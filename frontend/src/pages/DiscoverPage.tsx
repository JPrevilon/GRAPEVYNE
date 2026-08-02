import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { searchWines } from "@/api/wines";
import { isNetworkFailure } from "@/api/client";
import { Button } from "@/components/ui/Button";
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
import type { Wine } from "@/types/domain";

const ALL_FILTERS = "all";
const EMPTY_RESULTS: Wine[] = [];
const suggestedSearches = ["steak", "salmon", "champagne", "Tuscany", "gift"];

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

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const submittedQuery = searchParams.get("query")?.trim() ?? "";
  const [draftQuery, setDraftQuery] = useState(submittedQuery);
  const [validationMessage, setValidationMessage] = useState("");
  const [varietalFilter, setVarietalFilter] = useState(ALL_FILTERS);
  const [regionFilter, setRegionFilter] = useState(ALL_FILTERS);

  useEffect(() => {
    setDraftQuery(submittedQuery);
    setValidationMessage("");
    setVarietalFilter(ALL_FILTERS);
    setRegionFilter(ALL_FILTERS);
  }, [submittedQuery]);

  const wineSearch = useQuery({
    enabled: submittedQuery.length > 0,
    queryFn: ({ signal }) => searchWines(submittedQuery, signal),
    queryKey: ["wine-search", submittedQuery],
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

  function submitQuery(value: string) {
    const nextQuery = value.trim();

    if (!nextQuery) {
      setValidationMessage(
        "Describe a wine, meal, region, or occasion before searching.",
      );
      return;
    }

    setValidationMessage("");
    setVarietalFilter(ALL_FILTERS);
    setRegionFilter(ALL_FILTERS);
    setSearchParams({ query: nextQuery });
  }

  function handleQueryChange(value: string) {
    setDraftQuery(value);

    if (validationMessage) {
      setValidationMessage("");
    }
  }

  function clearFilters() {
    setVarietalFilter(ALL_FILTERS);
    setRegionFilter(ALL_FILTERS);
  }

  const showInitialState = !submittedQuery && !validationMessage;
  const showLoadingState = Boolean(submittedQuery) && wineSearch.isPending;
  const showEmptyState = wineSearch.isSuccess && results.length === 0;
  const showFilterEmptyState =
    wineSearch.isSuccess && results.length > 0 && visibleWines.length === 0;
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

  return (
    <PageShell
      className="discover-page"
      description="Search the current GrapeVyne wine service by meal, mood, grape, place, or occasion."
      eyebrow="Discovery chamber"
      title="Tell us the moment. We’ll help find the bottle."
    >
      <section className="discover-search-panel" aria-labelledby="discover-search-title">
        <div className="discover-search-panel__intro">
          <Sparkles aria-hidden="true" size={20} />
          <div>
            <h2 id="discover-search-title">Begin with a natural-language clue</h2>
            <p>Try “Pinot Noir for salmon” or “a traditional bottle for a gift.”</p>
          </div>
        </div>

        <NaturalLanguageSearch
          buttonLabel="Search"
          error={validationMessage || undefined}
          id="wine-search"
          isBusy={wineSearch.isFetching}
          label="Search wines"
          onChange={handleQueryChange}
          onSubmit={() => submitQuery(draftQuery)}
          placeholder="A crisp wine for oysters"
          value={draftQuery}
        />

        <div
          aria-label="Suggested wine searches"
          className="suggestion-row"
          role="group"
        >
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

      {showInitialState ? (
        <NoticePanel
          description="Search is connected to the current wine API. No demonstration bottles will replace a missing or failed response."
          eyebrow="Start with a clue"
          title="Your next bottle can begin with a dish, place, or feeling."
        />
      ) : null}

      {showLoadingState ? (
        <LoadingPanel
          description={`Checking the current wine catalog for “${submittedQuery}”.`}
          eyebrow="Searching"
          title="Following the vine…"
        />
      ) : null}

      {wineSearch.isError ? (
        <ErrorPanel
          action={
            <Button
              onClick={() => void wineSearch.refetch()}
              variant="secondary"
            >
              Try again
            </Button>
          }
          description={errorDescription(wineSearch.error)}
          eyebrow="Search unavailable"
          title={
            isNetworkFailure(wineSearch.error)
              ? "The GrapeVyne API is out of reach."
              : "The wine source could not complete that search."
          }
        />
      ) : null}

      {showEmptyState ? (
        <EmptyState
          description="Try a broader varietal, region, pairing, or occasion. The live result remains empty rather than being replaced with demo wines."
          eyebrow="No matches"
          title={`No bottle matched “${wineSearch.data.query}”.`}
        />
      ) : null}

      {wineSearch.isSuccess && results.length > 0 ? (
        <section className="discover-results" aria-labelledby="discover-results-title">
          <SectionHeading
            description={`Source: ${wineSearch.data.source}`}
            eyebrow="API results"
            id="discover-results-title"
            title={`${results.length} bottle${results.length === 1 ? "" : "s"} for “${wineSearch.data.query}”`}
          />

          <div
            aria-label="Filter wine results"
            className="discover-filters"
            role="group"
          >
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
              title="No current result has that varietal and region together."
            />
          ) : (
            <div className="wine-grid">
              {visibleWines.map((wine, index) => (
                <WineCard
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
      ) : null}
    </PageShell>
  );
}
