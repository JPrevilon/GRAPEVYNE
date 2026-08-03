import type { QueryClient } from "@tanstack/react-query";

import { RECOMMENDATION_QUERY_RESOURCE } from "@/api/recommendationQueryKeys";
import { TASTE_PROFILE_QUERY_RESOURCE } from "@/api/tasteProfileQueryKeys";
import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import type { User } from "@/types/domain";

export function invalidatePrivateCellarDerivations(
  queryClient: QueryClient,
  ownerId: User["id"],
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: privateQueryKey(ownerId, "cellar"),
    }),
    queryClient.invalidateQueries({
      queryKey: privateQueryKey(ownerId, TASTE_PROFILE_QUERY_RESOURCE),
    }),
    queryClient.invalidateQueries({
      queryKey: privateQueryKey(ownerId, RECOMMENDATION_QUERY_RESOURCE),
    }),
  ]);
}
