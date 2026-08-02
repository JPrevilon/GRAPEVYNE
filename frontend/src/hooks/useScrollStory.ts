import { type RefObject, useEffect } from "react";

import {
  STORY_CHAPTER_KEYS,
  type StoryChapter,
} from "@/experience/storyChapters";
import { useScene } from "@/experience/useScene";

const CHAPTER_SELECTOR = "[data-story-chapter]";
const DESKTOP_QUERY = "(min-width: 1025px)";
const MOBILE_QUERY = "(max-width: 1024px)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";
const STORY_CLASS = "has-scroll-story";
const SMOOTHING_CLASS = "has-scroll-smoothing";
const STORY_PROGRESS_PROPERTY = "--story-progress";
const CHAPTER_PROGRESS_PROPERTY = "--chapter-progress";

const STORY_CHAPTER_SET = new Set<string>(STORY_CHAPTER_KEYS);

type Cleanup = () => void;

interface StorySection {
  chapter: StoryChapter;
  element: HTMLElement;
}

interface StylePropertySnapshot {
  priority: string;
  value: string;
}

export async function loadScrollRuntimeDependencies() {
  const [gsapModule, scrollTriggerModule, lenisModule] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
    import("lenis"),
  ]);

  return {
    gsap: gsapModule.gsap,
    Lenis: lenisModule.default,
    ScrollTrigger: scrollTriggerModule.ScrollTrigger,
  };
}

export type ScrollRuntimeLoader = typeof loadScrollRuntimeDependencies;

function noop() {}

function once(cleanup: Cleanup): Cleanup {
  let cleaned = false;

  return () => {
    if (cleaned) return;
    cleaned = true;
    cleanup();
  };
}

function clampProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function formatProgress(value: number) {
  return String(Math.round(clampProgress(value) * 10_000) / 10_000);
}

function isStoryChapter(value: string | undefined): value is StoryChapter {
  return typeof value === "string" && STORY_CHAPTER_SET.has(value);
}

function getStorySections(root: HTMLElement) {
  const sections: StorySection[] = [];

  root.querySelectorAll<HTMLElement>(CHAPTER_SELECTOR).forEach((element) => {
    const chapter = element.dataset.storyChapter;

    if (isStoryChapter(chapter)) {
      sections.push({ chapter, element });
    }
  });

  return sections;
}

function snapshotStyleProperty(
  element: HTMLElement,
  property: string,
): StylePropertySnapshot {
  return {
    priority: element.style.getPropertyPriority(property),
    value: element.style.getPropertyValue(property),
  };
}

function restoreStyleProperty(
  element: HTMLElement,
  property: string,
  snapshot: StylePropertySnapshot,
) {
  if (snapshot.value) {
    element.style.setProperty(property, snapshot.value, snapshot.priority);
    return;
  }

  element.style.removeProperty(property);
}

function findActiveSection(sections: readonly StorySection[]) {
  if (sections.length === 0) return undefined;

  const viewportCenter = (window.innerHeight || 1) / 2;
  let nearest = sections[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  sections.forEach((section) => {
    const bounds = section.element.getBoundingClientRect();
    const distance =
      viewportCenter < bounds.top
        ? bounds.top - viewportCenter
        : viewportCenter > bounds.bottom
          ? viewportCenter - bounds.bottom
          : 0;

    if (distance < nearestDistance) {
      nearest = section;
      nearestDistance = distance;
    }
  });

  return nearest;
}

/**
 * Connects the semantic Home story to native or enhanced scroll behavior.
 * Heavy animation modules are requested only after a fine-pointer desktop is
 * confirmed, keeping reduced-motion and touch layouts in normal document flow.
 */
export function useScrollStory(
  rootRef: RefObject<HTMLElement>,
  loadRuntime: ScrollRuntimeLoader = loadScrollRuntimeDependencies,
) {
  const {
    prefersReducedMotion,
    setCurrentChapterId,
    setHomepageActive,
  } = useScene();

  useEffect(() => {
    const root = rootRef.current;

    if (!root) return undefined;

    const sections = getStorySections(root);
    const documentElement = document.documentElement;
    const hadStoryClass = documentElement.classList.contains(STORY_CLASS);
    const hadSmoothingClass =
      documentElement.classList.contains(SMOOTHING_CLASS);
    const storyProgressSnapshot = snapshotStyleProperty(
      root,
      STORY_PROGRESS_PROPERTY,
    );
    const chapterProgressSnapshot = snapshotStyleProperty(
      root,
      CHAPTER_PROGRESS_PROPERTY,
    );
    const mobileQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia(MOBILE_QUERY)
        : undefined;
    const coarsePointerQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia(COARSE_POINTER_QUERY)
        : undefined;

    let activeChapter: StoryChapter | undefined;
    let disposed = false;
    let runtimeGeneration = 0;
    let stopRuntime: Cleanup = noop;

    const setStoryProgress = (progress: number) => {
      root.style.setProperty(
        STORY_PROGRESS_PROPERTY,
        formatProgress(progress),
      );
    };

    const setChapterProgress = (progress: number) => {
      root.style.setProperty(
        CHAPTER_PROGRESS_PROPERTY,
        formatProgress(progress),
      );
    };

    const setSmoothingActive = (active: boolean) => {
      if (active) {
        documentElement.classList.add(SMOOTHING_CLASS);
      } else if (!hadSmoothingClass) {
        documentElement.classList.remove(SMOOTHING_CLASS);
      }
    };

    const activateChapter = (chapter: StoryChapter) => {
      if (activeChapter === chapter || disposed) return;
      activeChapter = chapter;
      setCurrentChapterId(chapter);
    };

    const syncNativeMetrics = (preferredSection?: StorySection) => {
      const activeSection = preferredSection ?? findActiveSection(sections);
      const viewportHeight = window.innerHeight || 1;
      const rootBounds = root.getBoundingClientRect();
      const storyDistance = Math.max(rootBounds.height - viewportHeight, 1);

      setStoryProgress(-rootBounds.top / storyDistance);

      if (!activeSection) {
        setChapterProgress(0);
        return;
      }

      activateChapter(activeSection.chapter);

      const chapterBounds = activeSection.element.getBoundingClientRect();
      const chapterHeight = Math.max(chapterBounds.height, 1);
      setChapterProgress(
        (viewportHeight / 2 - chapterBounds.top) / chapterHeight,
      );
    };

    const startNativeRuntime = (): Cleanup => {
      let animationFrame: number | undefined;
      let stopped = false;

      const updateMetrics = () => {
        animationFrame = undefined;
        if (!stopped) syncNativeMetrics();
      };

      const scheduleMetricsUpdate = () => {
        if (stopped || animationFrame !== undefined) return;
        animationFrame = window.requestAnimationFrame(updateMetrics);
      };

      const observer =
        typeof window.IntersectionObserver === "function"
          ? new window.IntersectionObserver(
              (entries) => {
                const viewportCenter = (window.innerHeight || 1) / 2;
                let nearestEntry: IntersectionObserverEntry | undefined;
                let nearestDistance = Number.POSITIVE_INFINITY;

                entries.forEach((entry) => {
                  if (!entry.isIntersecting) return;

                  const entryCenter =
                    entry.boundingClientRect.top +
                    entry.boundingClientRect.height / 2;
                  const distance = Math.abs(entryCenter - viewportCenter);

                  if (distance < nearestDistance) {
                    nearestEntry = entry;
                    nearestDistance = distance;
                  }
                });

                const observedSection = nearestEntry
                  ? sections.find(
                      ({ element }) => element === nearestEntry?.target,
                    )
                  : undefined;

                if (observedSection) {
                  syncNativeMetrics(observedSection);
                } else {
                  scheduleMetricsUpdate();
                }
              },
              {
                root: null,
                rootMargin: "-45% 0px -45% 0px",
                threshold: 0,
              },
            )
          : undefined;

      sections.forEach(({ element }) => observer?.observe(element));
      window.addEventListener("scroll", scheduleMetricsUpdate, {
        passive: true,
      });
      window.addEventListener("resize", scheduleMetricsUpdate);
      syncNativeMetrics();

      return once(() => {
        stopped = true;
        observer?.disconnect();
        window.removeEventListener("scroll", scheduleMetricsUpdate);
        window.removeEventListener("resize", scheduleMetricsUpdate);

        if (animationFrame !== undefined) {
          window.cancelAnimationFrame(animationFrame);
          animationFrame = undefined;
        }
      });
    };

    const startDesktopRuntime = async (generation: number) => {
      try {
        const { gsap, Lenis, ScrollTrigger } = await loadRuntime();

        if (disposed || generation !== runtimeGeneration) return;
        let matchedRuntimeCleanup: Cleanup = noop;
        let gsapMedia: ReturnType<typeof gsap.matchMedia> | undefined;
        let gsapContext: ReturnType<typeof gsap.context> | undefined;

        const createMatchedRuntime = (): Cleanup => {
          type OwnedTrigger = ReturnType<typeof ScrollTrigger.create>;

          const ownedTriggers = new Set<OwnedTrigger>();
          let lenis: InstanceType<typeof Lenis> | undefined;
          let tickerCallback: ((time: number) => void) | undefined;
          let lenisScrollCallback: (() => void) | undefined;

          const cleanup = once(() => {
            if (tickerCallback) {
              gsap.ticker.remove(tickerCallback);
              tickerCallback = undefined;
            }

            if (lenis && lenisScrollCallback) {
              lenis.off("scroll", lenisScrollCallback);
              lenisScrollCallback = undefined;
            }

            lenis?.destroy();
            lenis = undefined;

            ownedTriggers.forEach((trigger) => trigger.kill(true));
            ownedTriggers.clear();
            setSmoothingActive(false);
          });

          const own = (trigger: OwnedTrigger) => {
            ownedTriggers.add(trigger);
            return trigger;
          };

          try {
            lenis = new Lenis({
              autoRaf: false,
              duration: 1.05,
              smoothWheel: true,
              syncTouch: false,
              wheelMultiplier: 0.9,
            });
            lenisScrollCallback = () => ScrollTrigger.update();
            tickerCallback = (time: number) => lenis?.raf(time * 1000);

            lenis.on("scroll", lenisScrollCallback);
            gsap.ticker.add(tickerCallback);
            setSmoothingActive(true);

            own(
              ScrollTrigger.create({
                end: "bottom bottom",
                id: "grapevyne-story-progress",
                onRefresh: ({ progress }) => setStoryProgress(progress),
                onUpdate: ({ progress }) => setStoryProgress(progress),
                start: "top top",
                trigger: root,
              }),
            );

            sections.forEach(({ chapter, element }) => {
              own(
                ScrollTrigger.create({
                  end: "bottom center",
                  id: `grapevyne-story-chapter-${chapter}`,
                  onEnter: ({ progress }) => {
                    activateChapter(chapter);
                    setChapterProgress(progress);
                  },
                  onEnterBack: ({ progress }) => {
                    activateChapter(chapter);
                    setChapterProgress(progress);
                  },
                  onUpdate: ({ progress }) => {
                    if (activeChapter === chapter) {
                      setChapterProgress(progress);
                    }
                  },
                  start: "top center",
                  trigger: element,
                }),
              );

              if (chapter !== "hero") {
                const revealTargets = Array.from(
                  element.querySelectorAll<HTMLElement>(
                    "[data-story-reveal], .gv-story-media",
                  ),
                );

                revealTargets.forEach((target, index) => {
                  const isMedia = target.classList.contains("gv-story-media");
                  const tween = gsap.fromTo(
                    target,
                    isMedia
                      ? { autoAlpha: 0.55, scale: 0.985, y: 18 }
                      : { autoAlpha: 0.45, y: 32 },
                    {
                      autoAlpha: 1,
                      ease: "none",
                      immediateRender: false,
                      scale: 1,
                      scrollTrigger: {
                        end: "top 48%",
                        id: `grapevyne-story-reveal-${chapter}-${index}`,
                        invalidateOnRefresh: true,
                        scrub: 0.55,
                        start: "top 82%",
                        trigger: target,
                      },
                      y: 0,
                    },
                  );

                  if (tween.scrollTrigger) {
                    own(tween.scrollTrigger);
                  }
                });
              }

              if (!element.hasAttribute("data-story-pin")) return;

              own(
                ScrollTrigger.create({
                  anticipatePin: 1,
                  end: () =>
                    `+=${Math.min(window.innerHeight * 0.35, 320)}`,
                  id: `grapevyne-story-pin-${chapter}`,
                  invalidateOnRefresh: true,
                  pin: true,
                  pinSpacing: true,
                  start: "top top",
                  trigger: element,
                }),
              );
            });
          } catch (error) {
            cleanup();
            throw error;
          }

          return cleanup;
        };

        try {
          gsapContext = gsap.context(() => {
            gsap.registerPlugin(ScrollTrigger);
            gsapMedia = gsap.matchMedia();
            gsapMedia.add(DESKTOP_QUERY, () => {
              const cleanup = createMatchedRuntime();
              matchedRuntimeCleanup = cleanup;

              return () => {
                cleanup();
                if (matchedRuntimeCleanup === cleanup) {
                  matchedRuntimeCleanup = noop;
                }
              };
            });
          }, root);
        } catch (error) {
          gsapMedia?.revert();
          matchedRuntimeCleanup();
          gsapContext?.revert();
          setSmoothingActive(false);
          throw error;
        }

        const cleanup = once(() => {
          gsapMedia?.revert();
          matchedRuntimeCleanup();
          gsapContext?.revert();
          setSmoothingActive(false);
        });

        if (disposed || generation !== runtimeGeneration) {
          cleanup();
          return;
        }

        stopRuntime = cleanup;
      } catch {
        if (!disposed && generation === runtimeGeneration) {
          stopRuntime = startNativeRuntime();
        }
      }
    };

    const restartRuntime = () => {
      runtimeGeneration += 1;
      const generation = runtimeGeneration;

      stopRuntime();
      stopRuntime = noop;
      setSmoothingActive(false);

      if (
        prefersReducedMotion ||
        mobileQuery?.matches ||
        coarsePointerQuery?.matches
      ) {
        stopRuntime = startNativeRuntime();
        return;
      }

      void startDesktopRuntime(generation);
    };

    documentElement.classList.add(STORY_CLASS);
    setHomepageActive(true);
    setStoryProgress(0);
    setChapterProgress(0);

    if (sections[0]) {
      activateChapter(sections[0].chapter);
    }

    mobileQuery?.addEventListener("change", restartRuntime);
    coarsePointerQuery?.addEventListener("change", restartRuntime);
    restartRuntime();

    return () => {
      disposed = true;
      runtimeGeneration += 1;
      mobileQuery?.removeEventListener("change", restartRuntime);
      coarsePointerQuery?.removeEventListener("change", restartRuntime);
      stopRuntime();
      stopRuntime = noop;
      setSmoothingActive(false);

      if (!hadStoryClass) {
        documentElement.classList.remove(STORY_CLASS);
      }

      restoreStyleProperty(
        root,
        STORY_PROGRESS_PROPERTY,
        storyProgressSnapshot,
      );
      restoreStyleProperty(
        root,
        CHAPTER_PROGRESS_PROPERTY,
        chapterProgressSnapshot,
      );
      setHomepageActive(false);
    };
  }, [
    prefersReducedMotion,
    loadRuntime,
    rootRef,
    setCurrentChapterId,
    setHomepageActive,
  ]);

  return STORY_CHAPTER_KEYS;
}
