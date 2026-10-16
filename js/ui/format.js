import { POSITION_LABELS_HE } from "../data/settings.js";

export function formatMoney(amount) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(Math.round(amount));
  return `${sign}€${abs.toLocaleString("he-IL")}`;
}

/** פורמט כסף מקוצר לכרטיסים צפופים (למשל €45M, €850K). */
export function formatMoneyShort(amount) {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${Math.round(abs)}`;
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
