import { useQueryClient } from "@tanstack/react-query";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isAbortError } from "../../api/client";
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  signup as signupRequest,
} from "../../api/auth";
import { useToast } from "../../components/ui/useToast.js";
import type { User } from "../../types/domain";
import {
  AuthContext,
  type AuthStatus,
  type LoginInput,
  type SignupInput,
} from "./authContextValue";
import { isPrivateMutationKey, isPrivateQueryKey } from "./privateQueryKeys";
import {
  createAuthSessionSync,
  type AuthSessionSync,
} from "./authSessionSync";

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function staleAuthOperationError() {
  return new DOMException(
    "The authentication request was superseded.",
    "AbortError",
  );
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const { clearToasts } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [error, setError] = useState<Error | null>(null);
  const activeUserId = useRef<User["id"] | null>(null);
  const authOperationId = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const isMounted = useRef(false);
  const pendingRevalidation = useRef(false);
  const idleRevalidation = useRef<(() => void) | null>(null);
  const sessionSync = useRef<AuthSessionSync | null>(null);

  const replaceUser = useCallback(
    (nextUser: User | null) => {
      if (!isMounted.current) {
        return;
      }

      const nextUserId = nextUser?.id ?? null;

      if (activeUserId.current !== nextUserId) {
        void queryClient.cancelQueries({
          predicate: (query) => isPrivateQueryKey(query.queryKey),
        });
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

  const beginOperation = useCallback(() => {
    if (!isMounted.current) {
      throw staleAuthOperationError();
    }

    clearToasts();
    activeRequest.current?.abort();
    const controller = new AbortController();
    const operationId = ++authOperationId.current;

    activeRequest.current = controller;

    return { controller, operationId };
  }, [clearToasts]);

  const finishOperation = useCallback((controller: AbortController) => {
    if (activeRequest.current !== controller) {
      return;
    }

    activeRequest.current = null;

    if (!isMounted.current || !pendingRevalidation.current) {
      return;
    }

    pendingRevalidation.current = false;
    queueMicrotask(() => {
      if (isMounted.current && activeRequest.current === null) {
        idleRevalidation.current?.();
      }
    });
  }, []);

  const requestCurrentUser = useCallback(async (showLoading: boolean) => {
    if (!isMounted.current) {
      return;
    }

    const { controller, operationId } = beginOperation();

    if (showLoading) {
      setStatus("loading");
      setError(null);
    }

    try {
      const nextUser = await getCurrentUser(controller.signal);
      if (isMounted.current && operationId === authOperationId.current) {
        replaceUser(nextUser);
        setError(null);
        setStatus("ready");
      }
    } catch (caughtError) {
      if (controller.signal.aborted || isAbortError(caughtError)) {
        return;
      }

      if (!isMounted.current || operationId !== authOperationId.current) {
        return;
      }

      if (getHttpStatus(caughtError) === 401) {
        replaceUser(null);
        setError(null);
        setStatus("ready");
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError
          : new Error("The current session could not be checked."),
      );
      setStatus("error");
    } finally {
      finishOperation(controller);
    }
  }, [beginOperation, finishOperation, replaceUser]);

  const refreshUser = useCallback(
    () => requestCurrentUser(true),
    [requestCurrentUser],
  );

  useEffect(() => {
    isMounted.current = true;
    const revalidateSession = () => {
      if (!isMounted.current) {
        return;
      }

      if (activeRequest.current !== null) {
        return;
      }

      void refreshUser();
    };
    const queueSessionRevalidation = () => {
      if (!isMounted.current) {
        return;
      }

      if (activeRequest.current !== null) {
        pendingRevalidation.current = true;
        return;
      }

      void refreshUser();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        revalidateSession();
      }
    };

    idleRevalidation.current = queueSessionRevalidation;
    sessionSync.current = createAuthSessionSync(queueSessionRevalidation);
    window.addEventListener("focus", revalidateSession);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void refreshUser();

    return () => {
      isMounted.current = false;
      window.removeEventListener("focus", revalidateSession);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sessionSync.current?.close();
      sessionSync.current = null;
      idleRevalidation.current = null;
      pendingRevalidation.current = false;
      authOperationId.current += 1;
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [refreshUser]);

  const signup = useCallback(
    async (payload: SignupInput) => {
      const previousError = error;
      const previousStatus = status;
      const { controller, operationId } = beginOperation();
      setError(null);
      setStatus("loading");

      try {
        const nextUser = await signupRequest(payload, controller.signal);

        if (
          !isMounted.current ||
          controller.signal.aborted ||
          operationId !== authOperationId.current
        ) {
          throw staleAuthOperationError();
        }

        replaceUser(nextUser);
        setStatus("ready");
        sessionSync.current?.publish("signup");

        return nextUser;
      } catch (caughtError) {
        if (
          operationId === authOperationId.current &&
          isMounted.current &&
          !controller.signal.aborted &&
          !isAbortError(caughtError)
        ) {
          if (previousStatus === "error") {
            setError(previousError);
            setStatus("error");
          } else {
            setStatus("ready");
          }
        }

        throw caughtError;
      } finally {
        finishOperation(controller);
      }
    },
    [beginOperation, error, finishOperation, replaceUser, status]
  );

  const login = useCallback(
    async (payload: LoginInput) => {
      const previousError = error;
      const previousStatus = status;
      const { controller, operationId } = beginOperation();
      setError(null);
      setStatus("loading");

      try {
        const nextUser = await loginRequest(payload, controller.signal);

        if (
          !isMounted.current ||
          controller.signal.aborted ||
          operationId !== authOperationId.current
        ) {
          throw staleAuthOperationError();
        }

        replaceUser(nextUser);
        setStatus("ready");
        sessionSync.current?.publish("login");

        return nextUser;
      } catch (caughtError) {
        if (
          operationId === authOperationId.current &&
          isMounted.current &&
          !controller.signal.aborted &&
          !isAbortError(caughtError)
        ) {
          if (previousStatus === "error") {
            setError(previousError);
            setStatus("error");
          } else {
            setStatus("ready");
          }
        }

        throw caughtError;
      } finally {
        finishOperation(controller);
      }
    },
    [beginOperation, error, finishOperation, replaceUser, status]
  );

  const logout = useCallback(async () => {
    const { controller, operationId } = beginOperation();
    setError(null);
    setStatus("loading");

    try {
      await logoutRequest(controller.signal);

      if (
        !isMounted.current ||
        controller.signal.aborted ||
        operationId !== authOperationId.current
      ) {
        throw staleAuthOperationError();
      }

      replaceUser(null);
      setStatus("ready");
      sessionSync.current?.publish("logout");
    } catch (caughtError) {
      if (
        operationId === authOperationId.current &&
        isMounted.current &&
        !controller.signal.aborted &&
        !isAbortError(caughtError)
      ) {
        setStatus("ready");
      }

      throw caughtError;
    } finally {
      finishOperation(controller);
    }
  }, [beginOperation, finishOperation, replaceUser]);

  const handleAuthenticationRequired = useCallback(
    async (expectedUserId: User["id"]) => {
      if (!isMounted.current || activeUserId.current !== expectedUserId) {
        return false;
      }

      if (activeRequest.current !== null) {
        pendingRevalidation.current = true;
        return false;
      }

      await refreshUser();

      return (
        isMounted.current &&
        (activeUserId.current === expectedUserId ||
          activeUserId.current === null)
      );
    },
    [refreshUser],
  );

  const value = useMemo(
    () => ({
      error,
      user,
      handleAuthenticationRequired,
      isAuthenticated: Boolean(user),
      isLoading: status === "loading",
      login,
      logout,
      refreshUser,
      signup,
      status,
    }),
    [
      error,
      handleAuthenticationRequired,
      login,
      logout,
      refreshUser,
      signup,
      status,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
