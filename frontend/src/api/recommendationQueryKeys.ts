import {
  DEFAULT_RECOMMENDATION_LIMIT,
  normalizeRecommendationLimit,
  normalizeRecommendationQuery,
} from "@/api/recommendations";
import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import type { User } from "@/types/domain";

export const PUBLIC_RECOMMENDATION_QUERY_ROOT = "public" as const;
export const RECOMMENDATION_QUERY_RESOURCE = "wine-recommendations" as const;

export function recommendationQueryKey(
  query: string,
  limit: number = DEFAULT_RECOMMENDATION_LIMIT,
  userId: User["id"] | null = null,
) {
  const normalizedQuery = normalizeRecommendationQuery(query);
  const normalizedLimit = normalizeRecommendationLimit(limit);
  const segments = [
    RECOMMENDATION_QUERY_RESOURCE,
    normalizedQuery,
    normalizedLimit,
  ] as const;

  if (userId === null) {
    return [PUBLIC_RECOMMENDATION_QUERY_ROOT, ...segments] as const;
  }

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError(
      "The recommendation cache identity must be a positive integer.",
    );
  }

  return privateQueryKey(userId, ...segments);
}
