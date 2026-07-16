const api = typeof browser !== "undefined" ? browser : chrome;

function fmtWindow(w) {
  return `${w.earliestStart.slice(0, 16).replace("T", " ")} – ${w.latestEnd.slice(0, 16).replace("T", " ")}`;
}

function status(w) {
  // latestEnd er naiv lokal ISO uten Z → new Date() tolker den som lokal tid.
  if (new Date(w.latestEnd) <= new Date()) return "utløpt";
  return w.active ? "aktiv" : "av";
}

async function render() {
  const { watches, settings } = await api.runtime.sendMessage({ type: "GET_WATCHES" });
  const ul = document.getElementById("watch-list");
  ul.innerHTML = "";
  if (!watches.length) {
    ul.innerHTML = "<li>Ingen overvåkninger ennå. Lag en fra «Overvåk dette søket» i finneren.</li>";
  }
  for (const w of watches) {
    const li = document.createElement("li");
    const checked = w.active ? "checked" : "";
    li.innerHTML =
      `<strong>${w.label}</strong> · ${status(w)}<br>` +
      `<span class="muted">${fmtWindow(w)} · minst ${w.minHours} t` +
      (w.lastChecked ? ` · sjekket ${w.lastChecked.slice(11, 16)}` : " · ikke sjekket") + `</span> ` +
      `<label><input type="checkbox" data-toggle="${w.id}" ${checked}> aktiv</label> ` +
      `<button data-del="${w.id}">Slett</button>`;
    ul.appendChild(li);
  }
  document.getElementById("set-url").value = settings.backendUrl || "";
  document.getElementById("set-token").value = settings.backendToken || "";
  document.getElementById("set-poll").value = settings.pollMinutes || 15;
}

document.addEventListener("click", async (e) => {
  const del = e.target.closest("[data-del]");
  if (del) { await api.runtime.sendMessage({ type: "DELETE_WATCH", id: del.dataset.del }); render(); return; }
  if (e.target.id === "poll-now") { await api.runtime.sendMessage({ type: "POLL_NOW" }); render(); }
});

document.addEventListener("change", async (e) => {
  const t = e.target.closest("[data-toggle]");
  if (t) { await api.runtime.sendMessage({ type: "TOGGLE_WATCH", id: t.dataset.toggle }); render(); }
});

document.getElementById("set-save").addEventListener("click", async () => {
  await api.runtime.sendMessage({ type: "SAVE_SETTINGS", settings: {
    backendUrl: document.getElementById("set-url").value.trim().replace(/\/$/, ""),
    backendToken: document.getElementById("set-token").value.trim(),
    pollMinutes: Number(document.getElementById("set-poll").value) || 15,
  }});
  document.getElementById("set-msg").textContent = "Lagret.";
});

render();
