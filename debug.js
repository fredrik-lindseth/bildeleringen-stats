const browserAPI = typeof browser !== "undefined" ? browser : chrome;
const output = document.getElementById("output");
let lastData = null;

document.getElementById("dump-btn").addEventListener("click", async () => {
  const result = await browserAPI.runtime.sendMessage({ type: "DEBUG_DUMP" });
  lastData = result;
  output.textContent = JSON.stringify(result, null, 2);
});

document.getElementById("dump-all-btn").addEventListener("click", async () => {
  const data = await browserAPI.runtime.sendMessage({ type: "GET_DATA" });
  const reservations = data.reservations || [];
  if (reservations.length === 0) {
    output.textContent = "Ingen reservasjoner i cache.";
    return;
  }
  const first = reservations[0];
  lastData = { keys: Object.keys(first), first };
  output.textContent = JSON.stringify(lastData, null, 2);
});

document.getElementById("save-btn").addEventListener("click", () => {
  if (!lastData) return;
  const blob = new Blob([JSON.stringify(lastData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bildeleringen-debug.json";
  a.click();
  URL.revokeObjectURL(url);
});
