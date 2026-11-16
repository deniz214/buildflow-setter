// PLACEHOLDER SMS conversations (only shown with ?demo). Invented businesses.
// Shape of one conversation:
//   messages: { dir: "out" | "in" | "note" | "call", text, at, auto?, bot?, why?, by? }
//     out  = a text we sent      (auto = part of the blast, bot = the booking bot wrote it)
//     in   = their reply
//     note = internal comment, never sent to the lead
//     call = a logged call
//   sentiment: how the first reply reads ("positive" | "negative" | "neutral")
//   bot: what the after-hours bot did with it, and why

import { HOUR, MIN, DAY } from "../lib/time";

const ET = "America/New_York", CT = "America/Chicago", MT = "America/Denver", PT = "America/Los_Angeles";
const OPENER = "Hey, it's Deniz here, sorry for the random text. Found you guys on Google and thought I'd reach out.";
const OFFER = "Could you take on 2-3 more deck builds this month? You only pay when an appointment actually shows up.";

export function buildSmsSample(now = new Date()) {
  const t = now.getTime();
  const ago = (ms) => new Date(t - ms).toISOString();
  const ahead = (ms) => new Date(t + ms).toISOString();
  let n = 0;
  const blast = (ms) => [{ dir: "out", text: OPENER, at: ago(ms + 2 * MIN), auto: true }, { dir: "out", text: OFFER, at: ago(ms + 1 * MIN), auto: true }];
  const mk = (o) => {
    const replyAt = ago(o.replied);
    return {
      id: `sms-${++n}`, ws: "sms", calls: {}, notes: [], timeline: [], rescheduled: 0, touched: false,
      company: o.name, stage: "optin", optInAt: replyAt, stageAt: replyAt, noCall: o.sentiment === "negative",
      tags: [`contacted - sms`, `replied - sms`, `${o.sentiment} reply - sms`, o.niche || "deck builder"],
      ...o,
      messages: [...blast(o.replied + o.gap), ...o.thread.map(([dir, text, back, extra]) => ({ dir, text, at: ago(back), ...(extra || {}) }))],
    };
  };

  return [
    mk({ name: "Cedar Point Decks", account: "East Coast (704)", tz: ET, phone: "7045550191", sentiment: "positive", replied: 7 * MIN, gap: 40 * MIN,
      thread: [["in", "Sure, what's the catch", 7 * MIN]] }),
    mk({ name: "Ironwood Outdoor Builds", account: "Southeast (678)", tz: ET, phone: "6785550143", sentiment: "positive", replied: 52 * MIN, gap: 2 * HOUR,
      thread: [["in", "Yeah we could use more work. How does it work?", 52 * MIN]] }),
    mk({ name: "Lakeshore Deck & Fence", account: "Midwest (312)", tz: CT, phone: "3125550176", sentiment: "neutral", replied: 3 * HOUR, gap: 1 * HOUR,
      thread: [["in", "Who is this?", 3 * HOUR]] }),
    mk({ name: "High Desert Carpentry", account: "Mountain (720)", tz: MT, phone: "7205550112", sentiment: "negative", replied: 5 * HOUR, gap: 3 * HOUR,
      thread: [["in", "Not today", 5 * HOUR], ["note", "After-hours bot stopped: 'Not today' reads as a brush-off. Rule: we don't answer a no, so no reply was sent.", 1 * HOUR, { by: "Booking bot" }]],
      bot: { state: "silent", why: "'Not today' reads as a brush-off. Rule: never answer a no." } }),
    mk({ name: "Sunset Deck Co.", account: "West Coast (213)", tz: PT, phone: "2135550158", sentiment: "negative", replied: 6 * HOUR, gap: 2 * HOUR,
      thread: [["in", "Booked up for the month", 6 * HOUR]],
      bot: { state: "silent", why: "Says they're fully booked. No question asked, nothing to answer." } }),
    mk({ name: "Tri-County Decking", account: "East Coast (704)", tz: ET, phone: "9805550127", sentiment: "positive", replied: 15 * HOUR, gap: 4 * HOUR, touched: true,
      thread: [["in", "Sure", 15 * HOUR],
        ["out", "Great. I can show you how it works on a quick 15 minute call. Does tomorrow morning or afternoon suit you better?", 14.9 * HOUR, { bot: true, why: "Positive one-word reply after hours. Offered two time windows." }],
        ["in", "Morning", 14 * HOUR],
        ["out", "Perfect, I have 10:00 AM open. I'll send the invite to this number. Talk then!", 13.9 * HOUR, { bot: true, why: "Picked a window. Booked the first open morning slot." }]],
      stage: "unconfirmed", apptAt: ahead(16 * HOUR), stageAt: ago(13.9 * HOUR),
      bot: { state: "booked", why: "Booked for tomorrow 10:00 AM after two texts." } }),
    mk({ name: "Blackwater Deck Builders", account: "Southeast (678)", tz: ET, phone: "4045550164", sentiment: "positive", replied: 16 * HOUR, gap: 5 * HOUR,
      thread: [["in", "Yeah for sure. We partner with anyone who brings real jobs. What areas do you cover?", 16 * HOUR],
        ["out", "We run it in your own service area, so every homeowner is local to you. Want me to walk you through it on a quick call?", 15.9 * HOUR, { bot: true, why: "Asked a coverage question the playbook answers." }],
        ["in", "Depends on price. What do you charge per lead?", 15.5 * HOUR]],
      bot: { state: "needs_you", why: "Asked about price. Pricing is never discussed by text, so nothing was sent." } }),
    mk({ name: "Northgate Carpentry", account: "Midwest (312)", tz: CT, phone: "6305550139", sentiment: "neutral", replied: 17 * HOUR, gap: 3 * HOUR,
      thread: [["in", "I only pay after the homeowner pays me. Can you do that?", 17 * HOUR]],
      bot: { state: "needs_you", why: "Wants different payment terms. That's a decision for a person." } }),
    mk({ name: "Ridgeline Outdoor Living", account: "Mountain (720)", tz: MT, phone: "3035550183", sentiment: "positive", replied: 18 * HOUR, gap: 6 * HOUR,
      thread: [["in", "Interested, text me details", 18 * HOUR],
        ["out", "Will do. Easiest is a quick 15 minute call so you can see real numbers. Are mornings or afternoons better for you?", 17.9 * HOUR, { bot: true, why: "Asked for details. Steered toward a call." }]],
      bot: { state: "talking", why: "Waiting on their answer about a time." } }),
    mk({ name: "Harbor Town Decks", account: "East Coast (704)", tz: ET, phone: "8435550105", sentiment: "positive", replied: 1 * DAY + 2 * HOUR, gap: 4 * HOUR, touched: true,
      thread: [["in", "Sure, call me", 1 * DAY + 2 * HOUR], ["call", "Outgoing call · no answer", 1 * DAY + 1 * HOUR], ["call", "Outgoing call · completed · 4 min", 20 * HOUR]],
      stage: "confirmed", apptAt: ahead(22 * MIN), stageAt: ago(20 * HOUR), calls: {} }),
    mk({ name: "Stonebridge Builders", account: "West Coast (213)", tz: PT, phone: "8185550171", sentiment: "positive", replied: 1 * DAY + 5 * HOUR, gap: 2 * HOUR, touched: true,
      thread: [["in", "Maybe. Send info", 1 * DAY + 5 * HOUR], ["call", "Outgoing call · no answer", 1 * DAY + 4 * HOUR],
        ["out", "Tried calling just now. When's a good time for a quick 10 minute chat?", 1 * DAY + 4 * HOUR - MIN]] }),
    mk({ name: "Green Valley Fence & Deck", account: "Southeast (678)", tz: ET, phone: "7705550118", sentiment: "negative", replied: 1 * DAY + 8 * HOUR, gap: 3 * HOUR,
      thread: [["in", "STOP", 1 * DAY + 8 * HOUR]], stage: "bad", stageAt: ago(1 * DAY + 8 * HOUR),
      bot: { state: "silent", why: "Opt-out keyword. Removed, never texted again." } }),
    mk({ name: "Summit Deckworks", account: "Mountain (720)", tz: MT, phone: "8015550146", sentiment: "positive", replied: 2 * DAY, gap: 5 * HOUR, touched: true,
      thread: [["in", "Yes we do decks, what do you need", 2 * DAY], ["call", "Outgoing call · completed · 6 min", 1 * DAY + 20 * HOUR],
        ["note", "Good call. Runs one crew, wants 4 more builds a month. Booked for Thursday.", 1 * DAY + 20 * HOUR, { by: "Setter" }]],
      stage: "unconfirmed", apptAt: ahead(1 * DAY + 3 * HOUR), stageAt: ago(1 * DAY + 20 * HOUR) }),
    mk({ name: "Old Mill Carpentry", account: "Midwest (312)", tz: CT, phone: "4145550162", sentiment: "neutral", replied: 2 * DAY + 4 * HOUR, gap: 6 * HOUR, touched: true,
      thread: [["in", "Call my office", 2 * DAY + 4 * HOUR], ["call", "Outgoing call · no answer", 2 * DAY + 3 * HOUR]],
      bot: { state: "took_over", why: "A setter called this lead, so the bot stepped back." } }),
  ];
}
