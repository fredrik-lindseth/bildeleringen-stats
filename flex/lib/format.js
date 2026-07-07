// Naiv lokal ISO uten tidssone, matcher dele.no ("2026-07-08T09:00:00").
// Vi jobber i lokal veggklokke (Europe/Oslo der brukeren er).

function pad(n) {
  return String(n).padStart(2, "0");
}

export function toLocalISO(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function parseLocalISO(s) {
  // Godta valgfrie brøkdels-sekunder: API-et kan gi segmentgrenser med
  // mikrosekundpresisjon (f.eks. "2026-07-07T18:44:00.113787" for en tur
  // som starter nå). Vi jobber på minutt-nivå, så brøkdelen ignoreres.
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/.exec(s);
  if (!m) throw new Error(`Ugyldig lokal ISO: ${s}`);
  const [, y, mo, d, h, mi, se] = m;
  return new Date(
    Number(y), Number(mo) - 1, Number(d),
    Number(h), Number(mi), Number(se || 0)
  );
}
