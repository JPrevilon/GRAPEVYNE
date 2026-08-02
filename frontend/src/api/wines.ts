import { ApiError, apiRequest, unwrapData } from "@/api/client";
import { normalizeWineDetail, normalizeWineSearch } from "@/api/normalizers";
import type {
  ApiSuccessEnvelope,
  WineDetailData,
  WineSearchData,
} from "@/types/api";
import type { WineDetailResult, WineSearchResult } from "@/types/domain";

export async function searchWines(
  query: string,
  signal?: AbortSignal,
): Promise<WineSearchResult> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new ApiError("Search query is required.", {
      code: "missing_query",
      status: 400,
    });
  }

  const params = new URLSearchParams({ query: normalizedQuery });
  const envelope = await apiRequest<ApiSuccessEnvelope<WineSearchData>>(
    `/wines/search?${params.toString()}`,
    { signal },
  );

  return normalizeWineSearch(unwrapData<WineSearchData>(envelope));
}

export async function getWineDetail(
  externalWineId: string,
  signal?: AbortSignal,
): Promise<WineDetailResult> {
  const envelope = await apiRequest<ApiSuccessEnvelope<WineDetailData>>(
    `/wines/${encodeURIComponent(externalWineId)}`,
    { signal },
  );

  return normalizeWineDetail(unwrapData<WineDetailData>(envelope));
}
