/**
 * Resolve a CSS custom property to its computed value.
 */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function createBarChart(canvas, labels, data, label = "") {
  const accent = cssVar("--color-accent");
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: accent }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

export function createLineChart(canvas, labels, data, label = "") {
  const accent = cssVar("--color-accent");
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: accent,
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

export function createSparkline(canvas, data) {
  const accent = cssVar("--color-accent");
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: accent,
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
