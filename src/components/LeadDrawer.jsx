// The lead panel: everything a setter does with one lead while on the phone.
// Log the call, book them in, move the stage, write notes.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, CalendarPlus, Check, Copy, ExternalLink, Mail, Phone, PhoneMissed, RefreshCcw, X } from "lucide-react";
import { Avatar, CallButtons, LocalTime, StageChip, Tier } from "./bits";
import { B2C_STAGES, STAGES } from "../lib/stages";
import { useStore } from "../lib/store";
import { fetchSlots } from "../lib/live";
import { TZ_SHORT, addDays, fmtPhone, fmtTime, fmtWhen, rel, wallParts, zonedToUTC } from "../lib/time";

export default function LeadDrawer({ lead: l, focus, onClose }) {
  const { actions, now } = useStore();
  const s = l.status;
  const bookRef = useRef(null);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const stages = (l.ws === "b2c" ? STAGES.filter((x) => B2C_STAGES.includes(x.id)) : STAGES).filter((x) => !x.legacy || x.id === l.stage);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  useEffect(() => {
    if (focus === "book") setTimeout(() => bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 320);
  }, [focus]);

  const saveNote = () => {
    if (!note.trim()) return;
    actions.addNote(l, note.trim());
    setNote("");
  };
  const copy = () => {
    navigator.clipboard?.writeText(l.phone).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1400);
  };

  const facts = l.ws === "sms"
    ? [["Business", l.name], ["Sending account", l.account], ["First reply", (l.messages.find((m) => m.dir === "in") || {}).text], ["Reads as", l.sentiment]]
    : l.ws === "b2b"
    ? [["Business", l.company], ["Niche", l.niche], ["Jobs / month", l.jobs], l.revenue && ["Monthly revenue", l.revenue], ["Tier", l.tier ? `${l.tier} of 5` : "—"], ["Came from", l.ad], ["Email", l.email]]
    : [["Company", l.client], ["Project", l.project], ["Property", l.property], ["ZIP", l.zip], ["Email", l.email]];

  return (
    <>
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
      <motion.aside className="drawer" role="dialog" aria-label={l.name}
        initial={{ x: "104%" }} animate={{ x: 0 }} exit={{ x: "104%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
        <header className="drawer-head">
          <Avatar name={l.name} size={52} />
          <div className="drawer-id">
            <h2>{l.name} <Tier n={l.tier} /></h2>
            <p>{l.ws === "b2c" ? <>Lead for <b>{l.client}</b></> : l.ws === "sms" ? `SMS outreach · ${l.account}` : l.company}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>

        <div className="drawer-body">
          <div className="drawer-status">
            <StageChip id={s.needsUpdate ? "needs_update" : l.stage} />
            {l.rescheduled > 0 && <span className="tag-re"><RefreshCcw size={11} /> Rescheduled</span>}
            <span className="muted">Their time <LocalTime tz={l.tz} now={now} /></span>
          </div>

          <div className="contact-call"><CallButtons lead={l} big /></div>
          <div className="contact">
            <span className="contact-num mono">{fmtPhone(l.phone) || "No number"}</span>
            <button className="btn btn-soft btn-icon" onClick={copy} title="Copy number" aria-label="Copy number">{copied ? <Check size={17} /> : <Copy size={17} />}</button>
            <a className="btn btn-soft btn-icon" href={`mailto:${l.email}`} title="Email" aria-label="Email"><Mail size={17} /></a>
          </div>

          {s.due && (
            <div className="callout">
              <div><b>{s.current.label}</b><span>due {rel(s.current.at, now)}</span></div>
              <div className="callout-btns">
                <button className="btn btn-soft" onClick={() => actions.logCall(l, s.current.key, "no_pickup")}><PhoneMissed size={15} /> No answer</button>
                <button className="btn btn-accent" onClick={() => (s.pot === "unconfirmed" ? actions.setStage(l, "confirmed") : actions.logCall(l, s.current.key, "picked_up"))}>
                  <Check size={15} strokeWidth={3} /> {s.pot === "unconfirmed" ? "Confirmed" : "Picked up"}
                </button>
              </div>
            </div>
          )}
          {s.needsUpdate && (
            <div className="callout is-warn">
              <div><b>What happened on this call?</b><span>The appointment was {rel(new Date(l.apptAt), now)}. Pick the outcome below.</span></div>
            </div>
          )}
          {l.apptAt && !s.needsUpdate && ["unconfirmed", "confirmed"].includes(l.stage) && (
            <div className="appt"><CalendarClock size={17} /><div><b>{fmtWhen(new Date(l.apptAt), l.tz, now)} {TZ_SHORT[l.tz]}</b><span>{rel(new Date(l.apptAt), now)}</span></div></div>
          )}

          <Section title="Move stage">
            <div className="stage-grid">
              {stages.map((st) => (
                <button key={st.id} className={`stage-btn t-${st.tone} ${l.stage === st.id && !s.needsUpdate ? "is-on" : ""}`} onClick={() => actions.setStage(l, st.id)}>
                  <i className="dot" />{st.label}
                </button>
              ))}
            </div>
          </Section>

          <div ref={bookRef}>
            <Section title={l.apptAt ? "Rebook" : "Book appointment"} icon={<CalendarPlus size={15} />}>
              {l.table === "hub"
                ? <div className="hub-book">
                    <p className="muted">{l.trade === "decks"
                      ? `Opens ${l.client}'s GHL calendar with ${l.name.split(" ")[0]}'s details filled in. Book it there; their GHL booking workflow runs as usual. Then set the stage here.`
                      : `Opens ${l.client}'s booking page with ${l.name.split(" ")[0]}'s details filled in. The booking lands on this desk by itself.`}</p>
                    <a className="btn btn-ink" href={l.bookUrl} target="_blank" rel="noopener" aria-disabled={!l.bookUrl}><ExternalLink size={15} /> Open booking page</a>
                  </div>
                : <Booker lead={l} now={now} onBook={(at) => actions.book(l, at)} />}
            </Section>
          </div>

          <Section title="Notes">
            <div className="note-box">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={`What did ${l.name.split(" ")[0]} say?`} rows={3}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote(); }} />
              <button className="btn btn-ink" disabled={!note.trim()} onClick={saveNote}>Save note</button>
            </div>
            {l.notesText && <div className="note is-log"><p>{l.notesText}</p></div>}
            {l.notes.map((n) => (
              <div key={n.at} className="note"><p>{n.text}</p><span>{fmtWhen(new Date(n.at), l.tz, now)}</span></div>
            ))}
          </Section>

          <Section title="Details">
            <dl className="facts">
              {facts.filter(Boolean).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
            </dl>
          </Section>

          <Section title="Activity">
            <ol className="timeline">
              {[...l.timeline].sort((a, b) => new Date(b.at) - new Date(a.at)).map((t, i) => (
                <li key={i} className={`tl-${t.type}`}><i /><div><b>{t.text}</b><span>{fmtWhen(new Date(t.at), l.tz, now)}</span></div></li>
              ))}
            </ol>
          </Section>
        </div>
      </motion.aside>
    </>
  );
}

const Section = ({ title, icon, children }) => (
  <section className="sec"><h4>{icon}{title}</h4>{children}</section>
);

// Day strip + time grid, in the lead's own time zone. Open times are made up
// for the prototype; the real one reads them from the GHL calendar.
function Booker({ lead, now, onBook }) {
  const days = useMemo(() => {
    const d0 = wallParts(now, lead.tz);
    return Array.from({ length: 5 }, (_, i) => {
      const d = addDays(d0, i);
      const slots = [];
      for (let h = 9; h <= 17; h++) for (const m of [0, 30]) {
        if (h === 17 && m) continue;
        const at = zonedToUTC(d.y, d.m, d.d, h, m, lead.tz);
        const taken = (d.d * 7 + h * 3 + m) % 4 === 0;
        if (at.getTime() > now.getTime() + 10 * 60000 && !taken) slots.push(at);
      }
      const noon = zonedToUTC(d.y, d.m, d.d, 12, 0, lead.tz);
      return {
        key: `${d.y}-${d.m}-${d.d}`, slots,
        dow: i === 0 ? "Today" : i === 1 ? "Tmrw" : new Intl.DateTimeFormat("en-US", { timeZone: lead.tz, weekday: "short" }).format(noon),
        num: d.d,
      };
    });
  }, [lead.tz, now.getTime() - (now.getTime() % 600000)]); // eslint-disable-line
  // Live leads: replace the made-up times with the real open times from GHL.
  const [real, setReal] = useState(lead.live ? "loading" : null);
  useEffect(() => {
    if (!lead.live) return;
    let off = false;
    fetchSlots(lead).then((s) => !off && setReal(s)).catch((e) => !off && setReal({ error: e.message }));
    return () => { off = true; };
  }, [lead.id, lead.live]); // eslint-disable-line
  if (Array.isArray(real)) days.forEach((d) => { d.slots = real.filter((at) => { const p = wallParts(at, lead.tz); return `${p.y}-${p.m}-${p.d}` === d.key; }); });
  const firstOpen = days.findIndex((d) => d.slots.length);
  const [di, setDi] = useState(Math.max(0, firstOpen));
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (Array.isArray(real)) setDi(Math.max(0, days.findIndex((d) => d.slots.length))); }, [real]); // eslint-disable-line
  const day = days[di] || days[0];

  if (real === "loading") return <p className="muted">Loading open times from the calendar…</p>;
  if (real && real.error) return <p className="muted">Couldn't load the calendar: {real.error}</p>;

  return (
    <div className="booker">
      <div className="days">
        {days.map((d, i) => (
          <button key={d.key} className={`day ${i === di ? "is-on" : ""}`} disabled={!d.slots.length} onClick={() => { setDi(i); setPick(null); }}>
            <small>{d.dow}</small><b>{d.num}</b>
          </button>
        ))}
      </div>
      <div className="slots">
        {day.slots.map((at) => (
          <button key={at.toISOString()} className={`slot ${pick === at.toISOString() ? "is-on" : ""}`} onClick={() => setPick(at.toISOString())}>
            {fmtTime(at, lead.tz)}
          </button>
        ))}
        {!day.slots.length && <p className="muted">No times left this day.</p>}
      </div>
      <button className="btn btn-accent btn-lg booker-go" disabled={!pick || busy} onClick={async () => { setBusy(true); await onBook(pick); setBusy(false); setPick(null); }}>
        <Check size={17} strokeWidth={3} />
        {busy ? "Booking…" : pick ? `Book ${fmtWhen(new Date(pick), lead.tz, now)} ${TZ_SHORT[lead.tz]}` : "Pick a time"}
      </button>
      <p className="booker-note">Booking moves {lead.name.split(" ")[0]} to Unconfirmed and starts the confirmation calls.</p>
    </div>
  );
}
