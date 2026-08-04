import type { Page } from "@playwright/test";

import type { DisposableAccount } from "./accounts";
import {
  envelopeData,
  sameOriginApi,
  type ApiCellarEntry,
  type ApiEnvelope,
  type ApiUser,
  type AuthenticatedUserData,
  type CellarEntryData,
} from "./api";

export const PROFILE_WINE_IDS = [
  "mock-chateau-montelena-cabernet-sauvignon-2019",
  "mock-argyle-reserve-pinot-noir-2021",
  "mock-frogs-leap-estate-sauvignon-blanc-2022",
] as const;

export async function signupThroughPreview(
  page: Page,
  account: DisposableAccount,
): Promise<ApiUser> {
  const response = await sameOriginApi<ApiEnvelope<AuthenticatedUserData>>(
    page,
    "/api/auth/signup",
    { body: account, method: "POST" },
  );

  return envelopeData(response).user;
}

export async function createCellarEntryThroughPreview(
  page: Page,
  userId: number,
  externalWineId: string,
  changes: Record<string, unknown> = {},
): Promise<ApiCellarEntry> {
  const response = await sameOriginApi<ApiEnvelope<CellarEntryData>>(
    page,
    "/api/cellar",
    {
      body: { externalWineId, ...changes },
      expectedUserId: userId,
      method: "POST",
    },
  );

  return envelopeData(response).entry;
}

export async function seedActiveProfile(
  page: Page,
  userId: number,
  privateNote = "E2E PRIVATE NOTE MUST NEVER ENTER THE PROFILE",
): Promise<ApiCellarEntry[]> {
  const changes = [
    {
      favorite: true,
      memoryTitle: "Steak night",
      notes: `${privateNote} cabernet`,
      occasion: "Celebration dinner",
      pairing: "Steak",
      status: "buy_again",
      tags: ["structured", "dinner"],
      userRating: 5,
      wouldBuyAgain: true,
    },
    {
      favorite: true,
      memoryTitle: "Quiet table",
      notes: `${privateNote} pinot`,
      occasion: "Date night",
      pairing: "Salmon",
      status: "tasted",
      tags: ["silky", "red fruit"],
      userRating: 4,
      wouldBuyAgain: true,
    },
    {
      favorite: false,
      memoryTitle: "Garden lunch",
      notes: `${privateNote} sauvignon`,
      occasion: "Lunch",
      pairing: "Goat cheese",
      status: "buy_again",
      tags: ["bright", "mineral"],
      userRating: 5,
      wouldBuyAgain: true,
    },
  ];

  const entries: ApiCellarEntry[] = [];

  for (const [index, externalWineId] of PROFILE_WINE_IDS.entries()) {
    entries.push(
      await createCellarEntryThroughPreview(
        page,
        userId,
        externalWineId,
        changes[index],
      ),
    );
  }

  return entries;
}
