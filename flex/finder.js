import { solve, splitPairs } from "./lib/flex.js";
import { parseLocalISO, toLocalISO } from "./lib/format.js";
import { getPlaces } from "./lib/storage.js";

const api = typeof browser !== "undefined" ? browser : chrome;

const STATE_LABEL = { AVAILABLE: "Ledig", RESERVED: "Opptatt", UNAVAILABLE: "Utilgjengelig" };

let tipEl = null;
function showTip(target, text) {
  if (!tipEl) {
    tipEl = document.createElement("div");
    tipEl.className = "tip";
    tipEl.hidden = true;
    document.body.append(tipEl);
  }
  tipEl.textContent = text;
  tipEl.hidden = false;
  const r = target.getBoundingClientRect();
  const t = tipEl.getBoundingClientRect();
  const left = Math.max(8, Math.min(r.left + r.width / 2 - t.width / 2, window.innerWidth - t.width - 8));
  tipEl.style.left = `${left}px`;
  tipEl.style.top = `${Math.max(8, r.top - t.height - 8)}px`;
}
function hideTip() {
  if (tipEl) tipEl.hidden = true;
}

const CATEGORIES = ["Småbil", "Minibil", "Kombi", "Stasjonsvogn", "SUV", "Varebil"];
const CATEGORY_OFF_BY_DEFAULT = new Set(["Småbil", "Varebil"]);
const FUELS = ["Bensin", "Diesel", "Elektrisitet"];
const WEEKDAYS = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

const pad = (n) => String(n).padStart(2, "0");
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function fmtDay(date) {
  return cap(date.toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short" }));
}
function fmtTime(date) {
  return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}
function fmtRange(a, b) {
  const sameDay = a.toDateString() === b.toDateString();
  return sameDay
    ? `${fmtDay(a)} ${fmtTime(a)}–${fmtTime(b)}`
    : `${fmtDay(a)} ${fmtTime(a)} – ${fmtDay(b)} ${fmtTime(b)}`;
}

let places = [];
let rangeStart = null;
let rangeEnd = null;
let calView = null;

async function init() {
  places = await getPlaces();
  const placeSel = document.getElementById("place");
  for (const p of places) placeSel.append(el("option", { value: p.id, text: p.name }));

  buildTimeOptions();
  document.getElementById("startTime").value = "09:00";
  document.getElementById("endTime").value = "17:00";
  buildChips("categoryChips", CATEGORIES, (v) => !CATEGORY_OFF_BY_DEFAULT.has(v));
  buildChips("fuelChips", FUELS, () => true);

  initCalendar();
  document.getElementById("startTime").addEventListener("change", updateSummary);
  document.getElementById("endTime").addEventListener("change", updateSummary);

  wireDurationToggle();
  document.getElementById("wish").addEventListener("submit", onSearch);
}

const atMidnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function initCalendar() {
  const now = new Date();
  rangeStart = atMidnight(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  rangeEnd = atMidnight(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3));
  calView = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  document.getElementById("calPrev").addEventListener("click", () => shiftMonth(-1));
  document.getElementById("calNext").addEventListener("click", () => shiftMonth(1));
  renderCalendar();
}

function shiftMonth(dir) {
  calView = new Date(calView.getFullYear(), calView.getMonth() + dir, 1);
  renderCalendar();
}

function pickDay(date) {
  if (!rangeStart || rangeEnd || date < rangeStart) {
    rangeStart = date;
    rangeEnd = null;
  } else {
    rangeEnd = date;
  }
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById("calGrid");
  grid.replaceChildren();
  document.getElementById("calMonth").textContent =
    cap(calView.toLocaleDateString("nb-NO", { month: "long", year: "numeric" }));

  const today = atMidnight(new Date());
  document.getElementById("calPrev").disabled =
    calView.getFullYear() === today.getFullYear() && calView.getMonth() === today.getMonth();

  for (const wd of WEEKDAYS) grid.append(el("div", { class: "cal__wd", text: wd }));

  const lead = (new Date(calView.getFullYear(), calView.getMonth(), 1).getDay() + 6) % 7;
  for (let i = 0; i < lead; i++) grid.append(el("div", { class: "cal__day is-empty" }));

  const days = new Date(calView.getFullYear(), calView.getMonth() + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = new Date(calView.getFullYear(), calView.getMonth(), d);
    const btn = el("button", { type: "button", class: "cal__day", text: String(d) });
    const past = date < today;
    if (past) btn.disabled = true;
    if (date.getTime() === today.getTime()) btn.classList.add("is-today");
    if (rangeStart && date.getTime() === rangeStart.getTime()) btn.classList.add("is-start");
    if (rangeEnd && date.getTime() === rangeEnd.getTime()) btn.classList.add("is-end");
    if (rangeStart && rangeEnd && date > rangeStart && date < rangeEnd) btn.classList.add("in-range");
    if (!past) btn.addEventListener("click", () => pickDay(date));
    grid.append(btn);
  }
  updateSummary();
}

function updateSummary() {
  const s = document.getElementById("rangeSummary");
  if (!rangeStart) { s.textContent = "Velg startdag"; return; }
  const st = document.getElementById("startTime").value;
  if (!rangeEnd) { s.textContent = `${fmtDay(rangeStart)} ${st} — velg sluttdag`; return; }
  const et = document.getElementById("endTime").value;
  s.textContent = `${fmtDay(rangeStart)} ${st} → ${fmtDay(rangeEnd)} ${et}`;
}

function buildTimeOptions() {
  const start = document.getElementById("startTime");
  const end = document.getElementById("endTime");
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const t = `${pad(h)}:${pad(m)}`;
      start.append(el("option", { value: t, text: t }));
      end.append(el("option", { value: t, text: t }));
    }
  }
}

function readRange() {
  const st = document.getElementById("startTime").value;
  const et = document.getElementById("endTime").value;
  const endDay = rangeEnd || rangeStart;
  return {
    start: parseLocalISO(`${dayKey(rangeStart)}T${st}:00`),
    end: parseLocalISO(`${dayKey(endDay)}T${et}:00`),
  };
}

function buildChips(containerId, values, isOn) {
  const box = document.getElementById(containerId);
  for (const v of values) {
    const chip = el("button", {
      type: "button",
      class: "chip",
      "data-val": v,
      "aria-pressed": String(isOn(v)),
      text: v,
    });
    chip.addEventListener("click", () => {
      chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") === "true" ? "false" : "true");
    });
    box.append(chip);
  }
}

function pressedValues(containerId) {
  return [...document.querySelectorAll(`#${containerId} .chip[aria-pressed="true"]`)]
    .map((c) => c.getAttribute("data-val"));
}

function wireDurationToggle() {
  const hoursRow = document.getElementById("hoursRow");
  const sync = () => {
    const duration = document.querySelector('input[name="mode"]:checked').value === "duration";
    hoursRow.classList.toggle("is-disabled", !duration);
  };
  for (const r of document.querySelectorAll('input[name="mode"]')) {
    r.addEventListener("change", sync);
  }
  sync();
}

function readWish() {
  const place = places.find((p) => p.id === document.getElementById("place").value);
  const { start: earliestStart, end: latestEnd } = readRange();
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const durationMinutes = mode === "duration" ? Number(document.getElementById("hours").value) * 60 : null;

  const categories = pressedValues("categoryChips");
  const fuels = pressedValues("fuelChips");
  const filters = {
    categories: categories.length ? categories : undefined,
    fuels: fuels.length && fuels.length < FUELS.length ? fuels : undefined,
    maxDistanceM: Number(document.getElementById("maxdist").value) || undefined,
  };
  return { point: place.point, earliestStart, latestEnd, durationMinutes, filters };
}

async function onSearch(e) {
  e.preventDefault();
  const results = document.getElementById("results");
  const wish = readWish();

  if (wish.latestEnd <= wish.earliestStart) {
    results.replaceChildren(el("p", { class: "hint", text: "Sluttidspunktet må være etter starten." }));
    return;
  }
  results.replaceChildren(el("p", { class: "hint", text: "Søker…" }));

  let res;
  try {
    res = await api.runtime.sendMessage({
      type: "SEARCH",
      point: wish.point,
      start: toLocalISO(wish.earliestStart),
      end: toLocalISO(wish.latestEnd),
    });
  } catch (err) {
    results.replaceChildren(el("p", { class: "hint", text: errorText(null) }));
    return;
  }
  if (!res || res.error) {
    results.replaceChildren(el("p", { class: "hint", text: errorText(res && res.error) }));
    return;
  }
  render(results, solve(res.result, wish), wish, res.result);
}

function errorText(code) {
  if (code === "NOT_LOGGED_IN") return "Åpne app.dele.no i en fane og logg inn først.";
  if (code === "AUTH_EXPIRED") return "Innloggingen utløp. Last app.dele.no på nytt.";
  if (!code) return "Fikk ikke svar fra utvidelsen. Sjekk at app.dele.no er åpen, og prøv igjen.";
  return `Noe gikk galt: ${code}`;
}

function render(container, out, wish, searchResult) {
  container.replaceChildren();
  bucket(container, "Ledig hele ditt vindu", out.whole, wish, "ok");
  bucket(container, "Passer med justering", out.adjusted, wish, "adjust");
  if (out.siblings.length) bucket(container, "Lignende bil i nærheten", out.siblings, wish, "sibling");
  if (!out.whole.length && wish.durationMinutes == null) {
    const pairs = splitPairs(searchResult, wish);
    if (pairs.length) renderSplits(container, pairs);
  }
  if (!out.whole.length && !out.adjusted.length && !out.siblings.length) {
    container.append(el("p", { class: "hint",
      text: "Ingen biler passer i dette tidsrommet. Prøv et større vindu, lengre gangavstand, eller flere biltyper." }));
  }
}

function bucket(container, title, fits, wish, variant) {
  if (!fits.length) return;
  const box = el("section", { class: `bucket bucket--${variant}` }, [
    el("h2", { class: "bucket__title" }, [
      el("span", { class: "bucket__dot" }),
      el("span", { text: title }),
      el("span", { class: "bucket__count", text: String(fits.length) }),
    ]),
  ]);
  for (const f of fits) box.append(carCard(f, wish));
  container.append(box);
}

function carCard(f, wish) {
  const card = el("div", { class: "car" });
  card.append(el("div", { class: "car__top" }, [
    el("div", { class: "car__title" }, [
      el("span", { class: "car__model", text: f.model }),
      el("span", { class: "car__num", text: `#${f.carNumber}` }),
    ]),
    el("span", { class: "car__price", text: `${f.hourlyRate} kr/t` }),
  ]));
  card.append(el("div", { class: "car__meta", text: `${f.location.name} · ${Math.round(f.location.distance)} m unna` }));

  if (f.kind === "short") {
    const t = Math.round((f.bestBlockMinutes / 60) * 10) / 10;
    card.append(el("div", { class: "car__note", text: `Kortere enn ønsket: lengste ledige blokk er ~${t} t` }));
  }

  card.append(timeline(f, wish));

  const foot = el("div", { class: "car__foot" });
  if (f.proposed) {
    foot.append(el("span", { class: "car__window", text: fmtRange(f.proposed.start, f.proposed.end) }));
    // Rå colon i tidsstemplene: dele.no sin ruter tolker %3A som "Invalid date".
    const url = `https://app.dele.no/findcar?start=${toLocalISO(f.proposed.start)}&end=${toLocalISO(f.proposed.end)}`;
    const label = f.coversWholeWindow ? "Åpne i dele.no →" : "Åpne justert tid →";
    foot.append(el("a", { class: "car__open", href: url, target: "_blank", rel: "noopener",
      text: label, title: `Åpner dele.no på ${fmtRange(f.proposed.start, f.proposed.end)} — velg «${f.location.name}»` }));
  }
  card.append(foot);
  return card;
}

function timeline(f, wish) {
  const wrap = el("div");
  const bar = el("div", { class: "timeline" });
  const span = wish.latestEnd - wish.earliestStart;
  const pct = (ms) => `${(ms / span) * 100}%`;
  for (const s of f.segments || []) {
    const label = `${STATE_LABEL[s.state] || s.state}: ${fmtRange(s.start, s.end)}`;
    const seg = el("div", {
      class: s.state === "AVAILABLE" ? "seg available" : "seg busy",
      style: `left:${pct(s.start - wish.earliestStart)};width:${pct(s.end - s.start)}`,
    });
    seg.addEventListener("mouseenter", () => showTip(seg, label));
    seg.addEventListener("mouseleave", hideTip);
    bar.append(seg);
  }
  if (f.proposed) {
    bar.append(el("div", { class: "marker",
      style: `left:${pct(f.proposed.start - wish.earliestStart)};width:${pct(f.proposed.end - f.proposed.start)}` }));
  }
  const sameDay = wish.earliestStart.toDateString() === wish.latestEnd.toDateString();
  wrap.append(bar);
  wrap.append(el("div", { class: "timeline__axis" }, [
    el("span", { text: `${fmtDay(wish.earliestStart)} ${fmtTime(wish.earliestStart)}` }),
    el("span", { text: sameDay ? fmtTime(wish.latestEnd) : `${fmtDay(wish.latestEnd)} ${fmtTime(wish.latestEnd)}` }),
  ]));
  return wrap;
}

function renderSplits(container, pairs) {
  const box = el("section", { class: "bucket bucket--split" }, [
    el("h2", { class: "bucket__title" }, [
      el("span", { class: "bucket__dot" }),
      el("span", { text: "Del opp på to biler" }),
      el("span", { class: "bucket__count", text: String(pairs.length) }),
    ]),
  ]);
  for (const p of pairs) {
    box.append(el("div", { class: "car" }, [
      el("div", { class: "split" }, [
        el("strong", { text: `#${p.first.carNumber} ${p.first.model}` }),
        el("span", { text: ` (${p.first.location.name}) ` }),
        el("span", { class: "swap", text: `→ bytt ${fmtDay(p.handover)} ${fmtTime(p.handover)} →` }),
        el("strong", { text: ` #${p.second.carNumber} ${p.second.model}` }),
        el("span", { text: ` (${p.second.location.name})` }),
      ]),
    ]));
  }
  container.append(box);
}

init();
