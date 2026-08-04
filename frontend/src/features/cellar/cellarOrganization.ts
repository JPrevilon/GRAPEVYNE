import type { CellarEntry } from "@/types/domain";

export type CellarGroupId =
  | "all"
  | "recent"
  | "favorites"
  | "highest-rated"
  | "date-night"
  | "dinner-pairings"
  | "celebrations"
  | "wishlist"
  | "buy-again";

export type CellarSortId = "recent" | "rating" | "tasted" | "wine-name";
export type CellarViewMode = "grid" | "list";

export interface CellarGroup {
  id: CellarGroupId;
  label: string;
  entries: CellarEntry[];
}

const DATE_NIGHT_OCCASIONS = new Set([
  "date",
  "date night",
  "date-night",
  "romantic dinner",
]);

const CELEBRATION_OCCASIONS = new Set([
  "anniversary",
  "birthday",
  "celebration",
  "graduation",
  "holiday celebration",
  "wedding",
]);

function normalizedRecordedValue(value: string | null): string {
  return (value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function recentFirst(left: CellarEntry, right: CellarEntry) {
  const dateDifference = Date.parse(right.savedAt) - Date.parse(left.savedAt);
  return dateDifference || right.id - left.id;
}

function ratingFirst(left: CellarEntry, right: CellarEntry) {
  return (
    (right.userRating ?? -1) - (left.userRating ?? -1) ||
    recentFirst(left, right)
  );
}

function tastedFirst(left: CellarEntry, right: CellarEntry) {
  const leftDate = left.tastedOn ? Date.parse(`${left.tastedOn}T00:00:00Z`) : -1;
  const rightDate = right.tastedOn ? Date.parse(`${right.tastedOn}T00:00:00Z`) : -1;
  return rightDate - leftDate || recentFirst(left, right);
}

function wineNameFirst(left: CellarEntry, right: CellarEntry) {
  return (
    left.wine.name.localeCompare(right.wine.name, undefined, {
      sensitivity: "base",
    }) || left.id - right.id
  );
}

export function sortCellarEntries(
  entries: readonly CellarEntry[],
  sortId: CellarSortId,
): CellarEntry[] {
  const sorted = [...entries];

  if (sortId === "rating") return sorted.sort(ratingFirst);
  if (sortId === "tasted") return sorted.sort(tastedFirst);
  if (sortId === "wine-name") return sorted.sort(wineNameFirst);
  return sorted.sort(recentFirst);
}

export function buildCellarGroups(entries: readonly CellarEntry[]): CellarGroup[] {
  const allEntries = sortCellarEntries(entries, "recent");
  const recordedRatings = entries
    .map((entry) => entry.userRating)
    .filter((rating): rating is number => rating !== null);
  const highestRating =
    recordedRatings.length > 0 ? Math.max(...recordedRatings) : null;
  const candidateGroups: CellarGroup[] = [
    { id: "all", label: "All bottles", entries: allEntries },
    { id: "recent", label: "Recently added", entries: allEntries.slice(0, 6) },
    {
      id: "favorites",
      label: "Favorites",
      entries: entries.filter((entry) => entry.favorite),
    },
    {
      id: "highest-rated",
      label: "Highest rated",
      entries:
        highestRating === null
          ? []
          : entries.filter((entry) => entry.userRating === highestRating),
    },
    {
      id: "date-night",
      label: "Date night",
      entries: entries.filter((entry) =>
        DATE_NIGHT_OCCASIONS.has(normalizedRecordedValue(entry.occasion)),
      ),
    },
    {
      id: "dinner-pairings",
      label: "Dinner pairings",
      entries: entries.filter(
        (entry) =>
          Boolean(entry.pairing?.trim()) &&
          normalizedRecordedValue(entry.occasion).split(" ").includes("dinner"),
      ),
    },
    {
      id: "celebrations",
      label: "Celebrations",
      entries: entries.filter((entry) =>
        CELEBRATION_OCCASIONS.has(normalizedRecordedValue(entry.occasion)),
      ),
    },
    {
      id: "wishlist",
      label: "Wishlist",
      entries: entries.filter((entry) => entry.status === "wishlist"),
    },
    {
      id: "buy-again",
      label: "Buy again",
      entries: entries.filter(
        (entry) =>
          entry.wouldBuyAgain === true || entry.status === "buy_again",
      ),
    },
  ];

  return candidateGroups
    .filter((group) => group.entries.length > 0)
    .map((group) => ({
      ...group,
      entries: sortCellarEntries(group.entries, "recent"),
    }));
}
