import type { Page } from "@playwright/test";

export interface SameOriginApiResponse<T = unknown> {
  body: T | null;
  ok: boolean;
  status: number;
}

interface SameOriginRequestOptions {
  body?: unknown;
  expectedUserId?: number;
  headers?: Record<string, string>;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
}

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

export interface ApiErrorEnvelope {
  error: {
    code: string;
    details?: unknown;
    message: string;
  };
}

export interface ApiUser {
  email: string;
  id: number;
  name: string;
}

export interface ApiWine {
  externalWineId: string;
  name: string;
}

export interface ApiCellarEntry {
  favorite: boolean;
  id: number;
  memoryTitle: string | null;
  notes: string | null;
  status: string;
  userId: number;
  userRating: number | null;
  wine: ApiWine;
  wouldBuyAgain: boolean | null;
}

export interface AuthenticatedUserData {
  authenticated: true;
  user: ApiUser;
}

export interface CellarEntryData {
  entry: ApiCellarEntry;
}

export interface CellarListData {
  count: number;
  entries: ApiCellarEntry[];
}

/**
 * Calls the backend through the Vite preview origin. Keeping setup traffic in
 * the browser context proves the same cookie/CORS/proxy contract used by the UI
 * and prevents tests from silently depending on a separately reachable API.
 */
export async function sameOriginApi<T = unknown>(
  page: Page,
  path: string,
  options: SameOriginRequestOptions = {},
): Promise<SameOriginApiResponse<T>> {
  if (!path.startsWith("/api/") || path.startsWith("//")) {
    throw new TypeError(`E2E API paths must be preview-relative: ${path}`);
  }

  return page.evaluate(
    async ({ body, expectedUserId, headers, method, path }) => {
      const requestUrl = new URL(path, window.location.origin);

      if (requestUrl.origin !== window.location.origin) {
        throw new TypeError("Cross-origin E2E API traffic is forbidden.");
      }

      const requestHeaders = new Headers(headers);

      if (body !== undefined) {
        requestHeaders.set("Content-Type", "application/json");
      }

      if (expectedUserId !== undefined) {
        requestHeaders.set(
          "X-Grapevyne-Expected-User-Id",
          String(expectedUserId),
        );
      }

      const response = await fetch(requestUrl, {
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "include",
        headers: requestHeaders,
        method: method ?? "GET",
      });
      const responseText = await response.text();
      let responseBody: unknown = null;

      if (responseText) {
        try {
          responseBody = JSON.parse(responseText) as unknown;
        } catch {
          responseBody = responseText;
        }
      }

      return {
        body: responseBody,
        ok: response.ok,
        status: response.status,
      };
    },
    {
      body: options.body,
      expectedUserId: options.expectedUserId,
      headers: options.headers,
      method: options.method,
      path,
    },
  ) as Promise<SameOriginApiResponse<T>>;
}

export function envelopeData<T>(
  response: SameOriginApiResponse<ApiEnvelope<T>>,
): T {
  if (!response.ok || !response.body || !("data" in response.body)) {
    throw new Error(`Expected a successful API envelope, received ${response.status}.`);
  }

  return response.body.data;
}
