const API_BASE = "https://app.dele.no/api";
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 50;
const MAX_RETRIES = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, headers, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { headers });

    if (res.ok) return res.json();

    if (res.status === 429) {
      const backoff = Math.pow(2, attempt) * 1000;
      console.warn(`[API] Rate limited, waiting ${backoff}ms`);
      await delay(backoff);
      continue;
    }

    if (res.status === 401) {
      throw new Error("AUTH_EXPIRED");
    }

    throw new Error(`API error: ${res.status}`);
  }
  throw new Error("Max retries exceeded");
}

export async function fetchAllReservations(token, membershipId) {
  const allReservations = [];
  let page = 0;

  while (true) {
    const url = `${API_BASE}/reservations/historic?page=${page}&size=${PAGE_SIZE}&sort=start,desc&membershipId=${membershipId}`;
    const data = await fetchWithRetry(url, { authorization: token });

    if (data.length === 0) break;
    allReservations.push(...data);
    if (data.length < PAGE_SIZE) break;

    page++;
    await delay(REQUEST_DELAY_MS);
  }

  return allReservations;
}

export async function fetchReservationDetail(id, token) {
  const url = `${API_BASE}/reservations/${id}`;
  return fetchWithRetry(url, { authorization: token });
}

export async function fetchAllDetails(reservations, token, onProgress) {
  const details = [];

  for (let i = 0; i < reservations.length; i++) {
    const detail = await fetchReservationDetail(reservations[i].id, token);
    details.push(detail);
    await delay(REQUEST_DELAY_MS);

    if (onProgress) {
      onProgress(i + 1, reservations.length);
    }
  }

  return details;
}
