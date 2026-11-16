// Scripts library: pick a script on the left, read it on the right.
// Only scripts that actually exist are listed. Add more in the SCRIPTS list.

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { ExternalLink, FileText, Minus, PlayCircle, Plus } from "lucide-react";
import { TRAINING } from "../data/training";
import { B2B_SETTING_SCRIPT } from "../data/b2bScript";

const SCRIPTS = {
  b2b: [
    { id: "setting", title: "B2B setting script", desc: "The full call, intro to commitment", lines: B2B_SETTING_SCRIPT },
  ],
  b2c: [],
  sms: [],
};

export default function Scripts({ ws }) {
  const list = SCRIPTS[ws];
  const [id, setId] = useState(list[0]?.id);
  const [size, setSize] = useState(17);
  const script = list.find((s) => s.id === id);
  const refs = useRef({});

  if (!list.length) {
    return (
      <div className="empty empty-lg">
        <span className="empty-tick is-plain"><FileText size={22} /></span>
        <strong>No {ws === "sms" ? "SMS" : "B2C"} scripts added yet.</strong>
        <p>Send over the scripts for this desk and they'll live here, laid out the same way as the B2B one.</p>
      </div>
    );
  }

  // Group lines under their section header.
  const sections = [];
  script.lines.forEach((ln) => {
    if (ln.type === "header") sections.push({ title: ln.text, lines: [] });
    else (sections[sections.length - 1] || sections[sections.push({ title: "Script", lines: [] }) - 1]).lines.push(ln);
  });

  return (
    <div className="scripts">
      <aside className="scripts-list">
        {list.map((s) => (
          <button key={s.id} className={`script-item ${s.id === id ? "is-on" : ""}`} onClick={() => setId(s.id)}>
            <FileText size={17} />
            <span><b>{s.title}</b><small>{s.desc}</small></span>
          </button>
        ))}
        {ws === "b2b" && TRAINING.map((m) => (
          <div key={m.title} className="training">
            <h4>{m.title}</h4>
            {m.lessons.filter((x) => x.src).map((x) => (
              <a key={x.id} className="lesson" href={x.src} target="_blank" rel="noreferrer">
                {x.type === "video" ? <PlayCircle size={15} /> : <FileText size={15} />}
                <span>{x.title}</span><ExternalLink size={13} className="lesson-go" />
              </a>
            ))}
          </div>
        ))}
      </aside>

      <article className="reader">
        <header className="reader-head">
          <div className="reader-jump">
            {sections.map((s, i) => (
              <button key={s.title} className="fchip" onClick={() => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                <em>{i + 1}</em> {s.title}
              </button>
            ))}
          </div>
          <div className="reader-size" aria-label="Text size">
            <button className="icon-btn" onClick={() => setSize((v) => Math.max(14, v - 1))} aria-label="Smaller text"><Minus size={15} /></button>
            <span>Aa</span>
            <button className="icon-btn" onClick={() => setSize((v) => Math.min(24, v + 1))} aria-label="Larger text"><Plus size={15} /></button>
          </div>
        </header>
        <div className="legend"><span><i className="lg you" />You say</span><span><i className="lg them" />Prospect says</span></div>

        <div className="reader-body" style={{ fontSize: size }}>
          {sections.map((s, i) => (
            <section key={s.title} ref={(el) => (refs.current[i] = el)}>
              <h3><em>{String(i + 1).padStart(2, "0")}</em>{s.title}</h3>
              {s.lines.map((ln, j) => (
                <motion.p key={j} className={`line is-${ln.type}`}
                  initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-20px" }} transition={{ duration: 0.3 }}>
                  <span className="who">{ln.type === "you" ? "You" : "Prospect"}</span>
                  {ln.text}
                </motion.p>
              ))}
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
