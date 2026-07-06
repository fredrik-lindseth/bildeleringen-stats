/**
 * Resolve a CSS custom property to its computed value.
 */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const defaultTooltip = {
  callbacks: {
    label: (ctx) => {
      const val = new Intl.NumberFormat("nb-NO").format(ctx.parsed.y);
      return ctx.dataset.label ? `${ctx.dataset.label}: ${val}` : val;
    },
  },
};

export function createBarChart(canvas, labels, data, label = "", { unit = "", yTitle = "" } = {}) {
  const accent = cssVar("--color-accent");
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: accent }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: defaultTooltip,
      },
      scales: {
        x: { ticks: { maxTicksLimit: 14, maxRotation: 45, font: { size: 11 } } },
        y: {
          title: yTitle ? { display: true, text: yTitle, font: { size: 12 } } : { display: false },
        },
      },
    },
  });
}

export function createLineChart(canvas, labels, data, label = "", { unit = "", yTitle = "" } = {}) {
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
      plugins: {
        legend: { display: false },
        tooltip: defaultTooltip,
      },
      scales: {
        x: { ticks: { maxTicksLimit: 14, maxRotation: 45, font: { size: 11 } } },
        y: {
          title: yTitle ? { display: true, text: yTitle, font: { size: 12 } } : { display: false },
        },
      },
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
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  });
}
