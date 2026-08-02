import { apiRequest } from "../../api/client";
import type { User } from "../../types/domain";
import type { LoginInput, SignupInput } from "./authContextValue";

interface ApiSuccessEnvelope<T> {
  data: T;
  message?: string;
}

interface AuthenticatedSessionData {
  authenticated: true;
  user: User;
}

interface AnonymousSessionData {
  authenticated: false;
}

export type AuthSessionResponse = ApiSuccessEnvelope<AuthenticatedSessionData>;
export type LogoutResponse = ApiSuccessEnvelope<AnonymousSessionData>;

export function signup(payload: SignupInput): Promise<AuthSessionResponse> {
  return apiRequest<AuthSessionResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginInput): Promise<AuthSessionResponse> {
  return apiRequest<AuthSessionResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout(): Promise<LogoutResponse> {
  return apiRequest<LogoutResponse>("/auth/logout", {
    method: "POST",
  });
}

export function getCurrentUser(signal?: AbortSignal): Promise<AuthSessionResponse> {
  return signal
    ? apiRequest<AuthSessionResponse>("/auth/me", { signal })
    : apiRequest<AuthSessionResponse>("/auth/me");
}
