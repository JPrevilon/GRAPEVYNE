import {
  QueryClient,
  QueryClientProvider,
  type QueryClientConfig,
} from "@tanstack/react-query";
import { type PropsWithChildren, useState } from "react";

import { ToastProvider } from "../components/ui/ToastProvider";
import { SceneProvider } from "../experience";
import { AuthProvider } from "../features/auth/AuthContext";

function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

const queryClientConfig: QueryClientConfig = {
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = getHttpStatus(error);

        if (status !== undefined && status >= 400 && status < 500) {
          return false;
        }

        return failureCount < 1;
      },
      staleTime: 60_000,
    },
  },
};

function createAppQueryClient() {
  return new QueryClient(queryClientConfig);
}

export default function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <SceneProvider>{children}</SceneProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
