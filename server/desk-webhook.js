// netlify/functions/desk-webhook.js   (goes into the agency-ops repo; name is free there)
//
// One inbound link per B2C client. A GoHighLevel "Custom Webhook" action in the
// client's sub-account POSTs here and the lead lands on the setter desk under
// that client:
//
//   POST /.netlify/functions/desk-webhook?client=<webhook_key>
//   { "event": "optin" | "booked" | "confirmed" | "stage",
//     "contact_id", "full_name", "phone", "email", "postal_code", "timezone",
//     "appt_at": "<GHL appointment start>",      (booked / confirmed)
//     "stage":   "<GHL pipeline stage name>" }   (stage)
//
// Matching: contact_id first, then phone, then email, always inside that client.
// Always answers 200 so GHL never retries a bad payload into duplicates.
//
// Env (already on the agency-ops site, nothing new): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// NOT DEPLOYED AND NOT TESTED YET. Needs server/desk_schema.sql run first.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function sb(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json", Prefer: "return=representation", ...(opts.headers || {}) },
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`supabase ${r.status}: ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : [];
}

// Unresolved merge tags ("{{contact.phone}}") and blanks count as empty.
const clean = (v) => { const s = String(v == null ? "" : v).trim(); return !s || /\{\{.*\}\}/.test(s) || /^(null|undefined)$/i.test(s) ? "" : s; };
const digits = (v) => clean(v).replace(/\D/g, "").slice(-10);

const TZ_CODE = { "america/new_york": "ET", "america/chicago": "CT", "america/denver": "MT", "america/los_angeles": "PT", "america/phoenix": "MT" };
const tzCode = (v, fallback) => { const s = clean(v); return TZ_CODE[s.toLowerCase()] || (/^(ET|CT|MT|PT)$/.test(s) ? s : fallback); };

// GHL sends human-formatted dates, not ISO. Keep the wall-clock digits exactly
// as written (the lead's own time) and never let the server's clock reinterpret them.
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const p2 = (n) => String(n).padStart(2, "0");
function wallClock(v) {
  const s = clean(v);
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${p2(m[4])}:${m[5]}:00+00:00`;
  m = s.match(/([A-Za-z]{3})[a-z]*\.? (\d{1,2}),? (\d{4}),? (?:at )?(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
  if (m && MONTHS[m[1].toLowerCase()]) {
    let h = +m[4]; const ap = (m[6] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
    return `${m[3]}-${p2(MONTHS[m[1].toLowerCase()])}-${p2(m[2])}T${p2(h)}:${m[5]}:00+00:00`;
  }
  return null;
}

// GHL pipeline stage name -> desk stage. Keyword match because every client's
// pipeline words things slightly differently. Unknown names change nothing.
function mapStage(raw) {
  const s = clean(raw).toLowerCase();
  if (!s) return null;
  if (s.includes("no show") || s.includes("no-show")) return "No Show";
  if (s.includes("resched")) return "Needs Reschedule";
  if (s.includes("cancel")) return "Cancelled";
  if (s.includes("unconfirm")) return "Booked (Unconfirmed)";
  if (s.includes("confirm")) return "Booked (Confirmed)";
  if (s.includes("book")) return "Booked (Unconfirmed)";
  if (s.includes("won") || s.includes("close") || s.includes("sold")) return "Show + Close";
  if (s.includes("estimate") || s.includes("show")) return "Show + FUP";
  if (s.includes("new lead") || s.includes("opt")) return "Opt-In";
  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const key = clean((event.queryStringParameters || {}).client);
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { console.error("[desk-webhook] invalid JSON:", String(event.body || "").slice(0, 500)); return json(200, { ok: false, error: "invalid JSON" }); }

  try {
    const clients = key ? await sb(`desk_clients?webhook_key=eq.${encodeURIComponent(key)}&active=eq.true&select=id,name,timezone&limit=1`) : [];
    if (!clients.length) return json(200, { ok: false, error: "unknown client link" });
    const client = clients[0];

    const ghlId = clean(body.contact_id || body.ghl_contact_id);
    const phone = digits(body.phone), email = clean(body.email).toLowerCase();
    if (!ghlId && !phone && !email) return json(200, { ok: false, error: "need contact_id, phone or email" });

    const base = `desk_leads?client_id=eq.${client.id}&select=*&limit=1`;
    let found = ghlId ? await sb(`${base}&ghl_contact_id=eq.${encodeURIComponent(ghlId)}`) : [];
    if (!found.length && phone) found = await sb(`${base}&phone=eq.${phone}`);
    if (!found.length && email) found = await sb(`${base}&email=eq.${encodeURIComponent(email)}`);
    const lead = found[0];

    const ev = clean(body.event).toLowerCase() || "optin";
    const now = new Date().toISOString();
    const appt = wallClock(body.appt_at);
    const patch = {};
    for (const [col, val] of [["ghl_contact_id", ghlId], ["full_name", clean(body.full_name)], ["phone", phone], ["email", email], ["postal_code", clean(body.postal_code)], ["project", clean(body.project)]]) {
      if (val && (!lead || !lead[col])) patch[col] = val;
    }
    if (!lead || !lead.timezone) patch.timezone = tzCode(body.timezone, client.timezone);

    let stage = null;
    if (ev === "booked") { stage = "Booked (Unconfirmed)"; patch.booked_at = now; if (appt) patch.appt_at = appt; }
    else if (ev === "confirmed") { stage = "Booked (Confirmed)"; if (appt) patch.appt_at = appt; }
    else if (ev === "stage") stage = mapStage(body.stage);
    else if (!lead) stage = "Opt-In";   // an opt-in never pulls an existing lead backwards
    if (stage && (!lead || lead.stage !== stage)) { patch.stage = stage; patch.stage_changed_at = now; }

    if (lead) {
      if (Object.keys(patch).length) await sb(`desk_leads?id=eq.${lead.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      console.log(`[desk-webhook] ${client.name}: ${ev} -> updated ${lead.id}`);
      return json(200, { ok: true, lead_id: lead.id, updated: Object.keys(patch) });
    }
    const rows = await sb("desk_leads", { method: "POST", body: JSON.stringify({ client_id: client.id, stage: "Opt-In", opt_in_at: now, ...patch }) });
    console.log(`[desk-webhook] ${client.name}: ${ev} -> new lead ${rows[0].id}`);
    return json(200, { ok: true, lead_id: rows[0].id, created: true });
  } catch (e) {
    console.error("[desk-webhook]", e.message);
    return json(200, { ok: false, error: e.message });
  }
};
