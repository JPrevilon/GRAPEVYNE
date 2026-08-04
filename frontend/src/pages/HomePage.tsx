import { ArrowRight, Rotate3D, Search } from "lucide-react";
import {
  lazy,
  Suspense,
  type MouseEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

import ChapterProgress from "@/components/navigation/ChapterProgress";
import DirectoryHeading from "@/components/typography/DirectoryHeading";
import { WineBottleFallback } from "@/components/wine/WineBottleFallback";
import StoryMediaStack from "@/experience/StoryMediaStack";
import { CINEMATIC_MEDIA } from "@/experience/media";
import {
  STORY_CHAPTERS,
  STORY_SUBJECTS,
  type StoryChapter,
  type StoryChapterDefinition,
} from "@/experience/storyChapters";
import { getNextStoryChapter } from "@/experience/storySubject";
import { useScene } from "@/experience/useScene";
import WebGLExperience from "@/experience/webgl/WebGLExperience";
import { STORY_SUBJECT_FALLBACK_PATHS } from "@/experience/webgl/modelAssets";
import { useAuth } from "@/features/auth/useAuth";
import { useScrollStory } from "@/hooks/useScrollStory";
import { useStoryStaticMode } from "@/hooks/useStoryStaticMode";
import "@/styles/scroll-story.css";

const LazyBottleInspectorModal = lazy(
  () => import("@/experience/webgl/BottleInspectorModal"),
);

function discoverHref(query: string) {
  return `/discover?query=${encodeURIComponent(query)}`;
}

function ChapterHeading({ chapter }: { chapter: StoryChapterDefinition }) {
  return (
    <header className="gv-story-heading">
      <p className="gv-story-heading__number">
        <span>{chapter.number}</span>
        <span aria-hidden="true"> / </span>
        <span>{chapter.navLabel}</span>
      </p>
      <DirectoryHeading
        ariaLabel={chapter.title}
        as={chapter.key === "hero" ? "h1" : "h2"}
        id={`${chapter.anchorId}-title`}
        scale={chapter.key === "hero" ? "hero" : "chapter"}
        segments={chapter.headingSegments}
      />
    </header>
  );
}

function StorySearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="gv-story-search"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) {
          setError("Describe a wine, meal, mood, or occasion to begin.");
          return;
        }
        setError("");
        navigate(discoverHref(trimmed));
      }}
    >
      <label className="gv-visually-hidden" htmlFor="story-wine-search">
        Describe the moment
      </label>
      <div className="gv-story-search__control">
        <Search aria-hidden="true" size={17} />
        <input
          aria-describedby={error ? "story-wine-search-error" : undefined}
          id="story-wine-search"
          onChange={(event) => {
            setQuery(event.target.value);
            if (error) setError("");
          }}
          placeholder="A Cabernet for steak night"
          type="search"
          value={query}
        />
        <button type="submit">SEARCH WINES</button>
      </div>
      {error ? (
        <p className="gv-story-search__error" id="story-wine-search-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function AuthCellarAction() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <span aria-live="polite" className="gv-story-auth-status">
        Checking cellar access…
      </span>
    );
  }

  return (
    <Link className="gv-story-action gv-story-action--primary" to={isAuthenticated ? "/cellar" : "/signup"}>
      {isAuthenticated ? "OPEN CELLAR" : "CREATE CELLAR"}
      <ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

function HeroActions({
  onInspect,
}: {
  onInspect: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="gv-story-actions">
      <Link className="gv-story-action gv-story-action--primary" to="/discover">
        DISCOVER
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
      <button className="gv-story-action gv-story-action--quiet" onClick={onInspect} type="button">
        <Rotate3D aria-hidden="true" size={16} />
        INSPECT BOTTLE
      </button>
    </div>
  );
}

function ChapterBody({
  chapter,
  onInspect,
}: {
  chapter: StoryChapter;
  onInspect: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  switch (chapter) {
    case "hero":
      return <HeroActions onInspect={onInspect} />;
    case "discovery":
      return <StorySearch />;
    case "portal":
      return <AuthCellarAction />;
    case "atlas":
      return (
        <Link className="gv-story-action gv-story-action--quiet" to="/profile">
          VIEW TASTE PROFILE
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      );
    case "finale":
      return (
        <div className="gv-story-finale-actions">
          <Link className="gv-story-action gv-story-action--primary" to="/discover">
            DISCOVER
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
          <details className="gv-under-cork">
            <summary>Under the Cork</summary>
            <p>
              Local scroll-scrubbed film, conditional WebGL subjects, exact label artwork,
              and the existing same-origin Flask product—without exposing private cellar data.
            </p>
          </details>
        </div>
      );
    case "match":
    case "taste":
    case "cellar":
    case "memory":
      return null;
  }
}

function StaticChapterVisual({ chapter }: { chapter: StoryChapterDefinition }) {
  const media = CINEMATIC_MEDIA[chapter.mediaKey];

  return (
    <div aria-hidden="true" className="gv-story-static-visual">
      <picture>
        <source media="(max-width: 720px)" srcSet={media.mobile.poster} />
        <img
          alt=""
          decoding="async"
          loading={chapter.key === "hero" ? "eager" : "lazy"}
          src={media.desktop.poster}
        />
      </picture>
      {chapter.subject === "bottle" ? (
        <div className="gv-story-static-subject gv-story-static-subject--bottle">
          <WineBottleFallback label="From Vine to Memory" tone="red" />
        </div>
      ) : chapter.subject === "grapes" ? (
        <img
          alt=""
          className="gv-story-static-subject gv-story-static-subject--grapes"
          src={STORY_SUBJECT_FALLBACK_PATHS.grapes}
        />
      ) : null}
    </div>
  );
}

function StoryFallbackSubjects({
  currentChapter,
  hidden,
}: {
  currentChapter: StoryChapter;
  hidden: boolean;
}) {
  const nextChapter = getNextStoryChapter(currentChapter);
  const bottleTarget =
    STORY_SUBJECTS[currentChapter] === "bottle"
      ? currentChapter
      : STORY_SUBJECTS[nextChapter] === "bottle"
        ? nextChapter
        : currentChapter;

  return (
    <div
      aria-hidden="true"
      className={`gv-story-fallback-subjects${hidden ? " is-webgl-ready" : ""}`}
      data-story-fallback-subjects
    >
      <div
        className="gv-story-fallback-subject gv-story-fallback-subject--bottle"
        data-subject-chapter={bottleTarget}
      >
        <WineBottleFallback label="From Vine to Memory" tone="red" />
      </div>
      <img
        alt=""
        className="gv-story-fallback-subject gv-story-fallback-subject--grapes"
        data-subject-chapter="discovery"
        src={STORY_SUBJECT_FALLBACK_PATHS.grapes}
      />
    </div>
  );
}

export default function HomePage() {
  const storyRef = useRef<HTMLDivElement>(null);
  const inspectButtonRef = useRef<HTMLButtonElement | null>(null);
  const [webglReady, setWebglReady] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const { currentChapterId } = useScene();
  const { reason: staticReason, staticMode } = useStoryStaticMode();
  const handleInspect = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    inspectButtonRef.current = event.currentTarget;
    setInspectorOpen(true);
  }, []);
  const handleInspectorClose = useCallback(() => {
    setInspectorOpen(false);
  }, []);
  useScrollStory(storyRef);

  return (
    <div
      className={`gv-story${webglReady ? " gv-story--webgl-ready" : ""}${staticMode ? " gv-story--static" : ""}`}
      data-story-mode={staticReason ?? "scrub"}
      ref={storyRef}
    >
      {!staticMode ? (
        <div aria-hidden="true" className="gv-story-stage" data-story-stage>
          <StoryMediaStack />
          <StoryFallbackSubjects currentChapter={currentChapterId} hidden={webglReady} />
          <WebGLExperience onReadyChange={setWebglReady} />
          <div className="gv-story-stage__grain" />
        </div>
      ) : null}

      <ChapterProgress />

      <div className="gv-story-track" data-story-track>
        {STORY_CHAPTERS.map((chapter) => (
          <section
            aria-labelledby={`${chapter.anchorId}-title`}
            className={`gv-story-chapter gv-story-chapter--${chapter.key}${currentChapterId === chapter.key ? " is-active" : ""}`}
            data-story-chapter={chapter.key}
            id={chapter.anchorId}
            key={chapter.key}
          >
            <div className="gv-story-chapter__panel">
              {staticMode ? <StaticChapterVisual chapter={chapter} /> : null}
              <div className="gv-story-chapter__content">
                <ChapterHeading chapter={chapter} />
                <p className="gv-story-supporting-line">{chapter.supportingLine}</p>
                <ChapterBody
                  chapter={chapter.key}
                  onInspect={handleInspect}
                />
              </div>
            </div>
          </section>
        ))}
      </div>

      {inspectorOpen ? (
        <Suspense fallback={<span className="gv-visually-hidden">Loading bottle viewer…</span>}>
          <LazyBottleInspectorModal
            onClose={handleInspectorClose}
            returnFocus={inspectButtonRef.current}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
