import { createContext } from "react";

import type { User } from "../../types/domain";

export type AuthStatus = "error" | "loading" | "ready";

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput extends LoginInput {
  name: string;
}

export interface AuthContextValue {
  error: Error | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  handleAuthenticationRequired: (expectedUserId: User["id"]) => Promise<boolean>;
  login: (payload: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signup: (payload: SignupInput) => Promise<User>;
  status: AuthStatus;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
