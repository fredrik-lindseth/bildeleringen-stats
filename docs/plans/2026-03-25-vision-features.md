# Vision Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add four vision features: car ownership cost comparison, trip categorization, CO₂ footprint, and shareable annual summary.

**Architecture:** Four new pure-function modules in `lib/` (ownership costs, CO₂, categories, summary), a new dashboard section for each, and a standalone summary page. All features use existing cached reservation data — no new API calls needed.

**Tech Stack:** Vanilla JS, Chart.js, CSS custom properties, WebExtension API

**Key data findings from dele.no API:**
- `car.properties` has `FUEL_TYPE` (Bensin/Elektrisitet/Diesel) — enables CO₂ calculation
- `car.category` (Stasjonsvogn/SUV/Småbil/Minibil/Kombi/Varebil) — enables ownership cost modeling
- `notes` field contains user-written trip purposes ("IKEA og obs Bygg", "Bursdagsbesøk") — enables auto-categorization
- `price.lines` has detailed breakdown (startavgift, timepris, km-pris) — enables cost analysis
- `created` vs `start` timestamps give booking lead time

---

### Task 1: Car Ownership Cost Model

**Files:**
- Create: `lib/ownership-cost.js`

**What it does:** Pure functions that estimate monthly/yearly cost of owning a car comparable to the user's most-used car category. Returns a comparison object: `{ ownershipCost, sharingCost, savings, breakdownOwnership, breakdownSharing }`.

**Step 1: Create `lib/ownership-cost.js`**

```js
// Norwegian car ownership cost estimates (2025 data, NOK/year)
// Sources: NAF, OFV, SSB
const OWNERSHIP_COSTS = {
  // category → { depreciation, insurance, tax, maintenance, parking }
  Småbil:       { depreciation: 25000, insurance: 8000, tax: 3000, maintenance: 6000, parking: 12000 },
  Minibil:      { depreciation: 22000, insurance: 7500, tax: 2800, maintenance: 5500, parking: 12000 },
  Kombi:        { depreciation: 30000, insurance: 9000, tax: 3200, maintenance: 7000, parking: 12000 },
  Stasjonsvogn: { depreciation: 32000, insurance: 9500, tax: 3500, maintenance: 7500, parking: 12000 },
  SUV:          { depreciation: 40000, insurance: 11000, tax: 4000, maintenance: 8500, parking: 12000 },
  Varebil:      { depreciation: 35000, insurance: 10000, tax: 3800, maintenance: 8000, parking: 12000 },
};

// Fuel cost per km by type (NOK)
const FUEL_COST_PER_KM = {
  Bensin: 1.2,
  Diesel: 1.0,
  Elektrisitet: 0.3,
};

export function estimateOwnershipCost(reservations, period = "year") {
  // 1. Determine most-used car category
  // 2. Sum actual sharing costs for period
  // 3. Calculate ownership fixed costs + variable fuel costs for same km
  // 4. Return comparison
}

export function getMostUsedCategory(reservations) {
  // Count trips per car.category, return most common
}

export function getMostUsedFuelType(reservations) {
  // Count trips per FUEL_TYPE property, return most common
}
```

Implementation should:
- Use `filterDriven` from stats.js for actual trips
- Extract fuel type from `car.properties` where `groupKey === "FUEL_TYPE"`
- Calculate ownership cost = fixed costs + (totalKm × fuel cost per km)
- Calculate sharing cost = sum of `price.total` for same period
- Return `{ ownershipCost, sharingCost, savings, savingsPercent, period, category, fuelType, totalKm, breakdownOwnership: { depreciation, insurance, tax, maintenance, parking, fuel }, breakdownSharing: { total } }`

**Step 2: Commit**
```bash
git add lib/ownership-cost.js
git commit -m "feat: car ownership cost comparison model"
```

---

### Task 2: Ownership Comparison Dashboard Section

**Files:**
- Modify: `dashboard/dashboard.html` — add Section 5 "Bilregnestykket" after Trender
- Modify: `dashboard/dashboard.css` — add styles for comparison layout
- Modify: `dashboard/dashboard.js` — import and render ownership comparison

**HTML structure for the section:**
```html
<section class="section" id="bilregnestyket">
  <h2 class="section__title">Bilregnestykket</h2>

  <div class="comparison">
    <div class="comparison__column comparison__column--sharing">
      <h3>Bildeling</h3>
      <span class="comparison__amount" id="sharing-cost">–</span>
      <span class="comparison__period">per år</span>
    </div>
    <div class="comparison__vs">vs</div>
    <div class="comparison__column comparison__column--ownership">
      <h3>Eid bil</h3>
      <span class="comparison__amount" id="ownership-cost">–</span>
      <span class="comparison__period">per år</span>
    </div>
  </div>

  <div class="comparison__verdict" id="comparison-verdict"></div>

  <div class="comparison__breakdown">
    <!-- Stacked bar or itemized list showing cost components -->
    <canvas id="ownership-breakdown-chart"></canvas>
  </div>

  <p class="comparison__note">
    Estimat basert på din mest brukte bilkategori (<span id="comparison-category">–</span>).
    Eierkostnader inkluderer verditap, forsikring, årsavgift, vedlikehold og parkering.
  </p>
</div>
```

**CSS:** Comparison layout with two columns, large numbers, color-coded (green = saving, red = more expensive). Use `--color-tertiary` (green) for savings display.

**JS:** Import `estimateOwnershipCost` from `lib/ownership-cost.js`. Render comparison with a horizontal stacked bar chart showing cost breakdown side by side.

**Step 3: Add nav link**
Add "Bilregnestyket" to nav in dashboard.html.

**Step 4: Commit**
```bash
git add dashboard/
git commit -m "feat: car ownership comparison section in dashboard"
```

---

### Task 3: Trip Categorization Module

**Files:**
- Create: `lib/categories.js`

**What it does:** Categorize trips by purpose. Uses the `notes` field (user-written descriptions) for auto-suggestion. Categories stored in `browser.storage.local` as a map `{ reservationId: categoryKey }`.

**Categories:**
```js
export const CATEGORIES = {
  handletur: { label: "Handletur", icon: "🛒" },
  helgetur:  { label: "Helgetur", icon: "🏡" },
  hyttetur:  { label: "Hyttetur", icon: "⛰️" },
  besok:     { label: "Besøk", icon: "👋" },
  transport: { label: "Frakt/transport", icon: "📦" },
  aktivitet: { label: "Aktivitet", icon: "⚽" },
  jobb:      { label: "Jobb", icon: "💼" },
  flyplass:  { label: "Flyplass", icon: "✈️" },
  annet:     { label: "Annet", icon: "📌" },
};
```

**Auto-suggestion from notes:**
```js
const KEYWORD_MAP = {
  handletur: ["ikea", "obs", "coop", "rema", "kiwi", "biltema", "handel", "handle", "butikk"],
  besok:     ["besøk", "bursdag", "mamma", "pappa", "familie"],
  hyttetur:  ["hytte", "hytta"],
  flyplass:  ["flesland", "flyplass", "fly"],
  aktivitet: ["skøyte", "fotball", "trening", "svømme", "tur"],
  transport: ["hente", "levere", "frakt", "flytt"],
};

export function suggestCategory(reservation) {
  const notes = (reservation.notes || "").toLowerCase();
  if (!notes) return null;
  for (const [cat, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => notes.includes(kw))) return cat;
  }
  return null;
}
```

**Storage functions:**
```js
export async function loadCategories() {
  // Read from browser.storage.local key "tripCategories"
}

export async function saveCategory(reservationId, categoryKey) {
  // Save to browser.storage.local
}

export async function categorizeStats(reservations, categories) {
  // Return { categoryKey: { count, totalCost, totalKm } }
}
```

**Step 1: Commit**
```bash
git add lib/categories.js
git commit -m "feat: trip categorization with auto-suggestion from notes"
```

---

### Task 4: Trip Categories Dashboard Section

**Files:**
- Modify: `dashboard/dashboard.html` — add Section 6 "Turkategorier"
- Modify: `dashboard/dashboard.css` — category tag styles, pie chart
- Modify: `dashboard/dashboard.js` — import categories, render pie chart + category list

**Features:**
- Donut/pie chart showing cost distribution by category
- List of recent uncategorized trips with auto-suggested category (click to confirm)
- Category breakdown table: category → trips, total cost, avg cost, total km
- Ability to manually set category on any trip (small dropdown/pill selector)

**Important:** Categories are stored separately from reservations in `browser.storage.local` under key `"tripCategories"`. This avoids modifying the cached API data.

**Step 2: Commit**
```bash
git add dashboard/
git commit -m "feat: trip categories section with auto-tagging and cost breakdown"
```

---

### Task 5: CO₂ Calculation Module

**Files:**
- Create: `lib/co2.js`

**What it does:** Estimate CO₂ emissions per trip based on fuel type, car category, and driven km.

```js
// grams CO₂ per km by fuel type and category (Norwegian averages)
// Sources: SSB, Miljødirektoratet
const CO2_PER_KM = {
  Bensin: {
    Småbil: 120, Minibil: 110, Kombi: 140,
    Stasjonsvogn: 150, SUV: 180, Varebil: 190,
  },
  Diesel: {
    Småbil: 100, Minibil: 95, Kombi: 120,
    Stasjonsvogn: 130, SUV: 160, Varebil: 170,
  },
  Elektrisitet: {
    Småbil: 0, Minibil: 0, Kombi: 0,
    Stasjonsvogn: 0, SUV: 0, Varebil: 0,
  },
};

// Private car average (Norwegian fleet): ~130 g/km, utilization ~5%
// Shared car utilization ~20-30% → manufacturing amortized over more km
const PRIVATE_CAR_AVG_CO2 = 130; // g/km
const SHARING_UTILIZATION_FACTOR = 0.7; // 30% less lifecycle emissions from shared use

export function tripCO2(reservation) {
  // Extract fuel type from car.properties
  // Look up g/km from table
  // Return { co2Grams, fuelType, category, km }
}

export function totalCO2(reservations) {
  // Sum all trip emissions
  // Return { totalKg, totalKm, avgPerKm, byFuelType, byCategory }
}

export function co2Comparison(reservations) {
  // Compare: actual sharing emissions vs. hypothetical private car emissions
  // Private car: same km × PRIVATE_CAR_AVG_CO2 (+ manufacturing overhead for low utilization)
  // Return { sharingCO2Kg, privateCO2Kg, savedKg, savedPercent }
}

export function getFuelType(car) {
  // Extract from car.properties where groupKey === "FUEL_TYPE"
  const prop = (car.properties || []).find(p => p.groupKey === "FUEL_TYPE");
  return prop ? prop.name : "Bensin"; // default
}
```

**Step 1: Commit**
```bash
git add lib/co2.js
git commit -m "feat: CO₂ calculation based on fuel type and car category"
```

---

### Task 6: CO₂ Dashboard Section

**Files:**
- Modify: `dashboard/dashboard.html` — add Section 7 "Klimaregnskap"
- Modify: `dashboard/dashboard.css` — CO₂ comparison styles
- Modify: `dashboard/dashboard.js` — render CO₂ data

**Features:**
- Big number: total CO₂ saved this year vs. private car
- Comparison visualization (sharing vs. ownership, like bilregnestykket)
- CO₂ per trip by fuel type (bar chart: bensin vs. diesel vs. el)
- Monthly CO₂ trend
- Stat cards: total emissions, avg per km, % electric trips

**CSS:** Use `--color-tertiary` (green) for savings/positive environmental numbers.

**Step 2: Commit**
```bash
git add dashboard/
git commit -m "feat: climate footprint section in dashboard"
```

---

### Task 7: Annual Summary Page

**Files:**
- Create: `summary/summary.html`
- Create: `summary/summary.css`
- Create: `summary/summary.js`

**What it does:** A standalone full-page "year in review" — visual, personal, and shareable. Opens from dashboard via a "Se årsoppsummering" button.

**Layout:** Single scrollable page, one stat per "slide"/section. Large typography, bold colors.

**Content sections (one per scroll viewport):**
1. **Headline:** "Ditt bildeleår 2025" (or selected year)
2. **Total:** kr spent, with monthly sparkline
3. **Distance:** total km, longest trip, favorite car
4. **Time:** total hours behind the wheel, busiest day/month
5. **Fleet:** most used cars (top 3 with category icons)
6. **Money saved:** vs. car ownership estimate (from Task 1)
7. **Climate:** CO₂ saved vs. private car (from Task 5)
8. **Categories:** trip purpose breakdown (from Task 3, if tagged)
9. **Closing:** "Et år uten egen bil." with share button

**Share button:** Generates a screenshot-friendly view (fixed dimensions, clean background) using the canvas API or `html2canvas` approach. Actually, simplest: a "Kopier som bilde" button that uses the native `navigator.clipboard` API or downloads a PNG. For v1, just have clean CSS that looks good in a browser screenshot.

**Year selector:** Dropdown at the top to pick which year to summarize.

**Step 1: Create summary HTML with all sections**
**Step 2: Create summary CSS — bold, editorial design, dark background, large type, scroll-snap**
**Step 3: Create summary JS — pulls data from background, computes all stats, renders**
**Step 4: Add link from dashboard to summary page**
**Step 5: Commit**

```bash
git add summary/ dashboard/dashboard.html dashboard/dashboard.js
git commit -m "feat: annual summary page — year in review with all stats"
```

---

### Task 8: Dashboard Navigation Update

**Files:**
- Modify: `dashboard/dashboard.html` — add nav links for new sections
- Modify: `dashboard/dashboard.js` — wire up new nav items, scroll-spy

Add nav items: Bilregnestykket, Turkategorier, Klima. The annual summary gets a button in the header, not a nav item (it's a separate page).

**Commit:**
```bash
git add dashboard/
git commit -m "feat: add navigation for new dashboard sections"
```

---

### Task 9: Popup Quick Stats Update

**Files:**
- Modify: `popup/popup.html` — add CO₂ and savings summary
- Modify: `popup/popup.css` — styles
- Modify: `popup/popup.js` — import and render

Add two new stat cards to popup:
- "Spart i år" — estimated savings vs. car ownership (from `lib/ownership-cost.js`)
- "CO₂ spart" — estimated CO₂ savings (from `lib/co2.js`)

Use `--color-tertiary` (green) for these positive-impact numbers.

**Commit:**
```bash
git add popup/
git commit -m "feat: add savings and CO₂ stats to popup"
```

---

### Task 10: Polish & Documentation

**Files:**
- Modify: `README.md` — document new features
- Modify: `CLAUDE.md` — document new modules

Update README with:
- New features (bilregnestyket, turkategorier, klimaregnskap, årsoppsummering)
- Screenshots placeholder
- Note about estimated values (ownership costs, CO₂)

Update CLAUDE.md with:
- New modules: `lib/ownership-cost.js`, `lib/categories.js`, `lib/co2.js`
- Summary page architecture
- Category storage strategy

**Commit:**
```bash
git add README.md CLAUDE.md
git commit -m "docs: document new vision features"
```
