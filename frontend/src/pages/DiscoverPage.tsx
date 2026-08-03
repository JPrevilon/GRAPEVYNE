import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ApiError, isAbortError, isNetworkFailure } from "@/api/client";
import { recommendationQueryKey } from "@/api/recommendationQueryKeys";
import {
  DEFAULT_RECOMMENDATION_LIMIT,
  getWineRecommendations,
  MAX_RECOMMENDATION_QUERY_LENGTH,
  MIN_RECOMMENDATION_QUERY_LENGTH,
} from "@/api/recommendations";
import { searchWines } from "@/api/wines";
import DirectoryHeading from "@/components/typography/DirectoryHeading";
import { DIRECTORY_PAGE_HEADINGS } from "@/components/typography/directoryHeadingPresets";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  FilterChip,
  NaturalLanguageSearch,
  SelectControl,
} from "@/components/ui/FormControls";
import { PageShell, SectionHeading } from "@/components/ui/PageShell";
import {
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  NoticePanel,
} from "@/components/ui/StatePanels";
import WineCard from "@/components/wine/WineCard";
import RecommendationResultCard from "@/features/recommendations/components/RecommendationResultCard";
import { useAuth } from "@/features/auth/useAuth";
import type {
  RecommendationIntent,
  RecommendationResponse,
  Wine,
} from "@/types/domain";

type DiscoverMode = "recommendations" | "catalog";

const ALL_FILTERS = "all";
const MAX_CATALOG_QUERY_LENGTH = 200;
const MIN_CATALOG_QUERY_LENGTH = 1;
const EMPTY_RESULTS: Wine[] = [];
const suggestedSearches = [
  "bold red under $60 for steak night",
  "crisp white for oysters",
  "celebration bottle under $100",
  "gift between $40 and $75",
  "something new but not sweet",
];

function distinctValues(
  wines: Wine[],
  selectValue: (wine: Wine) => string | null,
): string[] {
  return Array.from(
    new Set(
      wines
        .map(selectValue)
        .filter((value): value is string => Boolean(value?.trim()))
        .map((value) => value.trim()),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function errorDescription(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "The wine service returned an unexpected response. Please try again.";
}

function isValidRecommendationQuery(query: string) {
  return (
    query.length >= MIN_RECOMMENDATION_QUERY_LENGTH &&
    query.length <= MAX_RECOMMENDATION_QUERY_LENGTH &&
    !/[<>]|[\u0000-\u001f]/u.test(query)
  );
}

function isValidCatalogQuery(query: string) {
  return (
    query.length >= MIN_CATALOG_QUERY_LENGTH &&
    query.length <= MAX_CATALOG_QUERY_LENGTH
  );
}

function isValidQuery(mode: DiscoverMode, query: string) {
  return mode === "recommendations"
    ? isValidRecommendationQuery(query)
    : isValidCatalogQuery(query);
}

function queryValidationMessage(mode: DiscoverMode) {
  return mode === "recommendations"
    ? "Use 2 to 300 plain-text characters to describe a wine, meal, region, or occasion."
    : "Use 1 to 200 characters to search the current catalog.";
}

function budgetLabel(intent: RecommendationIntent) {
  if (!intent.budget) return null;
  const { maximumCents, minimumCents } = intent.budget;
  const money = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      currency: "USD",
      maximumFractionDigits: 0,
      style: "currency",
    }).format(cents / 100);

  if (minimumCents !== null && maximumCents !== null) {
    return `${money(minimumCents)}–${money(maximumCents)}`;
  }
  if (maximumCents !== null) return `Up to ${money(maximumCents)}`;
  if (minimumCents !== null) return `At least ${money(minimumCents)}`;
  return null;
}

function IntentSummary({ response }: { response: RecommendationResponse }) {
  const { intent } = response;
  const style = [
    ...intent.categories,
    ...intent.varietals,
    ...intent.regions,
    ...intent.countries,
    ...intent.bodies.map((value) => `${value} body`),
    ...intent.acidities.map((value) => `${value} acidity`),
    ...intent.tannins.map((value) => `${value} tannin`),
    ...intent.sweetness,
    ...intent.excludedSweetness.map((value) => `not ${value}`),
  ];
  const rows = [
    ["Request", response.query],
    ["Style", style.join(", ")],
    ["Pairing", intent.pairings.join(", ")],
    ["Flavor", intent.flavors.join(", ")],
    ["Occasion", intent.occasions.join(", ")],
    ["Budget", budgetLabel(intent)],
    [
      "Personalization",
      response.personalization.status === "active"
        ? `${response.personalization.signalCount} owner-scoped signals active`
        : response.personalization.status.replace("_", " "),
    ],
    [
      "Catalog confidence",
      `${response.catalog.candidateCount} candidates from ${response.catalog.provider}`,
    ],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return (
    <section className="gv-intent-summary" aria-labelledby="parsed-intent-title">
      <div>
        <p className="gv-eyebrow">Controlled parser</p>
        <h2 id="parsed-intent-title">WHAT THE ENGINE UNDERSTOOD</h2>
      </div>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {intent.unparsedTerms.length > 0 ? (
        <p className="gv-intent-summary__unparsed">
          Not scored: {intent.unparsedTerms.join(", ")}. Unknown words remain
          visible but do not affect ordering.
        </p>
      ) : null}
      {intent.warnings.length > 0 ? (
        <div className="gv-intent-summary__warnings" role="note">
          <strong>Parser notes</strong>
          <ul>
            {intent.warnings.map((warning) => (
              <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ReadyRecommendationResults({
  query,
  userId,
}: {
  query: string;
  userId: number | null;
}) {
  const recommendationQuery = useQuery({
    queryFn: ({ signal }) =>
      getWineRecommendations(query, {
        limit: DEFAULT_RECOMMENDATION_LIMIT,
        signal,
      }),
    queryKey: recommendationQueryKey(
      query,
      DEFAULT_RECOMMENDATION_LIMIT,
      userId,
    ),
    staleTime: 60_000,
  });

  if (recommendationQuery.isPending) {
    return (
      <LoadingPanel
        description={`Parsing “${query}” and comparing only sourced catalog evidence.`}
        eyebrow="Explainable matching"
        title="READING THE REQUEST"
      />
    );
  }

  if (recommendationQuery.isError && !isAbortError(recommendationQuery.error)) {
    const providerFailure =
      recommendationQuery.error instanceof ApiError &&
      ["wine_service_timeout", "wine_service_unavailable"].includes(
        recommendationQuery.error.code,
      );
    return (
      <ErrorPanel
        action={
          <>
            <Button
              onClick={() => void recommendationQuery.refetch()}
              variant="secondary"
            >
              Try again
            </Button>
            {isNetworkFailure(recommendationQuery.error) ? (
              <ButtonLink to="/demo/cellar" variant="ghost">
                Open read-only demo
              </ButtonLink>
            ) : null}
          </>
        }
        description={errorDescription(recommendationQuery.error)}
        eyebrow={providerFailure ? "Provider failure" : "Recommendations unavailable"}
        title={
          isNetworkFailure(recommendationQuery.error)
            ? "THE GRAPEVYNE API IS OUT OF REACH"
            : providerFailure
              ? "THE CATALOG PROVIDER COULD NOT COMPLETE THIS MATCH"
              : "THE MATCHING ENGINE COULD NOT COMPLETE THIS REQUEST"
        }
      />
    );
  }

  const response = recommendationQuery.data;
  if (!response) return null;

  return (
    <div className="gv-recommendation-results">
      <p className="gv-assistive-status" role="status">
        {response.results.length === 0
          ? "No explainable recommendation matches are available."
          : `${response.results.length} explainable recommendation ${response.results.length === 1 ? "match is" : "matches are"} ready.`}
      </p>
      <IntentSummary response={response} />

      <aside className="gv-recommendation-disclosure" role="note">
        <div>
          <p className="gv-eyebrow">Personalization</p>
          <strong>{response.personalization.status.replace("_", " ")}</strong>
          <p>{response.personalization.disclosure}</p>
        </div>
        <div>
          <p className="gv-eyebrow">Limited catalog</p>
          <strong>{response.catalog.candidateCount} sourced candidates</strong>
          <p>{response.catalog.limitations}</p>
        </div>
      </aside>

      {response.results.length === 0 ? (
        <EmptyState
          description="No current candidate has enough sourced evidence for the strongest recognized clues. Broaden the request or switch to catalog browse; no substitute bottle has been invented."
          eyebrow="No meaningful match"
          title={`NO EXPLAINABLE MATCH FOR “${response.query}”`}
        />
      ) : (
        <section
          className="discover-results"
          aria-labelledby="recommendation-results-title"
        >
          <SectionHeading
            description={`${response.catalog.provider} catalog · ${response.personalization.status.replace("_", " ")}`}
            eyebrow="Deterministic ranking"
            id="recommendation-results-title"
            title={`${response.results.length} explainable match${response.results.length === 1 ? "" : "es"}`}
          />
          <div className="gv-recommendation-list">
            {response.results.map((result, index) => (
              <RecommendationResultCard
                index={index + 1}
                key={result.wine.externalWineId ?? `${result.wine.name}-${index}`}
                query={response.query}
                result={result}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RecommendationResults({ query }: { query: string }) {
  const { status, user } = useAuth();

  if (status === "loading") {
    return (
      <LoadingPanel
        description="Confirming whether this request should remain anonymous or use an identity-scoped recommendation cache."
        eyebrow="Session check"
        title="PREPARING PRIVATE CONTEXT"
      />
    );
  }

  if (status === "error") {
    return (
      <ErrorPanel
        description="Your session could not be verified, so GRAPEVYNE will not silently issue an anonymous request that might reuse the wrong cache context."
        eyebrow="Session unavailable"
        title="RECOMMENDATION CONTEXT COULD NOT BE VERIFIED"
      />
    );
  }

  return <ReadyRecommendationResults query={query} userId={user?.id ?? null} />;
}

function CatalogResults({ query }: { query: string }) {
  const [varietalFilter, setVarietalFilter] = useState(ALL_FILTERS);
  const [regionFilter, setRegionFilter] = useState(ALL_FILTERS);

  useEffect(() => {
    setVarietalFilter(ALL_FILTERS);
    setRegionFilter(ALL_FILTERS);
  }, [query]);

  const wineSearch = useQuery({
    queryFn: ({ signal }) => searchWines(query, signal),
    queryKey: ["public", "wine-search", query],
    staleTime: 5 * 60_000,
  });
  const results = wineSearch.data?.results ?? EMPTY_RESULTS;
  const varietals = useMemo(
    () => distinctValues(results, (wine) => wine.varietal),
    [results],
  );
  const regions = useMemo(
    () => distinctValues(results, (wine) => wine.region),
    [results],
  );
  const visibleWines = useMemo(
    () =>
      results.filter(
        (wine) =>
          (varietalFilter === ALL_FILTERS || wine.varietal === varietalFilter) &&
          (regionFilter === ALL_FILTERS || wine.region === regionFilter),
      ),
    [regionFilter, results, varietalFilter],
  );
  const hasActiveFilters =
    varietalFilter !== ALL_FILTERS || regionFilter !== ALL_FILTERS;
  const varietalOptions = useMemo(
    () => [
      { label: "All varietals", value: ALL_FILTERS },
      ...varietals.map((varietal) => ({ label: varietal, value: varietal })),
    ],
    [varietals],
  );
  const regionOptions = useMemo(
    () => [
      { label: "All regions", value: ALL_FILTERS },
      ...regions.map((region) => ({ label: region, value: region })),
    ],
    [regions],
  );

  function clearFilters() {
    setVarietalFilter(ALL_FILTERS);
    setRegionFilter(ALL_FILTERS);
  }

  if (wineSearch.isPending) {
    return (
      <LoadingPanel
        description={`Checking the current wine catalog for “${query}”.`}
        eyebrow="Searching"
        title="FOLLOWING THE VINE"
      />
    );
  }

  if (wineSearch.isError && !isAbortError(wineSearch.error)) {
    return (
      <ErrorPanel
        action={
          <>
            <Button onClick={() => void wineSearch.refetch()} variant="secondary">
              Try again
            </Button>
            {isNetworkFailure(wineSearch.error) ? (
              <ButtonLink to="/demo/cellar" variant="ghost">
                Open read-only demo
              </ButtonLink>
            ) : null}
          </>
        }
        description={errorDescription(wineSearch.error)}
        eyebrow="Search unavailable"
        title={
          isNetworkFailure(wineSearch.error)
            ? "THE GRAPEVYNE API IS OUT OF REACH"
            : "THE WINE SOURCE COULD NOT COMPLETE THAT SEARCH"
        }
      />
    );
  }

  if (wineSearch.data && results.length === 0) {
    return (
      <EmptyState
        description="Try a broader varietal, region, pairing, or occasion. The live result remains empty rather than being replaced with demo wines."
        eyebrow="No matches"
        title={`NO BOTTLE MATCHED “${wineSearch.data.query}”`}
      />
    );
  }

  if (!wineSearch.data) return null;
  const showFilterEmptyState = results.length > 0 && visibleWines.length === 0;

  return (
    <section className="discover-results" aria-labelledby="discover-results-title">
      <SectionHeading
        description={`Source: ${wineSearch.data.source}`}
        eyebrow="API results"
        id="discover-results-title"
        title={`${results.length} bottle${results.length === 1 ? "" : "s"} for “${wineSearch.data.query}”`}
      />

      <div aria-label="Filter wine results" className="discover-filters" role="group">
        <SelectControl
          id="discover-varietal-filter"
          label="Varietal"
          onChange={setVarietalFilter}
          options={varietalOptions}
          value={varietalFilter}
        />
        <SelectControl
          id="discover-region-filter"
          label="Region"
          onChange={setRegionFilter}
          options={regionOptions}
          value={regionFilter}
        />
        {hasActiveFilters ? (
          <Button onClick={clearFilters} size="compact" variant="text">
            <X aria-hidden="true" size={16} />
            Clear filters
          </Button>
        ) : null}
      </div>

      {showFilterEmptyState ? (
        <EmptyState
          action={
            <Button onClick={clearFilters} variant="secondary">
              Clear filters
            </Button>
          }
          description="Clear one or both filters to see the API results again."
          eyebrow="Filters narrowed too far"
          headingLevel="h3"
          title="NO CURRENT RESULT HAS THAT VARIETAL AND REGION TOGETHER"
        />
      ) : (
        <div className="wine-grid">
          {visibleWines.map((wine, index) => (
            <WineCard
              index={index + 1}
              key={
                wine.externalWineId ??
                wine.externalApiId ??
                wine.id ??
                `${wine.name}-${index}`
              }
              wine={wine}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const submittedQuery = searchParams.get("query")?.trim() ?? "";
  const mode: DiscoverMode =
    searchParams.get("mode") === "catalog" ? "catalog" : "recommendations";
  const [draftQuery, setDraftQuery] = useState(submittedQuery);
  const [validationMessage, setValidationMessage] = useState("");
  const submittedQueryIsValid = isValidQuery(mode, submittedQuery);

  useEffect(() => {
    setDraftQuery(submittedQuery);
    setValidationMessage("");
  }, [submittedQuery]);

  useEffect(() => {
    setValidationMessage("");
  }, [mode]);

  function updateLocation(nextMode: DiscoverMode, nextQuery = submittedQuery) {
    const params = new URLSearchParams();
    if (nextQuery) params.set("query", nextQuery);
    if (nextMode === "catalog") params.set("mode", "catalog");
    setSearchParams(params);
  }

  function submitQuery(value: string) {
    const nextQuery = value.trim();
    if (!isValidQuery(mode, nextQuery)) {
      setValidationMessage(queryValidationMessage(mode));
      return;
    }
    setValidationMessage("");
    updateLocation(mode, nextQuery);
  }

  return (
    <PageShell
      className="discover-page"
      description="Use deterministic explainable matching, or browse the current catalog directly with the same query field."
      eyebrow="01 / LIVE WINE DIRECTORY"
      heading={<DirectoryHeading {...DIRECTORY_PAGE_HEADINGS.discover} />}
    >
      <section className="discover-search-panel" aria-labelledby="discover-search-title">
        <div className="discover-search-panel__intro">
          <Sparkles aria-hidden="true" size={20} />
          <div>
            <h2 id="discover-search-title">BEGIN WITH A NATURAL-LANGUAGE CLUE</h2>
            <p>Try “a crisp white for oysters” or browse exact catalog text.</p>
          </div>
        </div>

        <div className="discover-mode-switch" role="group" aria-label="Discovery mode">
          <FilterChip
            active={mode === "recommendations"}
            onClick={() => updateLocation("recommendations")}
          >
            Explainable matches
          </FilterChip>
          <FilterChip
            active={mode === "catalog"}
            onClick={() => updateLocation("catalog")}
          >
            Catalog browse
          </FilterChip>
        </div>

        <NaturalLanguageSearch
          buttonLabel={mode === "recommendations" ? "Match" : "Search"}
          description={
            mode === "recommendations"
              ? "Controlled parser and visible scoring; no AI model or invented bottle."
              : "All query terms must occur in the current provider record."
          }
          error={validationMessage || undefined}
          id="wine-search"
          label="Search wines"
          maxLength={
            mode === "recommendations"
              ? MAX_RECOMMENDATION_QUERY_LENGTH
              : MAX_CATALOG_QUERY_LENGTH
          }
          onChange={(value) => {
            setDraftQuery(value);
            if (validationMessage) setValidationMessage("");
          }}
          onSubmit={() => submitQuery(draftQuery)}
          placeholder="A bold red under $60 for steak night"
          value={draftQuery}
        />

        <div aria-label="Suggested wine searches" className="suggestion-row" role="group">
          {suggestedSearches.map((suggestion) => (
            <FilterChip
              active={submittedQuery.toLowerCase() === suggestion.toLowerCase()}
              key={suggestion}
              onClick={() => {
                setDraftQuery(suggestion);
                submitQuery(suggestion);
              }}
            >
              {suggestion}
            </FilterChip>
          ))}
        </div>
      </section>

      {!submittedQuery && !validationMessage ? (
        <NoticePanel
          description="Recommendation mode ranks only the six sourced provider records and shows every scoring dimension. Catalog browse preserves the existing exact search contract."
          eyebrow="Choose a clue"
          title="FIND A BOTTLE WITH REASONS YOU CAN INSPECT"
        />
      ) : null}

      {submittedQuery && !submittedQueryIsValid ? (
        <ErrorPanel
          description={queryValidationMessage(mode)}
          eyebrow="Invalid request"
          title="THIS DISCOVERY QUERY CANNOT BE SENT"
        />
      ) : null}

      {submittedQueryIsValid ? (
        mode === "recommendations" ? (
          <RecommendationResults key="recommendations" query={submittedQuery} />
        ) : (
          <CatalogResults key="catalog" query={submittedQuery} />
        )
      ) : null}
    </PageShell>
  );
}
