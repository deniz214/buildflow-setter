// Time helpers. Everything a setter sees is in the LEAD's local time, so all
// wall-clock maths goes through Intl with an IANA zone (DST-correct).

export const MIN = 60 * 1000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const TZ_SHORT = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
};

export function wallParts(date, tz) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = p.value;
  let hh = parseInt(o.hour, 10);
  if (hh === 24) hh = 0;
  return { y: +o.year, m: +o.month, d: +o.day, hh, mm: +o.minute, ss: +o.second };
}

// The UTC instant at which a zone's wall clock reads y-m-d hh:mm.
export function zonedToUTC(y, m, d, hh, mm, tz) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const seen = wallParts(new Date(guess), tz);
  const seenUTC = Date.UTC(seen.y, seen.m - 1, seen.d, seen.hh, seen.mm, seen.ss);
  return new Date(guess + (guess - seenUTC));
}

export function addDays({ y, m, d }, n) {
  const b = new Date(Date.UTC(y, m - 1, d, 12));
  b.setUTCDate(b.getUTCDate() + n);
  return { y: b.getUTCFullYear(), m: b.getUTCMonth() + 1, d: b.getUTCDate() };
}

export const sameDay = (a, b, tz) => {
  const x = wallParts(a, tz), y = wallParts(b, tz);
  return x.y === y.y && x.m === y.m && x.d === y.d;
};

export const fmtTime = (date, tz) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(date);

export const fmtDay = (date, tz) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(date);

export function fmtWhen(date, tz, now = new Date()) {
  const t = fmtTime(date, tz);
  if (sameDay(date, now, tz)) return `Today ${t}`;
  if (sameDay(date, new Date(now.getTime() + DAY), tz)) return `Tomorrow ${t}`;
  if (sameDay(date, new Date(now.getTime() - DAY), tz)) return `Yesterday ${t}`;
  return `${fmtDay(date, tz)}, ${t}`;
}

export function hourLabel(h) {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:00 ${ap}`;
}

// "12 min ago", "in 3h"
export function rel(date, now) {
  const diff = Math.round((date - now) / MIN);
  const a = Math.abs(diff);
  const txt = a < 1 ? "now" : a < 60 ? `${a} min` : a < 1440 ? `${Math.round(a / 60)}h` : `${Math.round(a / 1440)}d`;
  if (a < 1) return "just now";
  return diff < 0 ? `${txt} ago` : `in ${txt}`;
}

export const initials = (name) =>
  String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

export const fmtPhone = (d) => {
  const s = String(d || "").replace(/\D/g, "").slice(-10);
  return s.length === 10 ? `(${s.slice(0, 3)}) ${s.slice(3, 6)}-${s.slice(6)}` : d || "";
};
