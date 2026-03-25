# Bildeleringen Stats

Nettleserutvidelse som gir deg statistikk og analyse av ditt bildeleforbruk på [dele.no](https://dele.no).

## Skjermbilder

*Kommer snart.*

## Funksjoner

- Oversikt over kjøreturer, kostnader og forbruk
- Statistikk per bil, måned og år
- All data lagres lokalt i nettleseren din

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

## Hvordan det fungerer

Utvidelsen leser autentiserings-token fra din aktive innlogging på dele.no og bruker dette til å hente statistikkdata fra dele.no sitt API. All databehandling skjer lokalt i nettleseren.

## Personvern

All data forblir i nettleseren din. Utvidelsen sender ingen data til eksterne servere. Det eneste nettverkstrafikken som genereres er API-kall direkte til dele.no sine servere, med din eksisterende innlogging.

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
manifest.json          # Utvidelsesmanifest (Manifest V3)
background.js          # Service worker / bakgrunnsskript
content.js             # Content script (kjører på dele.no)
popup/                 # Popup-UI (HTML/CSS/JS)
icons/                 # Utvidelsesikoner
```

## Lisens

[MIT](LICENSE)
