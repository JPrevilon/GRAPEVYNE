import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  Heart,
  MapPin,
  ShieldCheck,
  Star,
  Thermometer,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

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
  isNetworkFailure,
} from "@/api/client";
import { getWineDetail } from "@/api/wines";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorPanel, LoadingPanel } from "@/components/ui/StatePanels";
import { WineVisual } from "@/components/wine/WineBottleFallback";
import { privateQueryKey } from "@/features/auth/privateQueryKeys";
import { useAuth } from "@/features/auth/useAuth";

import { useToast } from "@/components/ui/useToast.js";

type SaveFeedback =
  | { kind: "duplicate" | "error" | "success"; message: string }
  | null;

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(priceCents / 100);
}

function returnPath(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}${location.hash}`;
}

function detailError(error: unknown) {
  if (error instanceof ApiError && (error.status === 404 || error.code === "wine_not_found")) {
    return {
      eyebrow: "Bottle not found",
      title: "THIS BOTTLE IS NOT IN THE CURRENT CATALOG",
      description: error.message,
    };
  }

  if (isNetworkFailure(error)) {
    return {
      eyebrow: "Wine service unavailable",
      title: "THE BOTTLE PROFILE CANNOT BE REACHED RIGHT NOW",
      description:
        error instanceof Error
          ? error.message
          : "The local wine service did not respond.",
    };
  }

  return {
    eyebrow: "Wine detail error",
    title: "BOTTLE DETAILS COULD NOT BE OPENED",
    description:
      error instanceof Error ? error.message : "The wine service returned an unexpected response.",
  };
}

export default function WineDetailPage() {
  const { wineId = "" } = useParams();
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
  const saveOperationId = useRef(0);

  activeAuthStatus.current = authStatus;
  activeUserId.current = user?.id;

  const wineQuery = useQuery({
    enabled: Boolean(wineId),
    queryFn: ({ signal }) => getWineDetail(wineId, signal),
    queryKey: ["public", "wine", wineId],
    staleTime: 5 * 60_000,
  });

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
      ? privateQueryKey(user.id, "cellar", "save", wineId)
      : (["private", "anonymous", "cellar", "save", wineId] as const),
  });

  useEffect(() => {
    saveOperationId.current += 1;
    setSaveFeedback(null);
    saveMutation.reset();
    // Reset confirmation when the route or signed-in identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, user?.id, wineId]);

  const wine = wineQuery.data?.wine;
  const locationLabel = useMemo(
    () => (wine ? [wine.region, wine.country].filter(Boolean).join(", ") : ""),
    [wine],
  );

  async function handleSave() {
    if (!wine) return;

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
        message: "This catalog record does not include a saveable external identifier.",
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

      if (
        operationId !== saveOperationId.current ||
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== savingUserId
      ) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: privateQueryKey(savingUserId, "cellar"),
      });

      if (
        operationId !== saveOperationId.current ||
        activeAuthStatus.current !== "ready" ||
        activeUserId.current !== savingUserId
      ) {
        return;
      }

      setSaveFeedback({ kind: "success", message: "Saved to your private cellar." });
      showToast({
        message: `${wine.name} is now in your private cellar.`,
        title: "Bottle saved",
      });
    } catch (error) {
      if (
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

      const message = error instanceof Error ? error.message : "This bottle could not be saved.";
      setSaveFeedback({ kind: "error", message });
      showToast({ message, title: "Save failed", tone: "error" });
    }
  }

  if (wineQuery.isPending) {
    return (
      <div className="gv-page-shell">
        <LoadingPanel
          description="Reading the fields returned by the current wine service."
          eyebrow="Wine detail"
          headingLevel="h1"
          title="BRINGING THE BOTTLE FORWARD"
        />
      </div>
    );
  }

  if (wineQuery.isError || !wine) {
    const content = detailError(wineQuery.error);
    return (
      <div className="gv-page-shell">
        <ErrorPanel
          action={
            <ButtonLink to="/discover" variant="secondary">
              <ArrowLeft aria-hidden="true" size={17} />
              Back to discovery
            </ButtonLink>
          }
          description={content.description}
          eyebrow={content.eyebrow}
          headingLevel="h1"
          title={content.title}
        />
      </div>
    );
  }

  const structures = [
    ["Body", wine.body],
    ["Acidity", wine.acidity],
    ["Sweetness", wine.sweetness],
    ["Serve", wine.servingTemp],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const hasTags = wine.tastingNotes.length > 0 || wine.pairings.length > 0 || Boolean(wine.occasion);
  const displayedSaveFeedback =
    authStatus === "ready" ? saveFeedback : null;

  return (
    <article className="gv-page-shell gv-wine-detail">
      <Link className="gv-back-link" to="/discover">
        <ArrowLeft aria-hidden="true" size={17} />
        Back to discovery
      </Link>

      <div className="gv-wine-detail__layout">
        <div className="gv-wine-detail__stage">
          <span aria-hidden="true" className="gv-wine-detail__halo" />
          <WineVisual
            alt={wine.imageUrl ? `${wine.name} bottle` : ""}
            imageUrl={wine.imageUrl}
            label={wine.name}
            loading="eager"
            varietal={wine.varietal}
          />
          {wineQuery.data?.source ? (
            <span className="gv-wine-detail__source">
              Catalog source: {wineQuery.data.source}
            </span>
          ) : null}
        </div>

        <div className="gv-wine-detail__copy">
          <p className="gv-eyebrow">WINE DIRECTORY / CATALOG RECORD</p>
          <h1>{wine.name}</h1>
          {wine.description ? <p className="gv-wine-detail__description">{wine.description}</p> : null}

          {wine.winery || wine.varietal || locationLabel || wine.vintage || wine.averageRating !== null || wine.priceCents !== null ? (
            <dl className="gv-wine-detail__facts">
              {wine.winery ? (
                <div>
                  <dt>PRODUCER</dt>
                  <dd>{wine.winery}</dd>
                </div>
              ) : null}
              {locationLabel ? (
                <div>
                  <dt><MapPin aria-hidden="true" size={16} />ORIGIN</dt>
                  <dd>{locationLabel}</dd>
                </div>
              ) : null}
              {wine.varietal ? <div><dt>VARIETAL</dt><dd>{wine.varietal}</dd></div> : null}
              {wine.vintage ? <div><dt>VINTAGE</dt><dd>{wine.vintage}</dd></div> : null}
              {wine.averageRating !== null ? (
                <div>
                  <dt><Star aria-hidden="true" size={16} />CATALOG RATING</dt>
                  <dd>{wine.averageRating.toFixed(1)}</dd>
                </div>
              ) : null}
              {wine.priceCents !== null ? (
                <div><dt>LISTED PRICE</dt><dd>{formatPrice(wine.priceCents)}</dd></div>
              ) : null}
            </dl>
          ) : null}

          <div className="gv-wine-detail__save">
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
                <><Check aria-hidden="true" size={17} />Saved to cellar</>
              ) : displayedSaveFeedback?.kind === "duplicate" ? (
                <><Check aria-hidden="true" size={17} />Already in cellar</>
              ) : isAuthenticated ? (
                <><Heart aria-hidden="true" size={17} />Save to my cellar</>
              ) : (
                <><ShieldCheck aria-hidden="true" size={17} />Sign in to save</>
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
        </div>
      </div>

      {hasTags || structures.length > 0 ? (
        <div className="gv-wine-detail__sections">
          {wine.tastingNotes.length > 0 ? (
            <section aria-labelledby="tasting-notes-title" className="gv-detail-section">
              <p className="gv-eyebrow">From the catalog</p>
              <h2 id="tasting-notes-title">TASTING NOTES</h2>
              <div className="gv-tag-list">
                {wine.tastingNotes.map((note) => <span key={note}>{note}</span>)}
              </div>
            </section>
          ) : null}
          {wine.pairings.length > 0 || wine.occasion ? (
            <section aria-labelledby="pairings-title" className="gv-detail-section">
              <p className="gv-eyebrow">Sourced suggestions</p>
              <h2 id="pairings-title">PAIRINGS AND OCCASION</h2>
              <div className="gv-tag-list">
                {wine.pairings.map((pairing) => <span key={pairing}>{pairing}</span>)}
                {wine.occasion ? <span>{wine.occasion}</span> : null}
              </div>
            </section>
          ) : null}
          {structures.length > 0 ? (
            <section aria-labelledby="structure-title" className="gv-detail-section">
              <p className="gv-eyebrow">Bottle structure</p>
              <h2 id="structure-title">AVAILABLE CHARACTERISTICS</h2>
              <dl className="gv-structure-list">
                {structures.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label === "Serve" ? <Thermometer aria-hidden="true" size={15} /> : null}{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
