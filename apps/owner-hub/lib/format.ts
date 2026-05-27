export function formatInteger(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(n);
}

export function formatEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "€ 0,00";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export function startOfDayUtc(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function daysAgoUtc(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
