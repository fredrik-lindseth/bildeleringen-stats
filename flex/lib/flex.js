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
