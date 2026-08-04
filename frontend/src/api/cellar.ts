import { ApiError, apiRequest, unwrapData } from "@/api/client";
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
  location?: string | null;
  memoryTitle?: string | null;
  notes?: string | null;
  occasion?: string | null;
  openedWith?: string | null;
  pairing?: string | null;
  status?: CellarStatus;
  tags?: string[];
  tastedOn?: string | null;
  userRating?: number | null;
  wouldBuyAgain?: boolean | null;
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

const CELLAR_IDENTITY_MISMATCH_CODES = new Set([
  "session_identity_changed",
  "session_identity_mismatch",
]);
const EXPECTED_USER_ID_HEADER = "X-Grapevyne-Expected-User-Id";

export function isCellarIdentityMismatch(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    CELLAR_IDENTITY_MISMATCH_CODES.has(error.code)
  );
}

export function isCellarErrorEntryOwnedBy(
  error: unknown,
  expectedUserId: number,
): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  const details = error.details;

  if (typeof details !== "object" || details === null || !("entry" in details)) {
    return false;
  }

  const entry = details.entry;

  return (
    typeof entry === "object" &&
    entry !== null &&
    "userId" in entry &&
    entry.userId === expectedUserId
  );
}

export function assertCellarEntryOwner(
  entry: CellarEntry,
  expectedUserId: number,
): CellarEntry {
  if (entry.userId !== expectedUserId) {
    throw new ApiError(
      "The cellar response did not match the active signed-in account. Your session is being rechecked.",
      {
        code: "session_identity_mismatch",
        details: { expectedUserId, receivedUserId: entry.userId },
      },
    );
  }

  return entry;
}

function expectedUserHeaders(expectedUserId: number): HeadersInit {
  if (!Number.isSafeInteger(expectedUserId) || expectedUserId <= 0) {
    throw new TypeError("The expected cellar owner ID must be a positive integer.");
  }

  return { [EXPECTED_USER_ID_HEADER]: String(expectedUserId) };
}

export function assertCellarListOwner(
  result: CellarListResult,
  expectedUserId: number,
): CellarListResult {
  const mismatchedEntry = result.entries.find(
    (entry) => entry.userId !== expectedUserId,
  );

  if (mismatchedEntry) {
    assertCellarEntryOwner(mismatchedEntry, expectedUserId);
  }

  return result;
}

function cellarChangesPayload(
  input: CellarEntryChanges,
): CellarEntryChanges {
  const payload: CellarEntryChanges = {};

  if (input.favorite !== undefined) payload.favorite = input.favorite;
  if (input.location !== undefined) payload.location = input.location;
  if (input.memoryTitle !== undefined) payload.memoryTitle = input.memoryTitle;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.occasion !== undefined) payload.occasion = input.occasion;
  if (input.openedWith !== undefined) payload.openedWith = input.openedWith;
  if (input.pairing !== undefined) payload.pairing = input.pairing;
  if (input.status !== undefined) payload.status = input.status;
  if (input.tags !== undefined) payload.tags = [...input.tags];
  if (input.tastedOn !== undefined) payload.tastedOn = input.tastedOn;
  if (input.userRating !== undefined) payload.userRating = input.userRating;
  if (input.wouldBuyAgain !== undefined) {
    payload.wouldBuyAgain = input.wouldBuyAgain;
  }

  return payload;
}

function cellarWinePayload(input: CellarWineInput | Wine): CellarWineInput {
  return {
    averageRating: input.averageRating,
    country: input.country,
    description: input.description,
    externalApiId: input.externalApiId,
    externalWineId: input.externalWineId ?? "",
    imageUrl: input.imageUrl,
    name: input.name,
    priceCents: input.priceCents,
    region: input.region,
    source: input.source,
    varietal: input.varietal,
    vintage: input.vintage,
    winery: input.winery,
  };
}

function saveCellarEntryPayload(input: SaveCellarEntryInput) {
  const payload: Record<string, unknown> = {
    ...cellarChangesPayload(input),
  };

  if ("externalWineId" in input && input.externalWineId !== undefined) {
    payload.externalWineId = input.externalWineId;
  } else if ("wine" in input && input.wine) {
    payload.wine = cellarWinePayload(input.wine);
  }

  return payload;
}

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
  expectedUserId: number,
): Promise<CellarEntry> {
  const envelope = await apiRequest<ApiSuccessEnvelope<CellarEntryData>>(
    "/cellar",
    {
      body: JSON.stringify(saveCellarEntryPayload(input)),
      headers: expectedUserHeaders(expectedUserId),
      method: "POST",
    },
  );

  return normalizeCellarEntry(unwrapData<CellarEntryData>(envelope).entry);
}

export async function updateCellarEntry(
  entryId: number,
  changes: CellarEntryChanges,
  expectedUserId: number,
): Promise<CellarEntry> {
  const envelope = await apiRequest<ApiSuccessEnvelope<CellarEntryData>>(
    `/cellar/${entryId}`,
    {
      body: JSON.stringify(cellarChangesPayload(changes)),
      headers: expectedUserHeaders(expectedUserId),
      method: "PATCH",
    },
  );

  return normalizeCellarEntry(unwrapData<CellarEntryData>(envelope).entry);
}

export async function deleteCellarEntry(
  entryId: number,
  expectedUserId: number,
): Promise<number> {
  const envelope = await apiRequest<
    ApiSuccessEnvelope<DeletedCellarEntryData>
  >(`/cellar/${entryId}`, {
    headers: expectedUserHeaders(expectedUserId),
    method: "DELETE",
  });
  const data = unwrapData<DeletedCellarEntryData>(envelope);

  if (!Number.isInteger(data.deletedId)) {
    throw new TypeError("The cellar delete response did not include a numeric ID.");
  }

  return data.deletedId as number;
}
