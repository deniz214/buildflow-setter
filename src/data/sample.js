// SAMPLE DATA: invented people and companies so the design can be judged with
// realistic content. Nothing here comes from Supabase or GHL. Times are built
// relative to "now" so every pot has something in it whenever you open the app.

import { HOUR, MIN, DAY } from "../lib/time";

const ET = "America/New_York", CT = "America/Chicago", MT = "America/Denver", PT = "America/Los_Angeles";

export function buildSample(now = new Date()) {
  const t = now.getTime();
  const ago = (ms) => new Date(t - ms).toISOString();
  const ahead = (ms) => new Date(t + ms).toISOString();
  let n = 0;
  const mk = (ws, o) => ({
    id: `${ws}-${++n}`, ws, calls: {}, notes: [], timeline: [], rescheduled: 0,
    stageAt: o.stageAt || o.optInAt, ...o,
  });

  const b2b = [
    // Opt-ins
    { name: "Victor Halvorsen", company: "Halvorsen Deck Co.", tz: ET, tier: 4, jobs: "20-30", phone: "4045550142", email: "victor@halvorsendeck.example", ad: "Ad 3 · Truck walkaround", stage: "optin", optInAt: ago(6 * MIN) },
    { name: "Renee Okafor", company: "Blue Ridge Decks", tz: ET, tier: 3, jobs: "10-20", phone: "8285550117", email: "renee@blueridgedecks.example", ad: "Ad 1 · Before / after", stage: "optin", optInAt: ago(1 * DAY + 3 * HOUR) },
    { name: "Marcus Tindall", company: "Tindall Outdoor Living", tz: CT, tier: 5, jobs: "30+", phone: "6155550199", email: "marcus@tindalloutdoor.example", ad: "Ad 3 · Truck walkaround", stage: "optin", optInAt: ago(2 * DAY + 5 * HOUR) },
    { name: "Sofia Brandt", company: "Brandt & Sons Carpentry", tz: MT, tier: 2, jobs: "Less than 10", revenue: "10-30k", phone: "7205550133", email: "sofia@brandtsons.example", ad: "Ad 2 · Owner story", stage: "optin", optInAt: ago(4 * DAY + 2 * HOUR) },
    { name: "Dale Whitcombe", company: "Whitcombe Decking", tz: PT, tier: 3, jobs: "Less than 10", revenue: "30-100k", phone: "5035550171", email: "dale@whitcombedecking.example", ad: "Ad 1 · Before / after", stage: "optin", optInAt: ago(9 * DAY + 1 * HOUR) },
    { name: "Priya Nandakumar", company: "Cedarline Builders", tz: CT, tier: 4, jobs: "20-30", phone: "5125550108", email: "priya@cedarline.example", ad: "Ad 4 · Price guide", stage: "optin", optInAt: ago(3 * DAY + 7 * HOUR) },
    // Booked, unconfirmed
    { name: "Owen Castellano", company: "Castellano Decks & Patios", tz: ET, tier: 5, jobs: "30+", phone: "9195550164", email: "owen@castellanodecks.example", ad: "Ad 3 · Truck walkaround", stage: "unconfirmed", optInAt: ago(2 * DAY), stageAt: ago(26 * HOUR), apptAt: ahead(22 * HOUR) },
    { name: "Hannah Lindqvist", company: "North Shore Deckworks", tz: CT, tier: 3, jobs: "10-20", phone: "3125550126", email: "hannah@northshoredeck.example", ad: "Ad 2 · Owner story", stage: "unconfirmed", optInAt: ago(3 * DAY), stageAt: ago(2 * DAY), apptAt: ahead(5 * HOUR) },
    { name: "Terrence Boyd", company: "Boyd Custom Decks", tz: PT, tier: 4, jobs: "20-30", phone: "2065550187", email: "terrence@boydcustom.example", ad: "Ad 4 · Price guide", stage: "unconfirmed", optInAt: ago(20 * HOUR), stageAt: ago(11 * MIN), apptAt: ahead(2 * DAY) },
    // Booked, confirmed
    { name: "Gabriela Montes", company: "Montes Outdoor Builds", tz: ET, tier: 4, jobs: "20-30", phone: "7045550150", email: "gabriela@montesbuilds.example", ad: "Ad 1 · Before / after", stage: "confirmed", optInAt: ago(3 * DAY), stageAt: ago(1 * DAY), apptAt: ahead(18 * MIN) },
    { name: "Liam Fairweather", company: "Fairweather Decks", tz: MT, tier: 3, jobs: "10-20", phone: "3035550139", email: "liam@fairweatherdecks.example", ad: "Ad 3 · Truck walkaround", stage: "confirmed", optInAt: ago(4 * DAY), stageAt: ago(2 * DAY), apptAt: ahead(3 * HOUR) },
    { name: "Nora Achterberg", company: "Achterberg Timber", tz: CT, tier: 5, jobs: "30+", phone: "4145550112", email: "nora@achterbergtimber.example", ad: "Ad 2 · Owner story", stage: "confirmed", optInAt: ago(5 * DAY), stageAt: ago(2 * DAY), apptAt: ahead(27 * HOUR), rescheduled: 1 },
    // Appointment passed, nobody logged the outcome -> "Needs update"
    { name: "Curtis Yeoman", company: "Yeoman Deck & Fence", tz: ET, tier: 3, jobs: "10-20", phone: "6785550193", email: "curtis@yeomandeck.example", ad: "Ad 4 · Price guide", stage: "confirmed", optInAt: ago(4 * DAY), stageAt: ago(2 * DAY), apptAt: ago(2 * HOUR) },
    { name: "Imani Adeyemi", company: "Adeyemi Decking Group", tz: PT, tier: 4, jobs: "20-30", phone: "9165550158", email: "imani@adeyemidecking.example", ad: "Ad 1 · Before / after", stage: "unconfirmed", optInAt: ago(3 * DAY), stageAt: ago(2 * DAY), apptAt: ago(5 * HOUR) },
    // Later stages
    { name: "Beau Thibodeaux", company: "Bayou Deck Builders", tz: CT, tier: 3, jobs: "10-20", phone: "5045550121", email: "beau@bayoudeck.example", ad: "Ad 2 · Owner story", stage: "reschedule", optInAt: ago(6 * DAY), stageAt: ago(1 * DAY) },
    { name: "Astrid Solheim", company: "Solheim Decks", tz: MT, tier: 2, jobs: "Less than 10", revenue: "10-30k", phone: "8015550176", email: "astrid@solheimdecks.example", ad: "Ad 3 · Truck walkaround", stage: "noshow", optInAt: ago(7 * DAY), stageAt: ago(2 * DAY), apptAt: ago(2 * DAY) },
    { name: "Rashid Karimi", company: "Karimi Outdoor Spaces", tz: ET, tier: 5, jobs: "30+", phone: "8045550145", email: "rashid@karimioutdoor.example", ad: "Ad 1 · Before / after", stage: "noshow", optInAt: ago(5 * DAY), stageAt: ago(1 * DAY), apptAt: ago(1 * DAY) },
    { name: "Colette Marchetti", company: "Marchetti Deck Studio", tz: ET, tier: 4, jobs: "20-30", phone: "8605550103", email: "colette@marchettideck.example", ad: "Ad 4 · Price guide", stage: "show_fup", optInAt: ago(8 * DAY), stageAt: ago(3 * DAY), apptAt: ago(3 * DAY) },
    { name: "Dmitri Volkov", company: "Volkov Decks", tz: CT, tier: 3, jobs: "10-20", phone: "6305550184", email: "dmitri@volkovdecks.example", ad: "Ad 2 · Owner story", stage: "show_fup", optInAt: ago(6 * DAY), stageAt: ago(2 * DAY), apptAt: ago(2 * DAY) },
    { name: "Shauna Pellegrino", company: "Pellegrino Decking", tz: PT, tier: 5, jobs: "30+", phone: "6195550129", email: "shauna@pellegrinodecking.example", ad: "Ad 3 · Truck walkaround", stage: "show_close", optInAt: ago(9 * DAY), stageAt: ago(4 * DAY), apptAt: ago(4 * DAY) },
    { name: "Everett Langford", company: "Langford Deck Co.", tz: ET, tier: 4, jobs: "20-30", phone: "7575550167", email: "everett@langforddeck.example", ad: "Ad 1 · Before / after", stage: "show_close", optInAt: ago(11 * DAY), stageAt: ago(6 * DAY), apptAt: ago(6 * DAY) },
    { name: "Joaquin Ferreira", company: "Ferreira Builds", tz: MT, tier: 3, jobs: "10-20", phone: "5055550118", email: "joaquin@ferreirabuilds.example", ad: "Ad 4 · Price guide", stage: "show_noclose", optInAt: ago(10 * DAY), stageAt: ago(5 * DAY), apptAt: ago(5 * DAY) },
    { name: "Miriam Stojanovic", company: "Stojanovic Decks", tz: CT, tier: 2, jobs: "Less than 10", revenue: "10-30k", phone: "9135550191", email: "miriam@stojanovicdecks.example", ad: "Ad 2 · Owner story", stage: "cancelled", optInAt: ago(7 * DAY), stageAt: ago(3 * DAY) },
  ].map((o) => mk("b2b", o));

  // B2C: homeowners. `client` is the contractor the lead belongs to.
  const b2c = [
    { name: "Angela Whitfield", client: "Summit Ridge Remodeling", project: "Bathroom remodel", property: "Single-family home", zip: "30097", tz: ET, phone: "7705550148", email: "angela.w@mail.example", stage: "optin", optInAt: ago(4 * MIN) },
    { name: "Tomasz Kowalczyk", client: "Harborline Decks", project: "New composite deck", property: "Single-family home", zip: "28203", tz: ET, phone: "7045550136", email: "tomasz.k@mail.example", stage: "optin", optInAt: ago(1 * DAY + 2 * HOUR) },
    { name: "Denise Abernathy", client: "Summit Ridge Remodeling", project: "Kitchen remodel", property: "Townhouse", zip: "30024", tz: ET, phone: "6785550172", email: "denise.a@mail.example", stage: "optin", optInAt: ago(2 * DAY + 6 * HOUR) },
    { name: "Hector Villanueva", client: "Pacific Crest Builders", project: "Bathroom remodel", property: "Single-family home", zip: "92117", tz: PT, phone: "8585550125", email: "hector.v@mail.example", stage: "optin", optInAt: ago(3 * DAY + 4 * HOUR) },
    { name: "Yuki Tanabe", client: "Pacific Crest Builders", project: "Kitchen remodel", property: "Condo", zip: "92103", tz: PT, phone: "6195550183", email: "yuki.t@mail.example", stage: "optin", optInAt: ago(8 * DAY + 3 * HOUR) },
    { name: "Bernard Ostrowski", client: "Lakeview Home Pros", project: "Deck replacement", property: "Single-family home", zip: "60614", tz: CT, phone: "7735550114", email: "bernard.o@mail.example", stage: "optin", optInAt: ago(5 * DAY + 1 * HOUR) },
    { name: "Latoya Ferguson", client: "Harborline Decks", project: "Deck repair", property: "Single-family home", zip: "28277", tz: ET, phone: "9805550161", email: "latoya.f@mail.example", stage: "optin", optInAt: ago(1 * DAY + 8 * HOUR) },
    { name: "Stefan Brauer", client: "Lakeview Home Pros", project: "Bathroom remodel", property: "Single-family home", zip: "60657", tz: CT, phone: "3125550197", email: "stefan.b@mail.example", stage: "unconfirmed", optInAt: ago(2 * DAY), stageAt: ago(28 * HOUR), apptAt: ahead(20 * HOUR) },
    { name: "Carmen Delgado", client: "Summit Ridge Remodeling", project: "Bathroom remodel", property: "Single-family home", zip: "30041", tz: ET, phone: "4705550109", email: "carmen.d@mail.example", stage: "unconfirmed", optInAt: ago(1 * DAY), stageAt: ago(9 * MIN), apptAt: ahead(2 * DAY) },
    { name: "Wendell Prichard", client: "Pacific Crest Builders", project: "Kitchen remodel", property: "Single-family home", zip: "92064", tz: PT, phone: "7605550154", email: "wendell.p@mail.example", stage: "unconfirmed", optInAt: ago(3 * DAY), stageAt: ago(2 * DAY), apptAt: ahead(6 * HOUR) },
    { name: "Folasade Bello", client: "Harborline Decks", project: "New composite deck", property: "Single-family home", zip: "28210", tz: ET, phone: "7045550122", email: "folasade.b@mail.example", stage: "confirmed", optInAt: ago(3 * DAY), stageAt: ago(1 * DAY), apptAt: ahead(41 * MIN) },
    { name: "Graham Sutherland", client: "Lakeview Home Pros", project: "Kitchen remodel", property: "Single-family home", zip: "60613", tz: CT, phone: "8725550178", email: "graham.s@mail.example", stage: "confirmed", optInAt: ago(4 * DAY), stageAt: ago(2 * DAY), apptAt: ahead(4 * HOUR) },
    { name: "Ines Carvalho", client: "Summit Ridge Remodeling", project: "Bathroom remodel", property: "Single-family home", zip: "30005", tz: ET, phone: "4045550131", email: "ines.c@mail.example", stage: "confirmed", optInAt: ago(5 * DAY), stageAt: ago(3 * DAY), apptAt: ahead(26 * HOUR) },
  ].map((o) => mk("b2c", o));

  // A little history so cards and timelines aren't empty.
  const seed = (lead, text, msAgo) => lead.timeline.push({ at: ago(msAgo), type: "note", text });
  [...b2b, ...b2c].forEach((l) => {
    l.timeline.push({ at: l.optInAt, type: "optin", text: l.ws === "b2b" ? `Opted in from ${l.ad}` : `Opted in on ${l.client}'s estimate page` });
    if (l.apptAt && l.stage !== "optin") l.timeline.push({ at: l.stageAt, type: "book", text: "Appointment booked" });
    if (l.stage === "confirmed") l.timeline.push({ at: l.stageAt, type: "stage", text: "Confirmed on the phone" });
  });
  b2b[1].notes.push({ at: ago(20 * HOUR), text: "Picked up briefly, on a job site. Asked for a call after 4." });
  seed(b2b[1], "No answer at 9:00 AM", 1 * DAY);
  b2b[2].notes.push({ at: ago(1 * DAY), text: "Runs two crews, wants to add a third by spring. Best reached on his mobile before 8." });
  b2b[7].notes.push({ at: ago(1 * DAY), text: "Booked through the lander. Has not replied to the confirmation text yet." });
  b2c[2].notes.push({ at: ago(1 * DAY), text: "Husband handles scheduling, call back when he's home after 5." });

  return [...b2b, ...b2c];
}

// Colour per B2C client so a setter can tell at a glance whose lead it is.
const CLIENT_TONES = ["blue", "green", "violet", "amber", "red"];
export function clientTone(name, all) {
  const i = Math.max(0, all.indexOf(name));
  return CLIENT_TONES[i % CLIENT_TONES.length];
}
