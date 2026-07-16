import { test } from "node:test";
import assert from "node:assert/strict";
import { detectHits } from "../lib/watch.js";
import { ORG_BILDELERINGEN } from "../lib/flex.js";

function car(over = {}) {
  return {
    carId: "c1", carNumber: "#948", model: "Yaris", carCategory: "Småbil",
    organizationId: ORG_BILDELERINGEN, seats: 5, carProperties: [],
    location: { id: "loc1", name: "Eksempelveien", distance: 166 },
    availability: [{ start: "2026-07-20T09:00:00", end: "2026-07-24T17:00:00", state: "AVAILABLE" }],
    ...over,
  };
}
const WIN = { start: new Date(2026, 6, 20, 9), end: new Date(2026, 6, 24, 17) };
const watch = (over = {}) => ({ minHours: 24, filters: { organizationId: ORG_BILDELERINGEN }, ...over });

test("detectHits gir treff for blokk over terskel", () => {
  const hits = detectHits({ cars: [car()] }, watch(), WIN);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].carId, "c1");
  assert.equal(hits[0].model, "Yaris");
  assert.ok(hits[0].blockHours >= 24);
});

test("detectHits dropper blokk under terskel", () => {
  const kort = car({ availability: [{ start: "2026-07-20T09:00:00", end: "2026-07-20T15:00:00", state: "AVAILABLE" }] });
  assert.equal(detectHits({ cars: [kort] }, watch({ minHours: 24 }), WIN).length, 0);
});

test("detectHits filtrerer bort andre organisasjoner", () => {
  const annen = car({ carId: "c2", organizationId: "annen-org" });
  const hits = detectHits({ cars: [annen] }, watch(), WIN);
  assert.equal(hits.length, 0);
});

test("detectHits gir ett treff per ledig blokk", () => {
  const toblokk = car({ availability: [
    { start: "2026-07-20T09:00:00", end: "2026-07-22T09:00:00", state: "AVAILABLE" },
    { start: "2026-07-22T09:00:00", end: "2026-07-23T09:00:00", state: "RESERVED" },
    { start: "2026-07-23T09:00:00", end: "2026-07-24T17:00:00", state: "AVAILABLE" },
  ]});
  const hits = detectHits({ cars: [toblokk] }, watch({ minHours: 24 }), WIN);
  assert.equal(hits.length, 2);
});
