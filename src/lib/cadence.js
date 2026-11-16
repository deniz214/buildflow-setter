// Call cadence: who is due for a call right now, and why.
//
// All slot times are in the LEAD's local time.
//
//   B2B  Opt-in ............ call now, then 9 AM / 1 PM / 4 PM for 7 days,
//                            then once a day at 12 PM
//        Booked, unconfirmed same 9 / 1 / 4 every day until the appointment
//        Booked, confirmed .. one call 30 minutes before
//
//   B2C  Opt-in ............ same 9 / 1 / 4 rhythm
//        Booked, unconfirmed same 9 / 1 / 4 until the appointment
//        Booked, confirmed .. one call 1 hour before
//
// A missed slot self-heals: the card always shows the FRESHEST due slot, so a
// lead never stacks up three overdue calls.

import { DAY, HOUR, MIN, addDays, hourLabel, wallParts, zonedToUTC } from "./time";

// Slot keys match the current Setter Hub and the Slack reminder cron exactly
// ("optin|2026-11-15|0900", "unconf|<appt>|<day>|1300", "conf|<appt>|30m"), and
// calls are stored as { key: "picked_up" | "no_pickup" }, so a call ticked here
// also silences the matching Slack reminder.
const p2 = (n) => String(n).padStart(2, "0");
const dayStr = (d) => `${d.y}-${p2(d.m)}-${p2(d.d)}`;
export const wallStr = (date, tz) => { const p = wallParts(date, tz); return `${p.y}-${p2(p.m)}-${p2(p.d)}T${p2(p.hh)}:${p2(p.mm)}`; };
const apptKey = (lead) => lead.apptWall || (lead.apptAt ? wallStr(new Date(lead.apptAt), lead.tz) : "none");

export const CADENCE = {
  b2b: { times: [9, 13, 16], intenseDays: 7, afterHour: 12, priorMin: 30 },
  b2c: { times: [9, 13, 16], intenseDays: 7, afterHour: 12, priorMin: 60 },
  sms: { times: [9, 13, 16], intenseDays: 7, afterHour: 12, priorMin: 30 },
};

export const POTS = {
  b2b: [
    { id: "optins", stage: "optin", label: "Opt-ins", blurb: "Opted in, not booked yet", rule: "9 AM · 1 PM · 4 PM for 7 days, then 12 PM daily" },
    { id: "unconfirmed", stage: "unconfirmed", label: "Unconfirmed", blurb: "Booked, not confirmed yet", rule: "9 AM · 1 PM · 4 PM until they confirm" },
    { id: "prior", stage: "confirmed", label: "30 min prior", blurb: "Confirmed, call starts soon", rule: "One call 30 minutes before" },
    { id: "rebook", stage: "noshow", label: "Rebook", blurb: "No-shows and reschedules", rule: "9 AM · 1 PM · 4 PM for 7 days, then 12 PM daily, until they are rebooked" },
  ],
  sms: [
    { id: "optins", stage: "optin", label: "Replied", blurb: "Replied by text, not booked yet", rule: "Call now, then 9 AM · 1 PM · 4 PM for 7 days, then 12 PM daily" },
    { id: "unconfirmed", stage: "unconfirmed", label: "Unconfirmed", blurb: "Booked, not confirmed yet", rule: "9 AM · 1 PM · 4 PM until they confirm" },
    { id: "prior", stage: "confirmed", label: "30 min prior", blurb: "Confirmed, call starts soon", rule: "One call 30 minutes before" },
    { id: "rebook", stage: "noshow", label: "Rebook", blurb: "No-shows and reschedules", rule: "9 AM · 1 PM · 4 PM for 7 days, then 12 PM daily, until they are rebooked" },
  ],
  b2c: [
    { id: "optins", stage: "optin", label: "Opt-ins", blurb: "Opted in, not booked yet", rule: "9 AM · 1 PM · 4 PM for 7 days, then 12 PM daily" },
    { id: "unconfirmed", stage: "unconfirmed", label: "Unconfirmed", blurb: "Booked, not confirmed yet", rule: "9 AM · 1 PM · 4 PM until they confirm" },
    { id: "prior", stage: "confirmed", label: "1 hour prior", blurb: "Confirmed, estimate starts soon", rule: "One call 1 hour before" },
  ],
};

const REBOOK = ["noshow", "reschedule"];
// noCall: an SMS reply that reads as "no" stays in the inbox but is never put in the call pot.
export const potFor = (lead) =>
  lead.noCall && lead.stage === "optin" ? null :
  lead.ws !== "b2c" && REBOOK.includes(lead.stage) ? "rebook" :
  lead.stage === "optin" ? "optins" : lead.stage === "unconfirmed" ? "unconfirmed" : lead.stage === "confirmed" ? "prior" : null;

// Every slot for a lead's current stage, oldest first, up to `horizon` ahead.
export function slotsFor(lead, now, horizon = 3 * DAY) {
  const cfg = CADENCE[lead.ws];
  const out = [];
  const until = now.getTime() + horizon;

  if (lead.stage === "confirmed") {
    if (!lead.apptAt) return out;
    const at = new Date(new Date(lead.apptAt).getTime() - cfg.priorMin * MIN);
    out.push({ key: `conf|${apptKey(lead)}|${cfg.priorMin}m`, at, label: cfg.priorMin === 60 ? "1 hour before" : "30 min before", kind: "prior" });
    return out;
  }
  const rebook = potFor(lead) === "rebook";
  if (lead.stage !== "optin" && lead.stage !== "unconfirmed" && !rebook) return out;

  const start = new Date(lead.stageAt || lead.optInAt);
  const appt = lead.stage === "unconfirmed" && lead.apptAt ? new Date(lead.apptAt).getTime() : Infinity;
  const stamp = wallStr(start, lead.tz).slice(0, 10);
  const pre = lead.stage === "optin" ? "optin" : rebook ? `rebook|${stamp}` : `unconf|${apptKey(lead)}`;
  out.push({
    key: lead.stage === "optin" ? "optin|arrival" : rebook ? `${pre}|arrival` : "unconf|arrival", at: start, kind: "new", day: 1,
    label: lead.stage === "optin" ? (lead.ws === "sms" ? "Replied · call now" : "New opt-in · call now") : rebook ? (lead.stage === "noshow" ? "No show · call to rebook" : "Needs a new time · call now") : "New booking · confirm it",
  });

  const d0 = wallParts(start, lead.tz);
  for (let i = 0; i < 400; i++) {
    const day = addDays(d0, i);
    const hours = (lead.stage === "optin" || rebook) && i >= cfg.intenseDays ? [cfg.afterHour] : cfg.times;
    let past = false;
    for (const h of hours) {
      const at = zonedToUTC(day.y, day.m, day.d, h, 0, lead.tz);
      const t = at.getTime();
      if (t <= start.getTime()) continue;
      if (t >= appt) { past = true; break; }
      if (t > until) { past = true; break; }
      out.push({ key: `${pre}|${dayStr(day)}|${p2(h)}00`, at, kind: "slot", day: i + 1, hour: h, label: `Day ${i + 1} · ${hourLabel(h)}` });
    }
    if (past) break;
  }
  return out;
}

// One call per slot: has this slot been dealt with?
const logged = (lead, key) => (lead.calls || {})[key];

export function statusOf(lead, now) {
  const pot = potFor(lead);
  const cfg = CADENCE[lead.ws];
  const appt = lead.apptAt ? new Date(lead.apptAt) : null;
  const base = { pot, due: false, current: null, next: null, needsUpdate: false, slots: [], today: [] };

  // An appointment that has come and gone with no outcome logged.
  if ((lead.stage === "unconfirmed" || lead.stage === "confirmed") && appt && now - appt > 30 * MIN) {
    return { ...base, pot: null, needsUpdate: true };
  }
  if (!pot) return base;

  const slots = slotsFor(lead, now);
  const past = slots.filter((s) => s.at <= now);
  const current = past[past.length - 1] || null;
  const next = slots.find((s) => s.at > now) || null;
  const prefix = pot === "optins" ? "optin" : pot === "rebook" ? "rebook" : pot === "unconfirmed" ? "unconf" : `conf|${apptKey(lead)}`;
  const reached = Object.entries(lead.calls || {}).some(([k, v]) => v === "picked_up" && k.startsWith(prefix));

  let due = false;
  if (current && !logged(lead, current.key) && !reached) {
    due = pot === "prior" ? now - current.at < cfg.priorMin * MIN + 30 * MIN : true;
  }

  // Today's rhythm in the lead's own day, for the little dot track on a card.
  const here = wallParts(now, lead.tz);
  const today = slots
    .filter((s) => s.kind === "slot")
    .filter((s) => { const p = wallParts(s.at, lead.tz); return p.y === here.y && p.m === here.m && p.d === here.d; })
    .map((s) => {
      const c = logged(lead, s.key);
      return { ...s, state: c ? c : s.at > now ? "upcoming" : current && s.key === current.key && due ? "due" : "missed" };
    });

  const day = current ? current.day || 1 : 1;
  return { ...base, due, current, next, reached, slots, today, day, overdueMin: current ? Math.round((now - current.at) / MIN) : 0 };
}

export const priorLabel = (ws) => (CADENCE[ws].priorMin === 60 ? "1 hour prior" : "30 min prior");
export { HOUR };
