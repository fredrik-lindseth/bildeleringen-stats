const api = typeof browser !== "undefined" ? browser : chrome;

document.getElementById("open").addEventListener("click", () => {
  api.tabs.create({ url: api.runtime.getURL("finder.html") });
  window.close();
});

api.runtime.sendMessage({ type: "GET_AUTH_STATUS" }).then((res) => {
  const status = document.getElementById("status");
  status.textContent = res && res.hasAuth
    ? "Innlogget på dele.no"
    : "Åpne app.dele.no og logg inn først";
});
