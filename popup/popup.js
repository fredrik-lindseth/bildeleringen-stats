import { currentMonthStats, monthlyCosts, usagePatterns } from "../lib/stats.js";
import { createSparkline } from "../lib/chart-helpers.js";

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Norwegian currency formatter
const formatNOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Norwegian relative date/time formatter
function formatSyncTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `Sist synkronisert: ${date.toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

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
dashboardLink.addEventListener("click", (e) => {
  e.preventDefault();
  browserAPI.tabs.create({
    url: browserAPI.runtime.getURL("dashboard/dashboard.html"),
  });
});

// Initialize
init();
