import { useQueryClient } from "@tanstack/react-query";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { User } from "../../types/domain";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
} from "./authApi";
import {
  AuthContext,
  type AuthStatus,
  type LoginInput,
  type SignupInput,
} from "./authContextValue";
import { isPrivateMutationKey, isPrivateQueryKey } from "./privateQueryKeys";

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const activeUserId = useRef<User["id"] | null>(null);
  const authOperationId = useRef(0);

  const replaceUser = useCallback(
    (nextUser: User | null) => {
      const nextUserId = nextUser?.id ?? null;

      if (activeUserId.current !== nextUserId) {
        queryClient.removeQueries({
          predicate: (query) => isPrivateQueryKey(query.queryKey),
        });
        const mutationCache = queryClient.getMutationCache();
        mutationCache
          .findAll({
            predicate: (mutation) =>
              isPrivateMutationKey(mutation.options.mutationKey),
          })
          .forEach((mutation) => mutationCache.remove(mutation));
      }

      activeUserId.current = nextUserId;
      setUser(nextUser);
    },
    [queryClient]
  );

  const refreshUser = useCallback(async (signal?: AbortSignal) => {
    const operationId = ++authOperationId.current;
    setStatus("loading");

    try {
      const response = await getCurrentUser(signal);
      if (operationId === authOperationId.current) {
        replaceUser(response.data.user);
      }
    } catch (error) {
      if (!signal?.aborted && getHttpStatus(error) !== 401) {
        console.error(error);
      }

      if (!signal?.aborted && operationId === authOperationId.current) {
        replaceUser(null);
      }
    } finally {
      if (!signal?.aborted && operationId === authOperationId.current) {
        setStatus("ready");
      }
    }
  }, [replaceUser]);

  useEffect(() => {
    const controller = new AbortController();
    void refreshUser(controller.signal);
    return () => controller.abort();
  }, [refreshUser]);

  const signup = useCallback(
    async (payload: SignupInput) => {
      const operationId = ++authOperationId.current;
      try {
        const response = await signupRequest(payload);
        if (operationId === authOperationId.current) {
          replaceUser(response.data.user);
        }
        return response.data.user;
      } finally {
        if (operationId === authOperationId.current) {
          setStatus("ready");
        }
      }
    },
    [replaceUser]
  );

  const login = useCallback(
    async (payload: LoginInput) => {
      const operationId = ++authOperationId.current;
      try {
        const response = await loginRequest(payload);
        if (operationId === authOperationId.current) {
          replaceUser(response.data.user);
        }
        return response.data.user;
      } finally {
        if (operationId === authOperationId.current) {
          setStatus("ready");
        }
      }
    },
    [replaceUser]
  );

  const logout = useCallback(async () => {
    const operationId = ++authOperationId.current;
    try {
      await logoutRequest();
      if (operationId === authOperationId.current) {
        replaceUser(null);
      }
    } finally {
      if (operationId === authOperationId.current) {
        setStatus("ready");
      }
    }
  }, [replaceUser]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading: status === "loading",
      login,
      logout,
      refreshUser,
      signup,
      status,
    }),
    [login, logout, refreshUser, signup, status, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
