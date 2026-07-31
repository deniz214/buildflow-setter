// src/SetterHub.jsx
//
// B2B Setter Hub — rebuilt in the B2C dialer "pot" style.
// Sections: Opt-Ins · Confirmations · ⏰ 30-Min Prior · All Leads.
// Only leads DUE for a call right now appear in the three pots; the card
// shows the call stage ("Day 2 · 1:00 PM call") and expands for full detail.
//
//   ✓ Called — picked up  -> lead leaves that pot (reached); on an
//                            unconfirmed appt it also promotes to Confirmed
//   ☎ Called — no answer  -> clears the lead until its next slot
// A brand-new opt-in pops immediately ("NEW OPT-IN · call now"), then follows
// the cadence. Missed slots self-heal: the card shows the FRESHEST due slot.
//
// Cadence (lead-local) — mirrors the b2b-cron Slack reminders:
//   Opt-In ............... call now + 9/1/4 for 3 days
//   Booked (Unconfirmed) . daily 9/1/4 until the appt + 2h & 1h before
//   Booked (Confirmed) ... 30 min before the appt
//
// "All Leads" keeps the stage dropdown and the appointment-time editor —
// appt_at is what arms every confirmation + 30-min reminder, here and in Slack.
//
// Needs 11_setter_calls.sql and 16_setter_commissions.sql.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const C = {
  bg: "#0f1115", panel: "#171a21", panel2: "#1d212b", border: "#262b36",
  text: "#e7e9ee", dim: "#8b909e", faint: "#5b606e",
  accent: "#5b8def", green: "#3ecf8e", red: "#f0616d", amber: "#e9b949", violet: "#a78bfa",
};

const STAGES = [
  "Opt-In", "Booked (Unconfirmed)", "Booked (Confirmed)", "Needs Reschedule",
  "Cancelled", "No Show", "Show + No Close", "Show + FUP", "Show + Close",
];
const TZ_IANA = { ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver", PT: "America/Los_Angeles" };
const TZ_ORDER = ["ET", "CT", "MT", "PT"];
const TZ_META = {
  ET: { label: "ET", full: "Eastern",  color: "#5b8def" },
  CT: { label: "CT", full: "Central",  color: "#3ecf8e" },
  MT: { label: "MT", full: "Mountain", color: "#e9b949" },
  PT: { label: "PT", full: "Pacific",  color: "#a78bfa" },
};

// Paste your B2B GHL sub-account location ID here as a fallback for leads
// whose row has no ghl_location_id (older rows). Leave "" to hide the link.
const GHL_LOCATION_FALLBACK = "";

const ghlLoc = (l) => l.ghl_location_id || GHL_LOCATION_FALLBACK;
// Opens the lead's conversation in GHL — where the setter calls / texts them.
const ghlChat = (l) => (ghlLoc(l) && l.ghl_contact_id)
  ? `https://app.gohighlevel.com/v2/location/${ghlLoc(l)}/conversations/conversations/${l.ghl_contact_id}` : null;
const telLink = (p) => { const d = String(p || "").replace(/[^\d+]/g, ""); return d ? `tel:${d}` : null; };

/* ---------- date helpers (DST-correct) ---------- */
const pad = (n) => String(n).padStart(2, "0");
function ord(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function partsInTz(iso, iana) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: iana, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = f.format(new Date(iso)).split("-").map(Number);
  return { y, m, d };
}
function addDays({ y, m, d }, n) {
  const b = new Date(Date.UTC(y, m - 1, d, 12));
  b.setUTCDate(b.getUTCDate() + n);
  return { y: b.getUTCFullYear(), m: b.getUTCMonth() + 1, d: b.getUTCDate() };
}
const dayKey = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
const dayNum = ({ y, m, d }) => y * 10000 + m * 100 + d;
function wallParts(date, iana) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: iana, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const o = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = p.value;
  let hh = parseInt(o.hour, 10); if (hh === 24) hh = 0;
  return { y: +o.year, m: +o.month, d: +o.day, hh, mm: +o.minute, ss: +o.second };
}
function zonedWallToUTC(y, m, d, hh, mm, iana) {
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  const seen = wallParts(new Date(guess), iana);
  const seenUTC = Date.UTC(seen.y, seen.m - 1, seen.d, seen.hh, seen.mm, seen.ss);
  return new Date(guess + (guess - seenUTC));
}
function apptInstant(lead) {
  const iana = TZ_IANA[lead.timezone];
  if (!iana || !lead.appt_at) return null;
  const m = String(lead.appt_at).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedWallToUTC(+m[1], +m[2], +m[3], +m[4], +m[5], iana);
}
function fmtDue(due, iana) {
  if (!iana) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: iana, weekday: "short", hour: "numeric", minute: "2-digit" }).format(due);
}
function relTime(due, now) {
  const diff = Math.round((due - now) / 60000);
  if (diff <= 0) return diff > -60 ? "due now" : `${Math.abs(Math.round(diff / 60))}h overdue`;
  if (diff < 60) return `in ${diff} min`;
  if (diff < 1440) return `in ${Math.round(diff / 60)}h`;
  return `in ${Math.round(diff / 1440)}d`;
}
/* appt_at is a naive wall-clock string "YYYY-MM-DDTHH:MM" in the LEAD's local
   timezone — same convention as the main tracker and ghl-appt-sync.js. */
function apptToInput(lead) {
  if (!lead.appt_at) return "";
  const m = String(lead.appt_at).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : "";
}
function inputToAppt(val) {
  const m = String(val).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : null;
}
function fmtApptLocal(lead) {
  const m = String(lead.appt_at || "").match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return "—";
  const s = `${m[3]}.${m[2]} ${m[4]}:${m[5]}`;
  return lead.timezone ? `${s} ${lead.timezone}` : s;
}

/* ---------- call cadence — mirrors b2b-cron.js ---------- */
const DAY_TIMES = [["0900", 9, "9:00 AM"], ["1300", 13, "1:00 PM"], ["1600", 16, "4:00 PM"]];

function slotsWithDue(lead) {
  const iana = TZ_IANA[lead.timezone];
  const out = [];
  if (lead.stage === "Opt-In") {
    out.push({ key: "optin|arrival", label: "NEW OPT-IN · call now", due: new Date(lead.opt_in_at || Date.now()), fresh: true });
    if (iana && lead.opt_in_at) {
      const start = partsInTz(lead.opt_in_at, iana);
      let n = 0;
      for (let day = 0; day < 3; day++) {
        const dp = addDays(start, day);
        for (const [code, hh, tl] of DAY_TIMES) {
          n++;
          out.push({
            key: `optin|${dayKey(dp)}|${code}`,
            label: day === 0 ? `Day 1 · ${ord(n)} call (${tl})` : `Day ${day + 1} Follow-Up · ${ord(n)} call (${tl})`,
            due: zonedWallToUTC(dp.y, dp.m, dp.d, hh, 0, iana),
          });
        }
      }
    }
  } else if (lead.stage === "Booked (Unconfirmed)") {
    const inst = apptInstant(lead);
    if (iana && inst) {
      const wall = String(lead.appt_at).slice(0, 16);
      out.push({ key: "unconf|arrival", label: "NEW BOOKING · confirm ASAP", due: new Date(lead.booked_at || Date.now()), fresh: true });
      let cursor = partsInTz(new Date().toISOString(), iana);
      const apptDay = partsInTz(inst.toISOString(), iana);
      for (let i = 0; i < 10 && dayNum(cursor) <= dayNum(apptDay); i++) {
        for (const [code, hh, tl] of DAY_TIMES) {
          const due = zonedWallToUTC(cursor.y, cursor.m, cursor.d, hh, 0, iana);
          if (due < inst) out.push({ key: `unconf|${wall}|${dayKey(cursor)}|${code}`, label: `Confirm · ${tl}`, due });
        }
        cursor = addDays(cursor, 1);
      }
      out.push({ key: `unconf|${wall}|2h`, label: "2h before appt", due: new Date(inst.getTime() - 2 * 3600e3) });
      out.push({ key: `unconf|${wall}|1h`, label: "1h before appt", due: new Date(inst.getTime() - 3600e3) });
    } else {
      out.push({ key: "unconf|arrival", label: "Confirm appt — call ASAP", due: new Date(), fresh: true });
    }
  } else if (lead.stage === "Booked (Confirmed)") {
    const inst = apptInstant(lead);
    if (inst) out.push({ key: `conf|${String(lead.appt_at).slice(0, 16)}|30m`, label: "30 min before appt", due: new Date(inst.getTime() - 30 * 60e3) });
  }
  return out;
}
function nextOpenSlot(lead) {
  const calls = lead.setter_calls || {};
  return slotsWithDue(lead).filter((s) => !calls[s.key]).sort((a, b) => a.due - b.due)[0] || null;
}
// The FRESHEST slot that is already due and untouched — what the pots show.
function dueOpenSlot(lead, now) {
  const calls = lead.setter_calls || {};
  const due = slotsWithDue(lead).filter((s) => !calls[s.key] && s.due.getTime() <= now).sort((a, b) => a.due - b.due);
  return due.length ? due[due.length - 1] : null;
}
const reachedIn = (lead, prefix) =>
  Object.entries(lead.setter_calls || {}).some(([k, v]) => v === "picked_up" && k.startsWith(prefix));
const isReached = (lead) => Object.values(lead.setter_calls || {}).includes("picked_up");

export default function SetterHub() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [section, setSection] = useState("optins");
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ full_name: "", phone: "", email: "", timezone: "ET", stage: "Opt-In", appt_at: "" });
  const [, setTick] = useState(0);
  const now = Date.now();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("b2b_leads").select("*");
    setLeads(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);

  async function tick(lead, slotKey, status) {
    const calls = { ...(lead.setter_calls || {}) };
    if (calls[slotKey] === status) delete calls[slotKey]; else calls[slotKey] = status;
    const patch = { setter_calls: calls };
    if (status === "picked_up" && lead.stage === "Booked (Unconfirmed)") patch.stage = "Booked (Confirmed)";
    await supabase.from("b2b_leads").update(patch).eq("id", lead.id);
    load();
  }
  async function setStage(lead, stage) {
    await supabase.from("b2b_leads").update({ stage }).eq("id", lead.id);
    load();
  }
  async function addLead() {
    if (!draft.phone && !draft.email) { window.alert("Need at least a phone or an email."); return; }
    const row = {
      full_name: draft.full_name || null,
      phone: draft.phone || null,
      email: draft.email || null,
      timezone: draft.timezone || null,
      stage: draft.stage,
      opt_in_at: new Date().toISOString(),
      setter_calls: {}, setter_sent: {},
    };
    if (draft.stage === "Booked (Unconfirmed)") {
      row.booked_at = new Date().toISOString();
      row.appt_at = draft.appt_at ? inputToAppt(draft.appt_at) : null;
    }
    const { error } = await supabase.from("b2b_leads").insert(row);
    if (error) { window.alert("Could not add lead: " + error.message); return; }
    setDraft({ full_name: "", phone: "", email: "", timezone: "ET", stage: "Opt-In", appt_at: "" });
    setShowAdd(false);
    load();
  }
  async function removeLead(lead) {
    if (!window.confirm(`Delete ${lead.full_name || "this lead"} permanently? This cannot be undone.`)) return;
    const { error } = await supabase.from("b2b_leads").delete().eq("id", lead.id);
    if (error) { window.alert("Could not delete: " + error.message); return; }
    load();
  }
  // Writes appt_at in the lead's local wall-clock format; "" clears it.
  async function setAppt(lead, inputVal) {
    const appt_at = inputVal ? inputToAppt(inputVal) : null;
    await supabase.from("b2b_leads").update({ appt_at }).eq("id", lead.id);
    load();
  }

  const stats = useMemo(() => {
    let calls = 0, pickups = 0, reached = 0;
    for (const l of leads) {
      const vals = Object.values(l.setter_calls || {});
      calls += vals.length;
      pickups += vals.filter((v) => v === "picked_up").length;
      if (vals.includes("picked_up")) reached += 1;
    }
    return { calls, pickups, reached };
  }, [leads]);

  const needle = q.trim().toLowerCase();
  const visible = needle ? leads.filter((l) => (l.full_name || "").toLowerCase().includes(needle)) : leads;

  /* ---- the three pots: only leads DUE right now ---- */
  const optPot = [];
  for (const l of visible) {
    if (l.stage !== "Opt-In" || reachedIn(l, "optin")) continue;
    const s = dueOpenSlot(l, now);
    if (s) optPot.push({ l, s });
  }
  const confPot = [];
  for (const l of visible) {
    if (l.stage !== "Booked (Unconfirmed)" || reachedIn(l, "unconf")) continue;
    const inst = apptInstant(l);
    if (inst && now >= inst.getTime()) continue; // appt already started
    const s = dueOpenSlot(l, now);
    if (s) confPot.push({ l, s });
  }
  const priorPot = visible
    .filter((l) => l.stage === "Booked (Confirmed)" || l.stage === "Booked (Unconfirmed)")
    .map((l) => { const inst = apptInstant(l); return { l, m: inst ? Math.round((inst.getTime() - now) / 60000) : null }; })
    .filter(({ m }) => m != null && m <= 30 && m > -15);

  const tzSort = (a, b) => TZ_ORDER.indexOf(a.l.timezone) - TZ_ORDER.indexOf(b.l.timezone);
  optPot.sort(tzSort); confPot.sort(tzSort);

  const activeLeads = useMemo(() => (
    [...visible].sort((a, b) => (b.opt_in_at || "").localeCompare(a.opt_in_at || ""))
  ), [visible]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>Setter Hub</h1>
          <p style={{ color: C.dim, marginTop: 6, marginBottom: 0, fontSize: 13.5 }}>
            Only leads due for a call show in the pots. · {leads.length} leads loaded
          </p>
          <p style={{ color: C.faint, marginTop: 4, marginBottom: 0, fontSize: 11.5 }}>
            Cadence: opt-ins call now + 9:00 AM / 1:00 PM / 4:00 PM local for 3 days · confirmations daily until the appt + 2h &amp; 1h before · 30 min before confirmed appts.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={{ ...inp, width: 200, marginTop: 0 }} />
          <button style={{ ...btnSecondary, background: showAdd ? C.accent : C.panel2, color: showAdd ? "#fff" : C.text }} onClick={() => setShowAdd((v) => !v)}>+ Add lead</button>
          <button style={btnSecondary} onClick={load}>Refresh</button>
        </div>
      </div>

      {showAdd && (
        <div style={{ marginTop: 16, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 15, maxWidth: 720 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Add a lead manually</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input placeholder="Full name" value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} style={{ ...inp, marginTop: 0 }} />
            <input placeholder="Phone (US)" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} style={{ ...inp, marginTop: 0 }} />
            <input placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={{ ...inp, marginTop: 0 }} />
            <select value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} style={{ ...inp, marginTop: 0 }}>
              {["ET", "CT", "MT", "PT"].map((t) => <option key={t} value={t}>{t} — {TZ_META[t].full}</option>)}
            </select>
            <select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })} style={{ ...inp, marginTop: 0 }}>
              {["Opt-In", "Booked (Unconfirmed)"].map((st) => <option key={st} value={st}>{st}</option>)}
            </select>
            {draft.stage === "Booked (Unconfirmed)" && (
              <input type="datetime-local" value={draft.appt_at} onChange={(e) => setDraft({ ...draft, appt_at: e.target.value })}
                title="Appointment time in the LEAD'S local time" style={{ ...inp, marginTop: 0, colorScheme: "dark" }} />
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={addLead} style={{ ...btnSecondary, background: C.green, color: "#0f1115", fontWeight: 700, border: "none" }}>Save lead</button>
            <button onClick={() => setShowAdd(false)} style={btnSecondary}>Cancel</button>
          </div>
          <div style={{ fontSize: 11, color: C.faint, marginTop: 8 }}>
            The timezone drives every call time and Slack reminder. A new opt-in pops in the pot immediately, then follows the 9:00 AM / 1:00 PM / 4:00 PM cadence.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <SectionBtn on={section === "optins"} onClick={() => setSection("optins")} label={`Opt-Ins (${optPot.length})`} />
        <SectionBtn on={section === "conf"} onClick={() => setSection("conf")} label={`Confirmations (${confPot.length})`} />
        <SectionBtn on={section === "prior"} onClick={() => setSection("prior")} label={`⏰ 30-Min Prior (${priorPot.length})`} tone={priorPot.length ? C.red : null} />
        <SectionBtn on={section === "all"} onClick={() => setSection("all")} label="All Leads" />
      </div>

      {loading ? <p style={{ color: C.dim, marginTop: 20 }}>Loading…</p> : (
        <>
          {section !== "all" && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10, maxWidth: 680 }}>
              {section === "optins" && (optPot.length
                ? optPot.map(({ l, s }) => <PotCard key={l.id} l={l} s={s} now={now} onTick={tick} onDelete={removeLead} />)
                : <Empty>No opt-in calls due right now. 🎉</Empty>)}
              {section === "conf" && (confPot.length
                ? confPot.map(({ l, s }) => <PotCard key={l.id} l={l} s={s} now={now} onTick={tick} conf setStage={setStage} onDelete={removeLead} />)
                : <Empty>No confirmation calls due right now. 🎉</Empty>)}
              {section === "prior" && (priorPot.length
                ? priorPot.map(({ l, m }) => <PriorCard key={l.id} l={l} m={m} setStage={setStage} />)
                : <Empty>No appointments starting within 30 minutes.</Empty>)}
            </div>
          )}

          {section === "all" && (
            <>
              <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
                <Stat label="Calls made" value={stats.calls} />
                <Stat label="Pickups" value={stats.pickups} tone={C.green} />
                <Stat label="Reached" value={stats.reached} tone={C.accent} />
              </div>
              <div style={{ marginTop: 24, overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr>{["Name", "Phone", "Stage", "Appt time", "Next call", "Chat", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {activeLeads.map((l) => {
                      const slot = nextOpenSlot(l);
                      const reached = isReached(l);
                      return (
                        <tr key={l.id}>
                          <td style={td}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>{l.full_name || "—"}<TzBadge tz={l.timezone} /></span></td>
                          <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{l.phone || "—"}</td>
                          <td style={td}>
                            <select value={l.stage || ""} onChange={(e) => setStage(l, e.target.value)} style={sel}>
                              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={td}><Appt lead={l} onSave={setAppt} /></td>
                          <td style={{ ...td, color: C.dim }}>
                            {reached ? <span style={{ color: C.green }}>✓ Reached</span> : slot ? <span>{slot.label} · <span style={{ color: C.faint }}>{relTime(slot.due.getTime(), now)}</span></span> : "—"}
                          </td>
                          <td style={td}>
                            {ghlChat(l)
                              ? <a href={ghlChat(l)} target="_blank" rel="noreferrer" style={{ ...linkBtn, padding: "3px 8px", fontSize: 11.5 }}>💬 Chat ↗</a>
                              : <span style={{ color: C.faint, fontSize: 11.5 }}>—</span>}
                          </td>
                          <td style={td}>
                            <span style={{ display: "flex", gap: 4 }}>
                              {slot && !reached && (
                                <>
                                  <button onClick={() => tick(l, slot.key, "picked_up")} style={tickBtn(false, C.green)} title="Picked up">✓</button>
                                  <button onClick={() => tick(l, slot.key, "no_pickup")} style={tickBtn(false, C.red)} title="No answer">✕</button>
                                </>
                              )}
                              <button onClick={() => removeLead(l)} style={tickBtn(false, C.red)} title="Delete lead">✕</button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {activeLeads.length === 0 && <tr><td style={{ ...td, color: C.faint }} colSpan={7}>No leads.</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- pot card: expand for detail, tick the call ---------- */
function PotCard({ l, s, now, onTick, conf, setStage, onDelete }) {
  const chat = ghlChat(l);
  const tel = telLink(l.phone);
  return (
    <details style={{ background: C.panel, border: `1px solid ${s.fresh ? C.green + "88" : C.amber + "44"}`, borderRadius: 12 }}>
      <summary style={{ listStyle: "none", cursor: "pointer", padding: "12px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{l.full_name || "—"}</span>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: C.dim }}>{l.phone || "—"}</span>
          <TzBadge tz={l.timezone} />
        </span>
        <span style={{ textAlign: "right" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: s.fresh ? C.green : C.amber }}>{s.label}</span>
          <span style={{ fontSize: 11, color: C.faint, marginLeft: 8 }}>{relTime(s.due.getTime(), now)}</span>
        </span>
      </summary>
      <div style={{ padding: "0 15px 13px", borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "5px 14px", fontSize: 12.5, marginTop: 10 }}>
          <span style={{ color: C.dim }}>Email</span><span>{l.email || "—"}</span>
          <span style={{ color: C.dim }}>Stage</span><span>{l.stage || "—"}</span>
          <span style={{ color: C.dim }}>Due</span><span>{fmtDue(s.due, TZ_IANA[l.timezone])} <span style={{ color: C.faint }}>(lead local)</span></span>
          {conf && <><span style={{ color: C.dim }}>Appt</span><span>{fmtApptLocal(l)}</span></>}
          {l.company && <><span style={{ color: C.dim }}>Company</span><span>{l.company}</span></>}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          {chat && <a href={chat} target="_blank" rel="noreferrer" style={linkBtn}>💬 Open chat in GHL ↗</a>}
          {tel && <a href={tel} style={linkBtn}>📞 Call {l.phone}</a>}
          {!chat && <span style={{ fontSize: 11, color: C.faint }}>no GHL contact linked</span>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button style={btn(C.green)} onClick={() => onTick(l, s.key, "picked_up")}>✓ Called — picked up</button>
          <button style={btn(C.faint)} onClick={() => onTick(l, s.key, "no_pickup")}>☎ Called — no answer</button>
          {conf && (
            <>
              <button style={btn(C.accent)} onClick={() => setStage(l, "Booked (Confirmed)")}>Mark confirmed</button>
              <button style={btn(C.red)} onClick={() => setStage(l, "Needs Reschedule")}>Needs reschedule</button>
            </>
          )}
          {onDelete && <button style={{ ...btn(C.red), marginLeft: "auto" }} title="Delete lead" onClick={() => onDelete(l)}>✕ Delete</button>}
        </div>
      </div>
    </details>
  );
}

function PriorCard({ l, m, setStage }) {
  const chat = ghlChat(l);
  const tel = telLink(l.phone);
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.red}66`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>{l.full_name || "—"}</span>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: C.dim, marginTop: 2 }}>{l.phone || "—"}</div>
          <div style={{ fontSize: 11.5, color: C.dim, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}><span>{l.stage}</span><TzBadge tz={l.timezone} /></div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: m <= 0 ? C.red : C.amber }}>{m <= 0 ? "starting now" : `in ${m} min`}</div>
          <div style={{ fontSize: 11.5, color: C.dim }}>{fmtApptLocal(l)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        {chat && <a href={chat} target="_blank" rel="noreferrer" style={linkBtn}>💬 Open chat in GHL ↗</a>}
        {tel && <a href={tel} style={linkBtn}>📞 Call {l.phone}</a>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button style={btn(C.accent)} onClick={() => setStage(l, "Show + No Close")}>Showed</button>
        <button style={btn(C.red)} onClick={() => setStage(l, "No Show")}>No Show</button>
      </div>
    </div>
  );
}

/* Inline appointment editor — entered as the lead's LOCAL time (matches the
   tracker + GHL sync). Saving writes appt_at, which re-arms the pots and the
   Slack reminders automatically. Stage is untouched. */
function Appt({ lead, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(apptToInput(lead));
  useEffect(() => { setVal(apptToInput(lead)); }, [lead.appt_at]);

  if (!editing) {
    const has = !!lead.appt_at;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
        <span style={{ color: has ? C.text : C.faint, fontSize: 12.5 }}>{has ? fmtApptLocal(lead) : "Not set"}</span>
        <button style={apptLink} onClick={() => { setVal(apptToInput(lead)); setEditing(true); }}>{has ? "Edit" : "Set"}</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
      <input type="datetime-local" value={val} onChange={(e) => setVal(e.target.value)} style={apptInput} />
      <button style={tickBtn(false, C.green)} title="Save" onClick={async () => { await onSave(lead, val); setEditing(false); }}>✓</button>
      <button style={tickBtn(false, C.faint)} title="Cancel" onClick={() => { setVal(apptToInput(lead)); setEditing(false); }}>✕</button>
      {lead.appt_at && (
        <button style={apptClear} title="Clear appointment time" onClick={async () => { await onSave(lead, ""); setEditing(false); }}>Clear</button>
      )}
    </div>
  );
}

function TzBadge({ tz }) {
  const meta = TZ_META[tz];
  if (!meta) return tz ? <span style={{ fontSize: 10.5, color: C.faint }}>{tz}</span> : null;
  return (
    <span title={meta.full + " Time"} style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 5,
      fontSize: 10.5, fontWeight: 700, lineHeight: 1.5,
      color: meta.color, background: meta.color + "1f", border: `1px solid ${meta.color}55`,
    }}>{meta.label}</span>
  );
}

function Stat({ label, value, tone, sub }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: tone || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const Empty = ({ children }) => <p style={{ color: C.faint, fontSize: 13.5 }}>{children}</p>;
function SectionBtn({ on, onClick, label, tone }) {
  return (
    <button onClick={onClick} style={{
      padding: "9px 16px", borderRadius: 9, fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
      background: on ? C.accent : C.panel, color: on ? "#fff" : (tone || C.text),
      border: `1px solid ${on ? C.accent : C.border}`,
    }}>{label}</button>
  );
}
const btn = (tone) => ({
  padding: "7px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
  background: "transparent", color: tone, border: `1px solid ${tone}66`,
});
const linkBtn = { display: "inline-block", padding: "5px 10px", borderRadius: 7, border: `1px solid ${C.accent}55`, background: "transparent", color: C.accent, fontSize: 12, fontFamily: "inherit", textDecoration: "none", cursor: "pointer", whiteSpace: "nowrap" };
const inp = { marginTop: 4, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
const sel = { padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12.5, fontFamily: "inherit" };
const btnSecondary = { padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" };
const th = { textAlign: "left", padding: "10px 12px", color: C.dim, fontSize: 11, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const td = { padding: "9px 12px", borderBottom: `1px solid ${C.border}`, color: C.text };
const apptLink = { padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: C.panel2, color: C.accent, fontSize: 11.5, fontFamily: "inherit", cursor: "pointer" };
const apptInput = { padding: "5px 7px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12, fontFamily: "inherit" };
const apptClear = { padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.red}66`, background: "transparent", color: C.red, fontSize: 11, fontFamily: "inherit", cursor: "pointer" };
function tickBtn(active, color) {
  return { width: 30, height: 26, borderRadius: 6, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", display: "grid", placeItems: "center", background: active ? color : "transparent", color: active ? "#0f1115" : color, border: `1px solid ${color}${active ? "" : "66"}` };
}
