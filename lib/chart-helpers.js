export function createBarChart(canvas, labels, data, label = "") {
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label, data, backgroundColor: "rgba(74, 144, 217, 0.8)" }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
    },
  });
}

export function createLineChart(canvas, labels, data, label = "") {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: "rgba(74, 144, 217, 1)",
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

export function createHeatmap(canvas, heatmapData) {
  const ctx = canvas.getContext("2d");
  const days = ["Son", "Man", "Tir", "Ons", "Tor", "Fre", "Lor"];
  const cellW = canvas.width / 24;
  const cellH = canvas.height / 7;
  const max = Math.max(...heatmapData.flat(), 1);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const intensity = heatmapData[day][hour] / max;
      ctx.fillStyle = `rgba(74, 144, 217, ${intensity})`;
      ctx.fillRect(hour * cellW, day * cellH, cellW - 1, cellH - 1);
    }
  }
}

export function createSparkline(canvas, data) {
  return new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: "rgba(74, 144, 217, 1)",
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
