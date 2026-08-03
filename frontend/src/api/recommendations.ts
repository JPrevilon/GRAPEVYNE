import { ApiError, apiRequest, unwrapData } from "@/api/client";
import { normalizeRecommendationResponse } from "@/api/normalizers";
import type { ApiSuccessEnvelope, RecommendationData } from "@/types/api";
import type { RecommendationResponse } from "@/types/domain";

export const DEFAULT_RECOMMENDATION_LIMIT = 6;
export const MIN_RECOMMENDATION_LIMIT = 1;
export const MAX_RECOMMENDATION_LIMIT = 12;
export const MIN_RECOMMENDATION_QUERY_LENGTH = 2;
export const MAX_RECOMMENDATION_QUERY_LENGTH = 300;

export interface WineRecommendationRequestOptions {
  limit?: number;
  signal?: AbortSignal;
}

export function normalizeRecommendationQuery(query: string): string {
  if (typeof query !== "string") {
    throw new ApiError("Recommendation query is required.", {
      code: "missing_query",
      status: 400,
    });
  }

  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new ApiError("Recommendation query is required.", {
      code: "missing_query",
      status: 400,
    });
  }

  if (
    normalizedQuery.length < MIN_RECOMMENDATION_QUERY_LENGTH ||
    normalizedQuery.length > MAX_RECOMMENDATION_QUERY_LENGTH ||
    /[<>]|[\u0000-\u001f]/u.test(normalizedQuery)
  ) {
    throw new ApiError(
      "Recommendation query must contain 2 to 300 plain-text characters.",
      {
        code: "validation_error",
        status: 400,
      },
    );
  }

  return normalizedQuery;
}

export function normalizeRecommendationLimit(
  limit: number = DEFAULT_RECOMMENDATION_LIMIT,
): number {
  if (
    !Number.isSafeInteger(limit) ||
    limit < MIN_RECOMMENDATION_LIMIT ||
    limit > MAX_RECOMMENDATION_LIMIT
  ) {
    throw new ApiError("Recommendation limit must be an integer from 1 to 12.", {
      code: "validation_error",
      status: 400,
    });
  }

  return limit;
}

export async function getWineRecommendations(
  query: string,
  options: WineRecommendationRequestOptions = {},
): Promise<RecommendationResponse> {
  const normalizedQuery = normalizeRecommendationQuery(query);
  const limit = normalizeRecommendationLimit(options.limit);
  const params = new URLSearchParams({
    query: normalizedQuery,
    limit: String(limit),
  });
  const envelope = await apiRequest<ApiSuccessEnvelope<RecommendationData>>(
    `/wines/recommendations?${params.toString()}`,
    { signal: options.signal },
  );

  return normalizeRecommendationResponse(
    unwrapData<RecommendationData>(envelope),
  );
}
