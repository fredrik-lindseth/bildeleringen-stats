# Bildeleringen Stats — Prosjektkonvensjoner

## Arkitektur

Nettleserutvidelse (Manifest V3) for Firefox + Chrome. Ingen build-step.

- `content.js` — kjører på `app.dele.no`, leser auth fra localStorage. Kan IKKE bruke ES modules.
- `background.js` — ES module. Håndterer synkronisering, caching, meldinger.
- `popup/` — ES module. Rask oversikt, åpnes fra utvidelsesikonet.
- `dashboard/` — ES module. Fullstendig statistikk med Chart.js-grafer.
- `lib/` — Delte moduler (API-klient, stats-beregninger, chart-helpers, browser-polyfill).
- `vendor/chart.min.js` — Chart.js UMD, lastes via `<script>` tag i HTML.

## Regler

- **Ingen build-step.** Vanilla JS, HTML, CSS. Ingen bundler, transpiler, eller npm-avhengigheter.
- **Alle farger via CSS custom properties i `:root`.** Ingen hardkodede hex/rgb-verdier utenfor `:root`.
- **Mørk modus er påkrevd.** All UI må fungere i både lys og mørk modus (`prefers-color-scheme`).
- **Norsk UI-tekst.** Alle brukervendte tekster på norsk.
- **ES modules overalt** — unntatt `content.js` (content scripts støtter ikke modules).
- **Stats-funksjoner er rene.** `lib/stats.js` har ingen sideeffekter — tar data inn, returnerer resultater.
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
