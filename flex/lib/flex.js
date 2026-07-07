import { parseLocalISO } from "./format.js";

export const MS_PER_MINUTE = 60 * 1000;

export function blockMinutes(b) {
  return (b.end - b.start) / MS_PER_MINUTE;
}

// Maksimale AVAILABLE-blokker klippet til [windowStart, windowEnd], stigende.
// Antar at availability-segmentene kommer sortert og sammenhengende fra API-et.
export function freeBlocks(availability, windowStart, windowEnd) {
  const blocks = [];
  for (const s of availability) {
    if (s.state !== "AVAILABLE") continue;
    const segStart = parseLocalISO(s.start);
    const segEnd = parseLocalISO(s.end);
    const start = segStart < windowStart ? windowStart : segStart;
    const end = segEnd > windowEnd ? windowEnd : segEnd;
    if (end <= start) continue;
    const last = blocks[blocks.length - 1];
    if (last && start <= last.end) {
      if (end > last.end) last.end = end;
    } else {
      blocks.push({ start, end });
    }
  }
  return blocks;
}

// Alle availability-segmenter (uansett state) klippet til vinduet — for tidslinja.
export function clippedSegments(availability, windowStart, windowEnd) {
  const out = [];
  for (const s of availability) {
    const start = parseLocalISO(s.start);
    const end = parseLocalISO(s.end);
    const cs = start < windowStart ? windowStart : start;
    const ce = end > windowEnd ? windowEnd : end;
    if (ce <= cs) continue;
    out.push({ start: cs, end: ce, state: s.state });
  }
  return out;
}

function carBase(car, segments) {
  return {
    carId: car.carId,
    carNumber: car.carNumber,
    model: car.model,
    category: car.carCategory,
    seats: car.seats,
    hourlyRate: car.hourlyRate,
    carProperties: car.carProperties || [],
    location: {
      name: car.location?.name,
      distance: car.location?.distance,
      id: car.location?.id,
    },
    segments,
  };
}

export function fitCar(car, wish) {
  const segments = clippedSegments(car.availability, wish.earliestStart, wish.latestEnd);
  const base = carBase(car, segments);
  const blocks = freeBlocks(car.availability, wish.earliestStart, wish.latestEnd);
  if (blocks.length === 0) {
    return { ...base, kind: "none", proposed: null, coversWholeWindow: false,
             shiftMinutes: 0, bestBlockMinutes: 0, shortfallMinutes: null };
  }
  const longest = blocks.reduce((a, b) => (blockMinutes(b) >= blockMinutes(a) ? b : a));
  const bestBlockMinutes = blockMinutes(longest);
  const coversWindow = (b) => b.start <= wish.earliestStart && b.end >= wish.latestEnd;

  if (wish.durationMinutes == null) {
    // hele-vinduet-modus
    const windowMinutes = (wish.latestEnd - wish.earliestStart) / MS_PER_MINUTE;
    if (blocks.some(coversWindow)) {
      return { ...base, kind: "fits",
               proposed: { start: wish.earliestStart, end: wish.latestEnd },
               coversWholeWindow: true, shiftMinutes: 0,
               bestBlockMinutes: windowMinutes, shortfallMinutes: 0 };
    }
    return { ...base, kind: "short",
             proposed: { start: longest.start, end: longest.end },
             coversWholeWindow: false, shiftMinutes: 0,
             bestBlockMinutes, shortfallMinutes: windowMinutes - bestBlockMinutes };
  }

  // varighets-modus
  const D = wish.durationMinutes;
  const fitting = blocks.filter((b) => blockMinutes(b) >= D);
  if (fitting.length > 0) {
    const earliest = fitting.reduce((a, b) => (b.start < a.start ? b : a));
    const proposed = { start: earliest.start, end: new Date(earliest.start.getTime() + D * MS_PER_MINUTE) };
    return { ...base, kind: "fits", proposed,
             coversWholeWindow: coversWindow(proposed),
             shiftMinutes: (proposed.start - wish.earliestStart) / MS_PER_MINUTE,
             bestBlockMinutes, shortfallMinutes: 0 };
  }
  return { ...base, kind: "short",
           proposed: { start: longest.start, end: longest.end },
           coversWholeWindow: false, shiftMinutes: (longest.start - wish.earliestStart) / MS_PER_MINUTE,
           bestBlockMinutes, shortfallMinutes: D - bestBlockMinutes };
}

function matchesFilters(car, filters = {}) {
  if (filters.category && car.carCategory !== filters.category) return false;
  if (filters.seats && (car.seats || 0) < filters.seats) return false;
  if (filters.fuel) {
    const fuels = (car.carProperties || [])
      .filter((p) => p.carPropertyGroup === "Drivstoff")
      .map((p) => p.carPropertyName);
    if (!fuels.includes(filters.fuel)) return false;
  }
  if (filters.carIds && filters.carIds.length && !filters.carIds.includes(car.carId)) return false;
  return true;
}

function withinDistance(car, filters = {}) {
  if (!filters.maxDistanceM) return true;
  const d = car.location?.distance;
  return d == null ? false : d <= filters.maxDistanceM;
}

function rankFits(list) {
  list.sort((a, b) => {
    if (a.coversWholeWindow !== b.coversWholeWindow) return a.coversWholeWindow ? -1 : 1;
    if (a.shiftMinutes !== b.shiftMinutes) return a.shiftMinutes - b.shiftMinutes;
    if (a.bestBlockMinutes !== b.bestBlockMinutes) return b.bestBlockMinutes - a.bestBlockMinutes;
    return (a.location.distance ?? Infinity) - (b.location.distance ?? Infinity);
  });
}

function siblingSuggestions(fits, wish) {
  const t = wish.target;
  const targetFit = t.carId ? fits.find((f) => f.carId === t.carId) : null;
  if (targetFit && targetFit.kind === "fits" && targetFit.coversWholeWindow) return [];
  const model = t.model || targetFit?.model;
  const category = t.category || targetFit?.category;
  const siblings = fits.filter((f) => {
    if (t.carId && f.carId === t.carId) return false;
    if (f.kind !== "fits") return false;
    return model ? f.model === model : f.category === category;
  });
  rankFits(siblings);
  return siblings;
}

export function solve(searchResult, wish) {
  const cars = (searchResult.cars || [])
    .filter((c) => matchesFilters(c, wish.filters))
    .filter((c) => withinDistance(c, wish.filters));
  const fits = cars.map((c) => fitCar(c, wish));

  const whole = fits.filter((f) => f.kind === "fits" && f.coversWholeWindow);
  const adjusted = fits.filter((f) => (f.kind === "fits" && !f.coversWholeWindow) || f.kind === "short");
  rankFits(whole);
  rankFits(adjusted);

  const siblings = wish.target ? siblingSuggestions(fits, wish) : [];
  return { whole, adjusted, siblings };
}
