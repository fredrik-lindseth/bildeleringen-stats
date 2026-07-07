import { parseLocalISO } from "./format.js";

const MS_PER_MINUTE = 60 * 1000;

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
