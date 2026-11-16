// Booking bot log: every conversation the after-hours bot has touched, what it
// sent, and WHY it sent it or held back. Read-only. The bot's own texts are
// marked in each thread, with its reason underneath.

import { useState } from "react";
import { Bot, Phone, StickyNote } from "lucide-react";
import { CountUp } from "../components/bits";
import { useStore } from "../lib/store";
import { fmtTime, fmtWhen } from "../lib/time";

const STATES = [
  { id: "needs_you", label: "Needs you", tone: "red", hint: "Flagged for a person, nothing sent" },
  { id: "booked", label: "Booked", tone: "green", hint: "The bot booked the call" },
  { id: "talking", label: "Talking", tone: "blue", hint: "Waiting on the lead" },
  { id: "took_over", label: "Person took over", tone: "violet", hint: "A setter stepped in" },
  { id: "silent", label: "Stayed silent", tone: "grey", hint: "Nothing worth answering" },
];
const STATE = Object.fromEntries(STATES.map((s) => [s.id, s]));

export default function BotLog() {
  const { forWs, now } = useStore();
  const rows = forWs("sms").filter((l) => l.bot);
  const [filter, setFilter] = useState("all");
  const [selId, setSelId] = useState(null);
  const count = (id) => rows.filter((l) => l.bot.state === id).length;
  const list = rows.filter((l) => filter === "all" || l.bot.state === filter)
    .sort((a, b) => STATES.findIndex((s) => s.id === a.bot.state) - STATES.findIndex((s) => s.id === b.bot.state));
  const sel = list.find((l) => l.id === selId) || null;
  const botTexts = rows.reduce((n, l) => n + l.messages.filter((m) => m.bot).length, 0);

  return (
    <div className="botlog">
      <div className="bot-banner">
        <span className="bot-ico"><Bot size={20} /></span>
        <div>
          <b>The bot isn't switched on yet.</b>
          <p>This is the log it will fill. Planned rules: it only works outside setter hours, never answers a "no", never talks price, and hands anything unusual to a person with a note saying why.</p>
        </div>
        <span className="chip t-grey">Off</span>
      </div>

      <div className="kpis">
        <div className="kpi"><span>Conversations</span><b className="display"><CountUp value={rows.length} /></b><small>the bot has been in</small></div>
        <div className="kpi is-good"><span>Booked</span><b className="display"><CountUp value={count("booked")} /></b><small>calls it put on the calendar</small></div>
        <div className="kpi is-hot"><span>Needs you</span><b className="display"><CountUp value={count("needs_you")} /></b><small>flagged, nothing sent</small></div>
        <div className="kpi"><span>Texts sent</span><b className="display"><CountUp value={botTexts} /></b><small>written by the bot</small></div>
      </div>

      <div className="filters bot-filters">
        <button className={`fchip ${filter === "all" ? "is-on" : ""}`} onClick={() => setFilter("all")}>All <em>{rows.length}</em></button>
        {STATES.map((s) => (
          <button key={s.id} className={`fchip ${filter === s.id ? "is-on" : ""}`} title={s.hint} onClick={() => setFilter(s.id)}>{s.label} <em>{count(s.id)}</em></button>
        ))}
      </div>

      <div className="bot-grid">
        <div className="bot-list">
          {list.map((l) => (
            <button key={l.id} className={`bot-item ${sel && sel.id === l.id ? "is-on" : ""}`} onClick={() => setSelId(l.id)}>
              <span className="bot-item-top"><b>{l.name}</b><span className={`chip chip-sm t-${STATE[l.bot.state].tone}`}>{STATE[l.bot.state].label}</span></span>
              <small>{l.account} · {fmtWhen(new Date(l.optInAt), "America/New_York", now)} · {l.messages.filter((m) => m.bot).length} bot texts</small>
              <p>{l.bot.why}</p>
            </button>
          ))}
          {!list.length && <div className="queue-empty">Nothing in this filter.</div>}
        </div>
        <div className="bot-read">
          {!sel ? <p className="muted">Pick a conversation to read it.</p> : (
            <>
              <h3>{sel.name}</h3>
              <div className="thread-body is-flat">
                {sel.messages.map((m, i) => (
                  <div key={i} className={`msg is-${m.dir} ${m.bot ? "is-bot" : ""}`}>
                    {m.dir === "note" && <span className="msg-tag"><StickyNote size={11} /> Internal comment{m.by ? ` · ${m.by}` : ""}</span>}
                    {m.dir === "call" ? <span className="msg-call"><Phone size={13} /> {m.text}</span> : <p>{m.text}</p>}
                    <span className="msg-meta mono">{fmtTime(new Date(m.at), sel.tz)}{m.auto && <em>auto</em>}{m.bot && <em className="is-bot"><Bot size={11} /> bot</em>}</span>
                    {m.why && <span className="msg-why">Why: {m.why}</span>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
