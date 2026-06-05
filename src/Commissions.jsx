// src/Commissions.jsx
// Setter's commission view: every client with "$100 Deal Commission? Yes/No"
// (earned) and whether it's been paid, plus totals: earned / paid / still owed.
// Read-only — the owner controls the ticks on the main dashboard.

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
      .select("id,name,setter_commission_amount,setter_commission_paid,setter_commission_paidout")
      .order("name");
    setClients(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const totals = useMemo(() => {
    const earnedRows = clients.filter((c) => c.setter_commission_paid);
    const earned = earnedRows.reduce((s, c) => s + Number(c.setter_commission_amount || 0), 0);
    const paid = earnedRows.filter((c) => c.setter_commission_paidout).reduce((s, c) => s + Number(c.setter_commission_amount || 0), 0);
    return { earned, paid, owed: earned - paid, deals: earnedRows.length };
  }, [clients]);

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 600, margin: 0 }}>Commissions</h1>
      <p style={{ color: C.dim, marginTop: 6, fontSize: 14 }}>Your $100 deal commission for each client.</p>

      {loading ? <p style={{ color: C.dim, marginTop: 20 }}>Loading…</p> : (
        <>
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
            <Stat label="Total earned" value={usd(totals.earned)} tone={C.green} sub={`${totals.deals} deals`} />
            <Stat label="Paid to you" value={usd(totals.paid)} tone={C.accent} />
            <Stat label="Still owed" value={usd(totals.owed)} tone={totals.owed > 0 ? C.amber : C.dim} />
          </div>

          <div style={{ marginTop: 22, overflowX: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr>{["Client", "$100 Deal Commission?", "Paid to you?", "Amount"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>{c.name || "—"}</td>
                    <td style={td}>
                      <span style={{ fontWeight: 700, color: c.setter_commission_paid ? C.green : C.faint }}>
                        {c.setter_commission_paid ? "Yes" : "No"}
                      </span>
                    </td>
                    <td style={td}>
                      {c.setter_commission_paid
                        ? <span style={{ fontWeight: 700, color: c.setter_commission_paidout ? C.green : C.amber }}>{c.setter_commission_paidout ? "Paid" : "Pending"}</span>
                        : <span style={{ color: C.faint }}>—</span>}
                    </td>
                    <td style={{ ...td, color: c.setter_commission_paid ? C.green : C.faint }}>
                      {c.setter_commission_paid ? usd(c.setter_commission_amount ?? 100) : "—"}
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && <tr><td style={{ ...td, color: C.faint }} colSpan={4}>No clients yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone, sub }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 12, color: C.dim, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: tone || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const th = { textAlign: "left", padding: "11px 14px", color: C.dim, fontSize: 12, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
const td = { padding: "11px 14px", borderBottom: `1px solid ${C.border}`, color: C.text };
