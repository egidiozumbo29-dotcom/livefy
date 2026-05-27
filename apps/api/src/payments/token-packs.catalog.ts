/**
 * Tier acquisto token stile marketplace cam (tipo Chaturbate):
 * più compri EUR, più ricevi token grazie ai bonus inclusi nel pacchetto.
 * Stripe usa `cents`; credito sul wallet = `tokens` + `bonusTokens`.
 */
export const TOKEN_PACKS = [
  {
    key: "eur_949_90",
    tokens: 90,
    bonusTokens: 0,
    cents: 949,
    currency: "eur" as const,
    shortLabel: "Start",
  },
  {
    key: "eur_1000_100",
    tokens: 100,
    bonusTokens: 0,
    cents: 1000,
    currency: "eur",
    shortLabel: "100 token · 10,00 €",
  },
  {
    key: "eur_999_115",
    tokens: 115,
    bonusTokens: 0,
    cents: 999,
    currency: "eur",
    shortLabel: undefined,
  },
  {
    key: "eur_1999_250",
    tokens: 210,
    bonusTokens: 40,
    cents: 1999,
    currency: "eur",
    shortLabel: "+40 omaggio",
  },
  {
    key: "eur_4499_600",
    tokens: 520,
    bonusTokens: 80,
    cents: 4499,
    currency: "eur",
    shortLabel: "+80 omaggio",
  },
  {
    key: "eur_7999_1100",
    tokens: 1000,
    bonusTokens: 100,
    cents: 7999,
    currency: "eur",
    shortLabel: "Più acquistato · +100 omaggio",
    badge: "popular" as const,
  },
  {
    key: "eur_10000_1050",
    tokens: 1000,
    bonusTokens: 50,
    cents: 10000,
    currency: "eur",
    shortLabel: "~100 € · +50 omaggio",
  },
  {
    key: "eur_10999_1250",
    tokens: 1100,
    bonusTokens: 150,
    cents: 10999,
    currency: "eur",
    shortLabel: "+150 omaggio",
  },
  {
    key: "eur_16999_2000",
    tokens: 1700,
    bonusTokens: 300,
    cents: 16999,
    currency: "eur",
    shortLabel: "+300 omaggio",
  },
  {
    key: "eur_27999_3500",
    tokens: 3000,
    bonusTokens: 500,
    cents: 27999,
    currency: "eur",
    shortLabel: "Miglior valore · +500 omaggio",
    badge: "best" as const,
  },
  {
    key: "eur_39999_5000",
    tokens: 4500,
    bonusTokens: 500,
    cents: 39999,
    currency: "eur",
    shortLabel: "+500 omaggio",
  },
  {
    key: "eur_44999_8000",
    tokens: 7000,
    bonusTokens: 1000,
    cents: 44999,
    currency: "eur",
    shortLabel: "+1000 omaggio",
  },
] as const satisfies Readonly<
  {
    key: string;
    tokens: number;
    bonusTokens: number;
    cents: number;
    currency: "eur";
    shortLabel?: string;
    badge?: "popular" | "best";
  }[]
>;

export type TokenPackCatalogEntry = (typeof TOKEN_PACKS)[number];
export type PackKey = TokenPackCatalogEntry["key"];

export function packTotalTokens(
  entry: Pick<TokenPackCatalogEntry, "tokens" | "bonusTokens">,
) {
  return entry.tokens + entry.bonusTokens;
}
