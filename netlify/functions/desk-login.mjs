// Checks the team password on the server, so the password is never inside the page.
//   POST { password } -> 200 { ok: true } | 401 { ok: false }
// Env on THIS Netlify site: DESK_PASSWORD
//
// Honest limit: this keeps people out of the app. The lead data itself is still
// readable with the public database key, the same as the old Setter Hub, until
// the database lockdown (login + row-level security) is done.

import crypto from "node:crypto";
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
  return json(ok ? 200 : 401, { ok });
};
