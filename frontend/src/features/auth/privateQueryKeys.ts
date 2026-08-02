import type { QueryKey } from "@tanstack/react-query";

import type { User } from "../../types/domain";

export const PRIVATE_QUERY_ROOT = "private" as const;

export function privateQueryKey(
  userId: User["id"],
  ...segments: ReadonlyArray<unknown>
) {
  return [PRIVATE_QUERY_ROOT, userId, ...segments] as const;
}

export function isPrivateQueryKey(queryKey: QueryKey): boolean {
  return queryKey[0] === PRIVATE_QUERY_ROOT;
}

export function isPrivateMutationKey(
  mutationKey: ReadonlyArray<unknown> | undefined,
): boolean {
  return mutationKey?.[0] === PRIVATE_QUERY_ROOT;
}
