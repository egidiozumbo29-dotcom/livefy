/** Locale fissa: evita mismatch SSR/client con `toLocaleString()` senza argomenti. */
const intFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatInteger(n: number): string {
  return intFormatter.format(n);
}

/** ISO → stringa deterministica (UTC), stessa su server e browser. */
export function formatIsoUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}
