// Small shared pieces: brand mark, avatar, chips, progress ring, toasts.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { STAGE, NEEDS_UPDATE } from "../lib/stages";
import { TZ_SHORT, fmtTime, initials } from "../lib/time";
import { useStore } from "../lib/store";
import logoNavy from "../assets/logo-navy.svg";
import ghlIcon from "../assets/ghl.png";
import wavvIcon from "../assets/wavv.png";

export const BRAND = "Savant";

// The Savant Enterprise logo, straight from the brand files.
export function Logo() {
  return <><img className="logo" src={logoNavy} alt="Savant Enterprise" /><span className="brand-sub">Setter desk</span></>;
}

// Where the WAVV dialer opens. Change this if your team uses a different link.
const WAVV_URL = "https://app.wavv.com/";

// Two ways to call. Either one copies the number first, so it can be pasted
// straight into the dialer, then opens that tool in a new tab.
//   GHL   opens this lead's conversation in GoHighLevel (the dialer is there)
//   WAVV  opens the WAVV app
export function CallButtons({ lead, big, compact }) {
  const { actions } = useStore();
  const number = lead.phone ? `+1${lead.phone}` : "";
  const go = (url, name) => {
    if (number) navigator.clipboard?.writeText(number).catch(() => {});
    actions.notify(number ? `Number copied. Opening ${name}…` : `Opening ${name}. This lead has no number saved.`);
    window.open(url, "_blank", "noopener");
  };
  return (
    <span className={`callbtns ${big ? "is-big" : ""} ${compact ? "is-compact" : ""}`}>
      <button className="btn btn-call" disabled={!lead.ghlUrl} onClick={() => go(lead.ghlUrl, "GoHighLevel")}
        title={lead.ghlUrl ? "Copy the number and open this lead in GoHighLevel" : "This lead isn't linked to a GoHighLevel contact"}>
        <img src={ghlIcon} alt="" /> GHL
      </button>
      <button className="btn btn-call" onClick={() => go(WAVV_URL, "WAVV")} title="Copy the number and open WAVV">
        <img src={wavvIcon} alt="" /> WAVV
      </button>
    </span>
  );
}

export function Avatar({ name, size = 40, tone }) {
  return (
    <span className={`avatar ${tone ? "t-" + tone : ""}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function StageChip({ id }) {
  const s = id === "needs_update" ? NEEDS_UPDATE : STAGE[id];
  if (!s) return null;
  return <span className={`chip t-${s.tone}`}><i className="dot" />{s.label}</span>;
}

export const Tier = ({ n }) => (n ? <span className="tier" title={`Lead tier ${n} of 5`}>T{n}</span> : null);

// The lead's own clock, e.g. "2:14 PM ET"
export function LocalTime({ tz, now }) {
  return <span className="mono">{fmtTime(now, tz)} {TZ_SHORT[tz] || ""}</span>;
}

export function CountUp({ value, duration = 700 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value;
    let raf;
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (b - a) * e));
      if (p < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{shown}</>;
}

export function Ring({ value, goal, size = 64, stroke = 6 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const p = Math.min(1, goal ? value / goal : 0);
  return (
    <svg width={size} height={size} className="ring" role="img" aria-label={`${value} of ${goal}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - p) }}
        transition={{ type: "spring", stiffness: 60, damping: 16 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// Today's three call slots as dots: answered, no answer, due now, later.
export function DotTrack({ today }) {
  if (!today || !today.length) return null;
  return (
    <span className="track" aria-label="Today's call slots">
      {today.map((s) => (
        <span key={s.key} className={`track-dot is-${s.state}`} title={`${s.label}: ${s.state.replace("_", " ")}`}>
          {s.state === "picked_up" && <Check size={9} strokeWidth={3.5} />}
        </span>
      ))}
    </span>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className={`toast is-${t.tone}`} layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }} transition={{ type: "spring", stiffness: 420, damping: 30 }}>
            {t.tone === "good" && <span className="toast-tick"><Check size={12} strokeWidth={3.5} /></span>}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// A short burst of paper when something good happens (a booking, a close).
export function Burst() {
  const { burst } = useStore();
  const [live, setLive] = useState(null);
  useEffect(() => {
    if (!burst) return;
    setLive(burst);
    const t = setTimeout(() => setLive(null), 1500);
    return () => clearTimeout(t);
  }, [burst]);
  if (!live) return null;
  const bits = Array.from({ length: 34 }, (_, i) => {
    const ang = (-Math.PI / 2) + ((i / 34) - 0.5) * Math.PI * 1.25;
    const dist = 180 + ((i * 53) % 220);
    return { i, x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, r: (i * 47) % 360, c: ["var(--accent)", "var(--ink)", "#fff", "var(--green)"][i % 4], w: 6 + (i % 3) * 3 };
  });
  return (
    <div className="burst" aria-hidden="true">
      {bits.map((b) => (
        <motion.i key={`${live}-${b.i}`} style={{ background: b.c, width: b.w, height: b.w * 0.55 }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: b.x, y: [b.y, b.y + 160], opacity: [1, 1, 0], rotate: b.r + 240, scale: 1 }}
          transition={{ duration: 1.3, ease: [0.12, 0.7, 0.3, 1] }} />
      ))}
    </div>
  );
}
