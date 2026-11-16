// The desk: sidebar, top bar, and whichever page is open.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BookOpenText, Bot, Building2, Columns3, LogOut, MessagesSquare, PhoneCall, RefreshCw, Users } from "lucide-react";
import { CountUp, Logo, Ring } from "../components/bits";
import LeadDrawer from "../components/LeadDrawer";
import { clientTone } from "../data/sample";
import { MODE, deskOpen, useStore } from "../lib/store";
import { fmtTime } from "../lib/time";
import Due from "./Due";
import Pipeline from "./Pipeline";
import Leads from "./Leads";
import Scripts from "./Scripts";
import Clients from "./Clients";
import Inbox, { boxOf } from "./Inbox";
import BotLog from "./BotLog";

const CALL_GOAL = 40;
const ZONES = [["ET", "America/New_York"], ["CT", "America/Chicago"], ["MT", "America/Denver"], ["PT", "America/Los_Angeles"]];

const PAGES = {
  inbox: { label: "Inbox", icon: MessagesSquare, title: "Conversations", sub: "Everyone who replied to the text outreach. Read, reply, call, book." },
  bot: { label: "Booking bot", icon: Bot, title: "Booking bot", sub: "What the after-hours bot said, and why." },
  due: { label: "Leads due", icon: PhoneCall, title: "Leads due", sub: "Everyone who needs a call right now, in one place." },
  pipeline: { label: "Pipeline", icon: Columns3, title: "Pipeline", sub: "Drag a lead to move it. Stages mirror GoHighLevel." },
  leads: { label: "All leads", icon: Users, title: "All leads", sub: "Search everyone on this desk." },
  clients: { label: "Clients", icon: Building2, title: "Clients", sub: "Onboard a client and connect their GoHighLevel account." },
  scripts: { label: "Scripts", icon: BookOpenText, title: "Scripts", sub: "Every script in one place, easy to read mid-call." },
};
const NAV = { b2b: ["due", "pipeline", "leads", "scripts"], b2c: ["due", "pipeline", "leads", "clients", "scripts"], sms: ["inbox", "due", "pipeline", "bot", "leads", "scripts"] };
const HOME = { b2b: "due", b2c: "due", sms: "inbox" };
const CRUMB = { b2b: "B2B · Contractors", b2c: "B2C · Homeowners", sms: "SMS · Outreach" };
const MODE_LABEL = { live: "Live data", demo: "Placeholder data", empty: "Empty view" };

export default function Shell({ ws, onSwitch, onLock }) {
  const { dueCount, callsToday, bookedToday, now, leads, clients, loading, error, actions } = useStore();
  const [page, setPage] = useState(HOME[ws]);
  const [open, setOpen] = useState(null); // { id, focus }
  const [clientId, setClientId] = useState(null); // B2C: null = every client
  const nav = NAV[ws];

  useEffect(() => { setPage(HOME[ws]); }, [ws]);
  useEffect(() => { setOpen(null); }, [ws]);
  useEffect(() => { if (clientId && !clients.some((c) => c.id === clientId)) setClientId(null); }, [clients, clientId]);

  const openLead = (id, focus) => setOpen({ id, focus });
  const newSms = leads.filter((l) => l.ws === "sms" && boxOf(l) === "new").length;
  const lead = open ? leads.find((l) => l.id === open.id) : null;
  const P = PAGES[page];
  const names = clients.map((c) => c.name);
  const showClientBar = ws === "b2c" && ["due", "pipeline", "leads"].includes(page) && clients.length > 0;
  const pageProps = { ws, openLead, clientId: ws === "b2c" ? clientId : null, goClients: () => setPage("clients") };

  return (
    <motion.div className="shell" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <aside className="side-nav">
        <div className="nav-brand"><Logo /></div>

        <div className="ws-switch" role="tablist" aria-label="Desk" style={{ gridTemplateColumns: `repeat(${["b2b", "b2c", "sms"].filter(deskOpen).length}, 1fr)` }}>
          {["b2b", "b2c", "sms"].filter(deskOpen).map((w) => (
            <button key={w} role="tab" aria-selected={ws === w} className={ws === w ? "is-on" : ""} onClick={() => onSwitch(w)}>
              {ws === w && <motion.i layoutId="ws-pill" className="ws-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <span>{w.toUpperCase()}</span>
              {dueCount(w) > 0 && <em>{dueCount(w)}</em>}
            </button>
          ))}
        </div>

        <nav className="nav">
          {nav.map((id) => {
            const I = PAGES[id].icon;
            return (
              <button key={id} className={`nav-item ${page === id ? "is-on" : ""}`} onClick={() => setPage(id)}>
                {page === id && <motion.i layoutId="nav-pill" className="nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <I size={18} /><span>{PAGES[id].label}</span>
                {id === "due" && dueCount(ws) > 0 && <em className="badge">{dueCount(ws)}</em>}
                {id === "inbox" && newSms > 0 && <em className="badge">{newSms}</em>}
                {id === "clients" && clients.length > 0 && <em className="badge is-quiet">{clients.length}</em>}
              </button>
            );
          })}
        </nav>

        <div className="today">
          <div className="today-ring">
            <Ring value={callsToday} goal={CALL_GOAL} />
            <b><CountUp value={callsToday} /></b>
          </div>
          <div className="today-txt">
            <span>This session</span>
            <strong>{callsToday} of {CALL_GOAL} calls</strong>
            <small>{bookedToday} booked</small>
          </div>
        </div>
        <button className="nav-item nav-lock" onClick={onLock}><LogOut size={17} /><span>Lock</span></button>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <AnimatePresence mode="wait">
              <motion.div key={ws + page} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                <div className="crumb">{CRUMB[ws]}</div>
                <h1 className="display">{P.title}</h1>
                <p className="topbar-sub">{P.sub}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="topbar-right">
            <span className={`pill-sample is-${MODE}`}>{MODE === "live" && <i className="live-dot" />}{MODE_LABEL[MODE]}</span>
            {MODE === "live" && (
              <button className={`icon-btn ${loading ? "is-spin" : ""}`} onClick={actions.reload} title="Refresh" aria-label="Refresh"><RefreshCw size={16} /></button>
            )}
            <div className="clocks" aria-label="US time zones right now">
              {ZONES.map(([s, tz]) => <span key={s}><em>{s}</em><b className="mono">{fmtTime(now, tz)}</b></span>)}
            </div>
          </div>
        </header>

        {error && <div className="banner is-bad">Couldn't load leads: {error} <button className="btn btn-soft" onClick={actions.reload}>Try again</button></div>}

        {showClientBar && (
          <div className="filters filters-clients" role="tablist" aria-label="Client">
            <span className="filters-lbl">Client</span>
            <button className={`fchip ${!clientId ? "is-on" : ""}`} onClick={() => setClientId(null)}>All clients</button>
            {clients.map((c) => (
              <button key={c.id} className={`fchip t-${clientTone(c.name, names)} ${clientId === c.id ? "is-on" : ""}`} onClick={() => setClientId(c.id)}><i className="dot" />{c.name}</button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.section key={ws + page} className="page" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            {loading && !["scripts", "clients", "inbox", "bot"].includes(page) ? <div className="loading"><i /><i /><i /></div> : (
              <>
                {page === "due" && <Due {...pageProps} />}
                {page === "pipeline" && <Pipeline {...pageProps} />}
                {page === "leads" && <Leads {...pageProps} />}
                {page === "clients" && <Clients />}
                {page === "inbox" && <Inbox openLead={openLead} />}
                {page === "bot" && <BotLog />}
                {page === "scripts" && <Scripts ws={ws} />}
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {lead && <LeadDrawer key={lead.id} lead={lead} focus={open.focus} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}
