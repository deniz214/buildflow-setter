// Builds a deck client's GHL landing page from public/deck-page-template.html.
// The page itself talks to the onboarding hub (ZIP check, lead, open times, booking),
// so the only things baked in are what the page shows before it has asked anything.

const HUB_API = "https://schedule-estimate.netlify.app/.netlify/functions/";

// Thank-you page price catalog (Jack's price education), same photos as the live deck pages.
const CATALOG_BASE = "https://buildflowtracking.netlify.app/deck-catalog/";
const CATALOG = [
  ["deck-01.webp", 5400, "Composite deck with stairs", "Composite boards, black aluminum railing"],
  ["deck-03.webp", 3200, "Stain & seal restoration", "Two-level cedar deck: cleaned, sanded and re-stained"],
  ["deck-10.webp", 9800, "Covered deck with stone column", "Composite, timber-frame roof, skirting"],
  ["deck-04.webp", 6900, "Raised backyard deck", "Composite boards, aluminum railing and stairs"],
  ["deck-07.webp", 11800, "Wraparound deck", "Composite boards, cedar posts, aluminum railing"],
  ["deck-06.webp", 8700, "Ground-level composite deck", "Grey composite boards, white vinyl railing"],
  ["deck-05.webp", 17500, "Second-story deck, finished underneath", "Composite, wrapped posts and beams, ceiling under the deck"],
  ["deck-02.webp", 7800, "Raised deck with skirting", "Composite boards and skirting, cable railing, stairs"],
  ["deck-08.webp", 12900, "Covered porch deck", "Composite deck with a roof and ceiling, vinyl railing"],
  ["deck-09.webp", 14500, "Raised deck with timber pavilion", "Composite, gable roof, two staircases"],
];

export const TIME_ZONES = [
  ["America/New_York", "Eastern Time"], ["America/Chicago", "Central Time"], ["America/Denver", "Mountain Time"],
  ["America/Phoenix", "Arizona Time"], ["America/Los_Angeles", "Pacific Time"], ["America/Anchorage", "Alaska Time"], ["Pacific/Honolulu", "Hawaii Time"],
];
const TZ_LABEL = Object.fromEntries(TIME_ZONES);

const html = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtPhone = (p) => { const d = String(p || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, ""); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || "").trim(); };

let template = null;
async function loadTemplate() {
  if (!template) {
    const r = await fetch("/deck-page-template.html", { cache: "no-store" });
    if (!r.ok) throw new Error("Couldn't load the page template");
    template = await r.text();
  }
  return template;
}

// c = a hub client row (business_name, owner_name, public_phone, text_number, time_zone, pixel_id, logo_url, id)
export async function buildDeckPage(c) {
  const t = await loadTemplate();
  const name = String(c.business_name || "").trim();
  const config = {
    api: HUB_API, clientId: c.id, name, ownerName: String(c.owner_name || "").trim(),
    phone: fmtPhone(c.public_phone), textFrom: fmtPhone(c.text_number),
    timeZone: c.time_zone || "America/New_York", tzLabel: TZ_LABEL[c.time_zone] || "Eastern Time", state: "",
    pixelId: String(c.pixel_id || "").trim(),
    catalogBase: CATALOG_BASE, catalog: CATALOG,
  };
  const logo = c.logo_url
    ? `<img src="${html(c.logo_url)}" alt="${html(name)}">`
    : `<span class="rs-wordmark">${html(name)}</span>`;
  const configJs = JSON.stringify(config).replace(/</g, "\\u003c");
  const out = t
    .replace(/\/\*__CONFIG__\*\/\{[^\n]*\};/, () => configJs + ";")
    .replace("__LOGO_HTML__", () => logo)
    .replace(/__NAME__/g, () => html(name));
  if (out.includes("__CONFIG__") || out.includes("__NAME__") || out.includes("__LOGO_HTML__")) throw new Error("Page template is out of date");
  return out;
}

// Shrinks a picked image to at most 800px wide/high and returns a PNG data URL (the hub stores it).
export function shrinkImage(file, max = 800) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return reject(new Error("Use a PNG, JPG or WebP logo"));
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(img.src);
      resolve(cv.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Couldn't read that image"));
    img.src = URL.createObjectURL(file);
  });
}

export const slugify = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
export const calendarLink = (id) => `https://api.leadconnectorhq.com/widget/booking/${id}`;
