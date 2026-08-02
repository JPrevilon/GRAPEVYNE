import { apiRequest, unwrapData } from "@/api/client";
import {
  normalizeCellarEntry,
  normalizeCellarList,
} from "@/api/normalizers";
import type {
  ApiSuccessEnvelope,
  CellarEntryData,
  CellarListData,
  DeletedCellarEntryData,
} from "@/types/api";
import type {
  CellarEntry,
  CellarListResult,
  CellarStatus,
  Wine,
} from "@/types/domain";

export interface CellarEntryChanges {
  favorite?: boolean;
  notes?: string | null;
  occasion?: string | null;
  status?: CellarStatus;
  userRating?: number | null;
}

export interface CellarWineInput {
  averageRating?: number | null;
  country?: string | null;
  description?: string | null;
  externalApiId?: string | null;
  externalWineId: string;
  imageUrl?: string | null;
  name: string;
  priceCents?: number | null;
  region?: string | null;
  source?: string | null;
  varietal?: string | null;
  vintage?: string | null;
  winery?: string | null;
}

export type SaveCellarEntryInput = CellarEntryChanges &
  (
    | { externalWineId: string; wine?: never }
    | { externalWineId?: never; wine: CellarWineInput | Wine }
  );

export async function getCellarEntries(
  signal?: AbortSignal,
): Promise<CellarListResult> {
  const envelope = await apiRequest<ApiSuccessEnvelope<CellarListData>>(
    "/cellar",
    { signal },
  );

  return normalizeCellarList(unwrapData<CellarListData>(envelope));
}

export async function getCellarEntry(
  entryId: number,
  signal?: AbortSignal,
): Promise<CellarEntry> {
  const envelope = await apiRequest<ApiSuccessEnvelope<CellarEntryData>>(
    `/cellar/${entryId}`,
    { signal },
  );

  return normalizeCellarEntry(unwrapData<CellarEntryData>(envelope).entry);
}

export async function saveWineToCellar(
  input: SaveCellarEntryInput,
): Promise<CellarEntry> {
  const envelope = await apiRequest<ApiSuccessEnvelope<CellarEntryData>>(
    "/cellar",
    {
      body: JSON.stringify(input),
      method: "POST",
    },
  );

  return normalizeCellarEntry(unwrapData<CellarEntryData>(envelope).entry);
}

export async function updateCellarEntry(
  entryId: number,
  changes: CellarEntryChanges,
): Promise<CellarEntry> {
  const envelope = await apiRequest<ApiSuccessEnvelope<CellarEntryData>>(
    `/cellar/${entryId}`,
    {
      body: JSON.stringify(changes),
      method: "PATCH",
    },
  );

  return normalizeCellarEntry(unwrapData<CellarEntryData>(envelope).entry);
}

export async function deleteCellarEntry(entryId: number): Promise<number> {
  const envelope = await apiRequest<
    ApiSuccessEnvelope<DeletedCellarEntryData>
  >(`/cellar/${entryId}`, { method: "DELETE" });
  const data = unwrapData<DeletedCellarEntryData>(envelope);

  if (!Number.isInteger(data.deletedId)) {
    throw new TypeError("The cellar delete response did not include a numeric ID.");
  }

  return data.deletedId as number;
}
