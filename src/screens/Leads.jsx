// All leads on this desk, searchable.

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, LocalTime, StageChip, Tier } from "../components/bits";
import { clientTone } from "../data/sample";
import { B2C_STAGES, STAGES } from "../lib/stages";
import { useStore } from "../lib/store";
import { fmtPhone, fmtWhen, rel } from "../lib/time";

export default function Leads({ ws, openLead, clientId }) {
  const { forWs, now, clients: clientRows } = useStore();
  const mine = (l) => !clientId || (l.clientId || l.client) === clientId;
  const leads = forWs(ws).filter(mine);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const clients = useMemo(() => clientRows.map((c) => c.name), [clientRows]);
  const stages = ws === "b2c" ? STAGES.filter((s) => B2C_STAGES.includes(s.id)) : STAGES;

  const rows = leads.filter((l) => {
    const hay = `${l.name} ${l.company || ""} ${l.client || ""} ${l.phone} ${l.email}`.toLowerCase();
    return (!q || hay.includes(q.toLowerCase())) && (stage === "all" || l.stage === stage);
  });

  return (
    <div className="leads">
      <div className="leads-bar">
        <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company, phone" aria-label="Search leads" /></label>
        <div className="filters">
          <button className={`fchip ${stage === "all" ? "is-on" : ""}`} onClick={() => setStage("all")}>All <em>{leads.length}</em></button>
          {stages.map((s) => {
            const n = leads.filter((l) => l.stage === s.id).length;
            return n ? <button key={s.id} className={`fchip ${stage === s.id ? "is-on" : ""}`} onClick={() => setStage(s.id)}>{s.label} <em>{n}</em></button> : null;
          })}
        </div>
      </div>
      <div className="table">
        <div className="tr th">
          <span>Lead</span><span>{ws === "b2c" ? "Company" : ws === "sms" ? "Sending account" : "Business"}</span><span>Stage</span><span>Next call</span><span>Appointment</span><span>Phone</span>
        </div>
        {rows.slice(0, 300).map((l) => (
          <button key={l.id} className="tr" onClick={() => openLead(l.id)}>
            <span className="td-lead"><Avatar name={l.name} size={32} /><b>{l.name}</b><Tier n={l.tier} /></span>
            <span>{ws === "b2c"
              ? <span className={`client t-${clientTone(l.client, clients)}`}><i className="dot" />{l.client}</span>
              : l.ws === "sms" ? l.account : l.company || <i className="muted">{l.niche}</i>}</span>
            <span><StageChip id={l.status.needsUpdate ? "needs_update" : l.stage} /></span>
            <span className="td-next">
              {l.status.due ? <b className="due-now"><i className="pulse" />Due now</b>
                : l.status.next ? <>{rel(l.status.next.at, now)}</> : <i className="muted">—</i>}
            </span>
            <span>{l.apptAt ? fmtWhen(new Date(l.apptAt), l.tz, now) : <i className="muted">—</i>}</span>
            <span className="mono td-phone">{fmtPhone(l.phone)}<small><LocalTime tz={l.tz} now={now} /></small></span>
          </button>
        ))}
        {!rows.length && <div className="table-empty">No leads match that.</div>}
      </div>
    </div>
  );
}
