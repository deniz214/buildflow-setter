// Pipeline board. Drag a card to another column to move the lead.
// "Needs update" fills itself: any appointment whose time has passed without
// an outcome lands there until someone says what happened.

import { useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, GripVertical, RefreshCcw } from "lucide-react";
import { Tier } from "../components/bits";
import { BOARD, NEEDS_UPDATE, STAGE } from "../lib/stages";
import { useStore } from "../lib/store";
import { fmtWhen } from "../lib/time";

const B2C_BOARD = ["optin", "unconfirmed", "confirmed", "needs_update", "reschedule", "noshow", "show_fup", "show_close", "cancelled", "bad"];
const CAP = 40;

export default function Pipeline({ ws, openLead, clientId }) {
  const { forWs, actions, now } = useStore();
  const mine = (l) => !clientId || (l.clientId || l.client) === clientId;
  const leads = forWs(ws).filter(mine);
  const cols = ws === "b2c" ? B2C_BOARD : BOARD;
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);

  const colOf = (l) => (l.status.needsUpdate ? "needs_update" : l.stage);
  const drop = (col) => {
    const l = leads.find((x) => x.id === drag);
    setDrag(null); setOver(null);
    if (!l || col === "needs_update") return;
    actions.setStage(l, col);
    if ((col === "unconfirmed" || col === "confirmed") && (!l.apptAt || new Date(l.apptAt) < now)) openLead(l.id, "book");
  };

  return (
    <div className="board">
      {cols.map((id, ci) => {
        const meta = id === "needs_update" ? NEEDS_UPDATE : STAGE[id];
        const items = leads.filter((l) => colOf(l) === id).sort((a, b) => new Date(b.stageAt) - new Date(a.stageAt));
        const canDrop = id !== "needs_update";
        return (
          <motion.div key={id} className={`col t-${meta.tone} ${over === id && canDrop ? "is-over" : ""} ${id === "needs_update" ? "is-auto" : ""}`}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.035 }}
            onDragOver={(e) => { if (canDrop && drag) { e.preventDefault(); setOver(id); } }}
            onDragLeave={() => setOver((o) => (o === id ? null : o))}
            onDrop={() => drop(id)}>
            <header className="col-head">
              <span><i className="dot" />{ws === "sms" && id === "optin" ? "Replied" : meta.label}</span>
              <em>{items.length}</em>
            </header>
            <p className="col-sub">{id === "needs_update" ? "Fills automatically" : ws === "sms" && id === "optin" ? "Replied by text, no booking" : meta.long}</p>
            <div className="col-body">
              {items.slice(0, CAP).map((l) => (
                <div key={l.id} className={`mini ${drag === l.id ? "is-drag" : ""}`} draggable
                  onDragStart={(e) => { setDrag(l.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", l.id); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  onClick={() => openLead(l.id)} role="button" tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") openLead(l.id); }}>
                  <GripVertical size={14} className="grip" />
                  <div className="mini-top"><b>{l.name}</b><Tier n={l.tier} /></div>
                  <div className="mini-co">{l.ws === "b2c" ? l.client : l.ws === "sms" ? l.account : l.company || l.niche}</div>
                  {(l.apptAt || l.rescheduled > 0 || l.status.due) && (
                    <div className="mini-foot">
                      {l.apptAt && <span><CalendarClock size={12} /> {fmtWhen(new Date(l.apptAt), l.tz, now)}</span>}
                      {l.rescheduled > 0 && <span className="tag-re"><RefreshCcw size={11} /> Rescheduled</span>}
                      {l.status.due && <span className="tag-due"><i className="pulse" />Call due</span>}
                    </div>
                  )}
                </div>
              ))}
              {items.length > CAP && <div className="col-more">+{items.length - CAP} more in All leads</div>}
              {!items.length && <div className="col-empty">{canDrop ? "Drop a lead here" : "Nothing waiting"}</div>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
