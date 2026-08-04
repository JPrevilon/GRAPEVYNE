import { beforeEach, describe, expect, it, vi } from "vitest";

import { getCurrentUser, login, logout, signup } from "@/api/auth";
import { apiRequest } from "@/api/client";

vi.mock("@/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/client")>();

  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

const mockedApiRequest = vi.mocked(apiRequest);

describe("auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiRequest
      .mockResolvedValueOnce({
        data: {
          authenticated: true,
          user: {
            createdAt: null,
            email: "reader@example.com",
            id: 7,
            name: "A Reader",
            updatedAt: null,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          authenticated: true,
          user: {
            createdAt: null,
            email: "reader@example.com",
            id: 7,
            name: "A Reader",
            updatedAt: null,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          authenticated: true,
          user: {
            createdAt: null,
            email: "reader@example.com",
            id: 7,
            name: "A Reader",
            updatedAt: null,
          },
        },
      })
      .mockResolvedValueOnce({ data: { authenticated: false } });
  });

  it("normalizes the exact envelopes and forwards cancellation to cookie-session endpoints", async () => {
    const controller = new AbortController();

    await expect(getCurrentUser(controller.signal)).resolves.toMatchObject({
      email: "reader@example.com",
      id: 7,
    });
    await expect(
      login(
        { email: "reader@example.com", password: "correct horse" },
        controller.signal,
      ),
    ).resolves.toMatchObject({ id: 7 });
    await expect(
      signup(
        {
          email: "reader@example.com",
          name: "A Reader",
          password: "correct horse",
        },
        controller.signal,
      ),
    ).resolves.toMatchObject({ id: 7 });
    await expect(logout(controller.signal)).resolves.toEqual({
      authenticated: false,
    });

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, "/auth/me", {
      signal: controller.signal,
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, "/auth/login", {
      body: JSON.stringify({
        email: "reader@example.com",
        password: "correct horse",
      }),
      method: "POST",
      signal: controller.signal,
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, "/auth/signup", {
      body: JSON.stringify({
        email: "reader@example.com",
        name: "A Reader",
        password: "correct horse",
      }),
      method: "POST",
      signal: controller.signal,
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(4, "/auth/logout", {
      method: "POST",
      signal: controller.signal,
    });
  });
});
