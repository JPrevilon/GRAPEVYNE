import { apiRequest, unwrapData } from "@/api/client";
import { normalizeUser } from "@/api/normalizers";
import type {
  ApiSuccessEnvelope,
  AuthenticatedUserData,
  LoggedOutData,
} from "@/types/api";
import type { User } from "@/types/domain";

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput extends LoginInput {
  name: string;
}

function normalizeAuthenticatedUser(data: AuthenticatedUserData): User {
  if (data.authenticated !== true) {
    throw new TypeError("The authentication response was not authenticated.");
  }

  return normalizeUser(data.user);
}

export async function getCurrentUser(signal?: AbortSignal): Promise<User> {
  const envelope = await apiRequest<ApiSuccessEnvelope<AuthenticatedUserData>>(
    "/auth/me",
    { signal },
  );

  return normalizeAuthenticatedUser(unwrapData<AuthenticatedUserData>(envelope));
}

export async function login(
  input: LoginInput,
  signal?: AbortSignal,
): Promise<User> {
  const envelope = await apiRequest<ApiSuccessEnvelope<AuthenticatedUserData>>(
    "/auth/login",
    {
      body: JSON.stringify(input),
      method: "POST",
      signal,
    },
  );

  return normalizeAuthenticatedUser(unwrapData<AuthenticatedUserData>(envelope));
}

export async function signup(
  input: SignupInput,
  signal?: AbortSignal,
): Promise<User> {
  const envelope = await apiRequest<ApiSuccessEnvelope<AuthenticatedUserData>>(
    "/auth/signup",
    {
      body: JSON.stringify(input),
      method: "POST",
      signal,
    },
  );

  return normalizeAuthenticatedUser(unwrapData<AuthenticatedUserData>(envelope));
}

export async function logout(signal?: AbortSignal): Promise<LoggedOutData> {
  const envelope = await apiRequest<ApiSuccessEnvelope<LoggedOutData>>(
    "/auth/logout",
    { method: "POST", signal },
  );
  const data = unwrapData<LoggedOutData>(envelope);

  if (data.authenticated !== false) {
    throw new TypeError("The logout response remained authenticated.");
  }

  return data;
}
