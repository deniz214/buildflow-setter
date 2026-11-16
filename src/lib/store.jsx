// App state.
//
//   B2B  live from Supabase (b2b_leads), scoped by B2B_SCOPE below.
//   B2C  starts empty. Clients are onboarded on the Clients page and their
//        leads arrive through each client's GHL webhook.
//
// Add ?demo to the address for placeholder leads, ?empty for an empty desk.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildSample } from "../data/sample";
import { buildSmsSample } from "../data/sampleSms";
import { statusOf, wallStr } from "./cadence";
import { STAGE } from "./stages";
import { fmtWhen } from "./time";
import * as live from "./live";

export const LIVE = live.LIVE;
const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
export const EMPTY = params.has("empty");
export const MODE = LIVE ? "live" : EMPTY ? "empty" : "demo";

// Desks that are switched on for real use. The others show as "Coming soon"
// in live mode and are fully open in ?demo.
export const LIVE_DESKS = ["b2b"];
export const deskOpen = (ws) => MODE !== "live" || LIVE_DESKS.includes(ws);

// Which B2B leads the desk starts with: opted in since Monday 9 Nov 2026
// (midnight Eastern), and only opt-ins, no-shows and needs-reschedule.
// Anything that gets booked or moved after go-live stays on the desk, so a lead
// never disappears the moment a setter books it.
export const B2B_SCOPE = {
  since: "2026-11-09T05:00:00Z",
  stages: ["optin", "noshow", "reschedule"],
  goLive: "2026-11-15T00:00:00Z",
};
const inScope = (l) => {
  if (!l.optInAt || l.optInAt < B2B_SCOPE.since) return false;
  if (B2B_SCOPE.stages.includes(l.stage)) return true;
  return (l.stageChangedAt || "") >= B2B_SCOPE.goLive || (l.bookedAt || "") >= B2B_SCOPE.goLive;
};

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [leads, setLeads] = useState(() => (MODE === "demo" ? [...buildSample(), ...buildSmsSample()] : []));
  // SMS desk: "demo" with placeholder conversations, otherwise not connected yet.
  const smsBackend = MODE === "demo" ? "demo" : "missing";
  const [clients, setClients] = useState(() => (MODE === "demo" ? [...new Set(buildSample().map((l) => l.client).filter(Boolean))].map((n) => ({ id: n, name: n, timezone: "ET", key: "demo", local: true })) : []));
  const [b2cBackend, setB2cBackend] = useState(MODE === "live" ? "checking" : "demo"); // ready | missing | demo
  const [loading, setLoading] = useState(MODE === "live");
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [toasts, setToasts] = useState([]);
  const [burst, setBurst] = useState(0);
  const [tally, setTally] = useState({ calls: 0, booked: 0 });
  const tid = useRef(0);

  const toast = useCallback((text, tone = "ink") => {
    const id = ++tid.current;
    setToasts((x) => [...x, { id, text, tone }]);
    setTimeout(() => setToasts((x) => x.filter((t) => t.id !== id)), tone === "bad" ? 6000 : 3200);
  }, []);

  const reload = useCallback(async () => {
    if (MODE !== "live") return;
    try {
      const [b2b, b2c] = await Promise.all([live.fetchB2B(B2B_SCOPE.since), live.fetchB2C()]);
      setLeads([...b2b.filter(inScope), ...b2c.leads]);
      setClients(b2c.clients);
      setB2cBackend(b2c.ready ? "ready" : "missing");
      setError("");
    } catch (e) {
      setError(e.message || "Couldn't load leads");
    } finally {
      setLoading(false);
      setNow(new Date());
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const t = setInterval(() => (MODE === "live" ? reload() : setNow(new Date())), MODE === "live" ? 60000 : 20000);
    return () => clearInterval(t);
  }, [reload]);

  const patch = (id, fn) => setLeads((ls) => ls.map((l) => (l.id === id ? fn(l) : l)));
  const stamp = () => new Date().toISOString();
  // Save to the database; if it fails, say so and reload the truth.
  const remote = useCallback(async (lead, fn) => {
    if (!lead.live) return true;
    try { await fn(); return true; } catch (e) { toast(`Not saved: ${e.message}`, "bad"); reload(); return false; }
  }, [toast, reload]);

  const actions = useMemo(() => { const actions = {
    reload,
    notify: toast,
    async logCall(lead, key, status) {
      if (lead.ws === "sms") return actions.markCalled(lead, key, status);
      const calls = { ...lead.calls, [key]: status };
      patch(lead.id, (l) => ({ ...l, calls, timeline: [...l.timeline, { at: stamp(), type: "call", text: status === "picked_up" ? "Called, picked up" : "Called, no answer" }] }));
      setTally((t) => ({ ...t, calls: t.calls + 1 }));
      setNow(new Date());
      if (status === "no_pickup") toast(`No answer logged for ${lead.name.split(" ")[0]}. Back in the pot at the next slot.`);
      await remote(lead, () => live.saveCalls(lead, calls));
    },
    async setStage(lead, stage) {
      if (lead.stage === stage) return;
      const at = stamp();
      patch(lead.id, (l) => ({ ...l, stage, stageAt: at, stageChangedAt: at, timeline: [...l.timeline, { at, type: "stage", text: `Moved to ${STAGE[stage].label}` }] }));
      setNow(new Date());
      toast(`${lead.name.split(" ")[0]} moved to ${STAGE[stage].label}`, stage === "show_close" || stage === "confirmed" ? "good" : "ink");
      if (stage === "show_close") setBurst((b) => b + 1);
      await remote(lead, () => live.saveStage(lead, stage));
    },
    async book(lead, iso) {
      if (lead.live) {
        try { await live.bookSlot(lead, iso); } catch (e) { toast(`Not booked: ${e.message}`, "bad"); return false; }
      }
      const at = stamp();
      patch(lead.id, (l) => ({
        ...l, stage: "unconfirmed", stageAt: at, bookedAt: at, stageChangedAt: at, apptAt: iso, apptWall: wallStr(new Date(iso), l.tz),
        rescheduled: l.apptAt ? l.rescheduled + 1 : l.rescheduled,
        timeline: [...l.timeline, { at, type: "book", text: `${l.apptAt ? "Rebooked" : "Booked"} for ${fmtWhen(new Date(iso), l.tz)}` }],
      }));
      setTally((t) => ({ ...t, booked: t.booked + 1 }));
      setNow(new Date());
      setBurst((b) => b + 1);
      toast(`Booked ${lead.name.split(" ")[0]} for ${fmtWhen(new Date(iso), lead.tz)}`, "good");
      if (lead.live) reload();
      return true;
    },
    async addNote(lead, text) {
      const at = stamp();
      if (!lead.live) return patch(lead.id, (l) => ({ ...l, notes: [{ at, text }, ...l.notes] }));
      const line = `[${fmtWhen(new Date(), "America/New_York")} ET] ${text}`;
      const notesText = lead.notesText ? `${line}\n${lead.notesText}` : line;
      patch(lead.id, (l) => ({ ...l, notesText }));
      if (await remote(lead, () => live.saveNotes(lead, notesText))) toast("Note saved");
    },
    /* ── SMS desk (placeholder conversations only until the GoHighLevel connection is live) ── */
    sendText(lead, text) {
      patch(lead.id, (l) => ({ ...l, touched: true, messages: [...l.messages, { dir: "out", text, at: stamp() }] }));
      toast(MODE === "demo" ? "Added to the thread (demo: nothing was actually sent)" : "Sent");
    },
    addComment(lead, text) {
      patch(lead.id, (l) => ({ ...l, messages: [...l.messages, { dir: "note", text, at: stamp(), by: "You" }] }));
    },
    markCalled(lead, key, status) {
      patch(lead.id, (l) => ({
        ...l, touched: true, calls: key ? { ...l.calls, [key]: status } : l.calls,
        messages: [...(l.messages || []), { dir: "call", text: status === "picked_up" ? "Outgoing call · spoke" : "Outgoing call · no answer", at: stamp() }],
      }));
      setTally((t) => ({ ...t, calls: t.calls + 1 }));
      setNow(new Date());
      toast(status === "picked_up" ? `Logged: spoke to ${lead.name}` : `No answer logged for ${lead.name}`);
    },
    async addClient(draft) {
      try {
        const c = await live.createClientRow(draft, b2cBackend === "ready");
        setClients((cs) => [...cs, c]);
        toast(`${c.name} added`, "good");
        return c;
      } catch (e) { toast(`Not saved: ${e.message}`, "bad"); return null; }
    },
    async removeClient(c) {
      try {
        await live.deleteClientRow(c, b2cBackend === "ready");
        setClients((cs) => cs.filter((x) => x.id !== c.id));
      } catch (e) { toast(`Not removed: ${e.message}`, "bad"); }
    },
  }; return actions; }, [toast, reload, remote, b2cBackend]);

  // Work out every lead's call status once per tick.
  const withStatus = useMemo(() => leads.map((l) => ({ ...l, status: statusOf(l, now) })), [leads, now]);

  const value = useMemo(() => ({
    leads: withStatus, clients, now, toasts, burst, actions, loading, error, b2cBackend, smsBackend,
    callsToday: tally.calls, bookedToday: tally.booked,
    forWs: (ws) => withStatus.filter((l) => l.ws === ws),
    dueCount: (ws) => withStatus.filter((l) => l.ws === ws && l.status.due).length,
  }), [withStatus, clients, now, toasts, burst, actions, loading, error, b2cBackend, tally]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
