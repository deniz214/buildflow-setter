// SMS team inbox: everyone who replied to the text outreach.
//   left    the queue (New · Contacted · Booked · Removed), oldest reply first
//   middle  the live conversation: our texts, their replies, calls, internal comments
//   right   what to do next, and who they are

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bot, CalendarClock, CalendarPlus, Check, Inbox as InboxIcon, MessageSquareText, Phone, PhoneMissed, Search, Send, StickyNote, Trash2 } from "lucide-react";
import { Avatar, CallButtons, CountUp, LocalTime } from "../components/bits";
import { useStore } from "../lib/store";
import { fmtPhone, fmtTime, fmtWhen, rel, sameDay } from "../lib/time";

// Which tab a conversation sits in.
export const boxOf = (l) =>
  l.stage === "bad" ? "removed" : ["unconfirmed", "confirmed"].includes(l.stage) ? "booked" : l.touched ? "contacted" : "new";

const TABS = [
  { id: "new", label: "New", hint: "Replied to the outreach. Nobody has called or texted them yet. Work top to bottom." },
  { id: "contacted", label: "Contacted", hint: "Someone has called or texted. Keep going until they book or drop out." },
  { id: "booked", label: "Booked", hint: "On the calendar." },
  { id: "removed", label: "Removed", hint: "Opted out or not a fit. Never texted again." },
];
const READS = { positive: ["Interested", "green"], negative: ["Not right now", "grey"], neutral: ["Unclear", "amber"] };

export default function Inbox({ openLead }) {
  const { forWs, now, actions, smsBackend } = useStore();
  const all = forWs("sms");
  const [tab, setTab] = useState("new");
  const [q, setQ] = useState("");
  const [account, setAccount] = useState("all");
  const [selId, setSelId] = useState(null);

  const accounts = useMemo(() => [...new Set(all.map((l) => l.account).filter(Boolean))].sort(), [all]);
  const inScope = all.filter((l) => account === "all" || l.account === account);
  const counts = Object.fromEntries(TABS.map((t) => [t.id, inScope.filter((l) => boxOf(l) === t.id).length]));
  const needle = q.trim().toLowerCase();
  const list = inScope
    .filter((l) => boxOf(l) === tab)
    .filter((l) => !needle || `${l.name} ${l.phone} ${l.account}`.toLowerCase().includes(needle))
    .sort((a, b) => new Date(a.optInAt) - new Date(b.optInAt));
  const sel = list.find((l) => l.id === selId) || list[0] || null;

  const today = (iso) => iso && sameDay(new Date(iso), now, "America/New_York");
  const kpis = [
    { label: "New replies", value: counts.new, sub: "nobody has answered yet", tone: counts.new ? "hot" : "" },
    { label: "Still to call", value: inScope.filter((l) => l.status.due).length, sub: "interested, call due now", tone: "warn" },
    { label: "Replies today", value: inScope.filter((l) => today(l.optInAt)).length, sub: "since midnight Eastern" },
    { label: "Booked", value: counts.booked, sub: "on the calendar", tone: "good" },
  ];

  if (!all.length) {
    return (
      <div className="empty empty-lg">
        <span className="empty-tick is-plain"><MessageSquareText size={22} /></span>
        <strong>No SMS conversations yet.</strong>
        <p>{smsBackend === "ready"
          ? "Replies to your text outreach will land here the moment they come in."
          : "The SMS desk isn't connected to GoHighLevel yet. Once it is, every reply to your text outreach lands here. Add ?demo to the address to see it with placeholder conversations."}</p>
      </div>
    );
  }

  return (
    <div className="inbox">
      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi ${k.tone ? "is-" + k.tone : ""}`}>
            <span>{k.label}</span><b className="display"><CountUp value={k.value} /></b><small>{k.sub}</small>
          </div>
        ))}
      </div>

      <div className="inbox-grid">
        {/* queue */}
        <aside className="queue">
          <div className="queue-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "is-on" : ""} onClick={() => { setTab(t.id); setSelId(null); }}>
                {tab === t.id && <motion.i layoutId="queue-pill" className="queue-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span>{t.label}</span><em>{counts[t.id]}</em>
              </button>
            ))}
          </div>
          <div className="queue-tools">
            <label className="search"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" aria-label="Search conversations" /></label>
            <select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Sending account">
              <option value="all">All {accounts.length} accounts</option>
              {accounts.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <p className="queue-hint">{TABS.find((t) => t.id === tab).hint}</p>
          <div className="queue-list">
            {list.map((l) => {
              const last = [...l.messages].reverse().find((m) => m.dir === "in");
              const [read, tone] = READS[l.sentiment] || READS.neutral;
              return (
                <button key={l.id} className={`qitem ${sel && sel.id === l.id ? "is-on" : ""}`} onClick={() => setSelId(l.id)}>
                  <Avatar name={l.name} size={34} />
                  <span className="qitem-txt">
                    <span className="qitem-top"><b>{l.name}</b><em className="mono">{rel(new Date(l.optInAt), now).replace(" ago", "")}</em></span>
                    <small>{l.account}</small>
                    <span className="qitem-last">{last ? last.text : "No reply yet"}</span>
                    <span className={`chip chip-sm t-${tone}`}>{read}</span>
                  </span>
                </button>
              );
            })}
            {!list.length && <div className="queue-empty"><InboxIcon size={18} />Nothing here.</div>}
          </div>
        </aside>

        {sel ? <Thread key={sel.id} lead={sel} now={now} actions={actions} openLead={openLead} /> : <div className="thread thread-none">Pick a conversation to read it.</div>}
      </div>
    </div>
  );
}

function Thread({ lead: l, now, actions, openLead }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("text"); // text | note
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [l.messages.length]);

  const send = () => {
    const v = text.trim();
    if (!v) return;
    mode === "note" ? actions.addComment(l, v) : actions.sendText(l, v);
    setText("");
  };
  const due = l.status.due ? l.status.current : null;
  const [read] = READS[l.sentiment] || READS.neutral;
  const firstReply = l.messages.find((m) => m.dir === "in");

  // Day dividers between messages.
  const rows = [];
  let lastDay = "";
  l.messages.forEach((m, i) => {
    const d = fmtWhen(new Date(m.at), l.tz, now).replace(/ \d.*$/, "").replace(",", "");
    if (d !== lastDay) { rows.push({ divider: d, key: "d" + i }); lastDay = d; }
    rows.push({ ...m, key: "m" + i });
  });

  return (
    <>
      <section className="thread">
        <header className="thread-head">
          <Avatar name={l.name} size={40} />
          <div><b>{l.name}</b><small className="mono">{fmtPhone(l.phone)} · {l.account}</small></div>
          <span className="thread-time">Their time <LocalTime tz={l.tz} now={now} /></span>
        </header>
        <div className="thread-body">
          <AnimatePresence initial={false}>
            {rows.map((m) => m.divider ? <div key={m.key} className="tday"><span>{m.divider}</span></div> : (
              <motion.div key={m.key} className={`msg is-${m.dir} ${m.bot ? "is-bot" : ""}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                {m.dir === "note" && <span className="msg-tag"><StickyNote size={11} /> Internal comment{m.by ? ` · ${m.by}` : ""}</span>}
                {m.dir === "call" ? <span className="msg-call"><Phone size={13} /> {m.text}</span> : <p>{m.text}</p>}
                <span className="msg-meta mono">
                  {fmtTime(new Date(m.at), l.tz)}
                  {m.auto && <em>auto</em>}
                  {m.bot && <em className="is-bot"><Bot size={11} /> bot</em>}
                </span>
                {m.why && <span className="msg-why">Why: {m.why}</span>}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={end} />
        </div>
        <footer className="composer">
          <div className="composer-mode">
            <button className={mode === "text" ? "is-on" : ""} onClick={() => setMode("text")}><MessageSquareText size={14} /> Text</button>
            <button className={mode === "note" ? "is-on is-note" : ""} onClick={() => setMode("note")}><StickyNote size={14} /> Internal comment</button>
          </div>
          <div className={`composer-box ${mode === "note" ? "is-note" : ""}`}>
            <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={mode === "note" ? "Only your team sees this" : `Text ${l.name}`}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <button className={`btn ${mode === "note" ? "btn-soft" : "btn-ink"}`} disabled={!text.trim()} onClick={send}><Send size={15} /> {mode === "note" ? "Save" : "Send"}</button>
          </div>
        </footer>
      </section>

      <aside className="next">
        <div className="next-call"><CallButtons lead={l} big /></div>
        <div className="next-grid">
          <button className="btn btn-accent" onClick={() => openLead(l.id, "book")}><CalendarPlus size={15} /> Book call</button>
          <button className="btn btn-soft" onClick={() => actions.markCalled(l, due ? due.key : null, "no_pickup")}><PhoneMissed size={15} /> No answer</button>
          <button className="btn btn-soft" onClick={() => actions.markCalled(l, due ? due.key : null, "picked_up")}><Check size={15} /> Spoke</button>
          <button className="btn btn-soft next-remove" onClick={() => actions.setStage(l, "bad")}><Trash2 size={15} /> Remove</button>
        </div>

        {l.apptAt && ["unconfirmed", "confirmed"].includes(l.stage) && (
          <div className="next-note is-good"><CalendarClock size={15} /><span><b>Call {fmtWhen(new Date(l.apptAt), l.tz, now)}</b>{l.stage === "confirmed" ? "Confirmed." : "Booked, not confirmed yet."}</span></div>
        )}
        <div className="next-note">
          <span><b>{read}:</b> {firstReply ? `replied "${firstReply.text.slice(0, 60)}"` : "no reply yet"}.
            {l.noCall ? " Left out of the call pot." : due ? ` Call due: ${due.label.toLowerCase()}.` : ""}</span>
        </div>
        {l.bot && <div className="next-note is-bot"><Bot size={15} /><span><b>Booking bot:</b> {l.bot.why}</span></div>}

        <h4>Contact</h4>
        <dl className="next-facts">
          <div><dt>Business</dt><dd>{l.name}</dd></div>
          <div><dt>Phone</dt><dd className="mono">{fmtPhone(l.phone)}</dd></div>
          <div><dt>Sending account</dt><dd>{l.account}</dd></div>
        </dl>
        <div className="tags">{(l.tags || []).map((t) => <span key={t}>{t}</span>)}</div>
        <button className="btn btn-ghost next-open" onClick={() => openLead(l.id)}>Open full lead panel</button>
      </aside>
    </>
  );
}
