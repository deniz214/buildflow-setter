// After the password: pick the side you're working on.

import { motion } from "motion/react";
import { ArrowUpRight, LogOut } from "lucide-react";
import { CountUp, Logo } from "../components/bits";
import { deskOpen, useStore } from "../lib/store";

const SIDES = [
  // order: B2B, B2C, SMS
  {
    ws: "b2b", tag: "B2B", title: "Contractors",
    desc: "Deck builders who opted in for a strategy call. Work the opt-ins, confirm the bookings, keep the pipeline moving.",
  },
  {
    ws: "b2c", tag: "B2C", title: "Homeowners",
    desc: "Homeowners asking our clients for an estimate. Every lead shows which company it belongs to.",
  },
  {
    ws: "sms", tag: "SMS", title: "Outreach",
    desc: "Contractors who replied to the text outreach. Live conversations, a call pot, and the after-hours booking bot.",
  },
];

export default function Choose({ onPick, onLock }) {
  const { forWs, clients: clientRows } = useStore();

  return (
    <motion.div className="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <header className="choose-top">
        <div className="lock-brand"><Logo /></div>
        <button className="btn btn-ghost" onClick={onLock}><LogOut size={16} /> Lock</button>
      </header>

      <motion.div className="choose-head" initial={{ y: 18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.05, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}>
        <h1 className="display">Where are you working today?</h1>
        <p>Both desks run on the same rhythm. You can switch any time from the sidebar.</p>
      </motion.div>

      <div className="choose-grid">
        {SIDES.map((s, i) => {
          const leads = forWs(s.ws);
          const due = leads.filter((l) => l.status.due).length;
          const optins = leads.filter((l) => l.stage === "optin").length;
          const booked = leads.filter((l) => l.stage === "unconfirmed" || l.stage === "confirmed").length;
          const clients = clientRows.map((c) => c.name);
          return (
            <motion.button key={s.ws} className={`side ${deskOpen(s.ws) ? "" : "is-soon"}`} disabled={!deskOpen(s.ws)} onClick={() => onPick(s.ws)}
              initial={{ y: 28, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.14 + i * 0.09, type: "spring", stiffness: 180, damping: 22 }}
              whileHover={deskOpen(s.ws) ? { y: -6 } : {}} whileTap={deskOpen(s.ws) ? { scale: 0.985 } : {}}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}>
              <div className="side-top">
                <span className="side-tag">{s.tag}</span>
                {deskOpen(s.ws) ? <span className="side-arrow"><ArrowUpRight size={20} /></span> : <span className="side-soon">Coming soon</span>}
              </div>
              <div className="side-art">{s.ws === "b2b" ? <PipelineArt /> : s.ws === "sms" ? <ChatArt /> : <ClientsArt names={clients} />}</div>
              <h2 className="display">{s.title}</h2>
              <p>{s.desc}</p>
              <div className="side-stats">
                <div className={`side-stat ${due ? "is-hot" : ""}`}>
                  <b className="display">{due > 0 && <i className="pulse" />}<CountUp value={due} /></b>
                  <span>calls due now</span>
                </div>
                <div className="side-stat"><b className="display"><CountUp value={optins} /></b><span>{s.ws === "sms" ? "replies" : "opt-ins"}</span></div>
                <div className="side-stat"><b className="display"><CountUp value={booked} /></b><span>booked</span></div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

// SMS card graphic: a short text exchange.
function ChatArt() {
  const rows = [["out", 150], ["in", 70], ["out", 110]];
  return (
    <div className="art-chat">
      {rows.map(([d, w], i) => (
        <motion.span key={i} className={`is-${d}`} style={{ width: w }} initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.4 + i * 0.14, type: "spring", stiffness: 220, damping: 18 }} />
      ))}
    </div>
  );
}

// B2B card graphic: a tiny pipeline, bars growing in.
function PipelineArt() {
  const bars = [72, 54, 40, 30, 22, 14];
  return (
    <div className="art-pipe">
      {bars.map((h, i) => (
        <motion.span key={i} className={i === 2 ? "is-accent" : ""} initial={{ height: 6 }} animate={{ height: h }}
          transition={{ delay: 0.35 + i * 0.07, type: "spring", stiffness: 140, damping: 14 }} />
      ))}
    </div>
  );
}

// B2C card graphic: the client companies whose leads are in the desk.
function ClientsArt({ names }) {
  return (
    <div className="art-clients">
      {names.slice(0, 4).map((n, i) => (
        <motion.span key={n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.08 }}>
          <i className={`dot c${i}`} />{n}
        </motion.span>
      ))}
    </div>
  );
}
