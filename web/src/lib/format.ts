import { TIME_ZONE } from "./config";

// Dates are handled as YYYY-MM-DD strings in Malaysia time.

export function todayKL(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 12-month term: 20 Aug 2026 → 19 Aug 2027
export function termEnd(start: string): string {
  const d = new Date(`${start}T00:00:00Z`);
  const y = d.getUTCFullYear() + 1;
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  // Clamp 29 Feb → 28 Feb in non-leap years
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(y, m, Math.min(day, last)));
  return addDays(next.toISOString().slice(0, 10), -1);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 20 Aug 2026
export function fmtDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const s = typeof date === "string" ? date.slice(0, 10) : todayKL(date);
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

// 20-Aug-2026 (receipt style)
export function fmtDateDash(date: string | null | undefined): string {
  if (!date) return "—";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return `${String(d).padStart(2, "0")}-${MONTHS[m - 1]}-${y}`;
}

export function fmtDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

// sen → "1,000.00"
export function money(sen: number): string {
  return (sen / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export const rm = (sen: number) => `RM ${money(sen)}`;

// For plan prices: "RM 150" when there are no sen, otherwise "RM 150.50"
export const rmShort = (sen: number) =>
  sen % 100 ? rm(sen) : `RM ${(sen / 100).toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;

// "150" / "150.00" / "1,000" → sen
export function parseRinggit(input: string): number | null {
  const n = Number(String(input).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
