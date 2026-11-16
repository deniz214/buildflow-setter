// Client onboarding from the desk's Clients page, saved into the onboarding hub
// (the same client list as schedule-estimate.netlify.app/admin).
//
//   GET                       -> { clients }           every client, CAPI tokens never included
//   POST { action: "save", client }                   create / update (merged over the saved row,
//                                                      so fields the desk doesn't show are kept)
//   POST { action: "logo", client_id, data_url }      -> { url } logo upload (PNG / JPG / WebP)
//
// Header x-desk-token: the pass from desk-login.
// Env on THIS Netlify site: DESK_PASSWORD, HUB_ADMIN_PASSWORD (= ADMIN_PASSWORD of the estimate-funnel site),
// optional HUB_URL.

import { tokenOk } from "../lib/desk-token.mjs";

const HUB = (process.env.HUB_URL || "https://schedule-estimate.netlify.app").replace(/\/$/, "");
const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });

// What a hub row looks like when POSTed back to clients-admin (its GET returns the same names).
const KEEP = ["id", "business_name", "owner_name", "calendar_url", "calendar_id", "time_zone", "pixel_id",
  "notify_email", "notify_phone", "public_phone", "public_email", "area_rules", "active",
  "landing_template", "quiz_focus", "brand_color", "button_color", "hero_image", "logo_url", "privacy_url",
  "trust_text", "quiz_bullets", "text_number", "license_text", "area_cities", "gallery_images", "region_name", "guide_webhook"];
// What the desk's form may change.
const EDITABLE = ["id", "business_name", "owner_name", "calendar_url", "calendar_id", "time_zone", "pixel_id", "capi_token",
  "notify_email", "notify_phone", "public_phone", "public_email", "area_rules", "active", "logo_url", "text_number",
  "quiz_focus", "guide_webhook"];

async function hub(path, init = {}) {
  const r = await fetch(`${HUB}/.netlify/functions/${path}`, {
    ...init, headers: { "x-admin-password": process.env.HUB_ADMIN_PASSWORD, ...(init.body ? { "Content-Type": "application/json" } : {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) throw Object.assign(new Error("The hub refused the admin password. Check HUB_ADMIN_PASSWORD matches ADMIN_PASSWORD on the estimate-funnel site."), { status: 502 });
  return { status: r.status, body };
}

export const handler = async (event) => {
  if (!tokenOk((event.headers || {})["x-desk-token"], process.env.DESK_PASSWORD)) return json(401, { error: "Session expired. Lock the desk and log in again." });
  if (!process.env.HUB_ADMIN_PASSWORD) return json(500, { error: "HUB_ADMIN_PASSWORD is not set on this site" });

  try {
    if (event.httpMethod === "GET") {
      const r = await hub("clients-admin");
      return json(r.status, r.body);
    }
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    let b;
    try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request" }); }

    if (b.action === "logo") {
      const r = await hub("upload-image", { method: "POST", body: JSON.stringify({ client_id: String(b.client_id || ""), kind: "logo", data_url: String(b.data_url || "") }) });
      return json(r.status, r.body);
    }
    if (b.action === "save") {
      const c = b.client || {};
      const id = String(c.id || "").trim().toLowerCase();
      const list = await hub("clients-admin");
      if (list.status !== 200) return json(list.status, list.body);
      const old = (list.body.clients || []).find((x) => x.id === id) || null;
      if (b.isNew && old) return json(409, { error: `The client ID "${id}" is already taken. Pick another.` });
      const row = {};
      if (old) for (const k of KEEP) if (old[k] !== undefined && old[k] !== null) row[k] = old[k];
      for (const k of EDITABLE) if (c[k] !== undefined) row[k] = c[k];
      row.id = id;
      const r = await hub("clients-admin", { method: "POST", body: JSON.stringify(row) });
      return json(r.status, r.body);
    }
    return json(400, { error: "Unknown action" });
  } catch (e) {
    return json(e.status || 502, { error: e.message || "Couldn't reach the onboarding hub" });
  }
};
