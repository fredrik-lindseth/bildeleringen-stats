// Leser dele.no-token fra localStorage("persist:data") og svarer background.
const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_AUTH") {
    try {
      const raw = localStorage.getItem("persist:data");
      if (!raw) return sendResponse(null);
      const parsed = JSON.parse(raw);
      const token = JSON.parse(parsed.authentication);
      sendResponse({ token });
    } catch (e) {
      console.log("[content] auth read failed:", e.message);
      sendResponse(null);
    }
    return true;
  }
  return false;
});
