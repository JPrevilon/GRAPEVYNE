import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import type { User } from "@/types/domain";

export const TASTE_PROFILE_QUERY_RESOURCE = "taste-profile" as const;

export function tasteProfileQueryKey(userId: User["id"]) {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new TypeError("The Taste Profile cache identity must be a positive integer.");
  }

  return privateQueryKey(userId, TASTE_PROFILE_QUERY_RESOURCE);
}
