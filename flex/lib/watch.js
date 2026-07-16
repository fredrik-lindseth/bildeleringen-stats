import { toLocalISO, parseLocalISO } from "./format.js";
import { freeBlocks, blockMinutes, matchesFilters, withinDistance } from "./flex.js";

// window = { start: Date, end: Date } — det effektive vinduet polleren søkte med.
// Gis eksplisitt; funksjonen leser aldri watch.earliestStart selv.
export function detectHits(searchResult, watch, window) {
  const cars = (searchResult.cars || [])
    .filter((c) => matchesFilters(c, watch.filters))
    .filter((c) => withinDistance(c, watch.filters));
  const minMinutes = watch.minHours * 60;
  const hits = [];
  for (const c of cars) {
    for (const b of freeBlocks(c.availability, window.start, window.end)) {
      const mins = blockMinutes(b);
      if (mins < minMinutes) continue;
      hits.push({
        carId: c.carId,
        carNumber: c.carNumber,
        model: c.model,
        category: c.carCategory,
        location: { name: c.location?.name, distance: c.location?.distance },
        blockStart: b.start,
        blockEnd: b.end,
        blockHours: mins / 60,
      });
    }
  }
  return hits;
}
