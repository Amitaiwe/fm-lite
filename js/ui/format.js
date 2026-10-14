import { POSITION_LABELS_HE } from "../data/settings.js";

export function formatMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  return `${sign}€${abs.toLocaleString("he-IL")}`;
}

export function positionLabel(position) {
  return POSITION_LABELS_HE[position] || position;
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
