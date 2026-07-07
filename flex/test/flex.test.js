import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLocalISO } from "../lib/format.js";
import { freeBlocks } from "../lib/flex.js";

const seg = (start, end, state) => ({ start, end, state, stateLabel: state });

test("freeBlocks henter kun AVAILABLE og klipper til vinduet", () => {
  const availability = [
    seg("2026-07-07T07:00:00", "2026-07-07T09:00:00", "AVAILABLE"),
    seg("2026-07-07T09:00:00", "2026-07-11T18:00:00", "RESERVED"),
    seg("2026-07-11T18:00:00", "2026-07-12T09:00:00", "AVAILABLE"),
  ];
  const blocks = freeBlocks(
    availability,
    parseLocalISO("2026-07-07T08:00:00"),
    parseLocalISO("2026-07-12T00:00:00")
  );
  assert.equal(blocks.length, 2);
  // første blokk klippet til vindusstart 08:00, ikke 07:00
  assert.equal(blocks[0].start.getTime(), parseLocalISO("2026-07-07T08:00:00").getTime());
  assert.equal(blocks[0].end.getTime(), parseLocalISO("2026-07-07T09:00:00").getTime());
  // andre blokk klippet til vindusslutt 00:00, ikke 09:00
  assert.equal(blocks[1].end.getTime(), parseLocalISO("2026-07-12T00:00:00").getTime());
});

test("freeBlocks utelater segmenter uten overlapp med vinduet", () => {
  const availability = [seg("2026-07-01T00:00:00", "2026-07-02T00:00:00", "AVAILABLE")];
  const blocks = freeBlocks(
    availability,
    parseLocalISO("2026-07-07T00:00:00"),
    parseLocalISO("2026-07-08T00:00:00")
  );
  assert.equal(blocks.length, 0);
});

test("freeBlocks behandler UNAVAILABLE som ikke-ledig", () => {
  const availability = [seg("2026-07-07T00:00:00", "2026-07-08T00:00:00", "UNAVAILABLE")];
  const blocks = freeBlocks(
    availability,
    parseLocalISO("2026-07-07T00:00:00"),
    parseLocalISO("2026-07-08T00:00:00")
  );
  assert.equal(blocks.length, 0);
});
