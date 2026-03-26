# dele.no API — Uoffisiell dokumentasjon

Observert fra `app.dele.no`. Brukes av Bildeleringen Stats-utvidelsen.

## Filer

- `openapi.json` — OpenAPI 3.0 spec med alle observerte endepunkter og skjemaer
- `sample-reservation-driven.json` — Eksempel: fullført tur med km og prislinjer
- `sample-reservation-notrip.json` — Eksempel: booket men ikke kjørt (noTrips=true, har gebyr)
- `sample-reservation-cancelled.json` — Eksempel: avbestilt reservasjon
- `sample-historic-list.json` — Eksempel: respons fra /reservations/historic

## Autentisering

Token hentes fra `localStorage.getItem("persist:data")` på `app.dele.no`:

```js
const raw = JSON.parse(localStorage.getItem("persist:data"));
const token = JSON.parse(raw.authentication);       // Bearer token
const membershipId = JSON.parse(raw.selectedMembership).id;
```

## Endepunkter

### GET /reservations/historic

Paginert liste over historiske reservasjoner.

```
?page=0&size=100&sort=start,desc&membershipId={uuid}
```

Returnerer array av `Reservation`-objekter. Tom array = ingen flere sider.

### GET /reservations/{id}

Detaljer for én reservasjon. Samme skjema som listeelementer.

## Viktige feltnavn

| Felt | Type | Beskrivelse |
|---|---|---|
| `price.total` | number | Total kostnad i NOK |
| `price.lines[]` | array | Detaljert prisberegning (startavgift, timepris, km-pris, etc.) |
| `drivenKm` | integer | Kjørte kilometer (0/null for noTrips) |
| `car.model` | string | Bilmodell ("Toyota RAV4") |
| `car.category` | string | Småbil / Minibil / Kombi / Stasjonsvogn / SUV / Varebil |
| `car.properties[].groupKey` | string | `FUEL_TYPE` → name = Bensin / Diesel / Elektrisitet |
| `canceled` | datetime\|null | null = ikke avbestilt |
| `noTrips` | boolean | Booket men ikke kjørt (kan ha kostnad > 0) |
| `notes` | string\|null | Brukerens turnotater |
| `state` | string | PAST / ACTIVE / UPCOMING |
| `location.name` | string | Hentestedets navn |
| `created` | datetime | Opprettelsestidspunkt (for booking lead time) |
