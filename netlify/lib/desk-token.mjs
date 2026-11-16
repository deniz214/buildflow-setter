// A 12-hour pass handed out by desk-login: "<expiry ms>.<signature>".
// Signed with DESK_PASSWORD, so changing the password logs everyone out.
// (Kept outside netlify/functions so Netlify does not deploy it as a function.)

import crypto from "node:crypto";

const HOURS = 12;
const sign = (exp, secret) => crypto.createHmac("sha256", secret).update("desk:" + exp).digest("hex");

export const makeToken = (secret) => {
  const exp = Date.now() + HOURS * 3600e3;
  return `${exp}.${sign(exp, secret)}`;
};

export const tokenOk = (token, secret) => {
  const [exp, sig] = String(token || "").split(".");
  if (!secret || !exp || !sig || !(Number(exp) > Date.now())) return false;
  const want = Buffer.from(sign(exp, secret));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
};
