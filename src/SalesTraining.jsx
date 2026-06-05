// src/SalesTraining.jsx
// Skool-style sales course. Sections with lessons; clicking a lesson opens its
// PDF (served from /public/sales-training) or, for 1.4, the Fathom recording.
// Sections beyond Sales Foundations are placeholders until their PDFs are added.

import { useState } from "react";

const C = {
  bg: "#0f1115", panel: "#171a21", panel2: "#1d212b", border: "#262b36",
  text: "#e7e9ee", dim: "#8b909e", faint: "#5b606e",
  accent: "#5b8def", green: "#3ecf8e", amber: "#e9b949", violet: "#a78bfa",
};

// type: "pdf" (src = file path) | "video" (src = url) | "soon"
const MODULES = [
  {
    title: "Sales Foundations",
    lessons: [
      { id: "1.1", title: "Why Most Agency Owners Suck At Sales", type: "pdf", src: "/sales-training/01-why-most-agency-owners-suck-at-sales.pdf" },
      { id: "1.2", title: "The Buyer's Mind (Sales Psychology)", type: "pdf", src: "/sales-training/02-the-buyers-mind.pdf" },
      { id: "1.3", title: "Pre-Call Preparation", type: "pdf", src: "/sales-training/03-pre-call-preparation.pdf" },
      { id: "1.4", title: "FULL Practical Sales Training", type: "video", src: "https://fathom.video/calls/689509941" },
    ],
  },
  {
    title: "The Discovery Call",
    lessons: [
      { id: "2.1", title: "Discovery Call Framework (Full Structure)", type: "soon" },
      { id: "2.2", title: "Opening The Call (First 5 Minutes)", type: "soon" },
      { id: "2.3", title: "Qualifying & Diagnosing (The Questions)", type: "soon" },
      { id: "2.4", title: "The Pitch Structure", type: "soon" },
      { id: "2.5", title: "Pricing & Presenting The Offer", type: "soon" },
    ],
  },
  {
    title: "Closing",
    lessons: [
      { id: "3.1", title: "Closing Techniques (Soft, Assumptive, etc.)", type: "soon" },
      { id: "3.2", title: "Top 10 Objections & Exact Responses", type: "soon" },
    ],
  },
  {
    title: "Follow-Up & Recovery",
    lessons: [
      { id: "4.1", title: "Post-Call Follow-Up Sequences", type: "soon" },
      { id: "4.2", title: "Re-Engaging Cold Prospects", type: "soon" },
    ],
  },
];

export default function SalesTraining() {
  const [lesson, setLesson] = useState(null);

  if (lesson) {
    return (
      <div>
        <button onClick={() => setLesson(null)} style={backBtn}>← All lessons</button>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 14px" }}>
          <span style={{ color: C.accent, marginRight: 8 }}>{lesson.id}</span>{lesson.title}
        </h2>
        {lesson.type === "pdf" && (
          <>
            <iframe title={lesson.title} src={lesson.src} style={{ width: "100%", height: "78vh", border: `1px solid ${C.border}`, borderRadius: 12, background: "#fff" }} />
            <div style={{ marginTop: 10 }}>
              <a href={lesson.src} target="_blank" rel="noreferrer" style={linkBtn}>Open PDF in new tab ↗</a>
            </div>
          </>
        )}
        {lesson.type === "video" && (
          <div style={{ ...card, textAlign: "center", padding: "40px 22px" }}>
            <div style={{ fontSize: 40 }}>▶</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 10 }}>Full Practical Sales Training</div>
            <div style={{ color: C.dim, fontSize: 13.5, marginTop: 6, marginBottom: 18 }}>The complete recorded training session.</div>
            <a href={lesson.src} target="_blank" rel="noreferrer" style={watchBtn}>Watch the recording ↗</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>Sales Training</h1>
      <p style={{ color: C.dim, marginTop: 6, fontSize: 14 }}>Work through each module in order. Read each lesson twice.</p>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 22, maxWidth: 720 }}>
        {MODULES.map((mod, mi) => (
          <div key={mod.title}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
              <span style={{ color: C.faint, marginRight: 8 }}>{mi + 1}.</span>{mod.title}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mod.lessons.map((l) => {
                const locked = l.type === "soon";
                return (
                  <button key={l.id} disabled={locked} onClick={() => !locked && setLesson(l)}
                    style={lessonRow(locked)}>
                    <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: locked ? C.faint : C.accent, fontFamily: "monospace" }}>{l.id}</span>
                      <span style={{ fontSize: 14, color: locked ? C.faint : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                    </span>
                    <span style={{ fontSize: 12, color: C.faint, flexShrink: 0, marginLeft: 10 }}>
                      {locked ? "Soon" : l.type === "video" ? "▶ Video" : "PDF →"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const card = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14 };
const backBtn = { marginBottom: 14, padding: "7px 13px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel2, color: C.text, fontSize: 13.5, fontFamily: "inherit", cursor: "pointer" };
const lessonRow = (locked) => ({
  display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
  background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 15px",
  cursor: locked ? "default" : "pointer", fontFamily: "inherit", textAlign: "left", opacity: locked ? 0.55 : 1,
});
const linkBtn = { color: C.accent, fontSize: 13, textDecoration: "none" };
const watchBtn = { display: "inline-block", padding: "12px 22px", borderRadius: 10, background: C.accent, color: "#fff", fontSize: 15, fontWeight: 600, textDecoration: "none" };
