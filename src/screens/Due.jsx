// Leads due: one structured call list. Only leads that need a call RIGHT NOW.
//
// Layout, top to bottom:
//   1. Summary strip: total due + a tab per pot (with counts)
//   2. Toolbar: search, how to group the list
//   3. The list: fixed columns, grouped (new leads first, then by time zone
//      or company), so 10 leads or 300 read the same way
//   4. Coming up next

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Building2, CalendarClock, CalendarPlus, Check, ChevronDown, PhoneMissed, Search, Zap } from "lucide-react";
import { Avatar, CallButtons, CountUp, DotTrack, LocalTime, Tier } from "../components/bits";
import { POTS } from "../lib/cadence";
import { clientTone } from "../data/sample";
import { useStore } from "../lib/store";
import { fmtTime, fmtWhen, rel } from "../lib/time";

const BOOKS = ["optins", "rebook"];
const ZONE_ORDER = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];
const ZONE_NAME = { "America/New_York": "Eastern", "America/Chicago": "Central", "America/Denver": "Mountain", "America/Los_Angeles": "Pacific", "America/Anchorage": "Alaska", "Pacific/Honolulu": "Hawaii" };
const zoneRank = (z) => { const i = ZONE_ORDER.indexOf(z); return i < 0 ? 99 : i; };
const GROUP_CAP = 50;

export default function Due({ ws, openLead, clientId, goClients }) {
  const { forWs, now, actions, clients: clientRows } = useStore();
  const mine = (l) => !clientId || (l.clientId || l.client) === clientId;
  const leads = forWs(ws).filter(mine);
  const pots = POTS[ws];
  const clients = useMemo(() => clientRows.map((c) => c.name), [clientRows]);

  const [pot, setPot] = useState("all");
  const [q, setQ] = useState("");
  const [groupBy, setGroupBy] = useState(ws === "b2c" ? "company" : "zone");
  const [closed, setClosed] = useState({});
  const [more, setMore] = useState({});

  const due = leads.filter((l) => l.status.due);
  const count = (id) => due.filter((l) => l.status.pot === id).length;
  const needle = q.trim().toLowerCase();
  const list = due
    .filter((l) => pot === "all" || l.status.pot === pot)
    .filter((l) => !needle || `${l.name} ${l.company || ""} ${l.client || ""} ${l.phone}`.toLowerCase().includes(needle));

  // Groups: brand-new leads first (speed matters most), then the rest.
  const keyOf = (l) => (ws === "b2c" ? l.client : ws === "sms" ? l.account : l.niche) || "Other";
  const byDue = (a, b) => a.status.current.at - b.status.current.at;
  const fresh = list.filter((l) => l.status.current.kind === "new").sort((a, b) => b.status.current.at - a.status.current.at);
  const rest = list.filter((l) => l.status.current.kind !== "new");
  const groups = [];
  if (fresh.length) groups.push({ id: "new", title: "New · call now", note: "Just came in", hot: true, items: fresh });
  if (groupBy === "none") {
    if (rest.length) groups.push({ id: "all", title: "Due", items: [...rest].sort(byDue) });
  } else if (groupBy === "company") {
    [...new Set(rest.map(keyOf))].sort().forEach((k) =>
      groups.push({ id: k, title: k, tone: ws === "b2c" ? clientTone(k, clients) : null, items: rest.filter((l) => keyOf(l) === k).sort(byDue) }));
  } else {
    [...new Set(rest.map((l) => l.tz))].sort((a, b) => zoneRank(a) - zoneRank(b)).forEach((z) =>
      groups.push({ id: z, title: ZONE_NAME[z] || z, note: `${fmtTime(now, z)} there now`, items: rest.filter((l) => l.tz === z).sort(byDue) }));
  }

  const upNext = leads
    .filter((l) => l.status.pot && !l.status.due && l.status.next && !l.status.reached)
    .sort((a, b) => a.status.next.at - b.status.next.at)
    .slice(0, 8);

  if (ws === "b2c" && !clientRows.length) {
    return (
      <div className="empty empty-lg">
        <span className="empty-tick is-plain"><Building2 size={22} /></span>
        <strong>No clients on the B2C desk yet.</strong>
        <p>Onboard a client and connect their GoHighLevel. Their opt-ins and bookings will show up here, ready to call.</p>
        <button className="btn btn-ink" onClick={goClients}>Onboard a client</button>
      </div>
    );
  }

  const tabs = [{ id: "all", label: "All due", n: due.length }, ...pots.map((p) => ({ id: p.id, label: p.label, n: count(p.id) }))];
  const activePot = pots.find((p) => p.id === pot);
  const groupOptions = ws === "b2c" ? [["company", "Company"], ["zone", "Time zone"], ["none", "None"]] : [["zone", "Time zone"], ["company", ws === "sms" ? "Account" : "Niche"], ["none", "None"]];

  return (
    <div className="due">
      {/* 1. summary strip */}
      <div className="due-strip">
        <div className="due-count">
          <b className="display"><CountUp value={due.length} /></b>
          <span>{due.length === 1 ? "call" : "calls"} due now</span>
        </div>
        <div className="due-tabs" role="tablist" aria-label="Call pots">
          {tabs.map((t) => (
            <button key={t.id} role="tab" aria-selected={pot === t.id} className={`due-tab ${pot === t.id ? "is-on" : ""}`} onClick={() => setPot(t.id)}>
              {pot === t.id && <motion.i layoutId={`due-tab-${ws}`} className="due-tab-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span>{t.label}</span><em className={t.n ? "" : "is-zero"}>{t.n}</em>
            </button>
          ))}
        </div>
      </div>

      {/* 2. toolbar */}
      <div className="due-tools">
        <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this list" aria-label="Search due leads" /></label>
        <div className="seg" role="group" aria-label="Group by">
          <span>Group by</span>
          {groupOptions.map(([id, label]) => (
            <button key={id} className={groupBy === id ? "is-on" : ""} onClick={() => setGroupBy(id)}>{label}</button>
          ))}
        </div>
        <p className="due-rule">{activePot ? <><b>{activePot.label}:</b> {activePot.rule}</> : "Call times are in each lead's own time zone"}</p>
      </div>

      {/* 3. the list */}
      <div className="dlist">
        <div className="drow dhead" aria-hidden="true">
          <span>Lead</span><span>Why now</span><span>Due</span><span>Today</span><span>Call</span><span className="dhead-out">Outcome</span>
        </div>

        {groups.map((g) => {
          const isClosed = closed[g.id];
          const cap = more[g.id] ? Infinity : GROUP_CAP;
          return (
            <section key={g.id} className={`dgroup ${g.hot ? "is-hot" : ""} ${g.tone ? "t-" + g.tone : ""}`}>
              <button className="dgroup-head" onClick={() => setClosed((c) => ({ ...c, [g.id]: !c[g.id] }))} aria-expanded={!isClosed}>
                <ChevronDown size={15} className={`chev ${isClosed ? "" : "is-open"}`} />
                {g.hot ? <Zap size={14} /> : g.tone ? <i className="dot" /> : null}
                <b>{g.title}</b><em>{g.items.length}</em>
                {g.note && <small>{g.note}</small>}
              </button>
              {!isClosed && g.items.slice(0, cap).map((l) => (
                <Row key={l.id} lead={l} now={now} ws={ws} clients={clients} showPot={pot === "all"} openLead={openLead} actions={actions} />
              ))}
              {!isClosed && g.items.length > cap && (
                <button className="dmore" onClick={() => setMore((m) => ({ ...m, [g.id]: true }))}>Show all {g.items.length}</button>
              )}
            </section>
          );
        })}

        {!list.length && (
          <div className="dempty">
            <span className="empty-tick"><Check size={20} strokeWidth={3} /></span>
            <strong>{needle ? "No match." : "All clear."}</strong>
            <p>{needle ? "Nobody due matches that search." : "Nobody here needs a call right now. They come back on their next slot."}</p>
          </div>
        )}
      </div>

      {/* 4. coming up */}
      {upNext.length > 0 && (
        <section className="upnext">
          <h3>Coming up next</h3>
          <div className="upnext-list">
            {upNext.map((l) => (
              <button key={l.id} className="upnext-row" onClick={() => openLead(l.id)}>
                <Avatar name={l.name} size={30} />
                <span className="upnext-name"><b>{l.name}</b><small>{l.ws === "b2c" ? l.client : l.company || l.niche}</small></span>
                <span className="upnext-slot">{l.status.next.label}</span>
                <span className="upnext-when mono">{rel(l.status.next.at, now)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const POT_SHORT = { optins: "Opt-in", unconfirmed: "Unconfirmed", prior: "Before call", rebook: "Rebook" };
const POT_TONE = { optins: "blue", unconfirmed: "amber", prior: "green", rebook: "violet" };

function Row({ lead: l, now, ws, clients, showPot, openLead, actions }) {
  const s = l.status, slot = s.current;
  const isNew = slot.kind === "new";
  const overdue = now - slot.at > 3 * 3600 * 1000;

  const positive = () => {
    if (s.pot === "unconfirmed") return actions.setStage(l, "confirmed");
    actions.logCall(l, slot.key, "picked_up");
    if (BOOKS.includes(s.pot)) openLead(l.id, "book");
  };
  const positiveLabel = s.pot === "unconfirmed" ? "Confirmed" : s.pot === "prior" ? "Reached" : "Picked up";

  return (
    <div className={`drow ${isNew ? "is-new" : ""}`}>
      <button className="dlead" onClick={() => openLead(l.id)} aria-label={`Open ${l.name}`}>
        <Avatar name={l.name} size={36} />
        <span className="dlead-txt">
          <b>{l.name} <Tier n={l.tier} /></b>
          {ws === "b2c"
            ? <span className={`client t-${clientTone(l.client, clients)}`}><i className="dot" />{l.client}</span>
            : <small>{l.ws === "sms" ? l.account : l.company || l.niche}</small>}
        </span>
      </button>
      <span className="dwhy">
        {showPot && <span className={`chip chip-sm t-${POT_TONE[s.pot]}`}>{POT_SHORT[s.pot]}</span>}
        <span className="dwhy-txt">{slot.label}{l.apptAt && !BOOKS.includes(s.pot) && <small><CalendarClock size={12} /> {fmtWhen(new Date(l.apptAt), l.tz, now)}</small>}</span>
      </span>
      <span className="ddue"><b className={`mono ${overdue ? "is-late" : ""}`}>{rel(slot.at, now)}</b><small><LocalTime tz={l.tz} now={now} /></small></span>
      <span><DotTrack today={s.today} /></span>
      <span><CallButtons lead={l} compact /></span>
      <span className="dout">
        <button className="btn btn-soft btn-sm" onClick={() => actions.logCall(l, slot.key, "no_pickup")}><PhoneMissed size={14} /> No answer</button>
        <button className="btn btn-accent btn-sm" onClick={positive}><Check size={14} strokeWidth={3} /> {positiveLabel}</button>
        {BOOKS.includes(s.pot)
          ? <button className="icon-btn" title="Book an appointment" aria-label="Book an appointment" onClick={() => openLead(l.id, "book")}><CalendarPlus size={17} /></button>
          : <span className="icon-gap" />}
      </span>
    </div>
  );
}
