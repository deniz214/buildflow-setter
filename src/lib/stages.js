// Pipeline stages. `ghl` is the exact stage name the current tracker and GHL
// use, so wiring the sync later is a straight mapping.

export const STAGES = [
  { id: "optin", label: "Opt-in", long: "Opted in, no booking", ghl: "Opt-In", tone: "blue" },
  { id: "unconfirmed", label: "Unconfirmed", long: "Booked, unconfirmed", ghl: "Booked (Unconfirmed)", tone: "amber" },
  { id: "confirmed", label: "Confirmed", long: "Booked, confirmed", ghl: "Booked (Confirmed)", tone: "green" },
  { id: "reschedule", label: "Needs reschedule", long: "Needs a new time", ghl: "Needs Reschedule", tone: "violet" },
  { id: "noshow", label: "No show", long: "Didn't show up", ghl: "No Show", tone: "red" },
  { id: "show_fup", label: "Show + follow-up", long: "Showed, follow-up open", ghl: "Show + FUP", tone: "blue" },
  { id: "show_close", label: "Show + close", long: "Showed and closed", ghl: "Show + Close", tone: "green" },
  { id: "show_noclose", label: "Show + no close", long: "Showed, didn't close", ghl: "Show + No Close", tone: "grey" },
  { id: "cancelled", label: "Cancelled", long: "Cancelled", ghl: "Cancelled", tone: "grey" },
  { id: "bad", label: "Bad lead", long: "Not a real prospect", ghl: "Bad Lead", tone: "grey" },
  // Older rows only; not offered as a choice.
  { id: "showed", label: "Showed", long: "Showed (older stage)", ghl: "Showed", tone: "blue", legacy: true },
];

export const STAGE = Object.fromEntries(STAGES.map((s) => [s.id, s]));

// "Needs update" is not a stage in GHL. It is worked out automatically: an
// appointment whose time has passed but nobody has logged what happened.
export const NEEDS_UPDATE = { id: "needs_update", label: "Needs update", long: "Appointment passed, no outcome yet", tone: "amber" };

// Board order, left to right.
export const BOARD = ["optin", "unconfirmed", "confirmed", "needs_update", "reschedule", "noshow", "show_fup", "show_close", "show_noclose", "cancelled", "bad"];

// B2C only works the front of the pipeline for now.
export const B2C_STAGES = ["optin", "unconfirmed", "confirmed"];
