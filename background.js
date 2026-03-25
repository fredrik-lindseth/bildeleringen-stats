import { browserAPI, storage } from "./lib/browser-polyfill.js";
import { fetchAllReservations, fetchAllDetails } from "./lib/api.js";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let currentAuth = null;

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN") {
    currentAuth = message.data;
    console.log("[BG] Auth token received");
  }

  if (message.type === "REQUEST_SYNC") {
    handleSync(message.force).then(sendResponse);
    return true;
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

function broadcastProgress(phase, current, total) {
  browserAPI.runtime.sendMessage({
    type: "SYNC_PROGRESS",
    phase,
    current,
    total,
  }).catch(() => {}); // Ignore if no listener (popup closed)
}

async function getAuth() {
  if (currentAuth) return currentAuth;

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

  if (!force && cached.lastSync && now - cached.lastSync < SYNC_INTERVAL_MS) {
    return { status: "CACHED", count: (cached.reservations || []).length };
  }

  try {
    broadcastProgress("FETCHING_LIST", 0, 0);
    const reservations = await fetchAllReservations(auth.token, auth.membershipId);

    const existingDetails = cached.reservations || [];
    const existingIds = new Set(existingDetails.map((r) => r.id));
    const newReservations = reservations.filter((r) => !existingIds.has(r.id));

    let allDetails;
    if (newReservations.length > 0) {
      broadcastProgress("FETCHING_DETAILS", 0, newReservations.length);
      const newDetails = await fetchAllDetails(newReservations, auth.token, (current, total) => {
        broadcastProgress("FETCHING_DETAILS", current, total);
      });
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
