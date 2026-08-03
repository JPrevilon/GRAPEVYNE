import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  API_BASE_URL,
  API_REQUEST_TIMEOUT_MS,
  ApiError,
  apiRequest,
  isAbortError,
  isNetworkFailure,
} from "@/api/client";
import type { ApiSuccessEnvelope } from "@/types/api";

const fetchMock = vi.fn<typeof fetch>();

describe("apiRequest", () => {
  beforeEach(() => {
    vi.useRealTimers();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns the exact success envelope and includes the Flask session", async () => {
    const envelope: ApiSuccessEnvelope<{ status: string }> = {
      data: { status: "ok" },
      message: "Healthy.",
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(envelope), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    await expect(
      apiRequest<ApiSuccessEnvelope<{ status: string }>>("/health"),
    ).resolves.toEqual(envelope);

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(API_BASE_URL).toBe("/api");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/health");
    expect(requestInit?.credentials).toBe("include");
    expect(new Headers(requestInit?.headers).has("Content-Type")).toBe(false);
  });

  it("cannot be downgraded from credentialed requests and labels JSON bodies", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: { authenticated: false } }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );

    await apiRequest("/auth/logout", {
      body: JSON.stringify({}),
      credentials: "omit",
      method: "POST",
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(requestInit?.credentials).toBe("include");
    expect(new Headers(requestInit?.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  it("preserves nested Flask error fields", async () => {
    const details = { email: "Email is required." };
    const payload = {
      error: {
        code: "validation_error",
        details,
        message: "Login validation failed.",
      },
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 400,
        statusText: "Bad Request",
      }),
    );

    const error = await apiRequest("/auth/login", { method: "POST" }).catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "validation_error",
      details,
      message: "Login validation failed.",
      payload,
      status: 400,
    });
  });

  it("labels fetch failures as network errors", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expect(apiRequest("/health")).rejects.toMatchObject({
      code: "network_error",
      status: 0,
    });
  });

  it("preserves aborts so canceled session boots are not reported as network failures", async () => {
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    fetchMock.mockRejectedValue(abortError);

    await expect(apiRequest("/auth/me")).rejects.toBe(abortError);
    expect(isAbortError(abortError)).toBe(true);
    expect(isAbortError({ name: "AbortError" })).toBe(true);
  });

  it("bounds a stalled request and distinguishes the owned timeout from caller cancellation", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Timed out.", "AbortError")),
          { once: true },
        );
      }),
    );

    const request = apiRequest("/health").catch((reason: unknown) => reason);
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

    const error = await request;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "request_timeout", status: 0 });
    expect(isNetworkFailure(error)).toBe(true);
  });

  it("normalizes a response-body stream failure as a useful network error", async () => {
    const cause = new TypeError("The response stream terminated early.");
    fetchMock.mockResolvedValue({
      headers: new Headers({ "Content-Type": "application/json" }),
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockRejectedValue(cause),
    } as unknown as Response);

    const error = await apiRequest("/health").catch(
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      cause,
      code: "network_error",
      message: "The GrapeVyne API response could not be read. Please try again.",
      status: 0,
    });
    expect(isNetworkFailure(error)).toBe(true);
  });

  it("preserves AbortError when response-body reading is canceled", async () => {
    const abortError = new DOMException("Reading was canceled.", "AbortError");
    fetchMock.mockResolvedValue({
      headers: new Headers({ "Content-Type": "application/json" }),
      ok: true,
      status: 200,
      statusText: "OK",
      text: vi.fn().mockRejectedValue(abortError),
    } as unknown as Response);

    await expect(apiRequest("/health")).rejects.toBe(abortError);
  });
});
