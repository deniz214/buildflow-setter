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

/* ───────── B2C: clients and their leads ─────────
   Tables desk_clients / desk_leads are created by server/desk_schema.sql and
   filled by the desk-webhook function. Until that SQL has been run, clients are
   kept in this browser only so the onboarding flow can still be tried. */

const LOCAL_CLIENTS = "savant_desk_clients_local";
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_CLIENTS) || "[]"); } catch { return []; } };
const writeLocal = (v) => { try { localStorage.setItem(LOCAL_CLIENTS, JSON.stringify(v)); } catch { /* private mode */ } };
const randomKey = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
const toClient = (r, local = false) => ({ id: r.id, name: r.name, timezone: r.timezone || "ET", key: r.webhook_key, ghlLocation: r.ghl_location_id || "", createdAt: r.created_at, local });

export const webhookUrl = (client) => `${FN}/desk-webhook?client=${client.key}`;

export async function fetchB2C() {
  const cl = await supabase.from("desk_clients").select("*").eq("active", true).order("created_at");
  if (cl.error) return { ready: false, clients: readLocal().map((r) => toClient(r, true)), leads: [] };
  const clients = cl.data.map((r) => toClient(r));
  const byId = Object.fromEntries(clients.map((c) => [c.id, c]));
  const ld = await supabase.from("desk_leads").select("*").order("opt_in_at", { ascending: false }).limit(2000);
  if (ld.error) throw new Error(ld.error.message);
  return { ready: true, clients, leads: ld.data.filter((r) => byId[r.client_id]).map((r) => toLead(r, "b2c", byId[r.client_id])) };
}

export async function createClientRow(draft, ready) {
  const row = { name: draft.name.trim(), timezone: draft.timezone, ghl_location_id: draft.ghlLocation.trim() || null };
  if (!ready) {
    const r = { ...row, id: `local-${randomKey()}`, webhook_key: randomKey(), created_at: new Date().toISOString() };
    writeLocal([...readLocal(), r]);
    return toClient(r, true);
  }
  const { data, error } = await supabase.from("desk_clients").insert(row).select().single();
  if (error) throw new Error(error.message);
  return toClient(data);
}

export async function deleteClientRow(client, ready) {
  if (client.local || !ready) return writeLocal(readLocal().filter((r) => r.id !== client.id));
  const { error } = await supabase.from("desk_clients").update({ active: false }).eq("id", client.id);
  if (error) throw new Error(error.message);
}
