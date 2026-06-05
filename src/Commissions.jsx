// src/Commissions.jsx
// Setter's commission view: every client from the dashboard, each showing
// "$100 Deal Commission? Yes / No" (Yes when the owner has ticked it), plus a
// total-earnings summary. Read-only — the owner controls the Yes/No.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

const C = {
  bg: "#0f1115", panel: "#171a21", panel2: "#1d212b", border: "#262b36",
  text: "#e7e9ee", dim: "#8b909e", faint: "#5b606e",
  accent: "#5b8def", green: "#3ecf8e", amber: "#e9b949", red: "#f0616d",
};
const usd = (n) => "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

export default function Commissions() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("clients")
      .select("id,name,setter_commission_amount,setter_commission_paid")
      .order("name");
    setClients(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const earned = clients.filter((c) => c.setter_commission_paid).reduce((s, c) => s + Number(c.setter_commission_amount || 0), 0);
    const yesCount = clients.filter((c) => c.setter_commission_paid).length;
    return { earned, yesCount, total: clients.length };
  }, [clients]);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>Commissions</h1>
      <p style={{ color: C.dim, marginTop: 6, fontSize: 14 }}>Your $100 deal commission for each client.</p>

      {loading ? <p style={{ color: C.dim, marginTop: 20 }}>Loading…</p> : (
        <>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
            <Stat label="Total earnings" value={usd(totals.earned)} tone={C.green} />
            <Stat label="Deals commissioned" value={totals.yesCount} tone={C.accent} />
            <Stat label="Clients total" value={totals.total} />
          </div>

          <div style={{ marginTop: 22, overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr>{["Client", "$100 Deal Commission?", "Amount"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>{c.name || "—"}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, color: c.setter_commission_paid ? C.green : C.faint }}>
                        {c.setter_commission_paid ? "Yes" : "No"}
                      </span>
                    </td>
                    <td style={{ ...td, color: c.setter_commission_paid ? C.green : C.faint }}>
                      {c.setter_commission_paid ? usd(c.setter_commission_amount ?? 100) : "—"}
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && <tr><td style={{ ...td, color: C.faint }} colSpan={3}>No clients yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: tone || C.text }}>{value}</div>
    </div>
  );
}

const th = { textAlign: "left", padding: "11px 14px", color: C.dim, fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const td = { padding: "11px 14px", borderBottom: `1px solid ${C.border}`, color: C.text };
