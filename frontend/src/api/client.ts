import type { ApiSuccessEnvelope, HealthData } from "@/types/api";

type JsonObject = Record<string, unknown>;

interface ApiErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  payload?: unknown;
  cause?: unknown;
}

const browserApiHost =
  typeof window !== "undefined" ? window.location.hostname : "localhost";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || `http://${browserApiHost}:5000/api`
).replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly payload?: unknown;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "request_failed";
    this.details = options.details;
    this.payload = options.payload;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return text;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toApiError(response: Response, payload: unknown): ApiError {
  const envelope = isJsonObject(payload) ? payload : null;
  const nestedError =
    envelope && isJsonObject(envelope.error) ? envelope.error : null;
  const message =
    nestedError && typeof nestedError.message === "string"
      ? nestedError.message
      : response.statusText || "Request failed";
  const code =
    nestedError && typeof nestedError.code === "string"
      ? nestedError.code
      : "request_failed";

  return new ApiError(message, {
    code,
    details: nestedError?.details,
    payload,
    status: response.status,
  });
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers,
    });
  } catch (cause) {
    if (
      cause instanceof DOMException &&
      cause.name === "AbortError"
    ) {
      throw cause;
    }

    throw new ApiError(
      "Could not reach the GrapeVyne API. Make sure the Flask server is running.",
      {
        cause,
        code: "network_error",
      },
    );
  }

  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw toApiError(response, payload);
  }

  return payload as T;
}

export function unwrapData<T>(payload: unknown): T {
  if (!isJsonObject(payload) || !("data" in payload)) {
    throw new ApiError("The API returned an invalid success envelope.", {
      code: "invalid_response",
      payload,
    });
  }

  return payload.data as T;
}

export function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError && error.code === "network_error";
}

export function getHealth(signal?: AbortSignal) {
  return apiRequest<ApiSuccessEnvelope<HealthData>>("/health", { signal });
}
