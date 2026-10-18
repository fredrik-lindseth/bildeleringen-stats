import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBackendUrl, originPatternFor } from "../lib/relay.js";

test("tom adresse betyr relay av", () => {
  assert.deepEqual(parseBackendUrl(""), { url: "", originPattern: null });
  assert.deepEqual(parseBackendUrl("   "), { url: "", originPattern: null });
  assert.deepEqual(parseBackendUrl(undefined), { url: "", originPattern: null });
});

test("https-adresse gir url uten skråstrek og mønster for verten", () => {
  assert.deepEqual(parseBackendUrl(" https://varsel.example.com/ "), {
    url: "https://varsel.example.com",
    originPattern: "https://varsel.example.com/*",
  });
});

test("sti beholdes, port inngår i url men ikke i mønsteret", () => {
  assert.deepEqual(parseBackendUrl("https://varsel.example.com:8443/relay//"), {
    url: "https://varsel.example.com:8443/relay",
    originPattern: "https://varsel.example.com/*",
  });
});

test("vertsnavn normaliseres til små bokstaver", () => {
  assert.equal(parseBackendUrl("https://Varsel.Example.COM").originPattern, "https://varsel.example.com/*");
});

test("http er lov mot localhost og 127.0.0.1", () => {
  assert.equal(parseBackendUrl("http://localhost:8000").originPattern, "http://localhost/*");
  assert.equal(parseBackendUrl("http://127.0.0.1:8000").url, "http://127.0.0.1:8000");
});

test("http mot andre verter avvises", () => {
  assert.throws(() => parseBackendUrl("http://varsel.example.com"), /https/);
});

test("andre protokoller og ugyldig input avvises", () => {
  assert.throws(() => parseBackendUrl("ftp://varsel.example.com"), /https/);
  assert.throws(() => parseBackendUrl("varsel.example.com"), /gyldig/);
});

test("brukernavn, query og fragment avvises", () => {
  assert.throws(() => parseBackendUrl("https://u:p@varsel.example.com"), /passord/);
  assert.throws(() => parseBackendUrl("https://varsel.example.com/?token=x"), /\?/);
  assert.throws(() => parseBackendUrl("https://varsel.example.com/#a"), /#/);
});

test("originPatternFor gir null for tom eller ugyldig lagret adresse", () => {
  assert.equal(originPatternFor(""), null);
  assert.equal(originPatternFor("http://varsel.example.com"), null);
  assert.equal(originPatternFor("https://varsel.example.com"), "https://varsel.example.com/*");
});
