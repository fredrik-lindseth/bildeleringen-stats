export const formatNOK = new Intl.NumberFormat("nb-NO", {
  style: "currency",
  currency: "NOK",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatSyncTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `Sist synkronisert: ${date.toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
