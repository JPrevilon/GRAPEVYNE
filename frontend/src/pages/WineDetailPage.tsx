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
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { saveWineToCellar } from "@/api/cellar";
import { ApiError, isNetworkFailure } from "@/api/client";
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
      title: "This bottle is not in the current catalog.",
      description: error.message,
    };
  }

  if (isNetworkFailure(error)) {
    return {
      eyebrow: "Wine service unavailable",
      title: "The bottle profile cannot be reached right now.",
      description:
        error instanceof Error
          ? error.message
          : "The local wine service did not respond.",
    };
  }

  return {
    eyebrow: "Wine detail error",
    title: "Bottle details could not be opened.",
    description:
      error instanceof Error ? error.message : "The wine service returned an unexpected response.",
  };
}

export default function WineDetailPage() {
  const { wineId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const { showToast } = useToast();
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>(null);

  const wineQuery = useQuery({
    enabled: Boolean(wineId),
    queryFn: ({ signal }) => getWineDetail(wineId, signal),
    queryKey: ["public", "wine", wineId],
    staleTime: 5 * 60_000,
  });

  const saveMutation = useMutation({
    gcTime: 0,
    mutationFn: (externalWineId: string) => saveWineToCellar({ externalWineId }),
    mutationKey: user
      ? privateQueryKey(user.id, "cellar", "save", wineId)
      : (["public", "wine-save", wineId] as const),
  });

  useEffect(() => {
    setSaveFeedback(null);
    saveMutation.reset();
    // Reset confirmation when the route or signed-in identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, wineId]);

  const wine = wineQuery.data?.wine;
  const locationLabel = useMemo(
    () => (wine ? [wine.region, wine.country].filter(Boolean).join(", ") : ""),
    [wine],
  );

  async function handleSave() {
    if (!wine) return;

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

    try {
      await saveMutation.mutateAsync(wine.externalWineId);
      await queryClient.invalidateQueries({
        queryKey: privateQueryKey(user.id, "cellar"),
      });
      setSaveFeedback({ kind: "success", message: "Saved to your private cellar." });
      showToast({
        message: `${wine.name} is now in your private cellar.`,
        title: "Bottle saved",
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "cellar_entry_exists") {
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
          title="Bringing the bottle forward."
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
          {wine.varietal ? <p className="gv-eyebrow">{wine.varietal}</p> : null}
          <h1>{wine.name}</h1>
          {wine.winery ? <p className="gv-wine-detail__producer">{wine.winery}</p> : null}
          {wine.description ? <p className="gv-wine-detail__description">{wine.description}</p> : null}

          {locationLabel || wine.vintage || wine.averageRating !== null || wine.priceCents !== null ? (
            <dl className="gv-wine-detail__facts">
              {locationLabel ? (
                <div>
                  <dt><MapPin aria-hidden="true" size={16} />Origin</dt>
                  <dd>{locationLabel}</dd>
                </div>
              ) : null}
              {wine.vintage ? <div><dt>Vintage</dt><dd>{wine.vintage}</dd></div> : null}
              {wine.averageRating !== null ? (
                <div>
                  <dt><Star aria-hidden="true" size={16} />Catalog rating</dt>
                  <dd>{wine.averageRating.toFixed(1)}</dd>
                </div>
              ) : null}
              {wine.priceCents !== null ? (
                <div><dt>Listed price</dt><dd>{formatPrice(wine.priceCents)}</dd></div>
              ) : null}
            </dl>
          ) : null}

          <div className="gv-wine-detail__save">
            <Button
              busyLabel="Saving bottle…"
              disabled={
                isAuthLoading ||
                saveFeedback?.kind === "success" ||
                saveFeedback?.kind === "duplicate"
              }
              isBusy={saveMutation.isPending}
              onClick={() => void handleSave()}
              variant="primary"
            >
              {saveFeedback?.kind === "success" ? (
                <><Check aria-hidden="true" size={17} />Saved to cellar</>
              ) : saveFeedback?.kind === "duplicate" ? (
                <><Check aria-hidden="true" size={17} />Already in cellar</>
              ) : isAuthenticated ? (
                <><Heart aria-hidden="true" size={17} />Save to my cellar</>
              ) : (
                <><ShieldCheck aria-hidden="true" size={17} />Sign in to save</>
              )}
            </Button>
            {saveFeedback ? (
              <p
                className={`gv-inline-feedback gv-inline-feedback--${saveFeedback.kind}`}
                role={saveFeedback.kind === "error" ? "alert" : "status"}
              >
                {saveFeedback.message}
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
              <h2 id="tasting-notes-title">Tasting notes</h2>
              <div className="gv-tag-list">
                {wine.tastingNotes.map((note) => <span key={note}>{note}</span>)}
              </div>
            </section>
          ) : null}
          {wine.pairings.length > 0 || wine.occasion ? (
            <section aria-labelledby="pairings-title" className="gv-detail-section">
              <p className="gv-eyebrow">Sourced suggestions</p>
              <h2 id="pairings-title">Pairings and occasion</h2>
              <div className="gv-tag-list">
                {wine.pairings.map((pairing) => <span key={pairing}>{pairing}</span>)}
                {wine.occasion ? <span>{wine.occasion}</span> : null}
              </div>
            </section>
          ) : null}
          {structures.length > 0 ? (
            <section aria-labelledby="structure-title" className="gv-detail-section">
              <p className="gv-eyebrow">Bottle structure</p>
              <h2 id="structure-title">Available characteristics</h2>
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
