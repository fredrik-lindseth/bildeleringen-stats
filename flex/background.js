import { browserAPI } from "./lib/browser-polyfill.js";

let currentAuth = null;

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_AUTH_STATUS") {
    getAuth().then((auth) => sendResponse({ hasAuth: auth !== null }));
    return true;
  }
  if (message.type === "SEARCH") {
    // Fylles ut i Task 7.
    sendResponse({ error: "NOT_IMPLEMENTED" });
    return true;
  }
  return false;
});

export async function getAuth() {
  if (currentAuth) return currentAuth;
  const tabs = await browserAPI.tabs.query({ url: "*://app.dele.no/*" });
  if (tabs.length === 0) return null;
  for (const tab of tabs) {
    try {
      const res = await browserAPI.tabs.sendMessage(tab.id, { type: "GET_AUTH" });
      if (res && res.token) {
        currentAuth = res;
        return res;
      }
    } catch (e) {
      // content script ikke lastet — prøv injection
    }
    try {
      const results = await browserAPI.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            const raw = localStorage.getItem("persist:data");
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return { token: JSON.parse(parsed.authentication) };
          } catch (e) {
            return null;
          }
        },
      });
      const result = results?.[0]?.result;
      if (result && result.token) {
        currentAuth = result;
        return result;
      }
    } catch (e) {
      console.warn("[bg] injection failed", tab.id, e);
    }
  }
  return null;
}
