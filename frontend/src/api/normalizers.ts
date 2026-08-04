import type {
  CellarEntry,
  CellarListResult,
  CellarStatus,
  RecommendationBudget,
  RecommendationCatalog,
  RecommendationDimension,
  RecommendationDimensionName,
  RecommendationIntent,
  RecommendationMatch,
  RecommendationParserEvidence,
  RecommendationParserWarning,
  RecommendationPersonalization,
  RecommendationPersonalizationStatus,
  RecommendationResponse,
  RecommendationResult,
  TasteProfile,
  TasteProfileCatalog,
  TasteProfileState,
  TasteSignal,
  TasteSignalDimension,
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

const RECOMMENDATION_DIMENSIONS = new Set<RecommendationDimensionName>([
  "pairing",
  "personal_taste",
  "requested_style",
  "budget",
  "occasion",
  "source_confidence",
  "discovery_balance",
]);

const RECOMMENDATION_PERSONALIZATION_STATUSES =
  new Set<RecommendationPersonalizationStatus>([
    "anonymous",
    "insufficient_data",
    "active",
  ]);

const RECOMMENDATION_CONFIDENCE_LEVELS = new Set([
  "high",
  "medium",
  "limited",
] as const);

const RECOMMENDATION_SCORE_BASES = new Set([
  "request_only",
  "personalized",
] as const);

const RECOMMENDATION_NOVELTY_VALUES = new Set([
  "familiar",
  "adventurous",
] as const);

const TASTE_PROFILE_STATES = new Set<TasteProfileState>([
  "empty",
  "limited",
  "active",
]);

const TASTE_SIGNAL_DIMENSIONS = new Set<TasteSignalDimension>([
  "category",
  "varietal",
  "place",
  "flavor",
  "structure",
  "occasion",
]);

const TASTE_ADJACENT_CONFIDENCE = new Set(["medium", "limited"] as const);

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

function nullableBoolean(value: unknown, label: string): boolean | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requiredBoolean(value, label);
}

function nullableDateString(value: unknown, label: string): string | null {
  const normalized = nullableString(value, label);

  if (normalized === null) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);

  if (!match) {
    throw new ApiContractError(`${label} must be an ISO calendar date.`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new ApiContractError(`${label} must be a valid calendar date.`);
  }

  return normalized;
}

function requiredStringList(value: unknown, label: string): string[] {
  return requiredArray(value, label).map((item, index) =>
    requiredString(item, `${label}[${index}]`),
  );
}

function nonNegativeInteger(value: unknown, label: string): number {
  const normalized = integer(value, label);

  if (normalized < 0) {
    throw new ApiContractError(`${label} must be zero or greater.`);
  }

  return normalized;
}

function boundedNumber(
  value: unknown,
  label: string,
  minimum: number,
  maximum: number,
): number {
  const normalized = finiteNumber(value, label);

  if (normalized < minimum || normalized > maximum) {
    throw new ApiContractError(
      `${label} must be between ${minimum} and ${maximum}.`,
    );
  }

  return normalized;
}

function requiredNullableString(value: unknown, label: string): string | null {
  if (value === undefined) {
    throw new ApiContractError(`${label} must be a string or null.`);
  }

  return nullableString(value, label);
}

function requiredNullableInteger(value: unknown, label: string): number | null {
  if (value === undefined) {
    throw new ApiContractError(`${label} must be an integer or null.`);
  }

  return nullableInteger(value, label);
}

function controlledString<T extends string>(
  value: unknown,
  supported: ReadonlySet<T>,
  label: string,
): T {
  if (typeof value !== "string" || !supported.has(value as T)) {
    throw new ApiContractError(`${label} is not supported.`);
  }

  return value as T;
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
    memoryTitle: nullableString(
      firstPresent(input, ["memoryTitle", "memory_title"]),
      "cellarEntry.memoryTitle",
    ),
    tastedOn: nullableDateString(
      firstPresent(input, ["tastedOn", "tasted_on"]),
      "cellarEntry.tastedOn",
    ),
    location: nullableString(input.location, "cellarEntry.location"),
    pairing: nullableString(input.pairing, "cellarEntry.pairing"),
    openedWith: nullableString(
      firstPresent(input, ["openedWith", "opened_with"]),
      "cellarEntry.openedWith",
    ),
    wouldBuyAgain: nullableBoolean(
      firstPresent(input, ["wouldBuyAgain", "would_buy_again"]),
      "cellarEntry.wouldBuyAgain",
    ),
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

function normalizeRecommendationBudget(value: unknown): RecommendationBudget {
  const input = objectValue(value, "recommendation.intent.budget");
  const minimumCents = requiredNullableInteger(
    input.minimumCents,
    "recommendation.intent.budget.minimumCents",
  );
  const maximumCents = requiredNullableInteger(
    input.maximumCents,
    "recommendation.intent.budget.maximumCents",
  );

  if (minimumCents !== null && minimumCents < 0) {
    throw new ApiContractError(
      "recommendation.intent.budget.minimumCents must be zero or greater.",
    );
  }

  if (maximumCents !== null && maximumCents < 0) {
    throw new ApiContractError(
      "recommendation.intent.budget.maximumCents must be zero or greater.",
    );
  }

  if (
    minimumCents !== null &&
    maximumCents !== null &&
    minimumCents > maximumCents
  ) {
    throw new ApiContractError(
      "recommendation.intent.budget minimum cannot exceed its maximum.",
    );
  }

  return { minimumCents, maximumCents };
}

function normalizeRecommendationEvidence(
  value: unknown,
  index: number,
): RecommendationParserEvidence {
  const label = `recommendation.intent.evidence[${index}]`;
  const input = objectValue(value, label);

  return {
    dimension: requiredString(input.dimension, `${label}.dimension`),
    value: requiredString(input.value, `${label}.value`),
    matchedText: requiredString(input.matchedText, `${label}.matchedText`),
  };
}

function normalizeRecommendationWarning(
  value: unknown,
  index: number,
): RecommendationParserWarning {
  const label = `recommendation.intent.warnings[${index}]`;
  const input = objectValue(value, label);

  return {
    code: requiredString(input.code, `${label}.code`),
    message: requiredString(input.message, `${label}.message`),
  };
}

function normalizeRecommendationIntent(value: unknown): RecommendationIntent {
  const input = objectValue(value, "recommendation.intent");
  const novelty =
    input.novelty === null
      ? null
      : controlledString(
          input.novelty,
          RECOMMENDATION_NOVELTY_VALUES,
          "recommendation.intent.novelty",
        );

  if (input.budget === undefined) {
    throw new ApiContractError(
      "recommendation.intent.budget must be an object or null.",
    );
  }

  return {
    categories: requiredStringList(
      input.categories,
      "recommendation.intent.categories",
    ),
    varietals: requiredStringList(
      input.varietals,
      "recommendation.intent.varietals",
    ),
    regions: requiredStringList(input.regions, "recommendation.intent.regions"),
    countries: requiredStringList(
      input.countries,
      "recommendation.intent.countries",
    ),
    bodies: requiredStringList(input.bodies, "recommendation.intent.bodies"),
    acidities: requiredStringList(
      input.acidities,
      "recommendation.intent.acidities",
    ),
    tannins: requiredStringList(input.tannins, "recommendation.intent.tannins"),
    sweetness: requiredStringList(
      input.sweetness,
      "recommendation.intent.sweetness",
    ),
    excludedSweetness: requiredStringList(
      input.excludedSweetness,
      "recommendation.intent.excludedSweetness",
    ),
    pairings: requiredStringList(
      input.pairings,
      "recommendation.intent.pairings",
    ),
    flavors: requiredStringList(input.flavors, "recommendation.intent.flavors"),
    occasions: requiredStringList(
      input.occasions,
      "recommendation.intent.occasions",
    ),
    novelty,
    budget:
      input.budget === null ? null : normalizeRecommendationBudget(input.budget),
    evidence: requiredArray(
      input.evidence,
      "recommendation.intent.evidence",
    ).map(normalizeRecommendationEvidence),
    warnings: requiredArray(
      input.warnings,
      "recommendation.intent.warnings",
    ).map(normalizeRecommendationWarning),
    unparsedTerms: requiredStringList(
      input.unparsedTerms,
      "recommendation.intent.unparsedTerms",
    ),
  };
}

function normalizeRecommendationPersonalization(
  value: unknown,
): RecommendationPersonalization {
  const input = objectValue(value, "recommendation.personalization");

  return {
    status: controlledString(
      input.status,
      RECOMMENDATION_PERSONALIZATION_STATUSES,
      "recommendation.personalization.status",
    ),
    signalCount: nonNegativeInteger(
      input.signalCount,
      "recommendation.personalization.signalCount",
    ),
    disclosure: requiredString(
      input.disclosure,
      "recommendation.personalization.disclosure",
    ),
  };
}

function normalizeRecommendationCatalog(value: unknown): RecommendationCatalog {
  const input = objectValue(value, "recommendation.catalog");

  return {
    provider: requiredString(input.provider, "recommendation.catalog.provider"),
    candidateCount: nonNegativeInteger(
      input.candidateCount,
      "recommendation.catalog.candidateCount",
    ),
    isDemonstrationCatalog: requiredBoolean(
      input.isDemonstrationCatalog,
      "recommendation.catalog.isDemonstrationCatalog",
    ),
    limitations: requiredString(
      input.limitations,
      "recommendation.catalog.limitations",
    ),
  };
}

function normalizeRecommendationDimension(
  value: unknown,
  index: number,
): RecommendationDimension {
  const label = `recommendation.results.match.breakdown[${index}]`;
  const input = objectValue(value, label);
  const weight = boundedNumber(input.weight, `${label}.weight`, 0, 100);
  const availablePoints = boundedNumber(
    input.availablePoints,
    `${label}.availablePoints`,
    0,
    weight,
  );
  const earnedPoints = boundedNumber(
    input.earnedPoints,
    `${label}.earnedPoints`,
    0,
    availablePoints,
  );

  return {
    dimension: controlledString(
      input.dimension,
      RECOMMENDATION_DIMENSIONS,
      `${label}.dimension`,
    ),
    weight,
    earnedPoints,
    availablePoints,
    normalizedContribution: boundedNumber(
      input.normalizedContribution,
      `${label}.normalizedContribution`,
      0,
      100,
    ),
    evidence: requiredStringList(input.evidence, `${label}.evidence`),
    unavailableReason: requiredNullableString(
      input.unavailableReason,
      `${label}.unavailableReason`,
    ),
  };
}

function normalizeRecommendationMatch(value: unknown): RecommendationMatch {
  const input = objectValue(value, "recommendation.results.match");

  return {
    score: boundedNumber(input.score, "recommendation.results.match.score", 0, 100),
    confidence: controlledString(
      input.confidence,
      RECOMMENDATION_CONFIDENCE_LEVELS,
      "recommendation.results.match.confidence",
    ),
    scoreBasis: controlledString(
      input.scoreBasis,
      RECOMMENDATION_SCORE_BASES,
      "recommendation.results.match.scoreBasis",
    ),
    reasons: requiredStringList(
      input.reasons,
      "recommendation.results.match.reasons",
    ),
    cautions: requiredStringList(
      input.cautions,
      "recommendation.results.match.cautions",
    ),
    matchedTags: requiredStringList(
      input.matchedTags,
      "recommendation.results.match.matchedTags",
    ),
    missingDataDisclosures: requiredStringList(
      input.missingDataDisclosures,
      "recommendation.results.match.missingDataDisclosures",
    ),
    breakdown: requiredArray(
      input.breakdown,
      "recommendation.results.match.breakdown",
    ).map(normalizeRecommendationDimension),
  };
}

function normalizeRecommendationResult(value: unknown): RecommendationResult {
  const input = objectValue(value, "recommendation.results");
  const wine = normalizeWine(input.wine);

  if (!wine.externalWineId) {
    throw new ApiContractError(
      "recommendation.results.wine.externalWineId must be a string.",
    );
  }

  return {
    wine,
    match: normalizeRecommendationMatch(input.match),
  };
}

export function normalizeRecommendationResponse(
  value: unknown,
): RecommendationResponse {
  const input = objectValue(value, "recommendation");

  return {
    query: requiredString(input.query, "recommendation.query"),
    intent: normalizeRecommendationIntent(input.intent),
    personalization: normalizeRecommendationPersonalization(
      input.personalization,
    ),
    catalog: normalizeRecommendationCatalog(input.catalog),
    results: requiredArray(input.results, "recommendation.results").map(
      normalizeRecommendationResult,
    ),
  };
}

function normalizeTasteSignal(value: unknown, index: number, collection: string): TasteSignal {
  const label = `tasteProfile.${collection}[${index}]`;
  const input = objectValue(value, label);

  return {
    id: requiredString(input.id, `${label}.id`),
    dimension: controlledString(
      input.dimension,
      TASTE_SIGNAL_DIMENSIONS,
      `${label}.dimension`,
    ),
    label: requiredString(input.label, `${label}.label`),
    score: boundedNumber(input.score, `${label}.score`, 0, 100),
    evidenceCount: nonNegativeInteger(
      input.evidenceCount,
      `${label}.evidenceCount`,
    ),
    summary: requiredString(input.summary, `${label}.summary`),
  };
}

function normalizeTasteCatalog(value: unknown): TasteProfileCatalog {
  const input = objectValue(value, "tasteProfile.catalog");

  return {
    provider: requiredString(input.provider, "tasteProfile.catalog.provider"),
    candidateCount: nonNegativeInteger(
      input.candidateCount,
      "tasteProfile.catalog.candidateCount",
    ),
    isDemonstrationCatalog: requiredBoolean(
      input.isDemonstrationCatalog,
      "tasteProfile.catalog.isDemonstrationCatalog",
    ),
    limitations: requiredString(
      input.limitations,
      "tasteProfile.catalog.limitations",
    ),
  };
}

export function normalizeTasteProfile(value: unknown): TasteProfile {
  const outer = objectValue(value, "tasteProfile");
  const input = isJsonObject(outer.profile) ? outer.profile : outer;
  const evidence = objectValue(input.evidence, "tasteProfile.evidence");
  const rawPriceRange = input.observedPriceRange;
  const rawSuggestion = input.adjacentSuggestion;

  if (rawPriceRange === undefined) {
    throw new ApiContractError(
      "tasteProfile.observedPriceRange must be an object or null.",
    );
  }

  if (rawSuggestion === undefined) {
    throw new ApiContractError(
      "tasteProfile.adjacentSuggestion must be an object or null.",
    );
  }

  const observedPriceRange =
    rawPriceRange === null
      ? null
      : (() => {
          const price = objectValue(rawPriceRange, "tasteProfile.observedPriceRange");
          const minimumCents = nonNegativeInteger(
            price.minimumCents,
            "tasteProfile.observedPriceRange.minimumCents",
          );
          const maximumCents = nonNegativeInteger(
            price.maximumCents,
            "tasteProfile.observedPriceRange.maximumCents",
          );

          if (minimumCents > maximumCents) {
            throw new ApiContractError(
              "tasteProfile.observedPriceRange minimum cannot exceed its maximum.",
            );
          }

          return {
            minimumCents,
            maximumCents,
            sampleSize: nonNegativeInteger(
              price.sampleSize,
              "tasteProfile.observedPriceRange.sampleSize",
            ),
          };
        })();

  const adjacentSuggestion =
    rawSuggestion === null
      ? null
      : (() => {
          const suggestion = objectValue(
            rawSuggestion,
            "tasteProfile.adjacentSuggestion",
          );
          const wine = normalizeWine(suggestion.wine);

          if (!wine.externalWineId) {
            throw new ApiContractError(
              "tasteProfile.adjacentSuggestion.wine.externalWineId must be a string.",
            );
          }

          return {
            wine: { ...wine, externalWineId: wine.externalWineId },
            reasons: requiredStringList(
              suggestion.reasons,
              "tasteProfile.adjacentSuggestion.reasons",
            ),
            confidence: controlledString(
              suggestion.confidence,
              TASTE_ADJACENT_CONFIDENCE,
              "tasteProfile.adjacentSuggestion.confidence",
            ),
            disclosure: requiredString(
              suggestion.disclosure,
              "tasteProfile.adjacentSuggestion.disclosure",
            ),
          };
        })();

  return {
    state: controlledString(
      input.state,
      TASTE_PROFILE_STATES,
      "tasteProfile.state",
    ),
    algorithmVersion: requiredString(
      input.algorithmVersion,
      "tasteProfile.algorithmVersion",
    ),
    summary: requiredString(input.summary, "tasteProfile.summary"),
    evidence: {
      totalCellarEntries: nonNegativeInteger(
        evidence.totalCellarEntries,
        "tasteProfile.evidence.totalCellarEntries",
      ),
      meaningfulEntries: nonNegativeInteger(
        evidence.meaningfulEntries,
        "tasteProfile.evidence.meaningfulEntries",
      ),
      distinctCanonicalWines: nonNegativeInteger(
        evidence.distinctCanonicalWines,
        "tasteProfile.evidence.distinctCanonicalWines",
      ),
      signalCount: nonNegativeInteger(
        evidence.signalCount,
        "tasteProfile.evidence.signalCount",
      ),
    },
    signals: requiredArray(input.signals, "tasteProfile.signals").map(
      (signal, index) => normalizeTasteSignal(signal, index, "signals"),
    ),
    lowerAffinitySignals: requiredArray(
      input.lowerAffinitySignals,
      "tasteProfile.lowerAffinitySignals",
    ).map((signal, index) =>
      normalizeTasteSignal(signal, index, "lowerAffinitySignals"),
    ),
    observedPriceRange,
    adjacentSuggestion,
    catalog: normalizeTasteCatalog(input.catalog),
    disclosure: requiredString(input.disclosure, "tasteProfile.disclosure"),
  };
}
