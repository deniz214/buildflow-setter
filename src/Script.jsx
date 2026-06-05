// src/Script.jsx
// B2B Setting Script — color-coded so the setter can read at a glance:
//   • setter lines  -> accent blue
//   • prospect (Mr. Customer) lines -> amber, italic
//   • section headers -> green

const C = {
  bg: "#0f1115", panel: "#171a21", panel2: "#1d212b", border: "#262b36",
  text: "#e7e9ee", dim: "#8b909e", faint: "#5b606e",
  you: "#5b8def", them: "#e9b949", header: "#3ecf8e",
};

// type: "header" | "you" | "them"
const SCRIPT = [
  { type: "header", text: "Introduction" },
  { type: "you", text: "Hey, Mr. Customer, it's (name) here. Just saw that you clicked on one of our ads about getting more decking jobs, is that right?" },
  { type: "them", text: "Yessir that's right." },
  { type: "you", text: "Alright awesome, what made you want to reach out? Are you looking to expand the business or is business slower than usual at the moment?" },
  { type: "them", text: "(Explains goals, e.g., looking to get more jobs)" },
  { type: "you", text: "Well, that's fantastic. We can absolutely help you with that. What have you tried in the past so far to grow the business / make business go faster again?" },
  { type: "them", text: "(Explains previous attempts)" },

  { type: "header", text: "The BuildFlow Approach" },
  { type: "you", text: "Well, good. Our way of doing things is quite different to that. I've got a very specific system we've designed, which I'm quite happy you mentioned. It's designed exactly for the situation you're in. I'd love to show you everything over a quick 15-20min call so that you can see for yourself how everything works and some results of our clients too. So would you be free anytime later today in the afternoon or evening?" },
  { type: "them", text: "(figure out best time)" },
  { type: "you", text: "Perfect I'll get us scheduled in. So in between now and the call, I'm gonna do a lot of research and preparation on you guys. If you've got anything you can send or text me over, I'd love to look at it — like a website or pictures of jobs. I just like to know and research and heavily understand the people I'm gonna work with. So I'll send you some information about me. You can send some information about yourself. Is that alright?" },

  { type: "header", text: "Closing & Commitment" },
  { type: "them", text: "Yes." },
  { type: "you", text: "Great. And listen, just make sure you're there on time for me, my friend, cause I'll put a lot of time into it. You'll see a Google Meet link. Click it, click join, and then I will see you on the other side." },
  { type: "them", text: "(Confirms)" },
  { type: "you", text: "Great. Any questions with that? Good. And you're sure TIME works?" },
  { type: "them", text: "Yes." },
  { type: "you", text: "Great, I'll see you then." },
];

export default function Script() {
  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 4px" }}>B2B Setting Script</h1>
      <div style={{ display: "flex", gap: 16, margin: "10px 0 20px", fontSize: 12.5, color: C.dim, flexWrap: "wrap" }}>
        <Legend color={C.you} label="You say" />
        <Legend color={C.them} label="Prospect" />
        <Legend color={C.header} label="Section" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 760 }}>
        {SCRIPT.map((line, i) => {
          if (line.type === "header") {
            return (
              <div key={i} style={{ marginTop: i === 0 ? 0 : 14, marginBottom: 2 }}>
                <span style={{ color: C.header, fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6 }}>{line.text}</span>
                <div style={{ height: 1, background: C.border, marginTop: 8 }} />
              </div>
            );
          }
          const you = line.type === "you";
          return (
            <div key={i} style={{
              background: C.panel, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${you ? C.you : C.them}`, borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: you ? C.you : C.them, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                {you ? "You" : "Prospect"}
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.55, color: C.text, fontStyle: you ? "normal" : "italic", opacity: you ? 1 : 0.92 }}>
                {line.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}
