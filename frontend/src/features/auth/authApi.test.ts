import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest } from "../../api/client";
import { getCurrentUser, login, logout, signup } from "./authApi";

vi.mock("../../api/client", () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe("auth API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApiRequest.mockResolvedValue({ data: {} });
  });

  it("uses the existing cookie-session endpoints without inventing token storage", async () => {
    await getCurrentUser();
    await login({ email: "reader@example.com", password: "correct horse" });
    await signup({
      email: "reader@example.com",
      name: "A Reader",
      password: "correct horse",
    });
    await logout();

    expect(mockedApiRequest).toHaveBeenNthCalledWith(1, "/auth/me");
    expect(mockedApiRequest).toHaveBeenNthCalledWith(2, "/auth/login", {
      body: JSON.stringify({
        email: "reader@example.com",
        password: "correct horse",
      }),
      method: "POST",
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(3, "/auth/signup", {
      body: JSON.stringify({
        email: "reader@example.com",
        name: "A Reader",
        password: "correct horse",
      }),
      method: "POST",
    });
    expect(mockedApiRequest).toHaveBeenNthCalledWith(4, "/auth/logout", {
      method: "POST",
    });
  });
});
