export type CellarStatus =
  | "saved"
  | "tasted"
  | "wishlist"
  | "buy_again"
  | "archived";

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Wine {
  id: number | null;
  externalApiId: string | null;
  externalWineId: string | null;
  source: string | null;
  name: string;
  winery: string | null;
  varietal: string | null;
  region: string | null;
  country: string | null;
  vintage: string | null;
  description: string | null;
  imageUrl: string | null;
  averageRating: number | null;
  priceCents: number | null;
  pairings: string[];
  tastingNotes: string[];
  body: string | null;
  acidity: string | null;
  sweetness: string | null;
  occasion: string | null;
  servingTemp: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// Transitional alias for reference components that use the older name.
export type WineProfile = Wine;

export interface CellarEntry {
  id: number;
  userId: number;
  wineId: number;
  userRating: number | null;
  notes: string | null;
  favorite: boolean;
  tags: string[];
  occasion: string | null;
  status: CellarStatus;
  savedAt: string;
  createdAt: string | null;
  updatedAt: string | null;
  wine: Wine;
}

export interface RecommendationBudget {
  minimumCents: number | null;
  maximumCents: number | null;
}

export interface RecommendationParserEvidence {
  dimension: string;
  value: string;
  matchedText: string;
}

export interface RecommendationParserWarning {
  code: string;
  message: string;
}

export interface RecommendationIntent {
  categories: string[];
  varietals: string[];
  regions: string[];
  countries: string[];
  bodies: string[];
  acidities: string[];
  tannins: string[];
  sweetness: string[];
  excludedSweetness: string[];
  pairings: string[];
  flavors: string[];
  occasions: string[];
  novelty: "familiar" | "adventurous" | null;
  budget: RecommendationBudget | null;
  evidence: RecommendationParserEvidence[];
  warnings: RecommendationParserWarning[];
  unparsedTerms: string[];
}

export type RecommendationPersonalizationStatus =
  | "anonymous"
  | "insufficient_data"
  | "active";

export interface RecommendationPersonalization {
  status: RecommendationPersonalizationStatus;
  signalCount: number;
  disclosure: string;
}

export interface RecommendationCatalog {
  provider: string;
  candidateCount: number;
  isDemonstrationCatalog: boolean;
  limitations: string;
}

export type RecommendationDimensionName =
  | "pairing"
  | "personal_taste"
  | "requested_style"
  | "budget"
  | "occasion"
  | "source_confidence"
  | "discovery_balance";

export interface RecommendationDimension {
  dimension: RecommendationDimensionName;
  weight: number;
  earnedPoints: number;
  availablePoints: number;
  normalizedContribution: number;
  evidence: string[];
  unavailableReason: string | null;
}

export interface RecommendationMatch {
  score: number;
  confidence: "high" | "medium" | "limited";
  scoreBasis: "request_only" | "personalized";
  reasons: string[];
  cautions: string[];
  matchedTags: string[];
  missingDataDisclosures: string[];
  breakdown: RecommendationDimension[];
}

export interface RecommendationResult {
  wine: Wine;
  match: RecommendationMatch;
}

export interface RecommendationResponse {
  query: string;
  intent: RecommendationIntent;
  personalization: RecommendationPersonalization;
  catalog: RecommendationCatalog;
  results: RecommendationResult[];
}

export type TasteProfileWineId = number | string;

export interface TasteProfileCluster {
  id: string;
  label: string;
  weight: number;
  wineIds: TasteProfileWineId[];
}

export interface TasteProfile {
  headline: string;
  summary: string;
  primaryStyles: string[];
  preferredRegions: string[];
  commonFlavorNotes: string[];
  typicalPriceRange: [number, number];
  occasions: string[];
  explorationGaps: string[];
  suggestedBranch: string;
  clusters: TasteProfileCluster[];
}

export interface WineSearchResult {
  query: string;
  results: Wine[];
  source: string;
}

export interface WineDetailResult {
  wine: Wine;
  source: string;
}

export interface CellarListResult {
  entries: CellarEntry[];
  count: number;
}
