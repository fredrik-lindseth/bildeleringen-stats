# Bildeleringen Stats

Nettleserutvidelse som gir deg full oversikt over ditt bildeleforbruk, transportkostnader og klimaavtrykk. Bygget for [Bildeleringen / dele.no](https://dele.no).

## Skjermbilder

_Kommer snart._

## Hva du får

### Popup — rask oversikt

Klikk på utvidelsesikonet for et øyeblikksbilde:

- Forbruk denne og forrige måned
- Antall turer og snittpris
- Mest brukte bil
- Estimert besparelse vs. bileierskap
- CO₂ fra dine turer i år
- Sparkline-trend for siste 6 måneder

### Dashboard — fullstendig statistikk

Åpnes fra popup-en. Åtte seksjoner med interaktive grafer:

**Kostnader** — Månedlige kostnader, årlig totalforbruk, snitt/median per tur, dyreste og billigste tur, kostnad per kilometer. Filtrer per år.

**Bruksmønster** — Heatmap over når du kjører (ukedag x tid), turer per måned, gjennomsnittlig turvarighet, dine mest brukte biler.

**Kilometer** — Total distanse, snitt per tur, lengste tur, kilometer fordelt per bilmodell.

**Trender** — År-over-år sammenligning, rullerende 3-måneders snitt, sesongmønster.

**Bilregnestykket** — Hva koster bildeling vs. å eie bil? Sammenligner ditt faktiske forbruk mot estimerte eierkostnader for din mest brukte bilkategori, pluss en konkret sammenligning mot Volvo EX C40 2026. Inkluderer verditap, forsikring, avgift, vedlikehold, parkering og drivstoff. Metodikk med full utregning tilgjengelig.

**Turkategorier** — Automatisk kategorisering av turer basert på notatene dine (handletur, besøk, hyttetur, flyplass, etc.). Donut-chart med kostnad per kategori. Foreslår kategorier du kan bekrefte med ett klikk.

**Klimaregnskap** — CO₂-utslipp beregnet fra faktisk drivstofftype og bilkategori per tur. Månedlig trend, fordeling per drivstofftype, andel elektriske turer. Transparent metodikk med kilder.

**Min transport** — Legg inn annen transport (taxi, leiebil, buss, fly, sykkel) og se totale transportkostnader og CO₂ samlet med bildeling. Gir et helhetlig bilde av hva det koster deg å komme deg rundt.

### Årsoppsummering

En visuell "year in review" med scroll-animasjon — totalt forbruk, kilometer, favorittbil, travleste måned, estimert besparelse og CO₂. Velg år i dropdown.

### Eksport

Hver dashboard-seksjon kan lastes ned som PNG-bilde for rapportering eller deling.

## Installasjon

### Rask installasjon (fra release)

1. Last ned `bildeleringen-stats-v*.zip` fra [Releases](../../releases)
2. Følg instruksjonene for din nettleser under

### Firefox

**Fra zip-fil:**
1. Gå til `about:debugging#/runtime/this-firefox`
2. Klikk «Last inn midlertidig tillegg...»
3. Velg den nedlastede `.zip`-filen

**Fra kildekode:**
1. Klon repoet: `git clone <repo-url>`
2. Gå til `about:debugging#/runtime/this-firefox`
3. Klikk «Last inn midlertidig tillegg...»
4. Velg `manifest.json` fra prosjektmappen

### Chrome / Chromium

1. Last ned og pakk ut `.zip`-filen (eller klon repoet)
2. Gå til `chrome://extensions`
3. Slå på «Utviklermodus» øverst til høyre
4. Klikk «Last inn upakket»
5. Velg den utpakkede mappen

### Forutsetninger

Du må være innlogget på [app.dele.no](https://app.dele.no) i samme nettleser. Utvidelsen leser innloggingen din derfra. Første synkronisering kan ta 1-2 minutter avhengig av antall reservasjoner.

## Hvordan det fungerer

1. **Content script** kjører på `app.dele.no` og leser autentiserings-token fra din aktive innlogging
2. **Bakgrunnsskript** henter reservasjonshistorikk fra dele.no sitt API og cacher alt lokalt i nettleseren
3. **Popup** viser rask oversikt når du klikker på utvidelsesikonet
4. **Dashboard** åpnes fra popup og viser fullstendig statistikk med grafer
5. **Årsoppsummering** gir et visuelt tilbakeblikk per år

Etter første synkronisering hentes kun nye turer (inkrementell oppdatering). Automatisk synk maks én gang per time.

## Personvern

- **All data forblir i nettleseren din** — ingenting sendes til eksterne servere
- Ingen sporing, ingen analyse, ingen tredjeparter
- Eneste nettverkstrafikk er API-kall direkte til dele.no med din eksisterende innlogging
- Data kan eksporteres eller slettes når som helst

## Estimater og kilder

Eierkostnader og CO₂ er estimater. Vi er transparente om metode og kilder:

| Estimat | Kilde |
|---|---|
| Eierkostnader per bilkategori | NAF Bilkostnadsindeks, OFV |
| Volvo EX C40 2026 kostnader | Nypris, forsikring, strømkostnad (norske tall) |
| CO₂ per biltur | Miljødirektoratet (per drivstofftype og kategori) |
| CO₂ buss | TØI/Skyss (~50 g/passasjer-km) |
| CO₂ taxi | Miljødirektoratet (~120 g/km, blandet flåte Bergen) |
| CO₂ fly innenriks | Avinor/Miljødirektoratet (~150 g/passasjer-km) |
| Substitusjonseffekter | TØI 1895/2022 — Bildeling i Bergen |

Klikk «Slik beregner vi» i dashboardet for full utregning med dine tall.

## Tillatelser

| Tillatelse | Hva den brukes til |
|---|---|
| `storage` | Lagre reservasjonsdata og innstillinger lokalt |
| `unlimitedStorage` | Tillate lagring av full reservasjonshistorikk |
| `*://app.dele.no/*` | Lese innlogging og hente data fra dele.no sitt API |

## Utvikling

### Kom i gang

```bash
git clone <repo-url>
cd bildeleringen
```

Last inn utvidelsen som beskrevet under [Installasjon](#installasjon). Etter endringer i koden, last utvidelsen på nytt:

- **Firefox:** Klikk «Last inn på nytt» på `about:debugging`-siden
- **Chrome:** Klikk oppdater-ikonet på `chrome://extensions`-siden

### Prosjektstruktur

```
manifest.json              # Utvidelsesmanifest (Manifest V3)
background.js              # Bakgrunnsskript — synkronisering, caching, meldinger
content.js                 # Content script — leser auth fra dele.no localStorage
popup/
  popup.html/css/js        # Popup — rask oversikt med nøkkeltall
dashboard/
  dashboard.html/css/js    # Dashboard — 8 seksjoner med grafer og analyser
summary/
  summary.html/css/js      # Årsoppsummering — visuell year-in-review
lib/
  api.js                   # API-klient (paginering, retry, rate-limiting)
  browser-polyfill.js      # Firefox/Chrome kompatibilitetslag
  categories.js            # Turkategorisering med auto-forslag fra notater
  chart-helpers.js         # Chart.js wrappere med CSS-variabel-farger
  co2.js                   # CO₂-beregning per drivstofftype og bilkategori
  formatters.js            # Delte formateringsfunksjoner (NOK, dato)
  ownership-cost.js        # Eierkostnadsmodell (kategoribasert + Volvo EX C40 2026)
  stats.js                 # Statistikkberegninger (rene funksjoner)
  transport.js             # Transportkalkulator (taxi, leiebil, buss, fly, sykkel)
vendor/
  chart.min.js             # Chart.js 4.x (UMD bundle)
  html2canvas.min.js       # html2canvas (for PNG-eksport)
icons/                     # Utvidelsesikoner
docs/
  research/                # Forskningsgrunnlag (TØI-rapporter, artikler)
  plans/                   # Design- og implementasjonsplaner
  visjon.md                # Prosjektets nordstjerne-visjon
```

### Teknologi

- Vanilla JS, HTML, CSS — ingen build-step, ingen npm
- [Chart.js](https://www.chartjs.org/) for visualiseringer
- [html2canvas](https://html2canvas.hertzen.com/) for PNG-eksport
- WebExtension API (Manifest V3) — Firefox + Chrome

## Lisens

[MIT](LICENSE)
