# Bildeleringen Stats

Nettleserutvidelse som gir deg statistikk og analyse av ditt bildeleforbruk på [dele.no](https://dele.no).

## Skjermbilder

_Kommer snart._

## Funksjoner

- **Popup:** Rask oversikt over forbruk denne og forrige måned, antall turer, snittkostnad, mest brukte bil, årlig besparelse og CO₂
- **Dashboard:** Fullstendig statistikk med syv seksjoner:
  - **Kostnader** — måned-over-måned, årlig totalforbruk, snitt/median per tur, dyreste/billigste tur, kostnad per km
  - **Bruksmønster** — heatmap (ukedag × tid), turer per måned, gjennomsnittlig varighet, mest brukte biler
  - **Kilometer** — total distanse, snitt per tur, lengste tur, km per bil
  - **Trender** — år-over-år sammenligning, rullerende 3-måneders snitt, sesongmønster
  - **Bilregnestykket** — sammenligning mot å eie bil (kategoribasert + Volvo EX C40 2026)
  - **Turkategorier** — automatisk kategorisering av turer fra notater, kostnad per kategori
  - **Klimaregnskap** — CO₂-utslipp basert på drivstofftype, sammenligning mot privatbil
- **Årsoppsummering** — visuell "year in review" med nøkkeltall, besparelse og klimaeffekt
- Inkrementell synkronisering — henter kun nye turer etter første innlasting
- All data lagres lokalt i nettleseren, ingen eksterne servere
- Kostnader og CO₂ er estimater basert på norske gjennomsnitt (NAF, SSB, Miljødirektoratet)

## Installasjon

### Firefox

1. Last ned eller klon dette repoet
2. Gå til `about:debugging#/runtime/this-firefox`
3. Klikk «Last inn midlertidig tillegg...»
4. Velg `manifest.json` fra prosjektmappen

### Chrome / Chromium

1. Last ned eller klon dette repoet
2. Gå til `chrome://extensions`
3. Slå på «Utviklermodus» øverst til høyre
4. Klikk «Last inn upakket»
5. Velg prosjektmappen

### Forutsetninger

Du må være innlogget på [app.dele.no](https://app.dele.no) i samme nettleser. Utvidelsen leser innloggingen din derfra.

## Hvordan det fungerer

1. **Content script** kjører på `app.dele.no` og leser autentiserings-token fra din aktive innlogging
2. **Bakgrunnsskript** henter reservasjonshistorikk fra dele.no sitt API og cacher alt lokalt
3. **Popup** viser en rask oversikt når du klikker på utvidelsesikonet
4. **Dashboard** åpnes fra popup og viser fullstendig statistikk med grafer

Cachen oppdateres automatisk maks én gang per time. Du kan også synkronisere manuelt.

## Tillatelser

| Tillatelse          | Hva den brukes til                                 |
| ------------------- | -------------------------------------------------- |
| `storage`           | Lagre reservasjonsdata lokalt i nettleseren        |
| `unlimitedStorage`  | Tillate lagring av full reservasjonshistorikk      |
| `*://app.dele.no/*` | Lese innlogging og hente data fra dele.no sitt API |

## Personvern

- All data forblir i nettleseren din
- Ingen data sendes til eksterne servere
- Ingen sporing eller analyse
- Eneste nettverkstrafikk er API-kall direkte til dele.no sine servere med din eksisterende innlogging

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
manifest.json            # Utvidelsesmanifest (Manifest V3)
background.js            # Bakgrunnsskript — synkronisering og caching
content.js               # Content script — leser auth fra dele.no
popup/
  popup.html/css/js      # Popup-UI — rask oversikt
dashboard/
  dashboard.html/css/js  # Dashboard — fullstendig statistikk
summary/
  summary.html/css/js    # Årsoppsummering — visuell year-in-review
lib/
  api.js                 # API-klient (paginering, retry, rate-limiting)
  browser-polyfill.js    # Firefox/Chrome kompatibilitetslag
  categories.js          # Turkategorisering med auto-forslag fra notater
  chart-helpers.js       # Chart.js hjelpefunksjoner
  co2.js                 # CO₂-beregning per drivstofftype og bilkategori
  formatters.js          # Delte formateringsfunksjoner (NOK, dato)
  ownership-cost.js      # Eierkostnadsmodell (kategori + Volvo EX C40)
  stats.js               # Statistikkberegninger (rene funksjoner)
vendor/
  chart.min.js           # Chart.js (bundlet)
icons/                   # Utvidelsesikoner
```

### Teknologi

- Vanilla JS, HTML, CSS — ingen build-step
- [Chart.js](https://www.chartjs.org/) for visualiseringer
- WebExtension API (Manifest V3) — fungerer i Firefox og Chrome

## Lisens

[MIT](LICENSE)
