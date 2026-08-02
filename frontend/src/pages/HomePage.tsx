import {
  ArrowRight,
  Check,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import BrandLockup from "@/components/brand/BrandLockup";
import ChapterProgress from "@/components/navigation/ChapterProgress";
import DirectoryHeading from "@/components/typography/DirectoryHeading";
import { ButtonLink } from "@/components/ui/Button";
import { NaturalLanguageSearch } from "@/components/ui/FormControls";
import { WineBottleFallback } from "@/components/wine/WineBottleFallback";
import CinematicVideo from "@/experience/CinematicVideo";
import type { MediaKey } from "@/experience/media";
import {
  STORY_CHAPTERS,
  type StoryChapter,
  type StoryChapterDefinition,
} from "@/experience/storyChapters";
import WebGLExperience from "@/experience/webgl/WebGLExperience";
import { useAuth } from "@/features/auth/useAuth";
import { useScrollStory } from "@/hooks/useScrollStory";
import "@/styles/scroll-story.css";

const discoveryPrompts = [
  "Bold red for steak night",
  "Crisp white for oysters",
  "Celebration bottle",
  "Gift under $75",
  "Something new",
] as const;

const matchDimensions = [
  "Pairing fit",
  "Requested style",
  "Budget fit",
  "Occasion fit",
  "Source-data confidence",
  "Personal taste fit after you have rated bottles",
] as const;

const cellarCapabilities = [
  "Recently added",
  "Favorites",
  "Highly rated",
  "Dinner pairings",
  "Celebrations",
  "Wishlist",
  "Buy again",
  "Private tasting notes",
] as const;

const tasteSignals = ["Bright", "Silky", "Mineral", "Savory", "Cellar-worthy"] as const;

function discoverHref(query: string) {
  return `/discover?query=${encodeURIComponent(query)}`;
}

function ChapterHeading({ chapter }: { chapter: StoryChapterDefinition }) {
  const headingId = `${chapter.anchorId}-title`;

  return (
    <header className="gv-story-heading" data-story-reveal>
      <p className="gv-story-heading__number">
        <span>{chapter.number}</span>
        <span aria-hidden="true"> / </span>
        <span>{chapter.navLabel}</span>
      </p>
      <DirectoryHeading
        ariaLabel={chapter.title}
        as={chapter.key === "hero" ? "h1" : "h2"}
        id={headingId}
        scale={chapter.key === "hero" ? "hero" : "chapter"}
        segments={chapter.headingSegments}
      />
    </header>
  );
}

function StorySearch({ id, label }: { id: string; label: string }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  function submit() {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Describe a wine, meal, mood, or occasion to begin.");
      return;
    }

    setError("");
    navigate(discoverHref(trimmedQuery));
  }

  return (
    <NaturalLanguageSearch
      buttonLabel="Discover"
      description="Search the current wine catalog with natural-language clues."
      error={error}
      id={id}
      label={label}
      onChange={(value) => {
        setQuery(value);
        if (error) setError("");
      }}
      onSubmit={submit}
      placeholder="A Cabernet for steak night"
      value={query}
    />
  );
}

function AuthCellarAction({ finale = false }: { finale?: boolean }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <span aria-live="polite" className="gv-story-auth-status">
        Checking cellar access…
      </span>
    );
  }

  return isAuthenticated ? (
    <ButtonLink to="/cellar" variant={finale ? "primary" : "secondary"}>
      Open my cellar
      <ArrowRight aria-hidden="true" size={17} />
    </ButtonLink>
  ) : (
    <ButtonLink to="/signup" variant={finale ? "primary" : "secondary"}>
      {finale ? "Create your cellar" : "Create my cellar"}
      <ArrowRight aria-hidden="true" size={17} />
    </ButtonLink>
  );
}

function ChapterMedia({ mediaKey }: { mediaKey: MediaKey }) {
  return (
    <div className="gv-story-media" aria-hidden="true">
      {mediaKey === "hero" ? (
        <CinematicVideo
          className="gv-story-media__visual"
          mediaKey="hero"
          priority
        />
      ) : (
        <CinematicVideo
          className="gv-story-media__visual"
          mediaKey={mediaKey}
        />
      )}
    </div>
  );
}

function HeroChapter() {
  return (
    <>
      <div className="gv-hero-bottle" aria-hidden="true">
        <WineBottleFallback label="From Vine to Memory" tone="red" />
      </div>
      <div className="gv-story-copy gv-story-copy--hero">
        <BrandLockup className="gv-story-brand" />
        <p className="gv-story-lede">
          Discover wines for the meal, moment, or mood. Save every bottle worth
          remembering in a private cellar.
        </p>
        <StorySearch id="hero-wine-search" label="What is the bottle for?" />
        <div className="gv-story-actions">
          <ButtonLink to="/discover" variant="primary">
            Begin the tasting
            <ArrowRight aria-hidden="true" size={17} />
          </ButtonLink>
          <ButtonLink to="/demo/cellar" variant="ghost">
            Explore the demo cellar
          </ButtonLink>
        </div>
        <p className="gv-story-privacy">
          <ShieldCheck aria-hidden="true" size={17} />
          Personal cellar entries and notes stay behind your signed Flask session.
        </p>
      </div>
    </>
  );
}

function DiscoveryChapter() {
  return (
    <div className="gv-story-copy gv-story-copy--wide">
      <p className="gv-story-lede">
        Start with a meal, grape, region, price, or occasion. GRAPEVYNE sends that
        description to the current discovery service and takes you to real results.
      </p>
      <StorySearch id="discovery-wine-search" label="Describe the moment" />
      <div aria-label="Example discovery searches" className="gv-story-chips">
        {discoveryPrompts.map((prompt) => (
          <a href={discoverHref(prompt)} key={prompt}>
            {prompt}
            <ArrowRight aria-hidden="true" size={14} />
          </a>
        ))}
      </div>
      <p className="gv-story-disclosure">
        These examples are search shortcuts, not wine results or availability claims.
      </p>
    </div>
  );
}

function MatchChapter() {
  return (
    <div className="gv-story-copy gv-story-copy--split">
      <div>
        <p className="gv-story-kicker">Demonstration of match reasoning</p>
        <p className="gv-story-lede">
          Why a bottle fits should be as clear as the recommendation itself.
        </p>
        <p>
          This preview explains the dimensions a future recommendation may use. It is
          not a score, recommendation, or profile for the current visitor.
        </p>
        <p className="gv-story-disclosure">
          Personal taste matching begins after you save and rate bottles.
        </p>
      </div>
      <ul className="gv-match-signals">
        {matchDimensions.map((dimension) => (
          <li key={dimension}>
            <span aria-hidden="true" />
            {dimension}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TasteChapter() {
  return (
    <div className="gv-story-copy gv-story-copy--taste">
      <p className="gv-story-lede">
        Your Taste Atlas begins with bottles you actually save and rate. Over time,
        patterns can make a growing collection easier to understand.
      </p>
      <div aria-label="Illustrative taste vocabulary" className="gv-taste-orbit">
        {tasteSignals.map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>
      <p className="gv-story-disclosure">
        Illustrative vocabulary only—not a personal profile or calculated result.
      </p>
    </div>
  );
}

function PortalChapter() {
  return (
    <div className="gv-story-copy gv-story-copy--portal">
      <p className="gv-story-lede">
        Keep saved bottles, ratings, occasions, favorites, and private notes tied to
        your account—not to this marketing page.
      </p>
      <div className="gv-story-actions">
        <AuthCellarAction />
        <ButtonLink to="/demo/cellar" variant="ghost">
          Explore the demo cellar
        </ButtonLink>
      </div>
      <p className="gv-story-privacy">
        <LockKeyhole aria-hidden="true" size={17} />
        The real cellar remains a protected route.
      </p>
    </div>
  );
}

function CellarChapter() {
  return (
    <div className="gv-story-copy gv-story-copy--wide">
      <p className="gv-story-lede">
        Build a collection on the protected cellar route, where every edit is
        confirmed by the owner-scoped API.
      </p>
      <ul className="gv-cellar-capabilities">
        {cellarCapabilities.map((capability) => (
          <li key={capability}>
            <Check aria-hidden="true" size={17} />
            {capability}
          </li>
        ))}
      </ul>
      <div className="gv-story-actions">
        <AuthCellarAction />
        <ButtonLink to="/demo/cellar" variant="ghost">
          See a read-only demonstration
        </ButtonLink>
      </div>
      <p className="gv-story-disclosure">
        Saving, editing, rating, favoriting, and deleting happen only in the real
        authenticated product experience.
      </p>
    </div>
  );
}

function MemoryChapter() {
  return (
    <div className="gv-story-copy gv-story-copy--memory">
      <article className="gv-memory-card" aria-labelledby="demo-memory-title">
        <p className="gv-story-kicker">Demonstration tasting memory</p>
        <h3 id="demo-memory-title">CELEBRATION DINNER</h3>
        <p>Blackberry and cedar opened after twenty minutes.</p>
        <dl>
          <div>
            <dt>Rating</dt>
            <dd>4 out of 5</dd>
          </div>
          <div>
            <dt>Favorite</dt>
            <dd>Yes</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Tasted</dd>
          </div>
        </dl>
        <p className="gv-story-disclosure">
          Fictional example—not connected to the current visitor or an account.
        </p>
      </article>
    </div>
  );
}

function AtlasChapter() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="gv-story-copy gv-story-copy--atlas">
      <p className="gv-story-lede">
        Your taste is not a score. It is a story that becomes clearer with every
        bottle.
      </p>
      <div
        aria-label="Demonstration of future taste preference clusters"
        className="gv-atlas-demo"
        role="group"
      >
        <span>Fresh &amp; mineral</span>
        <span>Silky reds</span>
        <span>Curious pours</span>
      </div>
      <p className="gv-story-disclosure">
        Demonstration only. These clusters show how an early profile may appear after
        enough real cellar activity exists. The personalized engine is not implemented
        yet.
      </p>
      <div className="gv-story-actions">
        <ButtonLink to="/demo/taste-atlas" variant="secondary">
          Explore the demo Taste Atlas
        </ButtonLink>
        {!isLoading && isAuthenticated ? (
          <ButtonLink to="/profile" variant="ghost">
            View my profile
          </ButtonLink>
        ) : null}
      </div>
    </div>
  );
}

function FinaleChapter() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="gv-story-copy gv-story-copy--finale">
      <BrandLockup className="gv-story-wordmark" />
      <p className="gv-story-lede">
        Search with a moment in mind, then keep the bottles that deserve another pour.
      </p>
      <div className="gv-story-actions gv-story-actions--finale">
        <AuthCellarAction finale />
        <ButtonLink to="/demo/cellar" variant="secondary">
          Explore the demo
        </ButtonLink>
        {!isLoading && !isAuthenticated ? (
          <ButtonLink to="/login" variant="ghost">
            Sign in
          </ButtonLink>
        ) : null}
        <a
          className="gv-button gv-button--ghost"
          href="https://github.com/JPrevilon/GRAPEVYNE"
          rel="noopener noreferrer"
          target="_blank"
        >
          <span>
            View source
            <ExternalLink aria-hidden="true" size={16} />
          </span>
        </a>
      </div>
      <details className="gv-under-cork">
        <summary>Under the Cork</summary>
        <div>
          <p>
            The current product uses React, TypeScript, Vite, Flask, PostgreSQL,
            Flask session authentication, React Query, and owner-scoped cellar CRUD.
          </p>
          <p>
            This homepage adds GSAP and Lenis choreography with reduced-motion,
            accessible navigation, responsive final media, and a persistent React Three
            Fiber WebGL bottle built from local desktop and mobile GLB models. Capability
            checks and reduced-motion preferences retain the CSS bottle fallback when
            needed. A recommendation engine and personalized Taste Atlas remain future work.
          </p>
        </div>
      </details>
    </div>
  );
}

const chapterBodies: Record<StoryChapter, () => ReactNode> = {
  atlas: AtlasChapter,
  cellar: CellarChapter,
  discovery: DiscoveryChapter,
  finale: FinaleChapter,
  hero: HeroChapter,
  match: MatchChapter,
  memory: MemoryChapter,
  portal: PortalChapter,
  taste: TasteChapter,
};

const pinnedChapters = new Set<StoryChapter>([
  "hero",
  "match",
  "portal",
  "memory",
  "atlas",
]);

const chapterMedia: Partial<Record<StoryChapter, MediaKey>> = {
  atlas: "atlas",
  hero: "hero",
  memory: "memory",
  portal: "cellar",
  taste: "liquid",
};

export default function HomePage() {
  const storyRef = useRef<HTMLDivElement>(null);
  const [webglReady, setWebglReady] = useState(false);
  useScrollStory(storyRef);

  return (
    <div
      className={`gv-story${webglReady ? " gv-story--webgl-ready" : ""}`}
      ref={storyRef}
    >
      <ChapterProgress />
      <WebGLExperience onReadyChange={setWebglReady} />
      {STORY_CHAPTERS.map((chapter) => {
        const ChapterBody = chapterBodies[chapter.key];
        const mediaKey = chapterMedia[chapter.key];

        return (
          <section
            aria-labelledby={`${chapter.anchorId}-title`}
            className={`gv-story-chapter gv-story-chapter--${chapter.key}`}
            data-story-chapter={chapter.key}
            data-story-pin={pinnedChapters.has(chapter.key) || undefined}
            id={chapter.anchorId}
            key={chapter.key}
          >
            {mediaKey ? <ChapterMedia mediaKey={mediaKey} /> : null}
            <div className="gv-story-chapter__inner">
              <ChapterHeading chapter={chapter} />
              <ChapterBody />
            </div>
          </section>
        );
      })}
    </div>
  );
}
