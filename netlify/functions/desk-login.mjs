// Checks the team password on the server, so the password is never inside the page.
//   POST { password } -> 200 { ok: true, token } | 401 { ok: false }
// Env on THIS Netlify site: DESK_PASSWORD
//
// The token is a 12-hour pass signed with DESK_PASSWORD (see netlify/lib/desk-token.mjs).
// The homeowners function needs it, so the hub's dialer key never reaches the page.
//
// Honest limit: the B2B lead data is still readable with the public database
// key, the same as the old Setter Hub, until the database lockdown is done.

import crypto from "node:crypto";
import { makeToken } from "../lib/desk-token.mjs";

const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { ok: false });
  const expected = process.env.DESK_PASSWORD || "";
  if (!expected) return json(500, { ok: false, error: "DESK_PASSWORD is not set on this site" });
  let given = "";
  try { given = String(JSON.parse(event.body || "{}").password || ""); } catch { /* treated as wrong */ }
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  const ok = crypto.timingSafeEqual(a, b);
  if (!ok) await new Promise((r) => setTimeout(r, 600));   // slow down guessing
  return json(ok ? 200 : 401, ok ? { ok, token: makeToken(expected) } : { ok });
};
