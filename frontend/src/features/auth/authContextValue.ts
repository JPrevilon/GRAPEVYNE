import { createContext } from "react";

import type { User } from "../../types/domain";

export type AuthStatus = "loading" | "ready";

export interface LoginInput {
  email: string;
  password: string;
}

export interface SignupInput extends LoginInput {
  name: string;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signup: (payload: SignupInput) => Promise<User>;
  status: AuthStatus;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
