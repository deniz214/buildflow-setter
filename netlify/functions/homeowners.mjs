// B2C (homeowner) leads for the desk, straight from the onboarding hub
// (schedule-estimate.netlify.app). Every company added in the hub's /admin
// dashboard shows up here on its own; nothing is set up on the desk side.
//
//   GET                                      -> the hub dialer's { clients, leads, ... }
//   POST { action: "call" | "stage" | "notes", lead_id, ... }  -> passed to the hub dialer
//
// Header x-desk-token: the pass from desk-login.
// Env on THIS Netlify site:
//   DESK_PASSWORD   (already set)
//   DIALER_KEY      the same value as DIALER_KEY on the estimate-funnel site
//   HUB_URL         optional, defaults to https://schedule-estimate.netlify.app

import { tokenOk } from "../lib/desk-token.mjs";

const HUB = (process.env.HUB_URL || "https://schedule-estimate.netlify.app").replace(/\/$/, "");
const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const ACTIONS = ["call", "stage", "notes"];

export const handler = async (event) => {
  const h = event.headers || {};
  if (!tokenOk(h["x-desk-token"], process.env.DESK_PASSWORD)) return json(401, { error: "Session expired. Lock the desk and log in again." });
  if (!process.env.DIALER_KEY) return json(500, { error: "DIALER_KEY is not set on this site" });

  let body;
  if (event.httpMethod === "POST") {
    try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad request" }); }
    if (!ACTIONS.includes(body.action)) return json(400, { error: "Unknown action" });
  } else if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" });

  try {
    const r = await fetch(`${HUB}/.netlify/functions/dialer`, {
      method: event.httpMethod,
      headers: { "x-dialer-key": process.env.DIALER_KEY, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    if (r.status === 401) return json(502, { error: "The hub refused the dialer key. Check DIALER_KEY matches the estimate-funnel site." });
    return { statusCode: r.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: text };
  } catch (e) {
    return json(502, { error: "Couldn't reach the onboarding hub: " + e.message });
  }
};
