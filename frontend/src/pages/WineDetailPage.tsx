import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  MapPin,
  Star,
  Thermometer,
} from "lucide-react";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { ApiError, isNetworkFailure } from "@/api/client";
import { getWineDetail } from "@/api/wines";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorPanel, LoadingPanel } from "@/components/ui/StatePanels";
import { WineVisual } from "@/components/wine/WineBottleFallback";
import SaveWineControl from "@/features/cellar/components/SaveWineControl";
import WineRecommendationContext from "@/features/recommendations/components/WineRecommendationContext";

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(priceCents / 100);
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
  const [searchParams] = useSearchParams();
  const requestContext = searchParams.get("request")?.trim() ?? "";
  const validRequestContext =
    requestContext.length >= 2 &&
    requestContext.length <= 300 &&
    !/[<>]|[\u0000-\u001f]/u.test(requestContext)
      ? requestContext
      : null;
  const discoveryPath = validRequestContext
    ? `/discover?${new URLSearchParams({ query: validRequestContext })}`
    : "/discover";

  const wineQuery = useQuery({
    enabled: Boolean(wineId),
    queryFn: ({ signal }) => getWineDetail(wineId, signal),
    queryKey: ["public", "wine", wineId],
    staleTime: 5 * 60_000,
  });

  const wine = wineQuery.data?.wine;
  const locationLabel = useMemo(
    () => (wine ? [wine.region, wine.country].filter(Boolean).join(", ") : ""),
    [wine],
  );

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
            <ButtonLink to={discoveryPath} variant="secondary">
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
      <Link className="gv-back-link" to={discoveryPath}>
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

          <SaveWineControl className="gv-wine-detail__save" wine={wine} />
        </div>
      </div>

      {validRequestContext && wine.externalWineId ? (
        <WineRecommendationContext
          externalWineId={wine.externalWineId}
          query={validRequestContext}
        />
      ) : requestContext ? (
        <section className="gv-recommendation-context gv-recommendation-context--unavailable">
          <p className="gv-eyebrow">Request context</p>
          <h2>WHY IT FITS THIS REQUEST</h2>
          <p>
            The request context was invalid or too long, so it was not sent to the
            recommendation endpoint. Bottle details remain available directly.
          </p>
        </section>
      ) : null}

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
