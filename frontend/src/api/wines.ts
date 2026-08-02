import { apiRequest, unwrapData } from "@/api/client";
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
  const params = new URLSearchParams({ query });
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
