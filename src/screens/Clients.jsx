// B2C clients, straight from the onboarding hub (the same list as
// schedule-estimate.netlify.app/admin). Deck clients are onboarded here: fill in
// the form, save, then "Copy GHL page code" and paste it into a GHL page.
// Remodeling clients are still set up in the hub's own dashboard.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Building2, Check, ChevronDown, ClipboardCopy, ExternalLink, ImagePlus, Pencil, Plus, X } from "lucide-react";
import { clientTone } from "../data/sample";
import { fetchHubClients, saveHubClient, uploadLogo } from "../lib/live";
import { TIME_ZONES, buildDeckPage, calendarLink, shrinkImage, slugify } from "../lib/deckPage";
import { useStore } from "../lib/store";

const HUB_ADMIN = "https://schedule-estimate.netlify.app/admin";
const isDeck = (c) => c && c.quiz_focus === "deck";

const EMPTY = {
  business_name: "", id: "", owner_name: "", logo_url: "", calendar_id: "", time_zone: "America/New_York",
  public_phone: "", notify_email: "", notify_phone: "", text_number: "", pixel_id: "", capi_token: "",
  zipFilter: false, zips: "", guide_webhook: "",
};

// Hub row -> form, and back.
const toDraft = (c) => {
  const zipRule = (c.area_rules || []).find((r) => r.mode === "include" && r.type === "zip");
  return {
    ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).filter((k) => c[k] != null).map((k) => [k, c[k]])),
    capi_token: "", hasCapi: !!c.has_capi_token, oldCalendarUrl: c.calendar_url || "", oldCalendarId: c.calendar_id || "",
    zipFilter: !!zipRule, zips: zipRule ? zipRule.zips.join(", ") : "",
  };
};
const zipList = (s) => [...new Set(String(s || "").match(/\b\d{5}\b/g) || [])];

export default function Clients() {
  const { clients, leads, b2cBackend, b2cError, actions } = useStore();
  const [hub, setHub] = useState(null);          // full hub rows, by id
  const [hubErr, setHubErr] = useState("");
  const [editing, setEditing] = useState(null);  // null | { isNew, draft }
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState("all");

  const loadHub = () => fetchHubClients()
    .then((rows) => { setHub(Object.fromEntries(rows.map((r) => [r.id, r]))); setHubErr(""); })
    .catch((e) => setHubErr(e.message));
  useEffect(() => { loadHub(); }, []);

  // Every client the hub has (the dialer list only holds active ones).
  const rows = useMemo(() => {
    const byId = new Map(clients.map((c) => [c.id, { id: c.id, name: c.name, trade: c.trade }]));
    Object.values(hub || {}).forEach((h) => byId.set(h.id, { id: h.id, name: h.business_name, trade: isDeck(h) ? "decks" : "remodeling", inactive: h.active === false }));
    return [...byId.values()].sort((a, b) => (a.trade === b.trade ? a.name.localeCompare(b.name) : a.trade === "decks" ? -1 : 1));
  }, [clients, hub]);
  const shown = rows.filter((c) => filter === "all" || c.trade === filter);
  const names = rows.map((c) => c.name);

  const saved = async (row) => {
    await loadHub();
    actions.reload();
    setEditing(null);
    setOpenId(row.id);
  };

  return (
    <div className="clients">
      {b2cBackend === "missing" && (
        <div className="banner is-bad"><b>Homeowner leads aren't loading.</b> {b2cError || "The desk couldn't reach the onboarding hub."}</div>
      )}
      {hubErr && <div className="banner is-bad"><b>Client details aren't loading.</b> {hubErr}</div>}

      <div className="clients-head">
        <div className="seg" role="tablist" aria-label="Trade">
          {[["all", "All"], ["decks", "Decks"], ["remodeling", "Remodeling"]].map(([k, l]) => (
            <button key={k} className={filter === k ? "is-on" : ""} onClick={() => setFilter(k)}>{l} <span className="muted">{rows.filter((c) => k === "all" || c.trade === k).length}</span></button>
          ))}
        </div>
        <button className="btn btn-ink" onClick={() => setEditing({ isNew: true, draft: { ...EMPTY } })} disabled={!hub}><Plus size={16} /> Onboard a deck client</button>
      </div>

      <AnimatePresence initial={false}>
        {editing && <DeckForm key={editing.isNew ? "new" : editing.draft.id} {...editing} taken={Object.keys(hub || {})} onCancel={() => setEditing(null)} onSaved={saved} notify={actions.notify} />}
      </AnimatePresence>

      {!rows.length && !editing && (
        <div className="empty empty-lg">
          <span className="empty-tick is-plain"><Building2 size={22} /></span>
          <strong>{hub ? "No clients yet." : "Loading clients…"}</strong>
          <p>Onboard a deck client to get their GHL landing page. Their leads land on this desk as soon as the page is live.</p>
        </div>
      )}

      <div className="client-list">
        {shown.map((c) => {
          const mine = leads.filter((l) => l.ws === "b2c" && l.clientId === c.id);
          const isOpen = openId === c.id;
          const h = hub && hub[c.id];
          return (
            <motion.article layout="position" key={c.id} className={`client-card t-${clientTone(c.name, names)}`}>
              <button className="client-top" onClick={() => setOpenId(isOpen ? null : c.id)} aria-expanded={isOpen}>
                <span className="client-badge"><i className="dot" /></span>
                <span className="client-name"><b>{c.name}</b><small>{c.trade === "decks" ? "Decks · GHL page" : "Remodeling · hub page"}{c.inactive ? " · paused" : ""}</small></span>
                <span className="client-stat"><b className="display">{mine.filter((l) => l.status.due).length}</b><small>due now</small></span>
                <span className="client-stat"><b className="display">{mine.filter((l) => l.stage === "optin").length}</b><small>opt-ins</small></span>
                <span className="client-stat"><b className="display">{mine.filter((l) => l.stage === "unconfirmed" || l.stage === "confirmed").length}</b><small>booked</small></span>
                <ChevronDown size={18} className={`chev ${isOpen ? "is-open" : ""}`} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div className="client-more" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <div className="client-more-in">
                      {c.trade === "decks" && h ? <DeckDetails c={h} onEdit={() => setEditing({ isNew: false, draft: toDraft(h) })} notify={actions.notify} />
                        : c.trade === "decks" ? <p className="muted">Loading details…</p>
                        : (
                          <>
                            <p className="muted">Remodeling clients are set up in the onboarding hub. Their leads and calls show on this desk like every other client.</p>
                            <div className="client-acts">
                              <a className="btn btn-soft" href={HUB_ADMIN} target="_blank" rel="noopener"><ExternalLink size={15} /> Open the hub dashboard</a>
                              <a className="btn btn-soft" href={`https://schedule-estimate.netlify.app/${c.id}`} target="_blank" rel="noopener"><ExternalLink size={15} /> Their landing page</a>
                            </div>
                          </>
                        )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function CopyPage({ c, notify, big }) {
  const [state, setState] = useState("");
  const copy = async () => {
    setState("busy");
    try {
      const code = await buildDeckPage(c);
      await navigator.clipboard.writeText(code);
      setState("done"); notify(`${c.business_name}'s page code is on your clipboard. Paste it into a GHL Custom Code element.`, "good");
      setTimeout(() => setState(""), 2400);
    } catch (e) { setState(""); notify(`Couldn't copy: ${e.message}`, "bad"); }
  };
  return (
    <button className={`btn btn-accent ${big ? "btn-lg" : ""}`} onClick={copy} disabled={state === "busy"}>
      {state === "done" ? <><Check size={16} strokeWidth={3} /> Copied</> : <><ClipboardCopy size={16} /> {state === "busy" ? "Building page…" : "Copy GHL page code"}</>}
    </button>
  );
}

function DeckDetails({ c, onEdit, notify }) {
  const zipRule = (c.area_rules || []).find((r) => r.mode === "include" && r.type === "zip");
  const facts = [
    ["Client ID", c.id], ["Owner", c.owner_name], ["GHL calendar ID", c.calendar_id], ["Time zone", (TIME_ZONES.find(([z]) => z === c.time_zone) || [])[1]],
    ["Phone on the page", c.public_phone], ["Alerts go to", [c.notify_email, c.notify_phone].filter(Boolean).join(" · ")],
    ["Meta pixel", c.pixel_id ? `${c.pixel_id}${c.has_capi_token ? " · CAPI token saved" : " · no CAPI token"}` : ""],
    ["Service area", zipRule ? `${zipRule.zips.length} ZIP codes (others are turned away)` : "Every ZIP accepted"],
    ["Leads go to", c.guide_webhook ? "Their own inbound webhook" : "The shared decks webhook"],
  ];
  return (
    <>
      <div className="client-acts">
        <CopyPage c={c} notify={notify} />
        <button className="btn btn-soft" onClick={onEdit}><Pencil size={15} /> Edit details</button>
      </div>
      <dl className="facts client-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}</dl>
      <h4>Going live</h4>
      <ol className="client-steps">
        <li>In GHL, make a blank funnel page, add a <b>Custom Code</b> element (section and row full width, no padding) and paste the page code.</li>
        <li>Use that page's link as the ad's website URL.</li>
        <li>Book one test on your phone with a ZIP inside their area. Check the lead and the booking show on this desk and in GHL, then delete the test contact.</li>
      </ol>
      <p className="muted small">Changed something here? Copy the page code again and paste it over the old one. The page link stays the same, so running ads aren't affected.</p>
    </>
  );
}

function DeckForm({ isNew, draft: start, taken, onCancel, onSaved, notify }) {
  const [d, setD] = useState(start);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const id = idTouched ? d.id : slugify(d.business_name);
  const zips = zipList(d.zips);

  const pickLogo = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f) return;
    if (!id) return setErr("Fill in the business name first, so the logo can be filed under it.");
    setLogoBusy(true); setErr("");
    try { const url = await uploadLogo(id, await shrinkImage(f)); setD((x) => ({ ...x, logo_url: url })); }
    catch (e2) { setErr(`Logo not uploaded: ${e2.message}`); }
    finally { setLogoBusy(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    const calId = String(d.calendar_id || "").trim();
    const problems = [];
    if (!d.business_name.trim()) problems.push("the business name");
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(id)) problems.push("a client ID (lowercase letters, numbers and dashes)");
    if (isNew && taken.includes(id)) problems.push(`a different client ID ("${id}" is taken)`);
    if (!/^[A-Za-z0-9]{15,40}$/.test(calId)) problems.push("the GHL calendar ID");
    if (d.zipFilter && !zips.length) problems.push("at least one ZIP code (or switch the ZIP filter off)");
    if (d.pixel_id && !/^\d{10,20}$/.test(String(d.pixel_id).trim())) problems.push("a pixel ID with numbers only");
    if (d.guide_webhook && !/^https:\/\/services\.leadconnectorhq\.com\/hooks\//.test(d.guide_webhook.trim())) problems.push("a GHL inbound webhook link (or leave it empty)");
    if (problems.length) return setErr(`Please add ${problems.join(", ")}.`);

    setBusy(true); setErr("");
    const client = {
      id, business_name: d.business_name.trim(), owner_name: d.owner_name.trim(), logo_url: d.logo_url || "",
      calendar_id: calId, calendar_url: calId === d.oldCalendarId && d.oldCalendarUrl ? d.oldCalendarUrl : calendarLink(calId),
      time_zone: d.time_zone, public_phone: d.public_phone.trim(), notify_email: d.notify_email.trim(), notify_phone: d.notify_phone.trim(),
      text_number: d.text_number.trim(), pixel_id: String(d.pixel_id || "").trim(), ...(d.capi_token.trim() ? { capi_token: d.capi_token.trim() } : {}),
      quiz_focus: "deck", guide_webhook: d.guide_webhook.trim(), active: true,
      area_rules: d.zipFilter ? [{ mode: "include", type: "zip", zips }] : [{ mode: "include", type: "country" }],
    };
    try {
      const r = await saveHubClient(client, isNew);
      notify(`${client.business_name} saved${r.warning ? ` (${r.warning})` : ""}`, "good");
      onSaved(r.client || client);
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  };

  return (
    <motion.form className="client-form deck-form" onSubmit={save} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
      <div className="client-form-in">
        <div className="deck-form-head">
          <b>{isNew ? "Onboard a deck client" : `Edit ${start.business_name}`}</b>
          <button type="button" className="icon-btn" onClick={onCancel} aria-label="Close"><X size={18} /></button>
        </div>

        <h5>The business</h5>
        <label><span>Business name</span><input autoFocus={isNew} value={d.business_name} onChange={set("business_name")} placeholder="e.g. Value Remodeling" /></label>
        <label><span>Client ID <em>used in links, can't change later</em></span>
          <input value={id} disabled={!isNew} onChange={(e) => { setIdTouched(true); setD((x) => ({ ...x, id: slugify(e.target.value) })); }} placeholder="value-remodeling" /></label>
        <label><span>Owner name <em>"David, the owner, comes out…"</em></span><input value={d.owner_name} onChange={set("owner_name")} placeholder="David Sakin" /></label>
        <div className="logo-pick">
          <span className="logo-prev">{d.logo_url ? <img src={d.logo_url} alt="" /> : <i>No logo: the name is shown instead</i>}</span>
          <label className="btn btn-soft"><ImagePlus size={15} /> {logoBusy ? "Uploading…" : d.logo_url ? "Change logo" : "Upload logo"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} hidden /></label>
          {d.logo_url && <button type="button" className="btn btn-ghost" onClick={() => setD((x) => ({ ...x, logo_url: "" }))}>Remove</button>}
        </div>

        <h5>Booking</h5>
        <label><span>GHL calendar ID</span><input value={d.calendar_id} onChange={set("calendar_id")} placeholder="iiPcFc54cWUzGsanVNzg" spellCheck="false" /></label>
        <label><span>Their time zone</span>
          <select value={d.time_zone} onChange={set("time_zone")}>{TIME_ZONES.map(([z, n]) => <option key={z} value={z}>{n}</option>)}</select></label>
        <label><span>Phone on the page <em>optional, shows Call buttons</em></span><input value={d.public_phone} onChange={set("public_phone")} placeholder="(410) 555-0123" /></label>
        <label><span>Confirmation texts come from <em>optional</em></span><input value={d.text_number} onChange={set("text_number")} placeholder="(410) 555-0199" /></label>

        <h5>Alerts &amp; tracking</h5>
        <label><span>Notification email(s) <em>comma-separated</em></span><input value={d.notify_email} onChange={set("notify_email")} placeholder="owner@company.com" /></label>
        <label><span>Notification phone</span><input value={d.notify_phone} onChange={set("notify_phone")} placeholder="+14105550123" /></label>
        <label><span>Their Meta pixel ID <em>their own, never a shared one</em></span><input value={d.pixel_id} onChange={set("pixel_id")} placeholder="1234567890123456" inputMode="numeric" /></label>
        <label><span>CAPI access token {d.hasCapi && <em>saved · leave empty to keep it</em>}</span><input type="password" value={d.capi_token} onChange={set("capi_token")} placeholder={d.hasCapi ? "••••••••" : "From their dataset in Events Manager"} autoComplete="off" /></label>

        <h5>Service area</h5>
        <label className="check"><input type="checkbox" checked={d.zipFilter} onChange={set("zipFilter")} /><span>Only accept certain ZIP codes <em>others see "we don't serve your area" and nothing is sent</em></span></label>
        {d.zipFilter && (
          <label className="wide"><span>ZIP codes <em>{zips.length ? `${zips.length} found` : "paste them in any format"}</em></span>
            <textarea rows={3} value={d.zips} onChange={set("zips")} placeholder="20701, 20723, 20759 …" /></label>
        )}

        <details className="wide adv">
          <summary>Advanced</summary>
          <label><span>Own GHL inbound webhook <em>leave empty to use the shared decks webhook</em></span><input value={d.guide_webhook} onChange={set("guide_webhook")} placeholder="https://services.leadconnectorhq.com/hooks/…" spellCheck="false" /></label>
        </details>

        {err && <p className="form-err wide" role="alert">{err}</p>}
        <div className="client-form-btns">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-accent" disabled={busy || logoBusy}><Check size={15} strokeWidth={3} /> {busy ? "Saving…" : isNew ? "Save client" : "Save changes"}</button>
        </div>
      </div>
    </motion.form>
  );
}
