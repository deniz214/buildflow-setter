// LIVE B2B data: the same Supabase table (b2b_leads) and the same agency-ops
// functions the current Setter Hub uses, so both apps stay in step and the
// Slack reminders keep working. Field formats are kept exactly as they are:
//
//   setter_calls   { "<slot key>": "picked_up" | "no_pickup" }
//   appt_at        the appointment as wall-clock digits in the LEAD's own time
//   stage          the tracker / GHL stage name
//
// Booking goes through b2b-slots / b2b-book, so no GHL token is in this app.

import { createClient } from "@supabase/supabase-js";
import { STAGES } from "./stages";
import { wallParts, zonedToUTC } from "./time";
import { deskFn } from "./token";

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();

// Live when the database settings are present. ?demo forces placeholder data.
export const LIVE = !!(URL_ && KEY) && !params.has("demo") && !params.has("empty");
const MODE_DEMO = !LIVE && !params.has("empty");
const supabase = LIVE ? createClient(URL_, KEY) : null;

const FN = "https://buildflowtracking.netlify.app/.netlify/functions";
const GHL_LOCATION = "w0QO7CqoWR6sxJImHI2m";
// Strategy-call calendars. Insurance leads book onto the IUL calendar.
const CALENDAR = { insurance: "XGN1TX8wex8W8CljAsaI", default: "64bfsRFtoPWOT5TLKiIq" };
const calendarFor = (lead) => (String(lead.niche || "").toLowerCase().startsWith("insurance") ? CALENDAR.insurance : CALENDAR.default);

const TZ_IANA = {
  ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver", PT: "America/Los_Angeles",
  AKT: "America/Anchorage", HAT: "Pacific/Honolulu",
};
const GHL_TO_ID = Object.fromEntries(STAGES.map((s) => [s.ghl, s.id]));
const ID_TO_GHL = Object.fromEntries(STAGES.map((s) => [s.id, s.ghl]));

const COLS = "id,niche,full_name,company,phone,email,timezone,stage,appt_at,opt_in_at,booked_at,stage_changed_at,notes,setter_calls,ghl_contact_id,lead_tier,jobs_per_month,budget_ok,ad_source";

const pad = (n) => String(n).padStart(2, "0");
const wallOf = (v) => {
  const m = String(v || "").match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? { str: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`, y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] } : null;
};

function toLead(r, ws = "b2b", client = null) {
  const tz = TZ_IANA[r.timezone] || TZ_IANA.ET;
  const w = wallOf(r.appt_at);
  const stage = GHL_TO_ID[r.stage] || "optin";
  const digits = String(r.phone || "").replace(/\D/g, "").slice(-10);
  return {
    id: r.id, ws, live: true, table: ws === "b2b" ? "b2b_leads" : "desk_leads",
    client: client ? client.name : undefined, clientId: client ? client.id : undefined,
    project: r.project || "", zip: r.postal_code || "", bookedAt: r.booked_at || "", stageChangedAt: r.stage_changed_at || "",
    name: String(r.full_name || "").trim() || "Unnamed lead", company: r.company || "", niche: r.niche || "Other",
    phone: digits, email: r.email || "", tz, tzKnown: !!TZ_IANA[r.timezone],
    tier: r.lead_tier || null, jobs: r.jobs_per_month || "", revenue: r.budget_ok || "", ad: r.ad_source || "",
    stage, rawStage: r.stage,
    optInAt: r.opt_in_at || r.booked_at || r.stage_changed_at,
    stageAt: (stage === "optin" ? r.opt_in_at : stage === "unconfirmed" ? r.booked_at || r.stage_changed_at : r.stage_changed_at || r.booked_at) || r.opt_in_at,
    apptAt: w ? zonedToUTC(w.y, w.mo, w.d, w.h, w.mi, tz).toISOString() : null,
    apptWall: w ? w.str : null,
    calls: r.setter_calls || {},
    notesText: r.notes || "",
    ghlUrl: r.ghl_contact_id ? `https://app.gohighlevel.com/v2/location/${GHL_LOCATION}/conversations/conversations/${r.ghl_contact_id}` : null,
    rescheduled: 0, notes: [], timeline: [],
  };
}

// Everything the setter can see. The table is larger than one page (1,000 rows).
export async function fetchB2B(since) {
  const out = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data, error } = await supabase.from("b2b_leads").select(COLS)
      .eq("setter_hidden", false).gte("opt_in_at", since).order("opt_in_at", { ascending: false }).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out.map((r) => toLead(r));
}

const update = async (lead, patch) => {
  const { error } = await supabase.from(lead.table).update(patch).eq("id", lead.id);
  if (error) throw new Error(error.message);
};

export const saveCalls = (lead, calls, alsoStage) =>
  update(lead, alsoStage ? { setter_calls: calls, stage: ID_TO_GHL[alsoStage] } : { setter_calls: calls });

export const saveStage = (lead, stage) => update(lead, { stage: ID_TO_GHL[stage] });

export const saveNotes = (lead, text) => update(lead, { notes: text });

// Open times on the GHL calendar for the next few days.
export async function fetchSlots(lead, days = 5) {
  const now = new Date();
  const r = await fetch(`${FN}/b2b-slots`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startMs: now.getTime(), endMs: now.getTime() + days * 86400000, timezone: lead.tz, calendarId: calendarFor(lead) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Calendar returned ${r.status}`);
  return (d.slots || []).map((s) => new Date(s));
}

// Creates the appointment in GHL and flips the lead to Booked (Unconfirmed).
export async function bookSlot(lead, iso) {
  const r = await fetch(`${FN}/b2b-book`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lead_id: lead.id, slot: iso, timezone: lead.tz, calendarId: calendarFor(lead) }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error === "slot_taken" ? "That time was just taken. Pick another." : d.error || `Booking failed (${r.status})`);
  return d;
}

export const wallString = (date, tz) => {
  const p = wallParts(date, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.hh)}:${pad(p.mm)}`;
};

/* ───────── B2C: homeowner leads from the onboarding hub ─────────
   Every company added in the hub (or on the desk's Clients page) shows up here
   on its own. Reads and writes go through this site's "homeowners" function,
   which holds the hub's dialer key, so no key is in the page. Calls, stages and
   notes land on the same lead row the hub's tracker, metrics and Slack
   reminders read, and the call schedule is the hub's own (callState), so a call
   ticked here silences the matching Slack reminder. */

const HUB_TO_DESK = {
  opt_in: "optin", booked_unconfirmed: "unconfirmed", booked_confirmed: "confirmed", reschedule_needed: "reschedule",
  no_show: "noshow", show_fup: "show_fup", show_close: "show_close", cancelled: "cancelled", dnd: "bad", fake_lead: "bad",
};
const DESK_TO_HUB = {
  optin: "opt_in", unconfirmed: "booked_unconfirmed", confirmed: "booked_confirmed", reschedule: "reschedule_needed",
  noshow: "no_show", show_fup: "show_fup", show_close: "show_close", cancelled: "cancelled", bad: "fake_lead",
};
export const HUB_STAGES = Object.keys(DESK_TO_HUB);

function hubLead(r) {
  const stage = HUB_TO_DESK[r.stage] || "bad";
  const open = r.booking && ["unconfirmed", "confirmed"].includes(stage);
  return {
    id: r.id, ws: "b2c", live: true, table: "hub",
    client: r.client, clientId: r.client_id, trade: r.trade || "remodeling",
    name: String(r.name || "").trim() && r.name !== "—" ? r.name : "Unnamed lead", company: "", niche: r.trade === "decks" ? "Decks" : "Remodeling",
    phone: String(r.phone_digits || "").replace(/\D/g, "").slice(-10), email: r.email || "", zip: r.zip || "",
    project: r.property_type || "", property: r.ownership || "", ad: r.ad_name || "",
    tz: r.tz || "America/New_York", tzKnown: !!r.tz,
    stage, rawStage: r.stage,
    optInAt: r.created_at, bookedAt: r.booked_at || "", stageChangedAt: "",
    stageAt: (stage === "optin" ? r.created_at : r.booked_at) || r.created_at,
    apptAt: open ? r.booking.start_time : null, apptWall: null,
    calls: r.setter_calls || {}, notesText: r.notes || "",
    ghlUrl: r.ghl_link || null, bookUrl: r.book_link || "",
    hubCall: r.call || {},
    rescheduled: 0, notes: [], timeline: [],
  };
}

export async function fetchB2C() {
  try {
    const d = await deskFn("homeowners");
    const clients = (d.clients || []).map((c) => ({ id: c.id, name: c.name, trade: c.trade || "remodeling", tz: c.tz || "" }));
    return { ready: true, clients, leads: (d.leads || []).map(hubLead) };
  } catch (e) {
    return { ready: false, clients: [], leads: [], error: e.message };
  }
}

const hubPost = (body) => deskFn("homeowners", body);
export const hubSaveCall = (lead, key, outcome) => hubPost({ action: "call", lead_id: lead.id, key, outcome });
export const hubSaveStage = (lead, stage) => hubPost({ action: "stage", lead_id: lead.id, stage: DESK_TO_HUB[stage] });
export const hubSaveNotes = (lead, text) => hubPost({ action: "notes", lead_id: lead.id, notes: text });

/* ───────── Clients (onboarding hub) ───────── */
export const fetchHubClients = () => deskFn("hub-admin").then((d) => d.clients || []);
export const saveHubClient = (client, isNew) => deskFn("hub-admin", { action: "save", client, isNew });
export const uploadLogo = (clientId, dataUrl) => deskFn("hub-admin", { action: "logo", client_id: clientId, data_url: dataUrl }).then((d) => d.url);
