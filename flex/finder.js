import { solve, splitPairs } from "./lib/flex.js";
import { parseLocalISO, toLocalISO } from "./lib/format.js";
import { getPlaces } from "./lib/storage.js";

const api = typeof browser !== "undefined" ? browser : chrome;

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(c);
  return node;
}

function fmt(date) {
  return date.toLocaleString("nb-NO", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

let places = [];

async function init() {
  places = await getPlaces();
  const sel = document.getElementById("place");
  for (const p of places) sel.append(el("option", { value: p.id, text: p.name }));

  // fornuftige default-tider: i morgen 09:00 -> +2 dager 17:00
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 17, 0, 0);
  document.getElementById("earliest").value = toLocalISO(start).slice(0, 16);
  document.getElementById("latest").value = toLocalISO(end).slice(0, 16);

  document.getElementById("wish").addEventListener("submit", onSearch);
}

function readWish() {
  const place = places.find((p) => p.id === document.getElementById("place").value);
  const earliestStart = parseLocalISO(document.getElementById("earliest").value);
  const latestEnd = parseLocalISO(document.getElementById("latest").value);
  const mode = document.querySelector('input[name="mode"]:checked').value;
  const durationMinutes = mode === "duration"
    ? Number(document.getElementById("hours").value) * 60
    : null;
  const filters = {
    category: document.getElementById("category").value || undefined,
    fuel: document.getElementById("fuel").value || undefined,
    maxDistanceM: Number(document.getElementById("maxdist").value) || undefined,
  };
  return { point: place.point, earliestStart, latestEnd, durationMinutes, filters };
}

async function onSearch(e) {
  e.preventDefault();
  const results = document.getElementById("results");
  results.replaceChildren(el("p", { class: "hint", text: "Søker…" }));
  const wish = readWish();
  const res = await api.runtime.sendMessage({
    type: "SEARCH",
    point: wish.point,
    start: toLocalISO(wish.earliestStart),
    end: toLocalISO(wish.latestEnd),
  });
  if (res.error) {
    results.replaceChildren(el("p", { class: "hint", text: errorText(res.error) }));
    return;
  }
  const out = solve(res.result, wish);
  render(results, out, wish, res.result);
}

function errorText(code) {
  if (code === "NOT_LOGGED_IN") return "Åpne app.dele.no i en fane og logg inn først.";
  if (code === "AUTH_EXPIRED") return "Innloggingen utløp. Last app.dele.no på nytt.";
  return `Noe gikk galt: ${code}`;
}

function render(container, out, wish, searchResult) {
  container.replaceChildren();
  bucket(container, "Ledig hele ditt vindu", out.whole, wish);
  bucket(container, "Passer med justering", out.adjusted, wish);
  if (out.siblings.length) bucket(container, "Lignende bil i nærheten", out.siblings, wish);
  if (!out.whole.length && wish.durationMinutes == null) {
    const pairs = splitPairs(searchResult, wish);
    if (pairs.length) renderSplits(container, pairs);
  }
  if (!out.whole.length && !out.adjusted.length) {
    container.append(el("p", { class: "hint", text: "Ingen biler passer i dette tidsrommet. Prøv et større vindu eller lengre gangavstand." }));
  }
}

function renderSplits(container, pairs) {
  const box = el("section", { class: "bucket" }, [el("h2", { text: `Del opp på to biler (${pairs.length})` })]);
  for (const p of pairs) {
    box.append(el("div", { class: "car" }, [
      el("div", { text: `#${p.first.carNumber} ${p.first.model} (${p.first.location.name}) → bytt ${fmt(p.handover)} → #${p.second.carNumber} ${p.second.model} (${p.second.location.name})` }),
    ]));
  }
  container.append(box);
}

function bucket(container, title, fits, wish) {
  if (!fits.length) return;
  const box = el("section", { class: "bucket" }, [el("h2", { text: `${title} (${fits.length})` })]);
  for (const f of fits) box.append(carCard(f, wish));
  container.append(box);
}

function carCard(f, wish) {
  const card = el("div", { class: "car" });
  card.append(el("div", { class: "head" }, [
    el("strong", { text: `#${f.carNumber} ${f.model}` }),
    el("span", { class: "meta", text: `${f.location.name} · ${Math.round(f.location.distance)} m · ${f.hourlyRate} kr/t` }),
  ]));
  if (f.kind === "short") {
    const t = Math.round(f.bestBlockMinutes / 60);
    card.append(el("div", { class: "sub", text: `Kort ned: lengste ledige blokk er ~${t} t` }));
  } else if (f.shiftMinutes > 0 && f.proposed) {
    card.append(el("div", { class: "sub", text: `Skyv start til ${fmt(f.proposed.start)}` }));
  }
  card.append(timeline(f, wish));
  if (f.proposed) {
    const url = `https://app.dele.no/findcar?start=${encodeURIComponent(toLocalISO(f.proposed.start))}&end=${encodeURIComponent(toLocalISO(f.proposed.end))}`;
    card.append(el("a", { class: "open", href: url, target: "_blank", rel: "noopener",
      text: `Åpne i dele.no (velg «${f.location.name}»)` }));
  }
  return card;
}

function timeline(f, wish) {
  const bar = el("div", { class: "timeline" });
  const span = wish.latestEnd - wish.earliestStart;
  const pct = (ms) => `${(ms / span) * 100}%`;
  // Grå bakgrunn = opptatt/utilgjengelig. Tegn ledige segmenter grønt oppå.
  for (const s of f.segments || []) {
    if (s.state !== "AVAILABLE") continue;
    const left = s.start - wish.earliestStart;
    const width = s.end - s.start;
    bar.append(el("div", { class: "seg available", style: `left:${pct(left)};width:${pct(width)}` }));
  }
  // Lilla markør-brakett rundt det foreslåtte booking-vinduet.
  if (f.proposed) {
    const left = f.proposed.start - wish.earliestStart;
    const width = f.proposed.end - f.proposed.start;
    bar.append(el("div", { class: "marker", style: `left:${pct(left)};width:${pct(width)}` }));
  }
  return bar;
}

init();
