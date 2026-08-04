import type { CellarStatus } from "@/types/domain";

export const CELLAR_STATUS_LABELS: Record<CellarStatus, string> = {
  saved: "Saved",
  tasted: "Tasted",
  wishlist: "Wishlist",
  buy_again: "Buy again",
  archived: "Archived",
};

export function cellarEntryTriggerId(entryId: number) {
  return `cellar-entry-${entryId}-trigger`;
}

export function formatCellarSavedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}
