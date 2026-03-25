# Bildeleringen Stats — Browser Extension Design

## Summary

A browser extension (Firefox + Chrome) that gives Bildeleringen (dele.no) members a statistical dashboard of their car-sharing usage. Reads auth from dele.no's localStorage, fetches reservation history, caches locally, and presents cost analysis, usage patterns, mileage stats, and trends.

## Architecture

```
bildeleringen/
├── manifest.json          # WebExtension manifest V3
├── background.js          # Service worker — auth, API, caching
├── content.js             # Reads auth token from dele.no localStorage
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── dashboard/
│   ├── dashboard.html
│   ├── dashboard.css
│   └── dashboard.js
├── lib/
│   ├── api.js             # API client (pagination, retry, rate-limiting)
│   ├── stats.js           # Calculations (costs, km, patterns)
│   └── chart-helpers.js   # Chart.js wrappers
├── vendor/
│   └── chart.min.js       # Chart.js bundled
├── icons/
├── LICENSE
└── README.md
```

## Data Flow

1. Content script runs on `app.dele.no/*`, reads auth token and membership ID from `localStorage("persist:data")`
2. Sends token to background script via `browser.runtime.sendMessage`
3. Background script fetches reservation history from `https://app.dele.no/api/reservations/historic`
4. Data cached in `browser.storage.local`
5. Popup and dashboard read from cache, compute stats on-the-fly

## Authentication

- Content script reads `persist:data` from dele.no's localStorage
- Extracts auth token and membership ID (same approach as the original console script)
- No separate login required — user just needs to be logged in on dele.no
- On 401: re-request fresh token from content script, retry once

## Caching Strategy

- First load: full paginated fetch, store in `browser.storage.local`
- Subsequent opens: incremental sync — only fetch reservations newer than last cached
- Auto-sync at most once per hour
- Manual refresh button for full re-sync
- `unlimitedStorage` permission for large history

## Popup (Quick Overview)

- Total spend this month + last month
- Number of trips this month
- Average cost per trip
- Most used car
- Sparkline trend for last 6 months

## Dashboard (Full Statistics)

### Costs
- Month-over-month bar chart
- Total spend per year
- Average/median cost per trip
- Most/least expensive trip
- Cost per km

### Usage Patterns
- Heatmap: weekday × time of day
- Trips per month (line chart)
- Average trip duration
- Most used cars (ranked)
- Booking lead time

### Mileage
- Total distance per month/year
- Average km per trip
- Longest trip
- Km per car

### Trends
- Year-over-year comparison
- Rolling 3-month average
- Seasonal patterns (summer vs winter)

## Error Handling

- **Not logged in:** "Log in to app.dele.no first"
- **Token expired:** Auto re-fetch, retry once
- **No reservations:** Friendly empty state
- **Rate limiting:** 50ms delay between calls, exponential backoff on 429
- **Syncing:** Progress indicator during first fetch
- **Incomplete data:** Cancelled trips filtered from calculations, shown separately

## Cross-Browser

- `browser.*` API with polyfill wrapper falling back to `chrome.*`
- Manifest V3 primary
- Test in both Firefox and Chrome before release

## Tech Stack

- Vanilla JS, HTML, CSS — no build step
- Chart.js for visualizations
- WebExtension API (cross-browser)
- No external dependencies beyond Chart.js
