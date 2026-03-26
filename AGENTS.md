# Bildeleringen Stats — Prosjektkonvensjoner

## Regler

- **Ingen build-step.** Vanilla JS, HTML, CSS. Ingen bundler eller npm. Vendor-libs i `vendor/`.
- **Alle farger via CSS custom properties i `:root`.** Ingen hardkodede hex/rgb utenfor `:root`. Maks 5 chart-farger (`--color-chart-1` til `--color-chart-5`) — legg til ny CSS-variabel før du bruker en 6. farge.
- **Mørk modus er påkrevd.** All UI må fungere i lys og mørk modus (`prefers-color-scheme`). Nye CSS-variabler trenger dark mode override.
- **Norsk UI-tekst.** Alt brukeren ser (labels, feilmeldinger, status) på norsk. Console.log kan være engelsk.
- **ES modules overalt** — unntatt `content.js` (content scripts støtter ikke modules).
- **Stats-funksjoner er rene.** `lib/stats.js`, `lib/co2.js`, `lib/ownership-cost.js` har ingen sideeffekter — tar data inn, returnerer resultater. Ikke kall browser-API-er eller storage fra disse.
- **Vis 'Slik beregner vi'-knapp med kilder** ved alle estimater (eierkostnader, CO₂). Prefix estimerte tall med "ca." eller "~".
- **Cross-browser:** `typeof browser !== "undefined" ? browser : chrome` for API-tilgang. `lib/browser-polyfill.js` eksporterer `browserAPI` og `storage`.

## API-feltnavn (kritisk)

Reservasjonsobjekter fra dele.no bruker disse feltnavnene — IKKE det du kanskje ville gjettet:

| Felt | Type | Beskrivelse |
|---|---|---|
| `price.total` | number | Kostnad i NOK (IKKE `totalPrice`) |
| `price.lines[]` | array | Prislinjer: startavgift, timepris, km-pris, gebyr |
| `drivenKm` | number/null | Kjørte km (IKKE `distance`) |
| `car.model` | string | Bilmodell (IKKE `vehicleName`) |
| `car.category` | string | Småbil / Minibil / Kombi / Stasjonsvogn / SUV / Varebil |
| `car.properties[]` | array | `groupKey: "FUEL_TYPE"` → `name: "Bensin"/"Diesel"/"Elektrisitet"` |
| `canceled` | datetime/null | null = ikke avbestilt (IKKE `status`) |
| `noTrips` | boolean | Booket men ikke kjørt. Kan ha kostnad > 0 (gebyr). |
| `notes` | string/null | Brukerens turnotater — brukes til auto-kategorisering |
| `start`, `end` | datetime | ISO-strenger |
| `created` | datetime | Opprettelsestidspunkt (for booking lead time) |

Full OpenAPI-spec i `docs/api/openapi.json`. Anonymiserte eksempler i `docs/api/sample-*.json`.

## Filtrering

Alle stats-funksjoner bruker én av to filtre:

- **`filterValid()`** — `canceled == null` OG `price.total != null`. Inkluderer noTrips (bruker betalte). Brukes av: `costStats()`, `monthlyCosts()`, `yearlyCosts()`.
- **`filterDriven()`** — `filterValid()` OG `!noTrips`. Kun faktisk kjøring. Brukes av: `usagePatterns()`, `mileageStats()`, `totalCO2()`, `estimateOwnershipCost()`.

Bruk feil filter → feil tall uten synlig feil.

## Storage-nøkler

Alt i `browser.storage.local`:

| Nøkkel | Struktur | Oppdateres av |
|---|---|---|
| `reservations` | Array av fulle reservasjonsobjekter | background.js (sync) |
| `lastSync` | Timestamp (ms) | background.js (sync) |
| `tripCategories` | `{ reservationId: categoryKey }` | dashboard (bruker-input) |
| `transportData` | `{ "2025": { taxi: {...}, buss: {...} } }` | dashboard (bruker-input) |

Reservasjoner og lastSync er API-data — rør dem ikke direkte. tripCategories og transportData er bruker-data — slett aldri ved sync.

## API-regler

- **Rate-limiting:** `lib/api.js` legger inn 50ms delay mellom kall. 429-svar → eksponentiell backoff (2^attempt × 1000ms). Endre ikke uten grunn.
- **Sync-intervall:** Maks én gang per time (`SYNC_INTERVAL_MS`). Manuell sync trigges av brukeren.
- **Inkrementell sync:** Henter kun nye reservasjoner (sammenligner ID-er mot cache). Eksisterende data oppdateres IKKE ved re-sync.
- **Token:** Kan utløpe (401). background.js ber content script om nytt token. Feiler stille hvis dele.no-fane er lukket.

Endepunkter:
- `GET /api/reservations/historic?page=0&size=100&sort=start,desc&membershipId=<UUID>`
- `GET /api/reservations/{id}`
- Auth: `authorization`-header med bearer token fra `localStorage("persist:data")` på app.dele.no
