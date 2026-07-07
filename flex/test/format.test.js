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

test("parseLocalISO godtar brøkdels-sekunder (API kan gi mikrosekunder)", () => {
  const d = parseLocalISO("2026-07-07T18:44:00.113787");
  assert.equal(d.getHours(), 18);
  assert.equal(d.getMinutes(), 44);
  assert.equal(d.getSeconds(), 0);
});

test("parseLocalISO kaster på ugyldig streng", () => {
  assert.throws(() => parseLocalISO("ikke en dato"));
});
