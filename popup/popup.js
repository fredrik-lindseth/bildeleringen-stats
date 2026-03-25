import { currentMonthStats, monthlyCosts, usagePatterns } from "../lib/stats.js";
import { createSparkline } from "../lib/chart-helpers.js";
import { formatNOK, formatSyncTime } from "../lib/formatters.js";
import { estimateOwnershipCost } from "../lib/ownership-cost.js";
import { co2Comparison } from "../lib/co2.js";

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// DOM references
const statusEl = document.getElementById("status");
const statsSection = document.getElementById("stats-section");
const spendThisMonth = document.getElementById("spend-this-month");
const spendLastMonth = document.getElementById("spend-last-month");
const tripsThisMonth = document.getElementById("trips-this-month");
const avgCost = document.getElementById("avg-cost");
const mostUsedCar = document.getElementById("most-used-car");
const sparklineCanvas = document.getElementById("sparkline-canvas");
const syncBtn = document.getElementById("sync-btn");
const lastSyncedEl = document.getElementById("last-synced");
const dashboardLink = document.getElementById("dashboard-link");
const emptyNote = document.getElementById("empty-note");

// Track chart instance to avoid leaks on re-render
let sparklineChart = null;

const statusText = document.getElementById("status-text");
const progressEl = document.getElementById("progress");
const progressBar = document.getElementById("progress-bar");

function showStatus(message, progress = null) {
  statusText.textContent = message;
  statusEl.hidden = false;

  if (progress !== null) {
    progressEl.hidden = false;
    progressBar.style.width = `${progress}%`;
  } else {
    progressEl.hidden = true;
    progressBar.style.width = "0%";
  }
}

function hideStatus() {
  statusEl.hidden = true;
  progressEl.hidden = true;
}

// Listen for progress updates from background
browserAPI.runtime.onMessage.addListener((message) => {
  if (message.type === "SYNC_PROGRESS") {
    const { phase, current, total } = message;
    if (phase === "FETCHING_LIST") {
      showStatus("Henter reservasjonsliste...");
    } else if (phase === "FETCHING_DETAILS" && total > 0) {
      const pct = Math.round((current / total) * 100);
      showStatus(`Henter detaljer: ${current} av ${total}`, pct);
    }
  }
});

function renderStats(reservations) {
  const stats = currentMonthStats(reservations);
  const monthly = monthlyCosts(reservations);

  // Current month spend
  spendThisMonth.textContent = stats.thisMonth
    ? formatNOK.format(stats.thisMonth.total)
    : "0 kr";

  // Last month spend
  spendLastMonth.textContent = stats.lastMonth
    ? formatNOK.format(stats.lastMonth.total)
    : "0 kr";

  // Trips this month
  tripsThisMonth.textContent = stats.tripsThisMonth;

  // Average cost per trip
  avgCost.textContent = stats.thisMonth
    ? formatNOK.format(stats.thisMonth.average)
    : "–";

  // Show empty note if no trips this month
  emptyNote.hidden = !(stats.tripsThisMonth === 0 && stats.thisMonth === null);

  // Most used car (across all data)
  const patterns = usagePatterns(reservations);
  const topCar = patterns.topCars[0];
  mostUsedCar.textContent = topCar ? topCar.name : "–";

  // Sparkline: last 6 months (destroy previous instance to avoid leak)
  if (sparklineChart) {
    sparklineChart.destroy();
    sparklineChart = null;
  }
  const last6 = monthly.slice(-6);
  if (last6.length > 1) {
    sparklineChart = createSparkline(
      sparklineCanvas,
      last6.map((m) => m.total)
    );
  }

  // Savings vs car ownership this year
  const currentYear = new Date().getFullYear();
  const ownership = estimateOwnershipCost(reservations, currentYear);
  const savingsEl = document.getElementById("yearly-savings");
  if (ownership && ownership.savings > 0) {
    savingsEl.textContent = formatNOK.format(ownership.savings);
  } else if (ownership) {
    savingsEl.textContent = "0 kr";
    savingsEl.classList.remove("card__value--tertiary");
  } else {
    savingsEl.textContent = "–";
  }

  // CO2 saved this year
  const yearData = reservations.filter(r => new Date(r.start).getFullYear() === currentYear);
  const co2 = co2Comparison(yearData);
  const co2El = document.getElementById("yearly-co2");
  if (co2 && co2.savedKg > 0) {
    co2El.textContent = `${Math.round(co2.savedKg)} kg`;
  } else {
    co2El.textContent = "–";
  }

  statsSection.hidden = false;
}

async function sendMessage(msg) {
  return browserAPI.runtime.sendMessage(msg);
}

async function init() {
  // 1. Check auth
  const authStatus = await sendMessage({ type: "GET_AUTH_STATUS" });
  if (!authStatus || !authStatus.hasAuth) {
    showStatus("Logg inn på app.dele.no først");
  }

  // 2. Try to get cached data
  const data = await sendMessage({ type: "GET_DATA" });
  if (data && data.reservations && data.reservations.length > 0) {
    hideStatus();
    renderStats(data.reservations);
    lastSyncedEl.textContent = formatSyncTime(data.lastSync);
  } else if (authStatus && authStatus.hasAuth) {
    // 3. No data but logged in — trigger sync
    showStatus("Synkroniserer...");
    syncBtn.disabled = true;
    const result = await sendMessage({ type: "REQUEST_SYNC" });
    syncBtn.disabled = false;

    if (result && result.error) {
      showStatus(
        result.error === "NOT_LOGGED_IN" || result.error === "AUTH_EXPIRED"
          ? "Logg inn på app.dele.no først"
          : `Feil: ${result.error}`
      );
    } else if (result && result.count > 0) {
      hideStatus();
      const freshData = await sendMessage({ type: "GET_DATA" });
      if (freshData && freshData.reservations) {
        renderStats(freshData.reservations);
        lastSyncedEl.textContent = formatSyncTime(freshData.lastSync);
      }
    } else {
      showStatus("Ingen data funnet");
    }
  }
}

// Sync button handler
syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  showStatus("Synkroniserer...");

  const result = await sendMessage({ type: "REQUEST_SYNC", force: true });

  syncBtn.disabled = false;

  if (result && result.error) {
    showStatus(
      result.error === "NOT_LOGGED_IN" || result.error === "AUTH_EXPIRED"
        ? "Logg inn på app.dele.no først"
        : `Feil: ${result.error}`
    );
    return;
  }

  hideStatus();
  const freshData = await sendMessage({ type: "GET_DATA" });
  if (freshData && freshData.reservations) {
    renderStats(freshData.reservations);
    lastSyncedEl.textContent = formatSyncTime(freshData.lastSync);
  }
});

// Dashboard link — open in new tab
dashboardLink.addEventListener("click", () => {
  browserAPI.tabs.create({
    url: browserAPI.runtime.getURL("dashboard/dashboard.html"),
  });
});

// Initialize
init();
