import { browserAPI, storage } from "./lib/browser-polyfill.js";
import { fetchAllReservations, fetchAllDetails } from "./lib/api.js";

const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let currentAuth = null;
// Single-flight lock: hvis sync allerede kjører, returner samme promise til
// alle som spør (popup + dashboard kan trigge samtidig).
let syncInFlight = null;

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Returner true KUN for meldinger som faktisk svarer async. Ellers tror
  // Firefox at vi venter på sendResponse og logger "went out of scope".
  if (message.type === "AUTH_TOKEN") {
    currentAuth = message.data;
    console.log("[BG] Auth token received");
    return false;
  }

  if (message.type === "REQUEST_SYNC") {
    if (syncInFlight) {
      syncInFlight.then(sendResponse);
      return true;
    }
    syncInFlight = handleSync(message.force).finally(() => {
      syncInFlight = null;
    });
    syncInFlight.then(sendResponse);
    return true;
  }

  if (message.type === "GET_DATA") {
    storage.get(["reservations", "lastSync"]).then(sendResponse);
    return true;
  }

  if (message.type === "GET_AUTH_STATUS") {
    // Probe aktivt — currentAuth er null etter bg-script-reload selv om
    // brukeren er innlogget. getAuth() spør content-scriptet i dele.no-fanen.
    getAuth().then((auth) => sendResponse({ hasAuth: auth !== null }));
    return true;
  }

  if (message.type === "DEBUG_DUMP") {
    storage.get(["reservations"]).then((data) => {
      const reservations = data.reservations || [];
      const sample = reservations.slice(0, 3);
      const keys = reservations.length > 0 ? Object.keys(reservations[0]) : [];
      sendResponse({ count: reservations.length, keys, sample });
    });
    return true;
  }

  // Andre meldinger (f.eks. SYNC_PROGRESS som vi broadcaster til oss selv)
  // har ingen response — viktig å returnere false.
  return false;
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
  if (currentAuth) {
    console.log("[BG] getAuth: returning cached currentAuth");
    return currentAuth;
  }

  const tabs = await browserAPI.tabs.query({ url: "*://app.dele.no/*" });
  console.log(`[BG] getAuth: found ${tabs.length} app.dele.no tab(s)`);
  if (tabs.length === 0) return null;

  // Prøv hver fane til vi finner auth (bruker kan ha flere åpne).
  for (const tab of tabs) {
    console.log(`[BG] getAuth: trying tab ${tab.id} (${tab.url})`);

    // Først: prøv content-scriptet hvis det er lastet (raskt).
    try {
      const response = await browserAPI.tabs.sendMessage(tab.id, { type: "GET_AUTH" });
      if (response && response.token) {
        console.log("[BG] getAuth: got auth via content script");
        currentAuth = response;
        return response;
      }
      console.log("[BG] getAuth: content script returned", response);
    } catch (e) {
      console.log("[BG] getAuth: content script not loaded —", e.message);
    }

    // Inject direkte og les localStorage. Returnerer diagnose ved feil.
    // Timeout etter 5s — hvis injection henger, gi opp og prøv neste fane.
    try {
      const injectPromise = browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            const raw = localStorage.getItem("persist:data");
            if (!raw) return { error: "no persist:data key", keys: Object.keys(localStorage) };
            const parsed = JSON.parse(raw);
            if (!parsed.authentication) {
              return { error: "no authentication field", parsedKeys: Object.keys(parsed) };
            }
            if (!parsed.selectedMembership) {
              return { error: "no selectedMembership field", parsedKeys: Object.keys(parsed) };
            }
            const token = JSON.parse(parsed.authentication);
            const membership = JSON.parse(parsed.selectedMembership);
            return {
              token,
              membershipId: membership.id ?? membership,
            };
          } catch (e) {
            return { error: e.message };
          }
        },
      });
      const results = await Promise.race([
        injectPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("scripting.executeScript timeout")), 5000)
        ),
      ]);
      const result = results?.[0]?.result;
      console.log("[BG] getAuth: injection result:", result);
      if (result && result.token) {
        currentAuth = result;
        return result;
      }
    } catch (e) {
      console.warn("[BG] getAuth: injection failed for tab", tab.id, e);
    }
  }

  return null;
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
