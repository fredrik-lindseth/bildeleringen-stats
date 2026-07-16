# Varsler — design

- **Dato:** 2026-07-16
- **Status:** Godkjent, klar for planlegging
- **Type:** Utvidelse av flex-utvidelsen (deteksjon + browser-varsel) pluss en ny
  dedikert backend på serveren (relay til Signal). Fler-bruker-klar fundament.

## Bakgrunn

flex finner ledige biler på forespørsel: du spør, den svarer. Varsler snur det.
Du sier hva du vil ha, og vi sier ifra når det dukker opp. Fellesferie-caset: i
ferien er alt utleid, og du vil vite i det en bil frigjøres lenge nok til at du
kan gripe den.

Nettleser-varsel alene er svakt, du må sitte foran skjermen. Derfor relayer vi
treffet til Signal, så det når mobilen.

**Nøkkelbegrensning som styrer arkitekturen:** dele.no-token bor kun i
nettleser-sesjonen din (`localStorage("persist:data")` på app.dele.no). Serveren
har ingen egen dele.no-token og kan derfor ikke polle ledighet selv. Altså må
pollingen skje i nettleseren, der token finnes. Serveren er kun budbringer.

Konsekvens, ærlig sagt: overvåkningen poller bare mens Firefox er åpen på
laptopen. Vi kan ikke watche 24/7 uten en dele.no-token på serveren, som hadde
vært en verre secret-eksponering og uansett utløper. Gevinsten er likevel reell:
laptopen oppdager, og relayen gjør at du får pinget på mobil selv om du ikke
sitter foran skjermen.

## Mål

1. Overvåk et sted + valgfrie filtre over et ytre tidsvindu, og varsle når en
   matchende bil blir ledig i en sammenhengende blokk ≥ en valgt terskel.
2. To varsel-kanaler per treff: browser-varsel lokalt (umiddelbart) og relay til
   Signal via en dedikert backend (når mobil).
3. Backend bygget fler-bruker-klar (abonnenter med token + kanal), men v1 har kun
   én abonnent: eierens varselkanal.

## Ikke-mål

- **Ikke auto-book.** Egen design-runde. Krever dele.no sitt skrive-API (book +
  avbestill, ikke kartlagt, "feil koster penger") og en server-side avbook-timer
  som overlever at laptopen sovner. Se Oppfølging.
- **Ikke 24/7 server-side polling.** Krever dele.no-token på server.
- **Ikke fler-bruker-onboarding i v1.** Backend-strukturen støtter flere
  abonnenter, men v1 legger inn eierens rad manuelt.
- **Ikke e-post-kanal i v1.** Backend-dispatchen er kanal-agnostisk, men Signal
  bygges først. Resend-e-post er skissert for fler-bruker senere.

## Repo-oppdeling

To repo, koblet av én webhook-POST:

- **`bildeleringen/flex/`** — watch-modell, deteksjon, poller, dispatcher, UI.
  All browser-side kode.
- **`backend/`** — dedikert `bildeleringen-backend` som tar imot treff og
  relayer til Signal. Bygges i backend-repoet; kontrakten under er
  fast.

## Arkitektur / dataflyt

```
flex-utvidelsen (laptop, mens Firefox er åpen)
  alarms vekker background.js hver ~15 min
    → for hver aktiv, ikke-utløpt overvåkning:
        searchAvailability(point, vindu, cachetToken)   [lib/search-api.js]
        detectHits(searchResult, watch)                 [lib/watch.js, ren]
        filtrer bort allerede varslede (notified-boka)
        for nye treff:
          browser.notifications.create(...)             ← lokalt, umiddelbart
          POST /api/notify (hvis backend konfigurert)   ← relay
        før i notified-boka

backend  (bildeleringen-backend, 24/7)
  POST /api/notify  (Bearer <abonnent-token>)
    → slå opp abonnent i SQLite
    → formater norsk melding
    → varsel-api /send  →  Signal   (v1)
    (senere: Resend → e-post)
```

## Watch-modellen

Én overvåkning er et lagret flex-ønske pluss én terskel. Lagres i
`storage.local` under nøkkelen `watches` (array):

```js
{
  id,                    // stabil id (timestamp + teller, ikke Math.random)
  label,                 // "Ferie hjem, 4 døgn"
  point: { lng, lat },   // fra et lagret sted
  placeName,             // for visning ("Eksempelveien")
  filters: {             // valgfrie, samme form som flex-ønsket
    categories, fuels, seats, maxDistanceM, carIds
  },
  earliestStart,         // ISO, ytre grense tidligst
  latestEnd,             // ISO, ytre grense senest
  minHours,              // terskel: minste sammenhengende ledige blokk
  active,                // bool
  created,               // ISO
  notified: {            // de-dup-hovedbok
    "<carId>|<blokkstartISO>": <ts>
  }
}
```

`earliestStart`, `latestEnd` og `filters` er nøyaktig samme form som flex sitt
ønske-objekt, så "Overvåk dette søket" gjenbruker det finder-siden allerede har
bygget opp.

### Storage-nøkler (nye)

| Nøkkel | Struktur | Oppdateres av |
|---|---|---|
| `watches` | Array av watch-objekter (over) | UI (bruker) + poller (`notified`, `active`) |
| `authToken` | `{ token, ts }` | content.js (push fra dele.no-fane) |
| `authStale` | bool | poller (ved 401) |
| `notifyBackend` | `{ url, token }` eller null | UI (innstillinger) |

`places` og `favoriteCarIds` finnes alt fra flex og gjenbrukes.

## Deteksjon (`lib/watch.js`, ren)

Ren modul, samme husregel som `lib/flex.js`: data inn, treff ut, ingen
browser-API, ingen storage, ingen sideeffekter.

```
detectHits(searchResult, watch) → Hit[]
```

1. Filtrer biler med `matchesFilters(car, watch.filters)` og
   `withinDistance(car, watch.filters)` fra `flex.js`.
2. Per bil: `freeBlocks(car.availability, earliestStart, latestEnd)` fra `flex.js`.
3. Behold blokker der `blockMinutes(b) >= watch.minHours * 60`.
4. Returner treff:
   ```js
   { carId, carNumber, model, category, location: {name, distance},
     blockStart, blockEnd, blockHours }
   ```

De-dup ligger **ikke** her (det er tilstand over tid, altså pollerens ansvar).
`detectHits` er ren og gir samme svar for samme input, som gjør den unit-testbar.

**Liten refaktor kreves:** `matchesFilters` og `withinDistance` er i dag
modul-private i `flex.js`. De eksporteres så `watch.js` gjenbruker dem i stedet
for å duplisere. `freeBlocks`, `blockMinutes` og `ORG_BILDELERINGEN` er alt
eksportert.

## Poller (`background.js` + `alarms`)

Ny permission `alarms` i flex-manifestet. Ved oppstart:
`alarms.create("watch-poll", { periodInMinutes: 15 })`. Default 15 min,
konfigurerbar i innstillinger (kortere = mer API-last og batteri).

`alarms.onAlarm` for `"watch-poll"`:

1. Last `watches`. Filtrer til aktive der `latestEnd > nå`.
2. Marker utløpte (`latestEnd <= nå`) som `active: false`, lagre.
3. Hent cachet token (`authToken`). Mangler den, eller `authStale`: hopp over,
   sett status. (Ingen dele.no-fane har kjørt content.js ennå.)
4. For hver aktive watch, sekvensielt (rate-limit i `search-api.js` holder):
   - `searchAvailability(watch.point, max(earliestStart, nå), latestEnd, token)`
   - `detectHits(result, watch)`
   - Filtrer bort treff der `"<carId>|<blokkstartISO>"` finnes i `watch.notified`.
   - For nye treff: dispatch (se under), før nøkkelen inn i `watch.notified` med
     tidsstempel.
5. Rydd `notified`-boka: dropp nøkler med blokkstart før `nå` (blokken er passert).
6. Lagre `watches`.

401 fra søket: tøm `authToken`, sett `authStale = true`, stopp runden.

## Auth (cachet token)

Samme teknikk som stats-utvidelsen. `content.js` på app.dele.no leser token fra
`localStorage("persist:data")` og pusher den til `storage.local` (`authToken`)
ved hver dele.no-lasting. Poller leser cachet token, uavhengig av om en fane er
åpen akkurat nå.

Token ligger i `storage.local` på din egen maskin, samme tillitsgrense som
reservasjonsdataene stats alt lagrer. Den er aldri i repoet og krysser aldri til
serveren.

## Varsel-dispatcher

Per nytt treff, to kanaler:

**1. Browser-varsel** (`notifications`-permission). `browser.notifications.create`
med tittel/tekst på norsk, f.eks. "Yaris #948 ledig 104 t ved Eksempelveien". Klikk
åpner finder-siden med watchens ønske forhåndslastet (derfra ett steg videre til
dele.no via eksisterende handoff). Nektet notifications-permission: fall tilbake
til kun relay (hvis konfigurert) + status i UI.

**2. Webhook-relay** til backend, kun hvis `notifyBackend` er satt. Fire-and-forget
med kort retry (backenden er ikke kritisk sti, browser-varselet er alt fyrt).
Feil logges, ingen spam.

### Kontrakt: `POST /api/notify`

```
POST https://varsel.example.com/api/notify
Authorization: Bearer <abonnent-token>
Content-Type: application/json

{
  "watchLabel": "Ferie hjem",
  "place": "Eksempelveien",
  "car":  { "model": "Yaris", "number": "#948",
            "location": "Eksempelveien", "distanceM": 166 },
  "free": { "start": "2026-07-20T09:00:00",
            "end":   "2026-07-24T17:00:00", "hours": 104 },
  "deepLink": "https://app.dele.no/findcar?start=2026-07-20T09:00:00&end=2026-07-24T17:00:00"
}
```

Svar: `200` (relayet), `401` (ukjent/utløpt token), `429` (rate-limit).
Utvidelsen trenger `https://varsel.example.com/*` i `host_permissions`.

## Backend (`bildeleringen-backend`)

Bygges i backend-repoet og følger driftsrepoets
sjekkliste for nye tjenester.

- **Stack:** liten Python-stdlib-tjeneste (ingen pip), ett server-script.
  Eget image, kjører i egen container.
- **Host:** samme vert som varsel-API-et, som nås
  på et internt nettverk.
- **Proxy-rute:** `varsel.example.com`, `/api/*` → backend. Sikkerhetsheadere
  og rate-limit. **Ikke SSO** på ingest-stien
  (utvidelsen kan ikke SSO-logge inn); token-auth i stedet, dokumentert egen auth
  slik sjekklista tillater.
- **State:** SQLite `subscribers(token, channel_type, channel_target, label,
  created)`. v1: én rad, `channel_type="signal"`, `channel_target=<gruppe-id>`.
- **Auth:** `Authorization: Bearer <token>` slås opp mot `subscribers`. Ukjent
  → 401.
- **Dispatch:** formater norsk melding, `curl varsel-api /send`.
  Kanal-agnostisk, så Resend-e-post kan legges til senere uten å røre kontrakten.
- **`/health`** for healthcheck. Porter bundet `127.0.0.1`.

Backenden har egne tester i backend-repoet.

## UI

Alt i flex, norsk, mørk modus, farger via `:root`, flex-designspråket.

- **Finder-siden:** knapp "Overvåk dette søket" som lagrer gjeldende ønske pluss
  et `minHours`-felt som en ny watch.
- **"Mine overvåkninger":** ny visning (fane/seksjon) med liste: label, vindu,
  terskel, status (aktiv / utløpt / venter på innlogging), sist sjekket, av/på-
  bryter, slett.
- **Innstillinger:** backend-URL + abonnent-token (valgfritt; uten = kun
  browser-varsel), og poll-intervall.

## Nye tillatelser (flex/manifest.json)

- `alarms` — bakgrunns-polling.
- `notifications` — browser-varsel.
- `host_permissions`: `https://varsel.example.com/*` — webhook-relay.

## Faser

- **v1** — deteksjon + browser-varsel + varsel-relay via dedikert backend.
- **Oppfølging (egne runder):**
  - E-post-kanal (Resend) i backend for fremmede brukere.
  - Fler-bruker-onboarding: hvordan en ukjent bruker registrerer kanal + får
    token. Signal er vanskelig for fremmede (må snakke med bot-nummeret), e-post
    er den lette veien.
  - **Auto-book med angrefrist:** grip bilen når den frigjøres, ~1 t før
    bookinggebyret slår inn, server-side timer avbooker automatisk hvis brukeren
    ikke bekrefter. Krever kartlegging av skrive-API-et, server-side token-
    forvaltning, og penge-sikkerhet. Egen design-runde.

## Testing

- `lib/watch.js` unit-testes med `node --test` mot fixtures: terskelgrense (blokk
  akkurat på/under `minHours`), flere blokker per bil, utløpt vindu, filter-
  anvendelse, og et "bil frigjøres"-scenario bygget fra `search-sample.json`.
- Poller-logikken (de-dup, utløp, rydding) testes med en tynn wrapper der
  storage og klokke er injisert, eller holdes mekanisk enkel og verifiseres i
  Firefox via firefox-devtools-MCP-en.
- Backend har egne tester i backend-repoet.

## Åpne spørsmål / risiko

- **Firefox MV3 service-worker-terminering:** `alarms` skal vekke en terminert
  SW. Verifiseres tidlig i Firefox (at pollingen faktisk kjører etter at SW-en
  er sovnet).
- **Poll-intervall vs. batteri/rate:** 15 min er en gjetning. Justeres etter
  hvordan det oppleves; `search`-svaret er ~586 KB, så altfor hyppig polling er
  sløsing.
- **varsel-api-reachability:** backenden må nå `varsel-api` på samme vert. Løses ved
  å deploye backenden på samme vert. Bekreftes i backend-
  delegeringen.
- **Fler-bruker Signal:** å sende Signal til fremmede krever at de interagerer
  med bot-nummeret. Derfor er e-post den realistiske fler-bruker-kanalen. Ikke
  blokkerende for v1 (kun eieren).
- **notified-boka vokser:** ryddes hver runde ved å droppe passerte blokker, så
  den holder seg liten.
