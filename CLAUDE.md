# Bildeleringen Stats — Prosjektkonvensjoner

## Arkitektur

Nettleserutvidelse (Manifest V3) for Firefox + Chrome. Ingen build-step.

- `content.js` — kjører på `app.dele.no`, leser auth fra localStorage. Kan IKKE bruke ES modules.
- `background.js` — ES module. Håndterer synkronisering, caching, meldinger.
- `popup/` — ES module. Rask oversikt, åpnes fra utvidelsesikonet.
- `dashboard/` — ES module. Fullstendig statistikk med Chart.js-grafer.
- `summary/` — ES module. Årsoppsummering, egen mørk design.
- `lib/` — Delte moduler:
  - `api.js` — API-klient (paginering, retry, rate-limiting)
  - `browser-polyfill.js` — Firefox/Chrome kompatibilitetslag
  - `categories.js` — Turkategorisering med auto-forslag fra `notes`-feltet
  - `chart-helpers.js` — Chart.js wrappere med CSS-variabel-farger
  - `co2.js` — CO₂-beregning per drivstofftype og bilkategori
  - `formatters.js` — Delte formateringsfunksjoner (NOK, dato)
  - `ownership-cost.js` — Eierkostnadsmodell (kategoribasert + Volvo EX C40 2026)
  - `stats.js` — Statistikkberegninger (rene funksjoner)
- `vendor/chart.min.js` — Chart.js UMD, lastes via `<script>` tag i HTML.

## Regler

- **Ingen build-step.** Vanilla JS, HTML, CSS. Ingen bundler, transpiler, eller npm-avhengigheter.
- **Alle farger via CSS custom properties i `:root`.** Ingen hardkodede hex/rgb-verdier utenfor `:root`.
- **Mørk modus er påkrevd.** All UI må fungere i både lys og mørk modus (`prefers-color-scheme`).
- **Norsk UI-tekst.** Alle brukervendte tekster på norsk.
- **ES modules overalt** — unntatt `content.js` (content scripts støtter ikke modules).
- **Stats-funksjoner er rene.** `lib/stats.js`, `lib/co2.js`, `lib/ownership-cost.js` har ingen sideeffekter.
- **Turkategorier lagres separat** i `browser.storage.local` under nøkkel `tripCategories`, ikke i reservasjonsdata.
- **Estimater er tydelig merket.** Eierkostnader og CO₂ er estimater basert på norske gjennomsnitt.
- **Cross-browser:** `typeof browser !== "undefined" ? browser : chrome` for API-tilgang.

## Testing

Last inn som midlertidig utvidelse:

- **Firefox:** `about:debugging#/runtime/this-firefox` → «Last inn midlertidig tillegg» → velg `manifest.json`
- **Chrome:** `chrome://extensions` → Utviklermodus → «Last inn upakket» → velg prosjektmappen

Du må være innlogget på `app.dele.no` for å teste med ekte data.

## API

Utvidelsen bruker dele.no sitt interne API:

- `GET /api/reservations/historic?page=N&size=100&sort=start,desc&membershipId=X` — paginert historikk
- `GET /api/reservations/{id}` — reservasjonsdetaljer
- Auth via `authorization`-header (token fra localStorage)
