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

export interface RecommendationResult {
  wine: Wine;
  matchScore: number;
  confidence: "high" | "medium" | "limited";
  reasons: string[];
  cautions: string[];
  matchedTags: string[];
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
