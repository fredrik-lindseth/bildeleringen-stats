import { test } from "node:test";
import assert from "node:assert/strict";
import { toLocalISO, parseLocalISO } from "../lib/format.js";

test("round-trip bevarer veggklokke uten tidssoneskift", () => {
  const s = "2026-07-08T09:30:00";
  assert.equal(toLocalISO(parseLocalISO(s)), s);
});

test("parseLocalISO tolker som lokal tid", () => {
  const d = parseLocalISO("2026-07-08T09:00:00");
  assert.equal(d.getHours(), 9);
  assert.equal(d.getMonth(), 6); // juli
  assert.equal(d.getDate(), 8);
});

test("parseLocalISO godtar manglende sekunder", () => {
  assert.equal(toLocalISO(parseLocalISO("2026-07-08T09:00")), "2026-07-08T09:00:00");
});

test("parseLocalISO kaster på ugyldig streng", () => {
  assert.throws(() => parseLocalISO("ikke en dato"));
});
