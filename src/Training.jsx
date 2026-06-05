// src/Training.jsx
// Training material list. For now one item — the B2B Setting Script — which
// opens a color-coded read view (setter lines vs prospect lines).

import { useState } from "react";
import Script from "./Script";
import SalesTraining from "./SalesTraining";

const C = {
  bg: "#0f1115", panel: "#171a21", panel2: "#1d212b", border: "#262b36",
  text: "#e7e9ee", dim: "#8b909e", faint: "#5b606e", accent: "#5b8def", violet: "#a78bfa",
};

const MATERIALS = [
  { id: "b2b-script", title: "B2B Setting Script", desc: "The full call script — intro to close" },
  { id: "sales-training", title: "Sales Training", desc: "Full sales course — foundations to closing" },
];

export default function Training() {
  const [open, setOpen] = useState(null);

  if (open === "b2b-script") {
    return (
      <div>
        <button onClick={() => setOpen(null)} style={backBtn}>← Training Material</button>
        <Script />
      </div>
    );
  }
  if (open === "sales-training") {
    return (
      <div>
        <button onClick={() => setOpen(null)} style={backBtn}>← Training Material</button>
        <SalesTraining />
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>Training Material</h1>
      <p style={{ color: C.dim, marginTop: 6, fontSize: 14 }}>Scripts and resources to help you close.</p>
      <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
        {MATERIALS.map((m) => (
          <button key={m.id} onClick={() => setOpen(m.id)} style={tile}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{m.title}</div>
            <div style={{ fontSize: 13, color: C.dim, marginTop: 6 }}>{m.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const tile = {
  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
  background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.violet}`,
  borderRadius: 14, padding: "20px 18px", color: C.text,
};
const backBtn = {
  marginBottom: 16, padding: "7px 13px", borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.panel2, color: C.text, fontSize: 13.5, fontFamily: "inherit", cursor: "pointer",
};
