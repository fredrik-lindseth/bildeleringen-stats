import { toLocalISO } from "./format.js";

const API_BASE = "https://app.dele.no/api";
const REQUEST_DELAY_MS = 50;
const MAX_RETRIES = 3;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, token, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers: { authorization: token, accept: "application/json" } });
    if (res.ok) return res.json();
    if (res.status === 429) {
      await delay(Math.pow(2, attempt) * 1000);
      continue;
    }
    if (res.status === 401) throw new Error("AUTH_EXPIRED");
    throw new Error(`API error: ${res.status}`);
  }
  throw new Error("Max retries exceeded");
}

// point: {lng, lat}. start/end: Date. Returnerer søkesvaret.
export async function searchAvailability(point, start, end, token) {
  const location = encodeURIComponent(
    JSON.stringify({ type: "Point", coordinates: [point.lng, point.lat] })
  );
  const url =
    `${API_BASE}/search?start=${toLocalISO(start)}&end=${toLocalISO(end)}&location=${location}`;
  await delay(REQUEST_DELAY_MS);
  return fetchWithRetry(url, token);
}

export async function fetchLocations(token) {
  return fetchWithRetry(`${API_BASE}/locations`, token);
}
