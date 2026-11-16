// netlify/functions/sms-webhook.js   (goes into the agency-ops repo; name is free there)
//
// GoHighLevel -> SMS desk. One link per sending sub-account. Two GHL workflows per
// sub-account POST here with a Custom Webhook action:
//
//   POST /.netlify/functions/sms-webhook?account=<webhook_key>
//   { "event": "outbound" | "inbound",
//     "contact_id": "{{contact.id}}", "business_name": "{{contact.company_name}}",
//     "full_name": "{{contact.name}}", "phone": "{{contact.phone}}",
//     "timezone": "{{contact.timezone}}", "tags": "{{contact.tags}}",
//     "message": "{{message.body}}", "message_id": "<optional GHL message id>" }
//
//   outbound  a text the outreach workflow sent   -> stored on the thread, marked "auto"
//   inbound   the contact replied                 -> stored; the FIRST reply puts them in
//             the inbox's New tab and reads the reply as positive / negative / neutral
//
// A lead only appears on the desk once they have replied. Always answers 200.
// Env (already on the site, nothing new): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// NOT DEPLOYED AND NOT TESTED YET. Needs server/sms_schema.sql run first.

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

const clean = (v) => { const s = String(v == null ? "" : v).trim(); return !s || /\{\{.*\}\}/.test(s) || /^(null|undefined)$/i.test(s) ? "" : s; };
const TZ_CODE = { "america/new_york": "ET", "america/chicago": "CT", "america/denver": "MT", "america/phoenix": "MT", "america/los_angeles": "PT" };

// First-pass read of a reply. Deliberately simple and conservative: anything that
// isn't clearly a yes or a no is "neutral" and still goes to a person.
const STOP = /^\s*(stop|unsubscribe|remove me|quit|cancel|end)\b/i;
const NO = /\b(no|nope|not interested|not today|not right now|booked up|too busy|slammed|don'?t (need|want)|wrong number|leave me alone)\b/i;
const YES = /\b(yes|yeah|yep|sure|ok(ay)?|interested|sounds good|tell me more|call me|how does it work|send (me )?(info|details))\b/i;
function readReply(text) {
  if (STOP.test(text)) return { sentiment: "negative", optOut: true };
  if (NO.test(text) && !YES.test(text)) return { sentiment: "negative" };
  if (YES.test(text)) return { sentiment: "positive" };
  return { sentiment: "neutral" };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const key = clean((event.queryStringParameters || {}).account);
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { console.error("[sms-webhook] invalid JSON:", String(event.body || "").slice(0, 500)); return json(200, { ok: false, error: "invalid JSON" }); }

  try {
    const accounts = key ? await sb(`sms_accounts?webhook_key=eq.${encodeURIComponent(key)}&active=eq.true&select=id,name&limit=1`) : [];
    if (!accounts.length) return json(200, { ok: false, error: "unknown account link" });
    const account = accounts[0];

    const contactId = clean(body.contact_id);
    const text = clean(body.message);
    const ev = clean(body.event).toLowerCase();
    if (!contactId || !text || !["inbound", "outbound"].includes(ev)) return json(200, { ok: false, error: "need event, contact_id and message" });

    const now = new Date().toISOString();
    const found = await sb(`sms_leads?account_id=eq.${account.id}&ghl_contact_id=eq.${encodeURIComponent(contactId)}&select=*&limit=1`);
    let lead = found[0];
    const tags = clean(body.tags).split(",").map((t) => t.trim()).filter(Boolean);

    if (!lead) {
      const rows = await sb("sms_leads", { method: "POST", body: JSON.stringify({
        account_id: account.id, ghl_contact_id: contactId,
        business_name: clean(body.business_name) || null, full_name: clean(body.full_name) || null,
        phone: clean(body.phone).replace(/\D/g, "").slice(-10) || null,
        timezone: TZ_CODE[clean(body.timezone).toLowerCase()] || null, tags, last_message_at: now,
      }) });
      lead = rows[0];
    }

    const msgId = clean(body.message_id) || null;
    try {
      await sb("sms_messages", { method: "POST", body: JSON.stringify({ lead_id: lead.id, dir: ev === "inbound" ? "in" : "out", body: text, sent_at: now, is_auto: ev === "outbound", ghl_message_id: msgId }) });
    } catch (e) {
      if (/23505|duplicate/i.test(e.message)) return json(200, { ok: true, duplicate: true });   // GHL retried the same message
      throw e;
    }

    const patch = { last_message_at: now };
    if (tags.length) patch.tags = tags;
    if (ev === "inbound" && !lead.first_reply_at) {
      const read = readReply(text);
      Object.assign(patch, { first_reply_at: now, sentiment: read.sentiment, no_call: read.sentiment === "negative", stage_changed_at: now });
      if (read.optOut) patch.stage = "Bad Lead";
    } else if (ev === "inbound" && STOP.test(text)) {
      Object.assign(patch, { stage: "Bad Lead", no_call: true, stage_changed_at: now });
    }
    await sb(`sms_leads?id=eq.${lead.id}`, { method: "PATCH", body: JSON.stringify(patch) });

    console.log(`[sms-webhook] ${account.name}: ${ev} for ${lead.id}`);
    return json(200, { ok: true, lead_id: lead.id });
  } catch (e) {
    console.error("[sms-webhook]", e.message);
    return json(200, { ok: false, error: e.message });
  }
};
