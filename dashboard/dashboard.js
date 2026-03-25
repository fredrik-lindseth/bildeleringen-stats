import {
  filterValid,
  filterDriven,
  costStats,
  monthlyCosts,
  yearlyCosts,
  usagePatterns,
  mileageStats,
} from "../lib/stats.js";

import {
  createBarChart,
  createLineChart,
} from "../lib/chart-helpers.js";

import { formatNOK, formatSyncTime } from "../lib/formatters.js";

import { estimateOwnershipCost, estimateVolvoComparison } from "../lib/ownership-cost.js";

import {
  CATEGORIES,
  loadCategories,
  saveCategory,
  categoryStats,
  autoSuggestAll,
} from "../lib/categories.js";

import { storage } from "../lib/browser-polyfill.js";

import { totalCO2, co2Comparison, monthlyCO2 } from "../lib/co2.js";

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// ---------- CSS Color Helpers ----------

/**
 * Read a CSS custom property value from :root.
 */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Convert any CSS color string to rgba() with a given alpha.
 * Uses a scratch canvas to let the browser parse the color.
 */
const _colorCtx = document.createElement("canvas").getContext("2d");
function colorWithAlpha(cssColor, alpha) {
  _colorCtx.fillStyle = cssColor;
  // The browser normalises any color to rgb()/rgba() in fillStyle
  const parsed = _colorCtx.fillStyle;
  if (parsed.startsWith("#")) {
    // Short hex — convert manually
    const r = parseInt(parsed.slice(1, 3), 16);
    const g = parseInt(parsed.slice(3, 5), 16);
    const b = parseInt(parsed.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  // Already rgb(...) or rgba(...)
  return parsed.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
    const parts = inner.split(",").map((s) => s.trim());
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  });
}

// Set Chart.js global defaults for current theme
Chart.defaults.color = cssVar("--color-text-secondary");
Chart.defaults.borderColor = cssVar("--color-border");

// ---------- Formatters ----------

const formatKm = new Intl.NumberFormat("nb-NO", {
  maximumFractionDigits: 0,
});

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

const MONTH_NAMES_FULL = [
  "Januar", "Februar", "Mars", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Desember",
];

function formatMonthLabel(key) {
  // "YYYY-MM" -> "jan 2024"
  const [year, month] = key.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

function formatDuration(hours) {
  if (hours == null || isNaN(hours)) return "–";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} t`;
  return `${h} t ${m} min`;
}

// ---------- DOM Helpers ----------

function $(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

// ---------- DOM References ----------

const statusEl = $("status");
const statusText = $("status-text");
const progressBar = $("progress-bar");
const progressFill = $("progress-fill");
const emptyState = $("empty-state");
const mainContent = $("main-content");
const syncBtn = $("sync-btn");
const lastSyncedEl = $("last-synced");

// ---------- Chart instances (for cleanup) ----------
const charts = {};

function destroyChart(name) {
  if (charts[name]) {
    charts[name].destroy();
    charts[name] = null;
  }
}

// ---------- Status / UI ----------

function showStatus(message) {
  statusText.textContent = message;
  statusEl.hidden = false;
  emptyState.hidden = true;
}

function hideStatus() {
  statusEl.hidden = true;
}

function showProgress(pct) {
  progressBar.hidden = false;
  progressFill.style.width = `${pct}%`;
}

function showEmpty() {
  emptyState.hidden = false;
  mainContent.hidden = true;
  hideStatus();
}

function showMain() {
  mainContent.hidden = false;
  emptyState.hidden = true;
  hideStatus();
}

// ---------- Navigation ----------

const navLinks = document.querySelectorAll(".nav__link");

function updateActiveNav() {
  const sections = document.querySelectorAll(".section");
  let current = "";

  for (const section of sections) {
    const rect = section.getBoundingClientRect();
    if (rect.top <= 140) {
      current = section.id;
    }
  }

  navLinks.forEach((link) => {
    const isActive = link.dataset.section === current;
    link.classList.toggle("nav__link--active", isActive);
  });
}

window.addEventListener("scroll", updateActiveNav, { passive: true });

navLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    navLinks.forEach((l) => l.classList.remove("nav__link--active"));
    link.classList.add("nav__link--active");
  });
});

// ---------- Messaging ----------

async function sendMessage(msg) {
  return browserAPI.runtime.sendMessage(msg);
}

// ---------- Rendering: Section 1 — Kostnader ----------

let allReservations = [];
let selectedYear = "all";

function getFilteredByYear(reservations, year) {
  if (year === "all") return reservations;
  return reservations.filter((r) => {
    const d = new Date(r.start);
    return d.getFullYear() === Number(year);
  });
}

function buildYearSelector(reservations) {
  const container = $("cost-year-selector");
  const years = new Set();
  for (const r of filterValid(reservations)) {
    years.add(new Date(r.start).getFullYear());
  }

  const sorted = [...years].sort((a, b) => a - b);

  // Clear and rebuild
  container.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = "year-btn year-btn--active";
  allBtn.dataset.year = "all";
  allBtn.textContent = "Alle år";
  container.appendChild(allBtn);

  for (const year of sorted) {
    const btn = document.createElement("button");
    btn.className = "year-btn";
    btn.dataset.year = String(year);
    btn.textContent = String(year);
    container.appendChild(btn);
  }

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".year-btn");
    if (!btn) return;

    container.querySelectorAll(".year-btn").forEach((b) =>
      b.classList.remove("year-btn--active")
    );
    btn.classList.add("year-btn--active");

    selectedYear = btn.dataset.year;
    renderCosts(allReservations);
  });
}

function renderCosts(reservations) {
  const filtered = getFilteredByYear(reservations, selectedYear);
  const stats = costStats(filtered);
  const monthly = monthlyCosts(filtered);
  const yearly = yearlyCosts(filtered);
  const mileage = mileageStats(filtered);

  // Yearly total display
  const yearlyEl = document.getElementById("cost-yearly-total");
  if (selectedYear === "all" && yearly.length > 0) {
    yearlyEl.innerHTML = yearly
      .map(
        (y) =>
          `<div class="yearly-row"><span>${y.year}</span><span>${formatNOK.format(y.total)}</span></div>`
      )
      .join("");
  } else if (stats) {
    yearlyEl.textContent = formatNOK.format(stats.total);
  } else {
    yearlyEl.textContent = "–";
  }

  // Stat cards
  setText("cost-avg-trip", stats ? formatNOK.format(stats.average) : "–");
  setText("cost-median-trip", stats ? formatNOK.format(stats.median) : "–");
  setText("cost-max-trip", stats ? formatNOK.format(stats.max) : "–");
  setText("cost-min-trip", stats ? formatNOK.format(stats.min) : "–");

  // Cost per km
  if (stats && mileage && mileage.total > 0) {
    const costPerKm = stats.total / mileage.total;
    setText("cost-per-km", `${formatNOK.format(costPerKm)}/km`);
  } else {
    setText("cost-per-km", "–");
  }

  // Monthly cost bar chart
  destroyChart("monthlyCost");
  if (monthly.length > 0) {
    const labels = monthly.map((m) => formatMonthLabel(m.month));
    const data = monthly.map((m) => m.total);
    charts.monthlyCost = createBarChart(
      $("monthly-cost-chart"),
      labels,
      data,
      "Kostnad",
      { yTitle: "Kr" }
    );
  }
}

// ---------- Rendering: Section 2 — Bruksmønster ----------

function renderUsage(reservations) {
  const patterns = usagePatterns(reservations);
  const valid = filterValid(reservations);

  // Heatmap
  const heatmapCanvas = $("heatmap-chart");
  renderHeatmapWithLabels(heatmapCanvas, patterns.heatmap);

  // Trips per month line chart
  destroyChart("tripsPerMonth");
  const tpmEntries = Object.entries(patterns.tripsPerMonth).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  if (tpmEntries.length > 0) {
    const labels = tpmEntries.map(([key]) => formatMonthLabel(key));
    const data = tpmEntries.map(([, val]) => val);
    charts.tripsPerMonth = createLineChart(
      $("trips-per-month-chart"),
      labels,
      data,
      "Turer",
      { yTitle: "Antall" }
    );
  }

  // Stat cards
  setText("usage-avg-duration", formatDuration(patterns.avgDuration));
  setText("usage-total-trips", valid.length.toString());

  // Top cars list
  const topCarsList = $("top-cars-list");
  topCarsList.innerHTML = "";
  const top5 = patterns.topCars.slice(0, 5);
  if (top5.length === 0) {
    topCarsList.innerHTML = '<li class="ranked-list__empty">Ingen data</li>';
  } else {
    for (let i = 0; i < top5.length; i++) {
      const li = document.createElement("li");
      li.className = "ranked-list__item";
      li.innerHTML = `
        <span class="ranked-list__rank">${i + 1}</span>
        <span class="ranked-list__name">${escapeHtml(top5[i].name)}</span>
        <span class="ranked-list__value">${top5[i].count} turer</span>
      `;
      topCarsList.appendChild(li);
    }
  }
}

/**
 * Draw heatmap with day/hour labels on the canvas directly.
 */
function renderHeatmapWithLabels(canvas, heatmapData) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const dayLabels = ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"];
  const labelW = 36;
  const labelH = 20;
  const paddingRight = 4;

  const availableW = canvas.clientWidth || 700;
  const cellW = Math.floor((availableW - labelW - paddingRight) / 24);
  const cellH = 24;
  const totalW = labelW + cellW * 24 + paddingRight;
  const totalH = labelH + cellH * 7 + 4;

  canvas.width = totalW * dpr;
  canvas.height = totalH * dpr;
  canvas.style.width = totalW + "px";
  canvas.style.height = totalH + "px";
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, totalW, totalH);

  const max = Math.max(...heatmapData.flat(), 1);

  // Get CSS custom property values for theming
  const styles = getComputedStyle(document.documentElement);
  const emptyColor = styles.getPropertyValue("--color-heatmap-empty").trim();
  const textColor = styles.getPropertyValue("--color-heatmap-text").trim();
  const heatmapFill = styles.getPropertyValue("--color-heatmap-fill").trim();

  // Hour labels
  ctx.font = "11px " + getComputedStyle(document.body).fontFamily;
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  for (let h = 0; h < 24; h += 3) {
    ctx.fillText(
      String(h).padStart(2, "0"),
      labelW + h * cellW + cellW / 2,
      labelH - 5
    );
  }

  // Day rows
  for (let day = 0; day < 7; day++) {
    const y = labelH + day * cellH;

    // Day label
    ctx.fillStyle = textColor;
    ctx.textAlign = "right";
    ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
    ctx.fillText(dayLabels[day], labelW - 6, y + cellH / 2 + 4);

    for (let hour = 0; hour < 24; hour++) {
      const x = labelW + hour * cellW;
      const intensity = heatmapData[day][hour] / max;

      if (intensity === 0) {
        ctx.fillStyle = emptyColor;
      } else {
        ctx.fillStyle = colorWithAlpha(heatmapFill, 0.15 + intensity * 0.85);
      }
      // Use roundRect if available, fallback to fillRect for older browsers
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(x, y, cellW - 2, cellH - 2, 3);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, cellW - 2, cellH - 2);
      }
    }
  }
}

// ---------- Rendering: Section 3 — Kilometer ----------

function renderMileage(reservations) {
  const mileage = mileageStats(reservations);

  if (!mileage) {
    $("km-empty").hidden = false;
    $("km-content").hidden = true;
    return;
  }

  $("km-empty").hidden = true;
  $("km-content").hidden = false;

  // Stat cards
  setText("km-total", `${formatKm.format(mileage.total)} km`);
  setText("km-avg", `${formatKm.format(mileage.average)} km`);
  setText("km-max", `${formatKm.format(mileage.max)} km`);

  // Monthly distance bar chart
  destroyChart("monthlyKm");
  if (mileage.byMonth.length > 0) {
    const labels = mileage.byMonth.map(([key]) => formatMonthLabel(key));
    const data = mileage.byMonth.map(([, val]) => val);
    charts.monthlyKm = createBarChart(
      $("monthly-km-chart"),
      labels,
      data,
      "Distanse",
      { yTitle: "Km" }
    );
  }

  // Km by car list
  const list = $("km-by-car-list");
  list.innerHTML = "";
  const top5 = mileage.byCar.slice(0, 5);
  if (top5.length === 0) {
    list.innerHTML = '<li class="ranked-list__empty">Ingen data</li>';
  } else {
    for (let i = 0; i < top5.length; i++) {
      const li = document.createElement("li");
      li.className = "ranked-list__item";
      li.innerHTML = `
        <span class="ranked-list__rank">${i + 1}</span>
        <span class="ranked-list__name">${escapeHtml(top5[i][0])}</span>
        <span class="ranked-list__value">${formatKm.format(top5[i][1])} km</span>
      `;
      list.appendChild(li);
    }
  }
}

// ---------- Rendering: Section 4 — Trender ----------

function renderTrends(reservations) {
  const monthly = monthlyCosts(reservations);
  const yearly = yearlyCosts(reservations);

  if (monthly.length < 3) {
    $("trends-empty").hidden = false;
    $("trends-content").hidden = true;
    return;
  }

  $("trends-empty").hidden = true;
  $("trends-content").hidden = false;

  // Year-over-year comparison
  destroyChart("yoy");
  if (yearly.length >= 2) {
    renderYearOverYear(reservations, yearly);
  }

  // Rolling 3-month average
  destroyChart("rollingAvg");
  renderRollingAverage(monthly);

  // Seasonal comparison (need at least 2 years of data)
  if (yearly.length >= 2) {
    $("seasonal-container").hidden = false;
    destroyChart("seasonal");
    renderSeasonalComparison(reservations, yearly);
  } else {
    $("seasonal-container").hidden = true;
  }
}

function renderYearOverYear(reservations, yearly) {
  const canvas = $("yoy-chart");

  // Build datasets per year, indexed by month 0-11
  const datasets = [];
  const colors = [1, 2, 3, 4, 5].map((n) => {
    const c = cssVar(`--color-chart-${n}`);
    return { border: c, bg: colorWithAlpha(c, 0.1) };
  });

  for (let i = 0; i < yearly.length; i++) {
    const year = yearly[i].year;
    const yearData = filterValid(reservations).filter(
      (r) => new Date(r.start).getFullYear() === year
    );

    const byMonth = Array(12).fill(0);
    for (const r of yearData) {
      byMonth[new Date(r.start).getMonth()] += r.price.total;
    }

    const color = colors[i % colors.length];
    datasets.push({
      label: String(year),
      data: byMonth,
      borderColor: color.border,
      backgroundColor: color.bg,
      tension: 0.3,
      fill: false,
    });
  }

  charts.yoy = new Chart(canvas, {
    type: "line",
    data: {
      labels: MONTH_NAMES_FULL,
      datasets,
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true, position: "top" } },
      scales: {
        x: { ticks: { maxTicksLimit: 12, font: { size: 11 } } },
        y: { beginAtZero: true, title: { display: true, text: "Kr", font: { size: 12 } } },
      },
    },
  });
}

function renderRollingAverage(monthly) {
  const canvas = $("rolling-avg-chart");

  if (monthly.length < 3) return;

  const labels = [];
  const data = [];

  for (let i = 2; i < monthly.length; i++) {
    const avg =
      (monthly[i].total + monthly[i - 1].total + monthly[i - 2].total) / 3;
    labels.push(formatMonthLabel(monthly[i].month));
    data.push(Math.round(avg));
  }

  charts.rollingAvg = createLineChart(canvas, labels, data, "3-mnd. snitt", { yTitle: "Kr" });
}

function renderSeasonalComparison(reservations, yearly) {
  const canvas = $("seasonal-chart");
  const valid = filterValid(reservations);

  // Average cost per month across all years
  const monthTotals = Array(12).fill(0);
  const monthCounts = Array(12).fill(0);

  for (const r of valid) {
    const d = new Date(r.start);
    monthTotals[d.getMonth()] += r.price.total;
    monthCounts[d.getMonth()]++;
  }

  const avgPerMonth = monthTotals.map((total, i) =>
    monthCounts[i] > 0 ? Math.round(total / yearly.length) : 0
  );

  charts.seasonal = createBarChart(
    canvas,
    MONTH_NAMES_FULL,
    avgPerMonth,
    "Snitt månedskostnad",
    { yTitle: "Kr" }
  );
}

// ---------- Rendering: Section 5 — Bilregnestykket ----------

function renderOwnership(reservations) {
  const result = estimateOwnershipCost(reservations);

  if (!result) {
    $("ownership-empty").hidden = false;
    $("ownership-content").hidden = true;
    return;
  }

  $("ownership-empty").hidden = true;
  $("ownership-content").hidden = false;

  // Set cost amounts
  setText("sharing-cost", formatNOK.format(result.sharingCost));
  setText("ownership-cost", formatNOK.format(result.ownershipCost));

  // Build verdict
  const verdictEl = $("comparison-verdict");
  if (result.savings > 0) {
    verdictEl.textContent = `Du sparer ${formatNOK.format(result.savings)} per år med bildeling`;
    verdictEl.className = "comparison__verdict comparison__verdict--saving";
  } else {
    verdictEl.textContent = `Bildeling koster ${formatNOK.format(Math.abs(result.savings))} mer per år`;
    verdictEl.className = "comparison__verdict comparison__verdict--more";
  }

  // Ownership breakdown horizontal bar chart
  destroyChart("ownershipBreakdown");
  const bd = result.breakdownOwnership;
  const breakdownLabels = [
    "Verditap",
    "Forsikring",
    "Årsavgift",
    "Vedlikehold",
    "Parkering",
    "Drivstoff",
  ];
  const breakdownData = [
    bd.depreciation,
    bd.insurance,
    bd.tax,
    bd.maintenance,
    bd.parking,
    bd.fuel,
  ];
  const breakdownColors = [
    cssVar("--color-chart-1"),
    cssVar("--color-chart-2"),
    cssVar("--color-chart-3"),
    cssVar("--color-chart-4"),
    cssVar("--color-chart-5"),
    cssVar("--color-tertiary"),
  ];

  charts.ownershipBreakdown = new Chart($("ownership-breakdown-chart"), {
    type: "bar",
    data: {
      labels: breakdownLabels,
      datasets: [{
        label: "Kostnad",
        data: breakdownData,
        backgroundColor: breakdownColors,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = new Intl.NumberFormat("nb-NO").format(ctx.parsed.x);
              return `${val} kr`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Kr", font: { size: 12 } },
        },
        y: {
          ticks: { font: { size: 12 } },
        },
      },
    },
  });

  // Volvo EX C40 comparison
  const volvo = estimateVolvoComparison(reservations);
  if (volvo) {
    setText("volvo-sharing-cost", formatNOK.format(volvo.sharingCost));
    setText("volvo-ownership-cost", formatNOK.format(volvo.ownershipCost));

    const volvoVerdictEl = $("volvo-verdict");
    if (volvo.savings > 0) {
      volvoVerdictEl.textContent = `Du sparer ${formatNOK.format(volvo.savings)} per år med bildeling`;
      volvoVerdictEl.className = "comparison__verdict comparison__verdict--saving";
    } else {
      volvoVerdictEl.textContent = `Bildeling koster ${formatNOK.format(Math.abs(volvo.savings))} mer per år`;
      volvoVerdictEl.className = "comparison__verdict comparison__verdict--more";
    }
  }

  // Note text
  const categoryName = result.category || "ukjent";
  const noteEl = $("comparison-note");
  noteEl.textContent =
    `Estimat basert på din mest brukte bilkategori (${categoryName}) og Volvo EX C40 2026. ` +
    `Eierkostnader inkluderer verditap, forsikring, årsavgift, vedlikehold, parkering og drivstoff/strøm.`;
}

// ---------- Rendering: Section 6 — Turkategorier ----------

async function renderCategories(reservations) {
  // 1. Load saved categories from storage
  const savedCategories = await loadCategories(storage);

  // 2. Auto-suggest for uncategorized trips
  const suggestions = autoSuggestAll(reservations, savedCategories);

  // 3. Merge saved + suggestions for stats display
  const merged = { ...suggestions, ...savedCategories };

  // 4. Calculate stats
  const stats = categoryStats(reservations, merged);

  // 5. Render donut chart (cost distribution)
  destroyChart("categoryDonut");
  const entries = Object.entries(stats).filter(([, v]) => v.totalCost > 0);
  if (entries.length > 0) {
    const labels = entries.map(([, v]) => v.label);
    const data = entries.map(([, v]) => v.totalCost);
    const colors = entries.map((_, i) => cssVar(`--color-chart-${(i % 5) + 1}`));

    charts.categoryDonut = new Chart($("category-donut-chart"), {
      type: "doughnut",
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "right" },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = formatNOK.format(ctx.parsed);
                const pct = Math.round((ctx.parsed / data.reduce((a, b) => a + b, 0)) * 100);
                return `${ctx.label}: ${val} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  // 6. Render category table
  const tableEl = $("category-table");
  tableEl.innerHTML = "";
  for (const [key, val] of entries.sort(([, a], [, b]) => b.totalCost - a.totalCost)) {
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <span class="category-row__name">${escapeHtml(val.label)}</span>
      <span class="category-row__stat">${val.count} turer</span>
      <span class="category-row__stat">${formatNOK.format(val.totalCost)}</span>
    `;
    tableEl.appendChild(row);
  }

  // 7. Show uncategorized trips with suggestions (max 10)
  const uncategorizedWithSuggestions = filterDriven(reservations)
    .filter(r => !savedCategories[r.id] && suggestions[r.id])
    .slice(0, 10);

  if (uncategorizedWithSuggestions.length > 0) {
    $("uncategorized-section").hidden = false;
    const listEl = $("suggestion-list");
    listEl.innerHTML = "";

    for (const r of uncategorizedWithSuggestions) {
      const catKey = suggestions[r.id];
      const catLabel = CATEGORIES[catKey]?.label || catKey;
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.innerHTML = `
        <span class="suggestion-item__notes">${escapeHtml(r.notes || "Ingen notat")}</span>
        <button class="suggestion-item__btn" data-id="${r.id}" data-cat="${catKey}">${escapeHtml(catLabel)}</button>
      `;
      listEl.appendChild(item);
    }

    // Click handler for accepting suggestions
    listEl.addEventListener("click", async (e) => {
      const btn = e.target.closest(".suggestion-item__btn");
      if (!btn) return;
      await saveCategory(storage, btn.dataset.id, btn.dataset.cat);
      btn.textContent = "\u2713";
      btn.disabled = true;
    });
  } else {
    $("uncategorized-section").hidden = true;
  }
}

// ---------- Rendering: Section 7 — Klimaregnskap ----------

function renderClimate(reservations) {
  const total = totalCO2(reservations);
  const comparison = co2Comparison(reservations);
  const monthly = monthlyCO2(reservations);

  if (!total) {
    $("co2-empty").hidden = false;
    $("co2-content").hidden = true;
    return;
  }

  $("co2-empty").hidden = true;
  $("co2-content").hidden = false;

  // Comparison
  const formatKg = (kg) => `${formatKm.format(Math.round(kg))}`;
  setText("co2-sharing", formatKg(comparison.sharingCO2Kg));
  setText("co2-private", formatKg(comparison.privateCO2Kg));

  const verdictEl = $("co2-verdict");
  if (comparison.savedKg > 0) {
    verdictEl.textContent = `Du sparer ${formatKg(comparison.savedKg)} kg CO\u2082 per \u00e5r med bildeling`;
    verdictEl.className = "comparison__verdict comparison__verdict--saving";
  } else {
    verdictEl.textContent = `Bildeling gir ${formatKg(Math.abs(comparison.savedKg))} kg mer CO\u2082 per \u00e5r`;
    verdictEl.className = "comparison__verdict comparison__verdict--more";
  }

  // Monthly chart
  destroyChart("monthlyCO2");
  if (monthly.length > 0) {
    charts.monthlyCO2 = createBarChart(
      $("monthly-co2-chart"),
      monthly.map(m => formatMonthLabel(m.month)),
      monthly.map(m => Math.round(m.co2Kg)),
      "CO\u2082",
      { yTitle: "Kg" }
    );
  }

  // Stat cards
  setText("co2-total", `${formatKm.format(Math.round(total.totalKg))} kg`);
  setText("co2-avg-km", `${Math.round(total.avgPerKm)} g/km`);

  // Electric percentage
  const elTrips = total.byFuelType["Elektrisitet"]?.trips || 0;
  const elPct = total.tripCount > 0 ? Math.round((elTrips / total.tripCount) * 100) : 0;
  setText("co2-electric-pct", `${elPct}%`);

  // Fuel type breakdown
  const fuelList = $("co2-fuel-list");
  fuelList.innerHTML = "";
  for (const [fuel, data] of Object.entries(total.byFuelType).sort(([,a],[,b]) => b.kg - a.kg)) {
    if (data.trips === 0) continue;
    const row = document.createElement("div");
    row.className = "category-row";
    row.innerHTML = `
      <span class="category-row__name">${escapeHtml(fuel)}</span>
      <span class="category-row__stat">${data.trips} turer</span>
      <span class="category-row__stat">${formatKm.format(Math.round(data.kg))} kg</span>
    `;
    fuelList.appendChild(row);
  }
}

// ---------- Utility ----------

function escapeHtml(str) {
  const el = document.createElement("span");
  el.textContent = str;
  return el.innerHTML;
}

// ---------- Sync ----------

async function handleSync(force = false) {
  syncBtn.disabled = true;
  syncBtn.classList.add("is-syncing");
  showStatus("Synkroniserer...");
  showProgress(30);

  const result = await sendMessage({ type: "REQUEST_SYNC", force });

  syncBtn.disabled = false;
  syncBtn.classList.remove("is-syncing");
  progressBar.hidden = true;

  if (result && result.error) {
    const msg =
      result.error === "NOT_LOGGED_IN" || result.error === "AUTH_EXPIRED"
        ? "Logg inn på app.dele.no først"
        : `Feil: ${result.error}`;
    showStatus(msg);
    return false;
  }

  return true;
}

// ---------- Init ----------

async function init() {
  showStatus("Laster data...");

  // Try to get cached data first
  let data = await sendMessage({ type: "GET_DATA" });

  if (!data || !data.reservations || data.reservations.length === 0) {
    // No data — try a sync
    showStatus("Ingen data funnet. Synkroniserer...");
    showProgress(20);

    const synced = await handleSync(false);
    if (!synced) {
      showEmpty();
      return;
    }

    data = await sendMessage({ type: "GET_DATA" });
    if (!data || !data.reservations || data.reservations.length === 0) {
      showEmpty();
      return;
    }
  }

  // We have data — render everything
  allReservations = data.reservations;
  lastSyncedEl.textContent = formatSyncTime(data.lastSync);

  buildYearSelector(allReservations);
  renderCosts(allReservations);
  renderUsage(allReservations);
  renderMileage(allReservations);
  renderTrends(allReservations);
  renderOwnership(allReservations);
  await renderCategories(allReservations);
  renderClimate(allReservations);

  showMain();
}

// Summary button
$("summary-btn").addEventListener("click", () => {
  browserAPI.tabs.create({ url: browserAPI.runtime.getURL("summary/summary.html") });
});

// Sync button
syncBtn.addEventListener("click", async () => {
  const synced = await handleSync(true);
  if (!synced) return;

  const data = await sendMessage({ type: "GET_DATA" });
  if (data && data.reservations && data.reservations.length > 0) {
    allReservations = data.reservations;
    lastSyncedEl.textContent = formatSyncTime(data.lastSync);

    buildYearSelector(allReservations);
    renderCosts(allReservations);
    renderUsage(allReservations);
    renderMileage(allReservations);
    renderTrends(allReservations);
    renderOwnership(allReservations);
    await renderCategories(allReservations);
    renderClimate(allReservations);

    showMain();
  } else {
    showEmpty();
  }
});

// Start
init();
