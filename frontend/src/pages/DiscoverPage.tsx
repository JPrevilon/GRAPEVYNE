import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { isAbortError, isNetworkFailure } from "@/api/client";
import { searchWines } from "@/api/wines";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  FilterChip,
  NaturalLanguageSearch,
  SelectControl,
} from "@/components/ui/FormControls";
import { PageShell, SectionHeading } from "@/components/ui/PageShell";
import DirectoryHeading from "@/components/typography/DirectoryHeading";
import { DIRECTORY_PAGE_HEADINGS } from "@/components/typography/directoryHeadingPresets";
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
    queryKey: ["public", "wine-search", submittedQuery],
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
      eyebrow="01 / LIVE WINE DIRECTORY"
      heading={<DirectoryHeading {...DIRECTORY_PAGE_HEADINGS.discover} />}
    >
      <section className="discover-search-panel" aria-labelledby="discover-search-title">
        <div className="discover-search-panel__intro">
          <Sparkles aria-hidden="true" size={20} />
          <div>
            <h2 id="discover-search-title">BEGIN WITH A NATURAL-LANGUAGE CLUE</h2>
            <p>Try “Pinot Noir for salmon” or “a traditional bottle for a gift.”</p>
          </div>
        </div>

        <NaturalLanguageSearch
          buttonLabel="Search"
          error={validationMessage || undefined}
          id="wine-search"
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
          title="YOUR NEXT BOTTLE CAN BEGIN WITH A DISH, PLACE, OR FEELING"
        />
      ) : null}

      {showLoadingState ? (
        <LoadingPanel
          description={`Checking the current wine catalog for “${submittedQuery}”.`}
          eyebrow="Searching"
          title="FOLLOWING THE VINE"
        />
      ) : null}

      {wineSearch.isError && !isAbortError(wineSearch.error) ? (
        <ErrorPanel
          action={
            <>
              <Button
                onClick={() => void wineSearch.refetch()}
                variant="secondary"
              >
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
      ) : null}

      {showEmptyState ? (
        <EmptyState
          description="Try a broader varietal, region, pairing, or occasion. The live result remains empty rather than being replaced with demo wines."
          eyebrow="No matches"
          title={`NO BOTTLE MATCHED “${wineSearch.data.query}”`}
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
      ) : null}
    </PageShell>
  );
}
