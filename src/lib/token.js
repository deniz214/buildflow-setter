// The 12-hour pass from desk-login. The server functions that reach the
// onboarding hub (homeowners, hub-admin) need it; it is not the password.
const KEY = "savant_desk_token";
export const saveToken = (t) => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* private mode */ } };
export const getToken = () => { try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; } };

// Calls one of this site's server functions with the pass.
export async function deskFn(name, body) {
  const r = await fetch(`/.netlify/functions/${name}`, {
    method: body ? "POST" : "GET",
    headers: { "x-desk-token": getToken(), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw Object.assign(new Error(d.error || `Server answered ${r.status}`), { status: r.status });
  return d;
}
