import { storage } from "./browser-polyfill.js";

// Eksempelveien (hjem), midtpunkt av gatas LineString fra /api/locations.
export const DEFAULT_PLACES = [
  { id: "home", name: "Eksempelveien (hjem)", point: { lng: 5.32415, lat: 60.39299 } },
];

const PLACES_KEY = "places";
const FAV_KEY = "favoriteCarIds";

// Ren funksjon: lagrede steder overstyrer default på samme id, resten beholdes.
export function mergePlaces(defaults, saved) {
  const byId = new Map(defaults.map((p) => [p.id, p]));
  for (const p of saved) byId.set(p.id, p);
  return [...byId.values()];
}

export async function getPlaces() {
  const { [PLACES_KEY]: saved } = await storage.get(PLACES_KEY);
  return mergePlaces(DEFAULT_PLACES, saved || []);
}

export async function savePlace(place) {
  const { [PLACES_KEY]: saved } = await storage.get(PLACES_KEY);
  const next = mergePlaces(saved || [], [place]);
  await storage.set({ [PLACES_KEY]: next });
  return next;
}

export async function getFavoriteCarIds() {
  const { [FAV_KEY]: ids } = await storage.get(FAV_KEY);
  return ids || [];
}

export async function saveFavoriteCarIds(ids) {
  await storage.set({ [FAV_KEY]: ids });
}
