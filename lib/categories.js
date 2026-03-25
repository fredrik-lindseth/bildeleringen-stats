import { filterDriven } from "./stats.js";

export const CATEGORIES = {
  handletur:  { label: "Handletur" },
  helgetur:   { label: "Helgetur" },
  hyttetur:   { label: "Hyttetur" },
  besok:      { label: "Besøk" },
  transport:  { label: "Frakt/transport" },
  aktivitet:  { label: "Aktivitet" },
  jobb:       { label: "Jobb" },
  flyplass:   { label: "Flyplass" },
  annet:      { label: "Annet" },
};

const KEYWORD_MAP = {
  handletur: ["ikea", "obs", "coop", "rema", "kiwi", "biltema", "handel", "handle", "butikk", "bygg", "jula", "europris"],
  besok:     ["besøk", "bursdag", "mamma", "pappa", "familie", "besteforeldre", "onkel", "tante"],
  hyttetur:  ["hytte", "hytta", "fjell"],
  flyplass:  ["flesland", "flyplass", "fly", "airport"],
  aktivitet: ["skøyte", "fotball", "trening", "svømme", "tur ", "ski", "klatring", "oasen"],
  transport: ["hente", "levere", "frakt", "flytt", "dump", "avfall", "gjenbruk"],
  jobb:      ["jobb", "arbeid", "kontor", "møte"],
};

/**
 * Auto-suggest a category based on the reservation's notes field.
 * Returns a category key or null if no match is found.
 */
export function suggestCategory(reservation) {
  const notes = reservation?.notes;
  if (!notes || typeof notes !== "string") return null;

  const lower = notes.toLowerCase();

  for (const [category, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}

/**
 * Load saved trip categories from storage.
 * Returns an object { reservationId: categoryKey }.
 */
export async function loadCategories(storage) {
  const result = await storage.get("tripCategories");
  return result.tripCategories || {};
}

/**
 * Save a single trip category to storage.
 */
export async function saveCategory(storage, reservationId, categoryKey) {
  const existing = await loadCategories(storage);
  existing[reservationId] = categoryKey;
  await storage.set({ tripCategories: existing });
}

/**
 * Compute per-category statistics from reservations and a category map.
 * Pure function — no side effects.
 */
export function categoryStats(reservations, categoryMap) {
  const driven = filterDriven(reservations);
  const stats = {};

  for (const r of driven) {
    const key = categoryMap[r.id] || "uncategorized";
    if (!stats[key]) {
      const cat = CATEGORIES[key];
      stats[key] = {
        label: cat ? cat.label : "Ukategorisert",
        count: 0,
        totalCost: 0,
        totalKm: 0,
        avgCost: 0,
      };
    }

    stats[key].count++;
    stats[key].totalCost += r.price?.total ?? 0;
    stats[key].totalKm += r.drivenKm ?? 0;
  }

  // Compute averages
  for (const entry of Object.values(stats)) {
    entry.avgCost = entry.count > 0 ? Math.round(entry.totalCost / entry.count) : 0;
  }

  return stats;
}

/**
 * Batch auto-suggest categories for all uncategorized reservations.
 * Returns a map { id: suggestedCategoryKey } only for reservations
 * where a suggestion was found.
 */
export function autoSuggestAll(reservations, existingCategories) {
  const suggestions = {};

  for (const r of reservations) {
    if (existingCategories[r.id]) continue;

    const suggestion = suggestCategory(r);
    if (suggestion) {
      suggestions[r.id] = suggestion;
    }
  }

  return suggestions;
}
