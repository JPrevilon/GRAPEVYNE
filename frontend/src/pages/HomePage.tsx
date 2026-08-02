import { ArrowRight, BookOpen, Search, ShieldCheck, Wine } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { ButtonLink } from "@/components/ui/Button";
import { NaturalLanguageSearch } from "@/components/ui/FormControls";
import { PageShell, SectionHeading } from "@/components/ui/PageShell";
import { WineBottleFallback } from "@/components/wine/WineBottleFallback";

const journey = [
  {
    description:
      "Describe a meal, grape, region, or occasion. The browser asks the local Flask wine service for sourced fields.",
    icon: Search,
    label: "Discover",
    number: "01",
  },
  {
    description:
      "Open a shareable bottle profile and save it only after the authenticated cellar API confirms the request.",
    icon: Wine,
    label: "Cellar",
    number: "02",
  },
  {
    description:
      "Return to private ratings, occasions, and notes attached to your account—not a public demonstration.",
    icon: BookOpen,
    label: "Remember",
    number: "03",
  },
] as const;

export default function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");

  function beginSearch() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setSearchError("Describe a wine, meal, place, or occasion to begin.");
      return;
    }

    setSearchError("");
    navigate(`/discover?query=${encodeURIComponent(trimmedQuery)}`);
  }

  return (
    <PageShell className="gv-home">
      <section aria-labelledby="home-title" className="gv-home-hero">
        <div className="gv-home-hero__copy">
          <div className="gv-home-hero__monogram" aria-hidden="true">
            <img alt="" src="/assets/brand/grapevyne-monogram.svg" />
          </div>
          <p className="gv-eyebrow">From Vine to Memory</p>
          <h1 id="home-title">
            Find the bottle.
            <br />
            <em>Keep the memory.</em>
          </h1>
          <p className="gv-home-hero__lede">
            Discover wines for the meal, moment, or mood. Save every bottle worth
            remembering in a private cellar connected to your account.
          </p>

          <NaturalLanguageSearch
            buttonLabel="Discover"
            description="Search the current wine catalog by natural-language clues."
            error={searchError}
            id="home-wine-search"
            label="What is the bottle for?"
            onChange={(value) => {
              setQuery(value);
              if (searchError) setSearchError("");
            }}
            onSubmit={beginSearch}
            placeholder="A Cabernet for steak night"
            value={query}
          />

          <div className="gv-home-hero__actions">
            <ButtonLink to="/discover" variant="primary">
              Begin the tasting
              <ArrowRight aria-hidden="true" size={17} />
            </ButtonLink>
            <ButtonLink to="/demo/cellar" variant="ghost">
              Explore the demo cellar
            </ButtonLink>
          </div>
          <p className="gv-home-hero__privacy">
            <ShieldCheck aria-hidden="true" size={17} />
            Cellar entries and personal notes stay behind your signed Flask session.
          </p>
        </div>

        <div className="gv-home-stage">
          <span aria-hidden="true" className="gv-home-stage__orbit gv-home-stage__orbit--one" />
          <span aria-hidden="true" className="gv-home-stage__orbit gv-home-stage__orbit--two" />
          <WineBottleFallback label="From Vine to Memory" tone="red" />
          <div className="gv-home-stage__note gv-home-stage__note--top">
            <span>Discovery</span>
            <strong>Real service fields</strong>
          </div>
          <div className="gv-home-stage__note gv-home-stage__note--bottom">
            <span>Private cellar</span>
            <strong>Backend-confirmed saves</strong>
          </div>
        </div>
      </section>

      <section aria-labelledby="journey-title" className="gv-home-journey">
        <SectionHeading
          description="A polished product baseline today; the full cinematic scroll story remains a later phase."
          eyebrow="The product journey"
          id="journey-title"
          title="A clear path from question to collection."
        />
        <div className="gv-home-journey__grid">
          {journey.map(({ description, icon: Icon, label, number }) => (
            <article className="gv-journey-card" key={number}>
              <div>
                <span>{number}</span>
                <Icon aria-hidden="true" size={20} />
              </div>
              <h3>{label}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="home-finale-title" className="gv-home-finale">
        <img
          alt=""
          aria-hidden="true"
          src="/assets/brand/grapevyne-wordmark.svg"
        />
        <div>
          <p className="gv-eyebrow">Your first bottle starts here</p>
          <h2 id="home-finale-title">Search with a moment in mind.</h2>
          <p>
            Explore the current catalog now, or open the clearly labeled public
            demonstration before creating an account.
          </p>
        </div>
        <ButtonLink to="/discover" variant="secondary">
          Explore discovery
          <ArrowRight aria-hidden="true" size={17} />
        </ButtonLink>
      </section>
    </PageShell>
  );
}
