# Bildeleringen Stats Extension — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a cross-browser extension that shows Bildeleringen (dele.no) car-sharing statistics via a popup and full dashboard.

**Architecture:** Content script reads auth from dele.no localStorage, background script fetches/caches reservation data, popup shows quick stats, dashboard shows full analytics with Chart.js.

**Tech Stack:** Vanilla JS, HTML, CSS, Chart.js, WebExtension API (Manifest V3)

---

### Task 1: Project Scaffolding

**Files:**
- Create: `manifest.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `LICENSE`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Bildeleringen Stats",
  "version": "0.1.0",
  "description": "Statistikk og analyse av ditt bildeleforbruk på dele.no",
  "permissions": ["storage", "unlimitedStorage"],
  "host_permissions": ["*://app.dele.no/*"],
  "background": {
    "scripts": ["background.js"],
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://app.dele.no/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

Note: Firefox supports `background.scripts` in MV3 (not `service_worker`). Chrome MV3 uses `service_worker`. We will handle this with a browser-specific key or a compatibility wrapper in Task 9.

**Step 2: Create .gitignore**

```
*.zip
*.xpi
*.crx
web-ext-artifacts/
node_modules/
.DS_Store
```

**Step 3: Create README.md**

Write a README with:
- Project description (Norwegian)
- Screenshot placeholder
- Installation instructions for Firefox (about:debugging) and Chrome (chrome://extensions)
- How it works (reads auth from dele.no, fetches stats)
- Privacy note (all data stays local, no external servers)
- Development section (web-ext run, load unpacked)
- License

**Step 4: Create LICENSE**

MIT license, copyright 2026 Fredrik.

**Step 5: Create placeholder icons**

Create `icons/` directory with simple SVG-based placeholder PNGs (16, 48, 128). We can replace with proper icons later.

**Step 6: Commit**

```bash
git add manifest.json .gitignore README.md LICENSE icons/
git commit -m "feat: project scaffolding with manifest, readme, and license"
```

---

### Task 2: Browser Compatibility Layer

**Files:**
- Create: `lib/browser-polyfill.js`

**Step 1: Write the browser polyfill**

```js
// Thin wrapper: use browser.* (Firefox) with chrome.* fallback
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Promisify chrome.* callback APIs if needed
function promisify(fn) {
  return (...args) =>
    new Promise((resolve, reject) => {
      fn(...args, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result);
        }
      });
    });
}

// Storage wrapper — always returns promises
const storage = {
  async get(keys) {
    if (browserAPI.storage.local.get.constructor.name === "AsyncFunction" ||
        typeof browser !== "undefined") {
      return browserAPI.storage.local.get(keys);
    }
    return promisify(chrome.storage.local.get)(keys);
  },
  async set(items) {
    if (typeof browser !== "undefined") {
      return browserAPI.storage.local.set(items);
    }
    return promisify(chrome.storage.local.set)(items);
  },
};

export { browserAPI, storage };
```

**Step 2: Verify it loads without errors**

Load the extension in Firefox via `about:debugging`, check console for errors.

**Step 3: Commit**

```bash
git add lib/browser-polyfill.js
git commit -m "feat: add browser compatibility polyfill for Firefox/Chrome"
```

---

### Task 3: Content Script — Auth Token Extraction

**Files:**
- Create: `content.js`

**Step 1: Write content.js**

```js
// Reads auth token and membership ID from dele.no localStorage
// Sends to background script on request

function extractAuth() {
  try {
    const raw = localStorage.getItem("persist:data");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const authToken = JSON.parse(parsed.authentication);
    const membership = JSON.parse(parsed.selectedMembership);

    return {
      token: authToken,
      membershipId: membership.id,
    };
  } catch (e) {
    console.error("[Bildeleringen Stats] Failed to extract auth:", e);
    return null;
  }
}

// Listen for requests from background/popup
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_AUTH") {
    const auth = extractAuth();
    sendResponse(auth);
  }
  return true; // Keep channel open for async response
});

// Also send auth on page load so background has it ready
const auth = extractAuth();
if (auth) {
  browserAPI.runtime.sendMessage({ type: "AUTH_TOKEN", data: auth });
}
```

**Step 2: Test manually**

Load extension in Firefox, navigate to app.dele.no, check background console for received AUTH_TOKEN message.

**Step 3: Commit**

```bash
git add content.js
git commit -m "feat: content script extracts auth token from dele.no localStorage"
```

---

### Task 4: API Client

**Files:**
- Create: `lib/api.js`

**Step 1: Write the API client**

```js
const API_BASE = "https://app.dele.no/api";
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 50;
const MAX_RETRIES = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, headers, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers });

    if (res.ok) return res.json();

    if (res.status === 429) {
      const backoff = Math.pow(2, attempt) * 1000;
      console.warn(`[API] Rate limited, waiting ${backoff}ms`);
      await delay(backoff);
      continue;
    }

    if (res.status === 401) {
      throw new Error("AUTH_EXPIRED");
    }

    throw new Error(`API error: ${res.status}`);
  }
  throw new Error("Max retries exceeded");
}

export async function fetchAllReservations(token, membershipId) {
  const allReservations = [];
  let page = 0;

  while (true) {
    const url = `${API_BASE}/reservations/historic?page=${page}&size=${PAGE_SIZE}&sort=start,desc&membershipId=${membershipId}`;
    const data = await fetchWithRetry(url, { authorization: token });

    if (data.length === 0) break;
    allReservations.push(...data);
    if (data.length < PAGE_SIZE) break;

    page++;
    await delay(REQUEST_DELAY_MS);
  }

  return allReservations;
}

export async function fetchReservationDetail(id, token) {
  const url = `${API_BASE}/reservations/${id}`;
  return fetchWithRetry(url, { authorization: token });
}

export async function fetchAllDetails(reservations, token, onProgress) {
  const details = [];

  for (let i = 0; i < reservations.length; i++) {
    const detail = await fetchReservationDetail(reservations[i].id, token);
    details.push(detail);
    await delay(REQUEST_DELAY_MS);

    if (onProgress) {
      onProgress(i + 1, reservations.length);
    }
  }

  return details;
}
```

**Step 2: Commit**

```bash
git add lib/api.js
git commit -m "feat: API client with pagination, retry, and rate limiting"
```

---

### Task 5: Background Script — Caching & Data Management

**Files:**
- Create: `background.js`

**Step 1: Write background.js**

```js
import { storage } from "./lib/browser-polyfill.js";
import { fetchAllReservations, fetchAllDetails } from "./lib/api.js";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let currentAuth = null;

const browserAPI = typeof browser !== "undefined" ? browser : chrome;

// Receive auth from content script
browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN") {
    currentAuth = message.data;
    console.log("[BG] Auth token received");
  }

  if (message.type === "REQUEST_SYNC") {
    handleSync(message.force).then(sendResponse);
    return true; // async
  }

  if (message.type === "GET_DATA") {
    storage.get(["reservations", "lastSync"]).then(sendResponse);
    return true;
  }

  if (message.type === "GET_AUTH_STATUS") {
    sendResponse({ hasAuth: currentAuth !== null });
  }

  return true;
});

async function getAuth() {
  if (currentAuth) return currentAuth;

  // Ask content script for auth
  const tabs = await browserAPI.tabs.query({ url: "*://app.dele.no/*" });
  if (tabs.length === 0) return null;

  return new Promise((resolve) => {
    browserAPI.tabs.sendMessage(tabs[0].id, { type: "GET_AUTH" }, (response) => {
      if (response) currentAuth = response;
      resolve(response);
    });
  });
}

async function handleSync(force = false) {
  const auth = await getAuth();
  if (!auth) return { error: "NOT_LOGGED_IN" };

  const cached = await storage.get(["reservations", "lastSync"]);
  const now = Date.now();

  // Skip if synced recently (unless forced)
  if (!force && cached.lastSync && now - cached.lastSync < SYNC_INTERVAL_MS) {
    return { status: "CACHED", count: (cached.reservations || []).length };
  }

  try {
    // Fetch reservation list
    const reservations = await fetchAllReservations(auth.token, auth.membershipId);

    // Determine which details we need to fetch
    const existingDetails = cached.reservations || [];
    const existingIds = new Set(existingDetails.map((r) => r.id));
    const newReservations = reservations.filter((r) => !existingIds.has(r.id));

    let allDetails;
    if (newReservations.length > 0) {
      const newDetails = await fetchAllDetails(newReservations, auth.token);
      allDetails = [...newDetails, ...existingDetails];
    } else {
      allDetails = existingDetails;
    }

    await storage.set({
      reservations: allDetails,
      lastSync: now,
    });

    return { status: "SYNCED", count: allDetails.length, newCount: newReservations.length };
  } catch (e) {
    if (e.message === "AUTH_EXPIRED") {
      currentAuth = null;
      return { error: "AUTH_EXPIRED" };
    }
    return { error: e.message };
  }
}
```

**Step 2: Test manually**

Load extension, navigate to dele.no, click popup → check background console for sync activity.

**Step 3: Commit**

```bash
git add background.js
git commit -m "feat: background script with incremental sync and caching"
```

---

### Task 6: Stats Calculation Library

**Files:**
- Create: `lib/stats.js`

**Step 1: Write stats.js**

All pure functions, no side effects. Each function takes an array of reservation detail objects and returns computed statistics.

```js
export function filterValid(reservations) {
  return reservations.filter((r) => r.status !== "CANCELLED" && r.totalPrice != null);
}

export function costStats(reservations) {
  const valid = filterValid(reservations);
  if (valid.length === 0) return null;

  const costs = valid.map((r) => r.totalPrice);
  costs.sort((a, b) => a - b);

  return {
    total: costs.reduce((sum, c) => sum + c, 0),
    average: costs.reduce((sum, c) => sum + c, 0) / costs.length,
    median: costs[Math.floor(costs.length / 2)],
    min: costs[0],
    max: costs[costs.length - 1],
    count: costs.length,
  };
}

export function monthlyCosts(reservations) {
  const valid = filterValid(reservations);
  const byMonth = {};

  for (const r of valid) {
    const date = new Date(r.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + r.totalPrice;
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

export function yearlyCosts(reservations) {
  const valid = filterValid(reservations);
  const byYear = {};

  for (const r of valid) {
    const year = new Date(r.start).getFullYear();
    byYear[year] = (byYear[year] || 0) + r.totalPrice;
  }

  return Object.entries(byYear)
    .sort(([a], [b]) => a - b)
    .map(([year, total]) => ({ year: Number(year), total }));
}

export function usagePatterns(reservations) {
  const valid = filterValid(reservations);

  // Heatmap: weekday (0-6) x hour (0-23)
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of valid) {
    const date = new Date(r.start);
    heatmap[date.getDay()][date.getHours()]++;
  }

  // Most used cars
  const carCounts = {};
  for (const r of valid) {
    const car = r.vehicleName || r.vehicleId || "Ukjent";
    carCounts[car] = (carCounts[car] || 0) + 1;
  }
  const topCars = Object.entries(carCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));

  // Average duration in hours
  const durations = valid.map((r) => (new Date(r.end) - new Date(r.start)) / 3600000);
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;

  // Trips per month
  const tripsPerMonth = {};
  for (const r of valid) {
    const date = new Date(r.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    tripsPerMonth[key] = (tripsPerMonth[key] || 0) + 1;
  }

  return { heatmap, topCars, avgDuration, tripsPerMonth };
}

export function mileageStats(reservations) {
  const withKm = filterValid(reservations).filter((r) => r.distance != null && r.distance > 0);
  if (withKm.length === 0) return null;

  const distances = withKm.map((r) => r.distance);
  const total = distances.reduce((sum, d) => sum + d, 0);

  // Per month
  const byMonth = {};
  for (const r of withKm) {
    const date = new Date(r.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + r.distance;
  }

  // Per car
  const byCar = {};
  for (const r of withKm) {
    const car = r.vehicleName || r.vehicleId || "Ukjent";
    byCar[car] = (byCar[car] || 0) + r.distance;
  }

  return {
    total,
    average: total / withKm.length,
    max: Math.max(...distances),
    count: withKm.length,
    byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)),
    byCar: Object.entries(byCar).sort(([, a], [, b]) => b - a),
  };
}

export function currentMonthStats(reservations) {
  const now = new Date();
  const thisMonth = reservations.filter((r) => {
    const d = new Date(r.start);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonth = reservations.filter((r) => {
    const d = new Date(r.start);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getMonth() === prev.getMonth() && d.getFullYear() === prev.getFullYear();
  });

  return {
    thisMonth: costStats(thisMonth),
    lastMonth: costStats(lastMonth),
    tripsThisMonth: filterValid(thisMonth).length,
  };
}
```

**Step 2: Commit**

```bash
git add lib/stats.js
git commit -m "feat: statistics calculation library (costs, mileage, patterns)"
```

---

### Task 7: Chart.js Setup & Helpers

**Files:**
- Create: `vendor/chart.min.js` (download Chart.js 4.x UMD bundle)
- Create: `lib/chart-helpers.js`

**Step 1: Download Chart.js**

```bash
curl -o vendor/chart.min.js https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js
```

**Step 2: Write chart-helpers.js**

```js
// Assumes Chart is loaded globally from vendor/chart.min.js

export function createBarChart(canvas, labels, data, label = "") {
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: "var(--chart-primary, #4a90d9)" }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

export function createLineChart(canvas, labels, data, label = "") {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: "var(--chart-primary, #4a90d9)",
        tension: 0.3,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

export function createHeatmap(canvas, heatmapData) {
  // Chart.js doesn't have native heatmap — use matrix plugin or manual canvas
  const ctx = canvas.getContext("2d");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const cellW = canvas.width / 24;
  const cellH = canvas.height / 7;
  const max = Math.max(...heatmapData.flat(), 1);

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const intensity = heatmapData[day][hour] / max;
      ctx.fillStyle = `rgba(74, 144, 217, ${intensity})`;
      ctx.fillRect(hour * cellW, day * cellH, cellW - 1, cellH - 1);
    }
  }
}

export function createSparkline(canvas, data) {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: "var(--chart-primary, #4a90d9)",
        borderWidth: 2,
        pointRadius: 0,
        fill: false,
        tension: 0.3,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  });
}
```

**Step 3: Commit**

```bash
git add vendor/chart.min.js lib/chart-helpers.js
git commit -m "feat: Chart.js vendor bundle and chart helper functions"
```

---

### Task 8: Popup UI

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

**Step 1: Write popup HTML**

Minimal layout: status bar, stat cards (spend, trips, avg cost, top car), sparkline canvas, sync button, link to dashboard.

**Step 2: Write popup CSS**

Clean, compact design. CSS custom properties in `:root` for theming. Support both light and dark mode via `prefers-color-scheme`. Max width ~350px (typical popup constraint).

**Step 3: Write popup JS**

- On load: send `GET_DATA` to background, render stats
- If no data: send `REQUEST_SYNC`, show progress
- If no auth: show "log in" message
- Sync button: send `REQUEST_SYNC` with `force: true`
- Dashboard link: `browser.tabs.create({ url: browser.runtime.getURL("dashboard/dashboard.html") })`
- Use `currentMonthStats()` from stats.js for the numbers
- Use `createSparkline()` for trend

**Step 4: Test manually**

Load extension, open popup, verify stats display with real data.

**Step 5: Commit**

```bash
git add popup/
git commit -m "feat: popup UI with quick stats overview and sparkline"
```

---

### Task 9: Dashboard UI

**Files:**
- Create: `dashboard/dashboard.html`
- Create: `dashboard/dashboard.css`
- Create: `dashboard/dashboard.js`

**Step 1: Write dashboard HTML**

Full-page layout with four sections: Costs, Usage, Mileage, Trends. Each section has chart canvases and stat cards. Tab navigation or scroll-based sections.

**Step 2: Write dashboard CSS**

Responsive grid layout. CSS custom properties for colors. Dark/light mode. Cards with subtle shadows. Charts fill their containers.

**Step 3: Write dashboard JS**

- On load: get cached data from background
- Compute all stats using functions from `lib/stats.js`
- Render charts: monthly costs bar chart, trips line chart, heatmap, mileage charts
- Render stat cards: totals, averages, top cars, longest trip etc.
- Sync button + last-synced timestamp display
- Handle empty state gracefully

**Step 4: Test manually**

Open dashboard, verify all four sections render with real data. Test with dark mode.

**Step 5: Commit**

```bash
git add dashboard/
git commit -m "feat: full statistics dashboard with costs, usage, mileage, and trends"
```

---

### Task 10: Cross-Browser Manifest Compatibility

**Files:**
- Modify: `manifest.json`

**Step 1: Handle Firefox vs Chrome background script**

Firefox MV3 uses `background.scripts`, Chrome MV3 uses `background.service_worker`. Use the Firefox-compatible format and add a `browser_specific_settings` key:

```json
{
  "browser_specific_settings": {
    "gecko": {
      "id": "bildeleringen-stats@extension",
      "strict_min_version": "109.0"
    }
  }
}
```

For Chrome compatibility, background.js must work as both a module script and service worker. If needed, create a `background-wrapper.js` that imports background.js.

**Step 2: Test in both browsers**

- Firefox: `about:debugging` → Load Temporary Add-on
- Chrome: `chrome://extensions` → Load unpacked

**Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: cross-browser manifest compatibility (Firefox + Chrome)"
```

---

### Task 11: Polish & Documentation

**Files:**
- Modify: `README.md` — finalize with actual screenshots, usage instructions
- Create: `CLAUDE.md` — project conventions for future development

**Step 1: Update README with final content**

Add installation from file, permissions explanation, privacy statement, contribution guide.

**Step 2: Create CLAUDE.md**

Document: project structure, how to test, naming conventions, no build step policy.

**Step 3: Final manual test**

Full end-to-end: install fresh in Firefox, log in to dele.no, open popup, open dashboard, verify all stats. Repeat in Chrome.

**Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: finalize readme and add project conventions"
```
