// Helper to extract price from reservation
function getPrice(r) {
  return r.price?.total ?? null;
}

// Helper to extract car name
function getCarName(r) {
  return r.car?.model || r.car?.licensePlate || "Ukjent";
}

export function filterValid(reservations) {
  return reservations.filter(
    (r) => r.canceled == null && !r.noTrips && getPrice(r) != null
  );
}

export function costStats(reservations) {
  const valid = filterValid(reservations);
  if (valid.length === 0) return null;

  const costs = valid.map((r) => getPrice(r));
  costs.sort((a, b) => a - b);

  return {
    total: costs.reduce((sum, c) => sum + c, 0),
    average: costs.reduce((sum, c) => sum + c, 0) / costs.length,
    median: costs[Math.floor(costs.length / 2)],
    min: costs[0],
    max: costs[costs.length - 1],
    count: costs.length,
  };
}

export function monthlyCosts(reservations) {
  const valid = filterValid(reservations);
  const byMonth = {};

  for (const r of valid) {
    const date = new Date(r.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + getPrice(r);
  }

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total]) => ({ month, total }));
}

export function yearlyCosts(reservations) {
  const valid = filterValid(reservations);
  const byYear = {};

  for (const r of valid) {
    const year = new Date(r.start).getFullYear();
    byYear[year] = (byYear[year] || 0) + getPrice(r);
  }

  return Object.entries(byYear)
    .sort(([a], [b]) => a - b)
    .map(([year, total]) => ({ year: Number(year), total }));
}

export function usagePatterns(reservations) {
  const valid = filterValid(reservations);

  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of valid) {
    const date = new Date(r.start);
    heatmap[date.getDay()][date.getHours()]++;
  }

  const carCounts = {};
  for (const r of valid) {
    const car = getCarName(r);
    carCounts[car] = (carCounts[car] || 0) + 1;
  }
  const topCars = Object.entries(carCounts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));

  const durations = valid.map(
    (r) => (new Date(r.end) - new Date(r.start)) / 3600000
  );
  const avgDuration =
    durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : 0;

  const tripsPerMonth = {};
  for (const r of valid) {
    const date = new Date(r.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    tripsPerMonth[key] = (tripsPerMonth[key] || 0) + 1;
  }

  return { heatmap, topCars, avgDuration, tripsPerMonth };
}

export function mileageStats(reservations) {
  const withKm = filterValid(reservations).filter(
    (r) => r.drivenKm != null && r.drivenKm > 0
  );
  if (withKm.length === 0) return null;

  const distances = withKm.map((r) => r.drivenKm);
  const total = distances.reduce((sum, d) => sum + d, 0);

  const byMonth = {};
  for (const r of withKm) {
    const date = new Date(r.start);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + r.drivenKm;
  }

  const byCar = {};
  for (const r of withKm) {
    const car = getCarName(r);
    byCar[car] = (byCar[car] || 0) + r.drivenKm;
  }

  return {
    total,
    average: total / withKm.length,
    max: Math.max(...distances),
    count: withKm.length,
    byMonth: Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)),
    byCar: Object.entries(byCar).sort(([, a], [, b]) => b - a),
  };
}

export function currentMonthStats(reservations) {
  const now = new Date();
  const thisMonth = reservations.filter((r) => {
    const d = new Date(r.start);
    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });
  const lastMonth = reservations.filter((r) => {
    const d = new Date(r.start);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return (
      d.getMonth() === prev.getMonth() &&
      d.getFullYear() === prev.getFullYear()
    );
  });

  return {
    thisMonth: costStats(thisMonth),
    lastMonth: costStats(lastMonth),
    tripsThisMonth: filterValid(thisMonth).length,
  };
}
