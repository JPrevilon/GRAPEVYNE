export type BottleTone = "gold" | "red" | "rose" | "white";

export function getBottleTone(varietal?: string | null): BottleTone {
  const value = varietal?.toLocaleLowerCase() ?? "";

  if (value.includes("champagne") || value.includes("sparkling")) {
    return "gold";
  }

  if (
    value.includes("sauvignon blanc") ||
    value.includes("chardonnay") ||
    value.includes("riesling") ||
    value.includes("semillon")
  ) {
    return "white";
  }

  if (value.includes("rosé") || value.includes("rose")) {
    return "rose";
  }

  return "red";
}
