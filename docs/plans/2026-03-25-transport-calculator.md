# Utvidet Transportkalkulator — Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** En ny dashboard-seksjon "Min transport" der brukeren legger inn annen transport (taxi, leiebil, buss, sykkel) og ser totale transport-kostnader og CO₂ samlet — bildeling + alt annet.

**Architecture:** Manuell input-form som lagres i `browser.storage.local` under nøkkel `transportData`. Beregningsmodul i `lib/transport.js`. Ny dashboard-seksjon med sammendrag.

**Datakilde:** Bildeledata hentes automatisk fra API. Alt annet legges inn manuelt av brukeren.

---

## Referansetall

Fra TØI-rapport 1895/2022 (Bildeling i Bergen) og norske kilder:

### CO₂-utslipp per transportmiddel (g/km, passasjer)

| Transportmiddel | g CO₂/km | Kilde |
|---|---|---|
| Bildeling (beregnes per tur) | varierer | Faktisk biltype |
| Taxi (Bergen, miks) | ~120 | Miljødirektoratet (økende andel elbil-taxi) |
| Leiebil (snitt) | ~130 | Norsk bilflåte-snitt |
| Buss (Bergen/Skyss) | ~50 | TØI/Skyss (passasjer-km, gjennomsnittsbelegg) |
| Sykkel/gange | 0 | — |
| Fly (innenriks) | ~150 | Avinor/Miljødirektoratet (per passasjer-km) |

### Typiske kostnader (Bergen 2025)

| Transportmiddel | Kostnad |
|---|---|
| Taxi startpris Bergen | ~80 kr |
| Taxi per km Bergen | ~15 kr/km |
| Taxi Flesland ↔ sentrum (~20 km) | ~400-500 kr |
| Leiebil per dag (snitt) | ~600-900 kr/dag |
| Buss enkeltbillett Skyss | ~42 kr |
| Buss månedskort Skyss (sone A) | ~870 kr |
| Bybane enkeltbillett | ~42 kr (samme som buss) |

---

## Tasks

### Task 1: Transport Data Module

**Files:**
- Create: `lib/transport.js`

Eksporterer:
- `TRANSPORT_MODES` — definisjon av transporttyper med standardverdier
- `loadTransportData(storage)` — leser lagrede data
- `saveTransportData(storage, data)` — lagrer data
- `transportSummary(transportData, reservationStats)` — beregner totaler

```js
export const TRANSPORT_MODES = {
  taxi: {
    label: "Taxi",
    co2PerKm: 120,
    fields: [
      { key: "trips", label: "Antall turer", type: "number" },
      { key: "totalKm", label: "Totalt km", type: "number" },
      { key: "totalCost", label: "Totalt betalt (kr)", type: "number" },
    ],
  },
  leiebil: {
    label: "Leiebil",
    co2PerKm: 130,
    fields: [
      { key: "days", label: "Antall leiedager", type: "number" },
      { key: "totalKm", label: "Totalt km", type: "number" },
      { key: "totalCost", label: "Totalt betalt (kr)", type: "number" },
    ],
  },
  buss: {
    label: "Buss/bybane",
    co2PerKm: 50,
    fields: [
      { key: "trips", label: "Antall turer", type: "number" },
      { key: "totalKm", label: "Estimert km (valgfritt)", type: "number", optional: true },
      { key: "totalCost", label: "Totalt betalt (kr)", type: "number" },
    ],
  },
  fly: {
    label: "Fly (innenriks)",
    co2PerKm: 150,
    fields: [
      { key: "trips", label: "Antall flyvninger", type: "number" },
      { key: "totalKm", label: "Estimert km", type: "number" },
      { key: "totalCost", label: "Totalt betalt (kr)", type: "number" },
    ],
  },
  sykkel: {
    label: "Sykkel/gange",
    co2PerKm: 0,
    fields: [
      { key: "totalKm", label: "Estimert km (valgfritt)", type: "number", optional: true },
    ],
  },
};
```

`transportSummary()` returnerer:
```js
{
  modes: {
    bildeling: { cost, co2Kg, km, trips },
    taxi: { cost, co2Kg, km, trips },
    leiebil: { cost, co2Kg, km, trips },
    buss: { cost, co2Kg, km, trips },
    fly: { cost, co2Kg, km, trips },
    sykkel: { cost: 0, co2Kg: 0, km, trips: 0 },
  },
  totals: { cost, co2Kg, km },
  bildelingAndel: { costPct, co2Pct, kmPct },
}
```

### Task 2: Transport Dashboard Section

**Files:**
- Modify: `dashboard/dashboard.html` — ny seksjon "Min transport"
- Modify: `dashboard/dashboard.css` — input-form styling
- Modify: `dashboard/dashboard.js` — form handling, rendering, storage

**UI-design:**

Seksjonen har to deler:

**Del 1: Input-form**
Kompakt form med en rad per transporttype. Hver rad har transportnavn + input-felt.
"Lagre"-knapp som skriver til browser.storage.local.
Tallene er for en valgt periode (velg år, eller "totalt").

```
┌──────────────────────────────────────────────────┐
│ MIN TRANSPORT (2025)                             │
│                                                  │
│ Taxi:    [__] turer  [__] km  [__] kr           │
│ Leiebil: [__] dager  [__] km  [__] kr           │
│ Buss:    [__] turer  [__] km  [__] kr           │
│ Fly:     [__] turer  [__] km  [__] kr           │
│ Sykkel:  [__] km                                │
│                                                  │
│              [Lagre]                             │
└──────────────────────────────────────────────────┘
```

**Del 2: Sammendrag**

Etter lagring vises:

- **Donut-chart:** Transportkostnader fordelt per type (bildeling, taxi, buss, leiebil, fly)
- **Stat-kort:** Total transportkostnad, total CO₂, bildeling-andel (%)
- **Tabell:** Transporttype → kostnad, CO₂, km
- **Note:** CO₂-kilder (TØI, Miljødirektoratet)

### Task 3: Nav og integrering

- Legg til "Min transport" i dashboard-nav
- Koble bildeledata fra eksisterende stats inn i transportSummary

### Task 4: Metodikk-note

Vis "Slik beregner vi" med:
- CO₂-faktorer per transporttype med kilde
- Note om at buss-CO₂ er passasjer-km basert på gjennomsnittsbelegg
- Referanse til TØI 1895/2022

---

## Viktige designvalg

1. **Manuell input** — vi har ikke API for taxi/buss/leiebil, så brukeren legger inn selv
2. **Per år** — data legges inn per år, med årsvelger
3. **Lagres separat** — under `transportData` i browser.storage.local, ikke blandet med bildele-data
4. **Enkel form** — ingen avansert UX, bare input-felt med tall
5. **Bildeling-tall hentes automatisk** — fra eksisterende cache, beregnes med costStats/totalCO2
