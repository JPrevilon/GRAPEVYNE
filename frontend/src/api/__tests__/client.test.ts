import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest } from "@/api/client";
import type { ApiSuccessEnvelope } from "@/types/api";

const fetchMock = vi.fn<typeof fetch>();

describe("apiRequest", () => {
  beforeEach(() => {
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

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(/\/api\/health$/);
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
  });
});
