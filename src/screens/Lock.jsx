// Password screen.
//
// The password is checked by a server function (netlify/functions/desk-login.mjs),
// so it is never shipped inside the page.

import { useRef, useState } from "react";
import { motion, useAnimate } from "motion/react";
import { ArrowRight, Eye, EyeOff, Lock as LockIcon } from "lucide-react";
import { Logo } from "../components/bits";

// On your own machine (localhost) there is no server function, so "setter" works there only.
const LOCAL = typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname);
const LOCAL_PASSWORD = "setter";

async function check(pw) {
  const local = () => (pw.trim().toLowerCase() === LOCAL_PASSWORD ? "ok" : "wrong");
  try {
    const r = await fetch("/.netlify/functions/desk-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    const d = await r.json().catch(() => null);          // only a real answer from the function counts
    if (d && d.ok === true && r.status === 200) return "ok";
    if (d && d.ok === false && r.status === 401) return "wrong";
    return LOCAL && !d ? local() : "down";
  } catch { return LOCAL ? local() : "down"; }
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

export default function Lock({ onUnlock }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [bad, setBad] = useState(0);
  const [opening, setOpening] = useState(false);
  const [fieldRef, animate] = useAnimate();
  const inputRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [down, setDown] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (busy || !pw) return;
    setBusy(true); setDown(false);
    const res = await check(pw);
    setBusy(false);
    if (res === "down") return setDown(true);
    if (res === "ok") {
      setOpening(true);
      setTimeout(onUnlock, 520);
    } else {
      setBad((b) => b + 1);
      animate(fieldRef.current, { x: [0, -9, 9, -6, 6, -3, 0] }, { duration: 0.42 });
      inputRef.current?.select();
    }
  };

  return (
    <motion.div className="lock" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.35 }}>
      <Orbit />
      <motion.form className="lock-card" onSubmit={submit}
        initial={{ y: 24, opacity: 0 }} animate={opening ? { y: -10, opacity: 0, scale: 0.97 } : { y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}>
        <div className="lock-brand"><Logo /></div>
        <h1 className="display lock-title">{greeting()}</h1>
        <p className="lock-sub">Enter the team password to open your call desk.</p>

        <label className={`field ${bad ? "is-bad" : ""}`} ref={fieldRef}>
          <LockIcon size={17} />
          <input ref={inputRef} type={show ? "text" : "password"} value={pw} autoFocus placeholder="Password" aria-label="Password"
            onChange={(e) => { setPw(e.target.value); if (bad) setBad(0); }} autoComplete="current-password" />
          <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </label>
        <div className="lock-err" role="alert">{down ? "Couldn't reach the server. Try again in a moment." : bad ? "That password isn't right. Try again." : "\u00a0"}</div>

        <button className="btn btn-ink btn-lg lock-go" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Unlock"} <ArrowRight size={18} />
        </button>
        {LOCAL && <div className="lock-hint">Local preview · password is <b>setter</b></div>}
      </motion.form>
    </motion.div>
  );
}

// Slow rings with dots travelling round them: calls going out on a rhythm.
function Orbit() {
  const rings = [150, 250, 350, 450];
  return (
    <svg className="orbit" viewBox="-500 -500 1000 1000" aria-hidden="true">
      {rings.map((r, i) => (
        <g key={r}>
          <circle r={r} fill="none" stroke="var(--line)" strokeWidth="1.5" />
          <g className="orbit-spin" style={{ animationDuration: `${26 + i * 14}s`, animationDirection: i % 2 ? "reverse" : "normal" }}>
            <circle cx={r} cy="0" r={i === 1 ? 9 : 6} fill={i === 1 ? "var(--accent)" : "var(--ink)"} stroke="var(--paper)" strokeWidth="3" />
            <circle cx={-r * 0.71} cy={r * 0.71} r="4" fill="var(--faint)" />
          </g>
        </g>
      ))}
    </svg>
  );
}
