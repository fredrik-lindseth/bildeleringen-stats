import { filterDriven, costStats, usagePatterns, mileageStats, monthlyCosts } from "../lib/stats.js";
import { estimateOwnershipCost } from "../lib/ownership-cost.js";
import { co2Comparison } from "../lib/co2.js";
import { formatNOK } from "../lib/formatters.js";

const browserAPI = typeof browser !== "undefined" ? browser : chrome;
const formatKm = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

const MONTH_NAMES = ["Januar","Februar","Mars","April","Mai","Juni","Juli","August","September","Oktober","November","Desember"];

async function init() {
  const data = await browserAPI.runtime.sendMessage({ type: "GET_DATA" });
  if (!data?.reservations?.length) {
    document.querySelector(".summary").innerHTML = '<section class="slide"><p>Ingen data. Åpne popup og synkroniser først.</p></section>';
    return;
  }

  const reservations = data.reservations;
  const years = [...new Set(filterDriven(reservations).map(r => new Date(r.start).getFullYear()))].sort();

  const select = document.getElementById("year-select");
  for (const y of years) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    select.appendChild(opt);
  }
  // Default to most recent full year, or current year
  const currentYear = new Date().getFullYear();
  select.value = years.includes(currentYear - 1) ? currentYear - 1 : years[years.length - 1];

  select.addEventListener("change", () => renderYear(reservations, Number(select.value)));
  renderYear(reservations, Number(select.value));
}

function renderYear(reservations, year) {
  const yearData = reservations.filter(r => new Date(r.start).getFullYear() === year);
  const driven = filterDriven(yearData);

  document.getElementById("summary-year").textContent = year;

  // Total cost
  const costs = costStats(yearData);
  document.getElementById("total-cost").textContent = costs ? formatNOK.format(costs.total) : "0 kr";
  document.getElementById("trip-count").textContent = costs ? `${costs.count} turer` : "0 turer";

  // Km
  const mileage = mileageStats(yearData);
  document.getElementById("total-km").textContent = mileage ? `${formatKm.format(mileage.total)} km` : "\u2013";
  document.getElementById("longest-trip").textContent = mileage ? `Lengste tur: ${formatKm.format(mileage.max)} km` : "";

  // Favorite car
  const patterns = usagePatterns(yearData);
  const topCar = patterns.topCars[0];
  document.getElementById("fav-car").textContent = topCar ? topCar.name : "\u2013";
  document.getElementById("fav-car-trips").textContent = topCar ? `${topCar.count} turer` : "";

  // Busiest month
  const monthly = monthlyCosts(yearData);
  if (monthly.length > 0) {
    const busiest = monthly.reduce((a, b) => b.total > a.total ? b : a);
    const monthIdx = parseInt(busiest.month.split("-")[1], 10) - 1;
    document.getElementById("busiest-month").textContent = MONTH_NAMES[monthIdx];
    document.getElementById("busiest-month-cost").textContent = formatNOK.format(busiest.total);
  } else {
    document.getElementById("busiest-month").textContent = "\u2013";
    document.getElementById("busiest-month-cost").textContent = "";
  }

  // Savings
  const ownership = estimateOwnershipCost(reservations, year);
  if (ownership && ownership.savings > 0) {
    document.getElementById("savings").textContent = formatNOK.format(ownership.savings);
    document.getElementById("savings-vs").textContent = `sammenlignet med \u00e5 eie ${ownership.category}`;
  } else if (ownership) {
    document.getElementById("savings").textContent = formatNOK.format(Math.abs(ownership.savings));
    document.getElementById("savings-vs").textContent = "mer enn \u00e5 eie bil";
  } else {
    document.getElementById("savings").textContent = "\u2013";
    document.getElementById("savings-vs").textContent = "";
  }

  // CO2
  const co2 = co2Comparison(yearData);
  if (co2 && co2.savedKg > 0) {
    document.getElementById("co2-saved").textContent = `${formatKm.format(Math.round(co2.savedKg))} kg`;
  } else {
    document.getElementById("co2-saved").textContent = "\u2013";
  }
}

init();
