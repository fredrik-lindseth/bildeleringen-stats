const browserAPI = typeof browser !== "undefined" ? browser : chrome;
const output = document.getElementById("output");
const info = document.getElementById("info");

function download(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function getReservations() {
  const data = await browserAPI.runtime.sendMessage({ type: "GET_DATA" });
  return data.reservations || [];
}

document.getElementById("dump-first-btn").addEventListener("click", async () => {
  const reservations = await getReservations();
  if (reservations.length === 0) {
    output.textContent = "Ingen reservasjoner i cache.";
    return;
  }
  info.textContent = `${reservations.length} reservasjoner i cache. Viser første:`;
  output.textContent = JSON.stringify(reservations[0], null, 2);
});

document.getElementById("dump-all-btn").addEventListener("click", async () => {
  const reservations = await getReservations();
  if (reservations.length === 0) {
    output.textContent = "Ingen reservasjoner i cache.";
    return;
  }
  info.textContent = `Laster ned ${reservations.length} reservasjoner...`;
  download(reservations, "bildeleringen-reservasjoner.json");
  info.textContent = `Lastet ned ${reservations.length} reservasjoner.`;
});
