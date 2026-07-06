import { currentMonthStats, monthlyCosts, usagePatterns } from "../lib/stats.js";
import { createSparkline } from "../lib/chart-helpers.js";
import { formatNOK, formatSyncTime } from "../lib/formatters.js";
import { estimateOwnershipCost } from "../lib/ownership-cost.js";

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
  statusEl.classList.remove("status--login");
  statusText.textContent = message;
  removeStatusAction();
  statusEl.hidden = false;

  if (progress !== null) {
    progressEl.hidden = false;
    progressBar.style.width = `${progress}%`;
  } else {
    progressEl.hidden = true;
    progressBar.style.width = "0%";
  }
}

function showLoginRequired() {
  statusEl.classList.add("status--login");
  statusText.innerHTML = `<strong>Du må logge inn på Bildeleringen</strong><br>Vi henter dataene dine så snart du er innlogget.`;
  removeStatusAction();

  const action = document.createElement("a");
  action.id = "status-action";
  action.className = "status__action";
  action.textContent = "Åpne app.dele.no →";
  action.href = "https://app.dele.no";
  action.target = "_blank";
  action.rel = "noopener";
  statusEl.appendChild(action);

  progressEl.hidden = true;
  progressBar.style.width = "0%";
  statusEl.hidden = false;
}

function removeStatusAction() {
  const existing = document.getElementById("status-action");
  if (existing) existing.remove();
}

function isAuthError(error) {
  return error === "NOT_LOGGED_IN" || error === "AUTH_EXPIRED";
}

function hideStatus() {
  statusEl.classList.remove("status--login");
  removeStatusAction();
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

  statsSection.hidden = false;
}

// Wrap sendMessage med timeout + tydelig feil. Background-scriptet kan være
// sovende (MV3 event page) og bruke sekunder på å våkne, og noen ganger
// svarer det aldri (bg-script crash, race etter reload, etc).
async function sendMessage(msg, timeoutMs = 10000) {
  return Promise.race([
    browserAPI.runtime.sendMessage(msg),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`sendMessage timeout: ${msg.type}`)), timeoutMs)
    ),
  ]);
}

async function init() {
  // Vis "Laster…" som standard så popup aldri ser tom ut. hideStatus()
  // kalles eksplisitt når vi har data å rendere.
  showStatus("Laster…");

  let authStatus;
  try {
    authStatus = await sendMessage({ type: "GET_AUTH_STATUS" });
  } catch (e) {
    console.error("[popup] GET_AUTH_STATUS feilet:", e);
    showStatus("Kunne ikke kontakte utvidelsen. Prøv å åpne popup-en på nytt.");
    return;
  }

  if (!authStatus || !authStatus.hasAuth) {
    showLoginRequired();
  }

  let data;
  try {
    data = await sendMessage({ type: "GET_DATA" });
  } catch (e) {
    console.error("[popup] GET_DATA feilet:", e);
    showStatus("Klarte ikke å lese lagrede data.");
    return;
  }

  if (data && data.reservations && data.reservations.length > 0) {
    hideStatus();
    try {
      renderStats(data.reservations);
      lastSyncedEl.textContent = formatSyncTime(data.lastSync);
    } catch (e) {
      console.error("[popup] renderStats feilet:", e);
      showStatus(`Feil ved opptegning: ${e.message}`);
    }
    return;
  }

  if (!authStatus || !authStatus.hasAuth) return;

  // Ingen data, men innlogget — start sync.
  showStatus("Synkroniserer…");
  syncBtn.disabled = true;

  let result;
  try {
    // Sync kan ta 30+ sek for første gangs synk. Egen timeout for denne.
    result = await sendMessage({ type: "REQUEST_SYNC" }, 120000);
  } catch (e) {
    console.error("[popup] REQUEST_SYNC feilet:", e);
    showStatus(`Sync feilet: ${e.message}`);
    syncBtn.disabled = false;
    return;
  }
  syncBtn.disabled = false;

  if (result && result.error) {
    if (isAuthError(result.error)) {
      showLoginRequired();
    } else {
      showStatus(`Feil: ${result.error}`);
    }
    return;
  }

  if (result && result.count > 0) {
    hideStatus();
    try {
      const freshData = await sendMessage({ type: "GET_DATA" });
      if (freshData && freshData.reservations) {
        renderStats(freshData.reservations);
        lastSyncedEl.textContent = formatSyncTime(freshData.lastSync);
      }
    } catch (e) {
      console.error("[popup] freshData feilet:", e);
      showStatus(`Feil: ${e.message}`);
    }
    return;
  }

  showStatus("Ingen data funnet");
}

// Sync button handler
syncBtn.addEventListener("click", async () => {
  syncBtn.disabled = true;
  showStatus("Synkroniserer…");

  let result;
  try {
    result = await sendMessage({ type: "REQUEST_SYNC", force: true }, 120000);
  } catch (e) {
    console.error("[popup] sync-knapp feilet:", e);
    showStatus(`Sync feilet: ${e.message}`);
    syncBtn.disabled = false;
    return;
  }
  syncBtn.disabled = false;

  if (result && result.error) {
    if (isAuthError(result.error)) {
      showLoginRequired();
    } else {
      showStatus(`Feil: ${result.error}`);
    }
    return;
  }

  hideStatus();
  try {
    const freshData = await sendMessage({ type: "GET_DATA" });
    if (freshData && freshData.reservations) {
      renderStats(freshData.reservations);
      lastSyncedEl.textContent = formatSyncTime(freshData.lastSync);
    }
  } catch (e) {
    console.error("[popup] GET_DATA etter sync feilet:", e);
    showStatus(`Feil: ${e.message}`);
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
