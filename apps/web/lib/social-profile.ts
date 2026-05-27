/** Allineati all’enum lato API `SOCIAL_LINK_KEYS`. */
export const PROFILE_SOCIAL_KEYS = [
  "twitter",
  "instagram",
  "tiktok",
  "youtube",
  "onlyfans",
  "linktree",
  "website",
] as const;

export type ProfileSocialKey = (typeof PROFILE_SOCIAL_KEYS)[number];

export function emptySocialLinksForm(): Record<ProfileSocialKey, string> {
  return PROFILE_SOCIAL_KEYS.reduce(
    (acc, k) => {
      acc[k] = "";
      return acc;
    },
    {} as Record<ProfileSocialKey, string>,
  );
}

export function normalizeLangList(csv: string): string[] {
  return csv
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 16);
}
