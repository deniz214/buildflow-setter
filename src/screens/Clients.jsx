// B2C clients. Onboard a client here, then paste their webhook link into a
// GoHighLevel workflow in that client's sub-account. Every lead GHL sends to
// that link lands on this desk under that client.

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, ChevronDown, Copy, Plus, Trash2 } from "lucide-react";
import { clientTone } from "../data/sample";
import { webhookUrl } from "../lib/live";
import { useStore } from "../lib/store";

const ZONES = [["ET", "Eastern"], ["CT", "Central"], ["MT", "Mountain"], ["PT", "Pacific"]];

// What each GHL workflow sends. Same link every time; only "event" changes.
const EVENTS = [
  { id: "optin", when: "New lead opts in", lands: "Opt-in" },
  { id: "booked", when: "Appointment booked", lands: "Unconfirmed", extra: '\n  "appt_at": "{{appointment.start_time}}",' },
  { id: "confirmed", when: "Appointment confirmed", lands: "Confirmed", extra: '\n  "appt_at": "{{appointment.start_time}}",' },
  { id: "stage", when: "Pipeline stage changed", lands: "the matching stage", extra: '\n  "stage": "{{opportunity.pipeline_stage}}",' },
];
const body = (e) => `{
  "event": "${e.id}",${e.extra || ""}
  "contact_id": "{{contact.id}}",
  "full_name": "{{contact.name}}",
  "phone": "{{contact.phone}}",
  "email": "{{contact.email}}",
  "postal_code": "{{contact.postal_code}}",
  "timezone": "{{contact.timezone}}"
}`;

export default function Clients() {
  const { clients, leads, actions, b2cBackend } = useStore();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", timezone: "ET", ghlLocation: "" });
  const [openId, setOpenId] = useState(null);
  const names = clients.map((c) => c.name);

  const save = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const c = await actions.addClient(draft);
    if (c) { setDraft({ name: "", timezone: "ET", ghlLocation: "" }); setAdding(false); setOpenId(c.id); }
  };

  return (
    <div className="clients">
      {b2cBackend !== "ready" && (
        <div className="banner">
          <b>Not connected to the database yet.</b> Clients you add are kept in this browser only, and their webhook links won't receive leads until the database tables and the webhook function are switched on.
        </div>
      )}

      <div className="clients-head">
        <p className="muted">{clients.length ? `${clients.length} client${clients.length === 1 ? "" : "s"} onboarded` : "No clients yet"}</p>
        <button className="btn btn-ink" onClick={() => setAdding((v) => !v)}><Plus size={16} /> Onboard a client</button>
      </div>

      <AnimatePresence initial={false}>
        {adding && (
          <motion.form className="client-form" onSubmit={save} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <div className="client-form-in">
              <label><span>Company name</span><input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. the contractor's business name" /></label>
              <label><span>Their time zone</span>
                <select value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}>
                  {ZONES.map(([z, n]) => <option key={z} value={z}>{n} ({z})</option>)}
                </select>
              </label>
              <label><span>GHL location ID <em>optional</em></span><input value={draft.ghlLocation} onChange={(e) => setDraft({ ...draft, ghlLocation: e.target.value })} placeholder="Lets Call buttons open the GHL chat" /></label>
              <div className="client-form-btns">
                <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
                <button className="btn btn-accent" disabled={!draft.name.trim()}><Check size={15} strokeWidth={3} /> Add client</button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {!clients.length && !adding && (
        <div className="empty empty-lg">
          <span className="empty-tick is-plain"><Building2 size={22} /></span>
          <strong>Onboard your first client.</strong>
          <p>Each client gets their own webhook link, their own pipeline and their own slice of the call pot. Everything also rolls up into one combined view across all clients.</p>
        </div>
      )}

      <div className="client-list">
        {clients.map((c) => {
          const mine = leads.filter((l) => l.ws === "b2c" && (l.clientId || l.client) === c.id);
          const isOpen = openId === c.id;
          return (
            <motion.article layout="position" key={c.id} className={`client-card t-${clientTone(c.name, names)}`}>
              <button className="client-top" onClick={() => setOpenId(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <span className="client-badge"><i className="dot" /></span>
                <span className="client-name"><b>{c.name}</b><small>{c.timezone}{c.local ? " · this browser only" : ""}</small></span>
                <span className="client-stat"><b className="display">{mine.filter((l) => l.status.due).length}</b><small>due now</small></span>
                <span className="client-stat"><b className="display">{mine.filter((l) => l.stage === "optin").length}</b><small>opt-ins</small></span>
                <span className="client-stat"><b className="display">{mine.filter((l) => l.stage === "unconfirmed" || l.stage === "confirmed").length}</b><small>booked</small></span>
                <ChevronDown size={18} className={`chev ${isOpen ? "is-open" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div className="client-more" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="client-more-in">
                      <h4>Webhook link</h4>
                      <p className="muted">In {c.name}'s GoHighLevel, add a <b>Custom Webhook</b> action (method POST) to each workflow below and paste this link.</p>
                      <CopyBox text={webhookUrl(c)} />
                      <h4>What to send</h4>
                      <div className="events">
                        {EVENTS.map((e) => <EventRow key={e.id} e={e} />)}
                      </div>
                      <button className="btn btn-ghost client-remove" onClick={() => { if (window.confirm(`Remove ${c.name} from the desk? Their leads stay in the database.`)) actions.removeClient(c); }}>
                        <Trash2 size={15} /> Remove client
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function EventRow({ e }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="event">
      <button className="event-top" onClick={() => setOpen((v) => !v)}>
        <span><b>{e.when}</b><small>lands in {e.lands}</small></span>
        <code>event: "{e.id}"</code>
        <ChevronDown size={16} className={`chev ${open ? "is-open" : ""}`} />
      </button>
      {open && <CopyBox text={body(e)} multi />}
    </div>
  );
}

function CopyBox({ text, multi }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(text).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1400); };
  return (
    <div className={`copybox ${multi ? "is-multi" : ""}`}>
      <pre>{text}</pre>
      <button className="btn btn-soft" onClick={copy}>{done ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}</button>
    </div>
  );
}
