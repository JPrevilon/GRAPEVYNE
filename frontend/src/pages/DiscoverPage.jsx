import { useEffect, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import PageHeader from "../components/ui/PageHeader.jsx";
import WineResultsGrid from "../features/wines/components/WineResultsGrid.jsx";
import { searchWines } from "../features/wines/wineApi.js";

const suggestedSearches = ["steak", "salmon", "champagne", "Tuscany", "gift"];

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("query") || "";
  const [query, setQuery] = useState(queryParam);
  const [results, setResults] = useState([]);
  const [searchedQuery, setSearchedQuery] = useState(queryParam);
  const [status, setStatus] = useState(queryParam ? "loading" : "idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setQuery(queryParam);

    if (!queryParam) {
      setResults([]);
      setSearchedQuery("");
      setStatus("idle");
      return;
    }

    let active = true;

    async function runSearch() {
      setStatus("loading");
      setErrorMessage("");

      try {
        const response = await searchWines(queryParam);

        if (!active) {
          return;
        }

        setResults(response.data.results);
        setSearchedQuery(response.data.query);
        setStatus("ready");
      } catch (error) {
        if (!active) {
          return;
        }

        setResults([]);
        setSearchedQuery(queryParam);
        setErrorMessage(error.message || "Wine search failed.");
        setStatus("error");
      }
    }

    runSearch();

    return () => {
      active = false;
    };
  }, [queryParam]);

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchParams({});
      return;
    }

    setSearchParams({ query: trimmedQuery });
  }

  function handleSuggestionClick(value) {
    setQuery(value);
    setSearchParams({ query: value });
  }

  return (
    <div className="content-stack">
      <PageHeader
        eyebrow="Discover"
        title="Find a bottle for the meal, moment, or mood."
        description="Search the GrapeVyne wine service by food pairing, varietal, region, or occasion."
      />

      <section className="discover-panel">
        <div className="discover-panel__copy">
          <Sparkles size={20} />
          <span>Curated search for dinners, gifts, celebrations, and cellar-worthy finds.</span>
        </div>
        <form className="discover-search" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="wine-search">
            Wine search
          </label>
          <div className="search-shell">
            <Search size={20} />
            <input
              id="wine-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by wine, varietal, region, or pairing"
              type="search"
              value={query}
            />
            <button className="primary-button" disabled={status === "loading"} type="submit">
              {status === "loading" ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        <div className="suggestion-row" aria-label="Suggested wine searches">
          {suggestedSearches.map((suggestion) => (
            <button
              className="suggestion-chip"
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              type="button"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {status === "idle" ? (
        <section className="state-panel state-panel--compact">
          <p className="eyebrow">Start with a clue</p>
          <h1>Tell GrapeVyne what the bottle is for.</h1>
          <p>
            Search for a dish, a place, a grape, or a moment. The result should
            feel useful before the cellar tools arrive.
          </p>
        </section>
      ) : null}

      {status === "loading" ? (
        <section className="state-panel state-panel--compact">
          <p className="eyebrow">Searching</p>
          <h1>Finding bottles with the right shape and mood.</h1>
          <p>Pairings, regions, and tasting notes are coming into focus.</p>
        </section>
      ) : null}

      {status === "error" ? (
        <section className="state-panel state-panel--compact">
          <p className="eyebrow">Search error</p>
          <h1>The wine service did not respond cleanly.</h1>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {status === "ready" ? (
        <WineResultsGrid query={searchedQuery} results={results} />
      ) : null}
    </div>
  );
}
