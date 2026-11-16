// Flow: password -> pick B2B or B2C -> the desk.

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { StoreProvider } from "./lib/store";
import { Burst, Toasts } from "./components/bits";
import Lock from "./screens/Lock";
import Choose from "./screens/Choose";
import Shell from "./screens/Shell";
import { saveToken } from "./lib/token";

const KEY = "savant_setter_unlocked";
const read = () => { try { return sessionStorage.getItem(KEY) === "1"; } catch { return false; } };
const write = (v) => { try { v ? sessionStorage.setItem(KEY, "1") : sessionStorage.removeItem(KEY); } catch { /* private mode */ } if (!v) saveToken(""); };

export default function App() {
  const [unlocked, setUnlocked] = useState(read);
  const [ws, setWs] = useState(null);

  const lock = () => { write(false); setUnlocked(false); setWs(null); };

  return (
    <StoreProvider>
      <AnimatePresence mode="wait">
        {!unlocked ? (
          <Lock key="lock" onUnlock={() => { write(true); setUnlocked(true); }} />
        ) : !ws ? (
          <Choose key="choose" onPick={setWs} onLock={lock} />
        ) : (
          <Shell key="shell" ws={ws} onSwitch={setWs} onLock={lock} />
        )}
      </AnimatePresence>
      <Toasts />
      <Burst />
    </StoreProvider>
  );
}
