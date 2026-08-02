import type {
  CellarEntry,
  CellarListResult,
  CellarStatus,
  TasteProfile,
  TasteProfileCluster,
  TasteProfileWineId,
  User,
  Wine,
  WineDetailResult,
  WineSearchResult,
} from "@/types/domain";

type JsonObject = Record<string, unknown>;

const CELLAR_STATUSES = new Set<CellarStatus>([
  "saved",
  "tasted",
  "wishlist",
  "buy_again",
  "archived",
]);

export class ApiContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "ApiContractError";
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectValue(value: unknown, label: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new ApiContractError(`${label} must be an object.`);
  }

  return value;
}

function firstPresent(input: JsonObject, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      return input[key];
    }
  }

  return undefined;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new ApiContractError(`${label} must be a string.`);
  }

  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requiredString(value, label);
}

function vintageString(value: unknown): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  throw new ApiContractError("wine.vintage must be a string or number.");
}

function finiteNumber(value: unknown, label: string): number {
  const normalized =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(normalized)) {
    throw new ApiContractError(`${label} must be a finite number.`);
  }

  return normalized;
}

function nullableNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return finiteNumber(value, label);
}

function integer(value: unknown, label: string): number {
  const normalized = finiteNumber(value, label);

  if (!Number.isInteger(normalized)) {
    throw new ApiContractError(`${label} must be an integer.`);
  }

  return normalized;
}

function nullableInteger(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return integer(value, label);
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new ApiContractError(`${label} must be a boolean.`);
  }

  return value;
}

function stringList(value: unknown, label: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ApiContractError(`${label} must be an array of strings.`);
  }

  return [...value] as string[];
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new ApiContractError(`${label} must be an array.`);
  }

  return value;
}

function cellarStatus(value: unknown): CellarStatus {
  if (typeof value !== "string" || !CELLAR_STATUSES.has(value as CellarStatus)) {
    throw new ApiContractError("cellarEntry.status is not supported.");
  }

  return value as CellarStatus;
}

function tasteProfileWineId(value: unknown, label: string): TasteProfileWineId {
  if (typeof value === "string") {
    return value;
  }

  return integer(value, label);
}

export function normalizeUser(value: unknown): User {
  const input = objectValue(value, "user");
  const nested = isJsonObject(input.user) ? input.user : input;

  return {
    id: integer(firstPresent(nested, ["id", "user_id"]), "user.id"),
    name: requiredString(
      firstPresent(nested, ["name", "user_name"]),
      "user.name",
    ),
    email: requiredString(nested.email, "user.email"),
    createdAt: nullableString(
      firstPresent(nested, ["createdAt", "created_at"]),
      "user.createdAt",
    ),
    updatedAt: nullableString(
      firstPresent(nested, ["updatedAt", "updated_at"]),
      "user.updatedAt",
    ),
  };
}

export function normalizeWine(value: unknown): Wine {
  const input = objectValue(value, "wine");

  return {
    id: nullableInteger(input.id, "wine.id"),
    externalApiId: nullableString(
      firstPresent(input, ["externalApiId", "external_api_id"]),
      "wine.externalApiId",
    ),
    externalWineId: nullableString(
      firstPresent(input, ["externalWineId", "external_wine_id"]),
      "wine.externalWineId",
    ),
    source: nullableString(input.source, "wine.source"),
    name: requiredString(
      firstPresent(input, ["name", "wine_name"]),
      "wine.name",
    ),
    winery: nullableString(
      firstPresent(input, ["winery", "producer"]),
      "wine.winery",
    ),
    varietal: nullableString(
      firstPresent(input, ["varietal", "grape"]),
      "wine.varietal",
    ),
    region: nullableString(input.region, "wine.region"),
    country: nullableString(input.country, "wine.country"),
    vintage: vintageString(input.vintage),
    description: nullableString(input.description, "wine.description"),
    imageUrl: nullableString(
      firstPresent(input, ["imageUrl", "image_url"]),
      "wine.imageUrl",
    ),
    averageRating: nullableNumber(
      firstPresent(input, ["averageRating", "average_rating"]),
      "wine.averageRating",
    ),
    priceCents: nullableInteger(
      firstPresent(input, ["priceCents", "price_cents"]),
      "wine.priceCents",
    ),
    pairings: stringList(
      firstPresent(input, ["pairings", "food_pairings"]),
      "wine.pairings",
    ),
    tastingNotes: stringList(
      firstPresent(input, ["tastingNotes", "tasting_notes"]),
      "wine.tastingNotes",
    ),
    body: nullableString(input.body, "wine.body"),
    acidity: nullableString(input.acidity, "wine.acidity"),
    sweetness: nullableString(input.sweetness, "wine.sweetness"),
    occasion: nullableString(input.occasion, "wine.occasion"),
    servingTemp: nullableString(
      firstPresent(input, ["servingTemp", "serving_temp"]),
      "wine.servingTemp",
    ),
    createdAt: nullableString(
      firstPresent(input, ["createdAt", "created_at"]),
      "wine.createdAt",
    ),
    updatedAt: nullableString(
      firstPresent(input, ["updatedAt", "updated_at"]),
      "wine.updatedAt",
    ),
  };
}

export function normalizeCellarEntry(value: unknown): CellarEntry {
  const input = objectValue(value, "cellarEntry");

  return {
    id: integer(
      firstPresent(input, ["id", "entry_id", "cellar_entry_id"]),
      "cellarEntry.id",
    ),
    userId: integer(
      firstPresent(input, ["userId", "user_id"]),
      "cellarEntry.userId",
    ),
    wineId: integer(
      firstPresent(input, ["wineId", "wine_id"]),
      "cellarEntry.wineId",
    ),
    userRating: nullableInteger(
      firstPresent(input, ["userRating", "user_rating"]),
      "cellarEntry.userRating",
    ),
    notes: nullableString(input.notes, "cellarEntry.notes"),
    favorite: requiredBoolean(
      firstPresent(input, ["favorite", "is_favorite"]),
      "cellarEntry.favorite",
    ),
    tags: stringList(input.tags, "cellarEntry.tags"),
    occasion: nullableString(input.occasion, "cellarEntry.occasion"),
    status: cellarStatus(input.status),
    savedAt: requiredString(
      firstPresent(input, ["savedAt", "saved_at"]),
      "cellarEntry.savedAt",
    ),
    createdAt: nullableString(
      firstPresent(input, ["createdAt", "created_at"]),
      "cellarEntry.createdAt",
    ),
    updatedAt: nullableString(
      firstPresent(input, ["updatedAt", "updated_at"]),
      "cellarEntry.updatedAt",
    ),
    wine: normalizeWine(input.wine),
  };
}

export function normalizeWineSearch(value: unknown): WineSearchResult {
  const input = objectValue(value, "wineSearch");

  return {
    query: requiredString(input.query, "wineSearch.query"),
    results: requiredArray(input.results, "wineSearch.results").map(normalizeWine),
    source: requiredString(input.source, "wineSearch.source"),
  };
}

export function normalizeWineDetail(value: unknown): WineDetailResult {
  const input = objectValue(value, "wineDetail");

  return {
    wine: normalizeWine(input.wine),
    source: requiredString(input.source, "wineDetail.source"),
  };
}

export function normalizeCellarList(value: unknown): CellarListResult {
  const input = objectValue(value, "cellarList");

  return {
    entries: requiredArray(input.entries, "cellarList.entries").map(
      normalizeCellarEntry,
    ),
    count: integer(input.count, "cellarList.count"),
  };
}

function normalizeTasteCluster(value: unknown, index: number): TasteProfileCluster {
  const input = objectValue(value, `tasteProfile.clusters[${index}]`);

  return {
    id: requiredString(input.id, `tasteProfile.clusters[${index}].id`),
    label: requiredString(input.label, `tasteProfile.clusters[${index}].label`),
    weight: finiteNumber(input.weight, `tasteProfile.clusters[${index}].weight`),
    wineIds: requiredArray(
      firstPresent(input, ["wineIds", "wine_ids"]),
      `tasteProfile.clusters[${index}].wineIds`,
    ).map((wineId, wineIndex) =>
      tasteProfileWineId(
        wineId,
        `tasteProfile.clusters[${index}].wineIds[${wineIndex}]`,
      ),
    ),
  };
}

export function normalizeTasteProfile(value: unknown): TasteProfile {
  const outer = objectValue(value, "tasteProfile");
  const input = isJsonObject(outer.profile) ? outer.profile : outer;
  const rawPriceRange = requiredArray(
    firstPresent(input, ["typicalPriceRange", "typical_price_range"]),
    "tasteProfile.typicalPriceRange",
  );

  if (rawPriceRange.length !== 2) {
    throw new ApiContractError(
      "tasteProfile.typicalPriceRange must contain exactly two numbers.",
    );
  }

  const minimumPrice = rawPriceRange[0];
  const maximumPrice = rawPriceRange[1];

  return {
    headline: requiredString(input.headline, "tasteProfile.headline"),
    summary: requiredString(input.summary, "tasteProfile.summary"),
    primaryStyles: stringList(
      firstPresent(input, ["primaryStyles", "primary_styles"]),
      "tasteProfile.primaryStyles",
    ),
    preferredRegions: stringList(
      firstPresent(input, ["preferredRegions", "preferred_regions"]),
      "tasteProfile.preferredRegions",
    ),
    commonFlavorNotes: stringList(
      firstPresent(input, ["commonFlavorNotes", "common_flavor_notes"]),
      "tasteProfile.commonFlavorNotes",
    ),
    typicalPriceRange: [
      finiteNumber(minimumPrice, "tasteProfile.typicalPriceRange[0]"),
      finiteNumber(maximumPrice, "tasteProfile.typicalPriceRange[1]"),
    ],
    occasions: stringList(input.occasions, "tasteProfile.occasions"),
    explorationGaps: stringList(
      firstPresent(input, ["explorationGaps", "exploration_gaps"]),
      "tasteProfile.explorationGaps",
    ),
    suggestedBranch: requiredString(
      firstPresent(input, ["suggestedBranch", "suggested_branch"]),
      "tasteProfile.suggestedBranch",
    ),
    clusters: requiredArray(input.clusters, "tasteProfile.clusters").map(
      normalizeTasteCluster,
    ),
  };
}
