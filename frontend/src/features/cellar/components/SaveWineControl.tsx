import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Heart, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  assertCellarEntryOwner,
  isCellarErrorEntryOwnedBy,
  isCellarIdentityMismatch,
  saveWineToCellar,
} from "@/api/cellar";
import {
  ApiError,
  isAbortError,
  isAuthenticationRequired,
} from "@/api/client";
import { RECOMMENDATION_QUERY_RESOURCE } from "@/api/recommendationQueryKeys";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/useToast.js";
import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import { useAuth } from "@/features/auth/useAuth";
import type { Wine } from "@/types/domain";

type SaveFeedback =
  | { kind: "duplicate" | "error" | "success"; message: string }
  | null;

interface SaveWineControlProps {
  className?: string;
  wine: Wine;
}

function returnPath(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`;
}

export default function SaveWineControl({
  className = "",
  wine,
}: SaveWineControlProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    handleAuthenticationRequired,
    isAuthenticated,
    status: authStatus,
    user,
  } = useAuth();
  const { showToast } = useToast();
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>(null);
  const activeAuthStatus = useRef(authStatus);
  const activeUserId = useRef(user?.id);
  const isMounted = useRef(false);
  const saveOperationId = useRef(0);
  const wineKey =
    wine.externalWineId ?? wine.externalApiId ?? wine.id ?? wine.name;

  activeAuthStatus.current = authStatus;
  activeUserId.current = user?.id;

  const saveMutation = useMutation({
    gcTime: 0,
    mutationFn: async ({
      externalWineId,
      ownerId,
    }: {
      externalWineId: string;
      ownerId: number;
    }) =>
      assertCellarEntryOwner(
        await saveWineToCellar({ externalWineId }, ownerId),
        ownerId,
      ),
    mutationKey: user
      ? privateQueryKey(user.id, "cellar", "save", wineKey)
      : (["private", "anonymous", "cellar", "save", wineKey] as const),
  });

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    saveOperationId.current += 1;
    setSaveFeedback(null);
    saveMutation.reset();
    // Reset confirmation when the wine or signed-in identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, user?.id, wineKey]);

  async function handleSave() {
    if (authStatus !== "ready") {
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", { state: { from: returnPath(location) } });
      return;
    }

    if (!user || !wine.externalWineId) {
      setSaveFeedback({
        kind: "error",
        message:
          "This catalog record does not include a saveable external identifier.",
      });
      return;
    }

    setSaveFeedback(null);
    const operationId = ++saveOperationId.current;
    const savingUserId = user.id;

    try {
      await saveMutation.mutateAsync({
        externalWineId: wine.externalWineId,
        ownerId: savingUserId,
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: privateQueryKey(savingUserId, "cellar"),
        }),
        queryClient.invalidateQueries({
          queryKey: privateQueryKey(
            savingUserId,
            RECOMMENDATION_QUERY_RESOURCE,
          ),
        }),
      ]);

      if (
        !isMounted.current ||
        operationId !== saveOperationId.current ||
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== savingUserId
      ) {
        return;
      }

      setSaveFeedback({
        kind: "success",
        message: "Saved to your private cellar.",
      });
      showToast({
        message: `${wine.name} is now in your private cellar.`,
        title: "Bottle saved",
      });
    } catch (error) {
      if (
        !isMounted.current ||
        operationId !== saveOperationId.current ||
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== savingUserId ||
        isAbortError(error)
      ) {
        return;
      }

      if (isCellarIdentityMismatch(error)) {
        await handleAuthenticationRequired(savingUserId);
        return;
      }

      if (isAuthenticationRequired(error)) {
        await handleAuthenticationRequired(savingUserId);
        return;
      }

      if (error instanceof ApiError && error.code === "cellar_entry_exists") {
        if (!isCellarErrorEntryOwnedBy(error, savingUserId)) {
          await handleAuthenticationRequired(savingUserId);
          return;
        }

        const message = "This bottle is already in your cellar.";
        setSaveFeedback({ kind: "duplicate", message });
        showToast({ message, title: "Already saved" });
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "This bottle could not be saved.";
      setSaveFeedback({ kind: "error", message });
      showToast({ message, title: "Save failed", tone: "error" });
    }
  }

  const displayedSaveFeedback = authStatus === "ready" ? saveFeedback : null;

  return (
    <div className={className}>
      <Button
        busyLabel="Saving bottle…"
        disabled={
          authStatus !== "ready" ||
          displayedSaveFeedback?.kind === "success" ||
          displayedSaveFeedback?.kind === "duplicate"
        }
        isBusy={saveMutation.isPending}
        onClick={() => void handleSave()}
        variant="primary"
      >
        {displayedSaveFeedback?.kind === "success" ? (
          <>
            <Check aria-hidden="true" size={17} />
            Saved to cellar
          </>
        ) : displayedSaveFeedback?.kind === "duplicate" ? (
          <>
            <Check aria-hidden="true" size={17} />
            Already in cellar
          </>
        ) : isAuthenticated ? (
          <>
            <Heart aria-hidden="true" size={17} />
            Save to my cellar
          </>
        ) : (
          <>
            <ShieldCheck aria-hidden="true" size={17} />
            Sign in to save
          </>
        )}
      </Button>
      {displayedSaveFeedback ? (
        <p
          className={`gv-inline-feedback gv-inline-feedback--${displayedSaveFeedback.kind}`}
          role={displayedSaveFeedback.kind === "error" ? "alert" : "status"}
        >
          {displayedSaveFeedback.message}
        </p>
      ) : null}
    </div>
  );
}
