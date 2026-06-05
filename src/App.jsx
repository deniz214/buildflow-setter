// src/App.jsx
// Setter app shell: a home screen with three tiles, and simple navigation
// (no router needed) between B2B Leads, Commissions, and Training Material.

import { useState } from "react";
import SetterHub from "./SetterHub";     // B2B Leads (calling + tracking)
import Commissions from "./Commissions";
import Training from "./Training";

const C = {
  bg: "#0f1115", panel: "#171a21", panel2: "#1d212b", border: "#262b36",
  text: "#e7e9ee", dim: "#8b909e", faint: "#5b606e",
  accent: "#5b8def", green: "#3ecf8e", amber: "#e9b949", violet: "#a78bfa",
};

const TILES = [
  { id: "leads", title: "B2B Leads", desc: "Your call queue, leads, and stages", icon: "📞", tone: C.accent },
  { id: "commissions", title: "Commissions", desc: "Your deal commissions & earnings", icon: "💰", tone: C.green },
  { id: "training", title: "Training Material", desc: "Scripts and resources", icon: "📚", tone: C.violet },
];

export default function App() {
  const [page, setPage] = useState("home");

  return (
    <div>
      {page === "home" ? (
        <Home onPick={setPage} />
      ) : (
        <>
          <button onClick={() => setPage("home")} style={backBtn}>← Home</button>
          {page === "leads" && <SetterHub />}
          {page === "commissions" && <Commissions />}
          {page === "training" && <Training />}
        </>
      )}
    </div>
  );
}

function Home({ onPick }) {
  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: "8px 0 4px" }}>BuildFlow · Setter</h1>
      <p style={{ color: C.dim, margin: "0 0 26px", fontSize: 15 }}>Pick where you want to go.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {TILES.map((t) => (
          <button key={t.id} onClick={() => onPick(t.id)} style={tile(t.tone)}>
            <div style={{ fontSize: 34 }}>{t.icon}</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 12 }}>{t.title}</div>
            <div style={{ fontSize: 13.5, color: C.dim, marginTop: 6 }}>{t.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

const tile = (tone) => ({
  textAlign: "left", cursor: "pointer", fontFamily: "inherit",
  background: C.panel, border: `1px solid ${C.border}`, borderLeft: `3px solid ${tone}`,
  borderRadius: 16, padding: "26px 22px", color: C.text, minHeight: 150,
  display: "flex", flexDirection: "column", justifyContent: "flex-start",
  transition: "transform 0.08s ease, border-color 0.15s ease",
});
const backBtn = {
  marginBottom: 18, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`,
  background: C.panel2, color: C.text, fontSize: 14, fontFamily: "inherit", cursor: "pointer",
};
