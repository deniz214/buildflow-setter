// src/SetterHub.jsx
//
// The setter's command center. Everything reads/writes b2b_leads, so it stays
// in sync with the rest of the software live.
//
//   • Stats:  earnings (from client commissions), calls made, pickups, reached
//   • Call queue: "Call now" (due/overdue) and "Up next" (upcoming), one row per
//     lead showing exactly who to call and when, with tick buttons
//   • Leads:  every active lead with a stage dropdown (auto-syncs) + call ticks
//
// Call schedule rules mirror the Slack scheduler:
//   Opt-In ............. call now + 9/1/4 local for 3 days
//   Booked (Unconfirmed) daily 9/1/4 until appt + 2h & 1h before
//   Booked (Confirmed) . 30 min before appt
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
const CALLING_STAGES = ["Opt-In", "Booked (Unconfirmed)", "Booked (Confirmed)"];
const TZ_IANA = { ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver", PT: "America/Los_Angeles" };

const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

/* ---------- date helpers ---------- */
const pad = (n) => String(n).padStart(2, "0");
function partsInTz(iso, iana) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: iana, year: "numeric", month: "2-digit", day: "2-digit" });
  const [y, m, d] = f.format(new Date(iso)).split("-").map(Number);
  return { y, m, d };
}
function addDays({ y, m, d }, n) {
  const b = new Date(Date.UTC(y, m - 1, d, 12)); b.setUTCDate(b.getUTCDate() + n);
  return { y: b.getUTCFullYear(), m: b.getUTCMonth() + 1, d: b.getUTCDate() };
}
const dayKey = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;
const dayNum = ({ y, m, d }) => y * 10000 + m * 100 + d;
function wallParts(date, iana) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: iana, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const o = {}; for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = p.value;
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
  return new Date(due).toLocaleString("en-US", { timeZone: iana || undefined, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function relTime(due, now) {
  const diff = due - now, abs = Math.abs(diff), h = Math.round(abs / 3600e3), m = Math.round(abs / 60e3);
  const t = abs < 3600e3 ? `${m}m` : abs < 36 * 3600e3 ? `${h}h` : `${Math.round(h / 24)}d`;
  return diff <= 0 ? `${t} overdue` : `in ${t}`;
}

const DAY_TIMES = [["0900", 9, "9 AM"], ["1300", 13, "1 PM"], ["1600", 16, "4 PM"]];

function slotsWithDue(lead) {
  const iana = TZ_IANA[lead.timezone];
  const out = [];
  if (lead.stage === "Opt-In") {
    out.push({ key: "optin|arrival", label: "Call now (new opt-in)", due: new Date(lead.opt_in_at || Date.now()) });
    if (iana && lead.opt_in_at) {
      const start = partsInTz(lead.opt_in_at, iana);
      for (let day = 0; day < 3; day++) {
        const dp = addDays(start, day);
        for (const [code, hh, tl] of DAY_TIMES) out.push({ key: `optin|${dayKey(dp)}|${code}`, label: `Day ${day + 1} · ${tl}`, due: zonedWallToUTC(dp.y, dp.m, dp.d, hh, 0, iana) });
      }
    }
  } else if (lead.stage === "Booked (Unconfirmed)") {
    const inst = apptInstant(lead);
    if (iana && inst) {
      const wall = String(lead.appt_at).slice(0, 16);
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
      out.push({ key: "unconf|arrival", label: "Confirm appt — call ASAP", due: new Date() });
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
const isReached = (lead) => Object.values(lead.setter_calls || {}).includes("picked_up");

export default function SetterHub() {
  const [leads, setLeads] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const now = Date.now();

  async function load() {
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("b2b_leads").select("*"),
      supabase.from("clients").select("id,name,setter_commission_amount,setter_commission_paid"),
    ]);
    setLeads(a.data || []);
    setClients(b.data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

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

  const stats = useMemo(() => {
    const earned = clients.reduce((s, c) => s + Number(c.setter_commission_amount || 0), 0);
    const paid = clients.filter((c) => c.setter_commission_paid).reduce((s, c) => s + Number(c.setter_commission_amount || 0), 0);
    let calls = 0, pickups = 0, reached = 0;
    for (const l of leads) {
      const c = l.setter_calls || {};
      const vals = Object.values(c);
      calls += vals.length;
      pickups += vals.filter((v) => v === "picked_up").length;
      if (vals.includes("picked_up")) reached += 1;
    }
    return { earned, paid, outstanding: earned - paid, clients: clients.length, calls, pickups, reached };
  }, [leads, clients]);

  const queue = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = [];
    for (const l of leads) {
      if (!CALLING_STAGES.includes(l.stage)) continue;
      if (isReached(l)) continue;
      if (needle && !(l.full_name || "").toLowerCase().includes(needle)) continue;
      const slot = nextOpenSlot(l);
      if (!slot) continue;
      rows.push({ lead: l, slot });
    }
    const nowRows = rows.filter((r) => r.slot.due.getTime() <= now).sort((a, b) => a.slot.due - b.slot.due);
    const nextRows = rows.filter((r) => r.slot.due.getTime() > now).sort((a, b) => a.slot.due - b.slot.due);
    return { nowRows, nextRows };
  }, [leads, q, now]);

  const activeLeads = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads
      .filter((l) => !needle || (l.full_name || "").toLowerCase().includes(needle))
      .sort((a, b) => (b.opt_in_at || "").localeCompare(a.opt_in_at || ""));
  }, [leads, q]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>Setter Hub</h1>
          <p style={{ color: C.dim, marginTop: 6, marginBottom: 0, fontSize: 14 }}>Your call queue, leads, and earnings — all live.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" style={{ ...inp, width: 200, marginTop: 0 }} />
          <button style={btnSecondary} onClick={load}>Refresh</button>
        </div>
      </div>

      {loading ? <p style={{ color: C.dim, marginTop: 20 }}>Loading…</p> : (
        <>
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
            <Stat label="Earned" value={usd(stats.earned)} tone={C.green} sub={`${stats.clients} clients × commission`} />
            <Stat label="Paid out" value={usd(stats.paid)} tone={C.accent} />
            <Stat label="Outstanding" value={usd(stats.outstanding)} tone={C.amber} />
            <Stat label="Calls made" value={stats.calls} />
            <Stat label="Pickups" value={stats.pickups} tone={C.green} />
          </div>

          <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, alignItems: "start" }}>
            <QueueCol title="Call now" tone={C.red} rows={queue.nowRows} now={now} onTick={tick} empty="Nobody due right now. Nice." />
            <QueueCol title="Up next" tone={C.accent} rows={queue.nextRows.slice(0, 25)} now={now} onTick={tick} empty="No upcoming calls scheduled." />
          </div>

          <div style={{ marginTop: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>All leads</h2>
            <div style={{ overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr>{["Name", "Phone", "Stage", "Next call", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {activeLeads.map((l) => {
                    const slot = nextOpenSlot(l);
                    const reached = isReached(l);
                    return (
                      <tr key={l.id}>
                        <td style={td}>{l.full_name || "—"}</td>
                        <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{l.phone || "—"}</td>
                        <td style={td}>
                          <select value={l.stage || ""} onChange={(e) => setStage(l, e.target.value)} style={sel}>
                            {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ ...td, color: C.dim }}>
                          {reached ? <span style={{ color: C.green }}>✓ Reached</span> : slot ? <span>{slot.label} · <span style={{ color: C.faint }}>{relTime(slot.due.getTime(), now)}</span></span> : "—"}
                        </td>
                        <td style={td}>
                          {slot && !reached && (
                            <span style={{ display: "flex", gap: 4 }}>
                              <button onClick={() => tick(l, slot.key, "picked_up")} style={tickBtn(false, C.green)} title="Picked up">✓</button>
                              <button onClick={() => tick(l, slot.key, "no_pickup")} style={tickBtn(false, C.red)} title="No answer">✕</button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {activeLeads.length === 0 && <tr><td style={{ ...td, color: C.faint }} colSpan={5}>No leads.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
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
function QueueCol({ title, tone, rows, now, onTick, empty }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: tone }}>{title}</span>
        <span style={{ fontSize: 12, color: C.faint }}>{rows.length}</span>
      </div>
      {rows.length === 0 && <div style={{ color: C.faint, fontSize: 13 }}>{empty}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map(({ lead, slot }) => (
          <div key={lead.id} style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lead.full_name || "—"}</div>
                {lead.phone && <div style={{ fontFamily: "monospace", fontSize: 12, marginTop: 2 }}>{lead.phone}</div>}
                <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{lead.stage}</div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "flex-start" }}>
                <button onClick={() => onTick(lead, slot.key, "picked_up")} style={tickBtn(false, C.green)} title="Picked up">✓</button>
                <button onClick={() => onTick(lead, slot.key, "no_pickup")} style={tickBtn(false, C.red)} title="No answer">✕</button>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: C.text }}>{slot.label}</div>
            <div style={{ fontSize: 10.5, color: tone }}>{relTime(slot.due.getTime(), now)} · {fmtDue(slot.due, TZ_IANA[lead.timezone])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const inp = { marginTop: 4, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" };
const sel = { padding: "6px 8px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 12.5, fontFamily: "inherit" };
const btnSecondary = { padding: "9px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 14, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" };
const th = { textAlign: "left", padding: "10px 12px", color: C.dim, fontSize: 11, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const td = { padding: "9px 12px", borderBottom: `1px solid ${C.border}`, color: C.text };
function tickBtn(active, color) {
  return { width: 30, height: 26, borderRadius: 6, fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer", display: "grid", placeItems: "center", background: active ? color : "transparent", color: active ? "#0f1115" : color, border: `1px solid ${color}${active ? "" : "66"}` };
}
