import {
  type CSSProperties,
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStoryStaticMode } from "@/hooks/useStoryStaticMode";

import { CINEMATIC_MEDIA } from "./media";
import { getScrubTime } from "./storyMediaMath";
import {
  STORY_CHAPTERS,
  STORY_SUBJECTS,
  type StoryChapter,
} from "./storyChapters";
import {
  deriveStoryTransitionState,
  type StoryTransitionInput,
} from "./storyTransition";
import { useScene } from "./useScene";
import {
  type InteractiveStorySubject,
  type SubjectInteractionState,
  resetSubjectInteractionWhenHidden,
} from "./webgl/subjectInteraction";

const MOBILE_MEDIA_QUERY = "(max-width: 720px)";
const MINIMUM_SEEK_DELTA_SECONDS = 1 / 48;
const DECODED_FRAME_TOLERANCE_SECONDS = 1 / 24;
const POSTER_FALLBACK_DELAY_MILLISECONDS = 1_200;
const OPACITY_EPSILON = 0.001;
const STORY_CHAPTER_INDEX = new Map(
  STORY_CHAPTERS.map(({ key }, index) => [key, index]),
);

type VideoWithFrameCallback = Omit<
  HTMLVideoElement,
  "cancelVideoFrameCallback" | "requestVideoFrameCallback"
> & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (
    callback: (
      now: DOMHighResTimeStamp,
      metadata: VideoFrameCallbackMetadata,
    ) => void,
  ) => number;
};

interface PendingFrameCallback {
  handle: number;
  requestId: number;
  sourceKey: string;
  targetTime: number;
  video: VideoWithFrameCallback;
}

interface VideoRefRegistration {
  callback: (node: HTMLVideoElement | null) => void;
  key: string;
}

type StableVideoFrameCallback = (
  now: DOMHighResTimeStamp,
  metadata: VideoFrameCallbackMetadata,
) => void;

interface PendingSeek {
  requestId: number;
  sourceKey: string;
  targetTime: number;
}

interface StoryMediaStackProps {
  interactionRef?: MutableRefObject<SubjectInteractionState>;
  onInteractiveSubjectChange?: (
    subject: InteractiveStorySubject | null,
  ) => void;
}

function sourceKey(
  chapter: StoryChapter,
  mobile: boolean,
  generation: number,
) {
  return `${chapter}:${mobile ? "mobile" : "desktop"}:${generation}`;
}

function subjectForIndex(index: number) {
  const chapter = STORY_CHAPTERS[index]?.key;
  return chapter ? STORY_SUBJECTS[chapter] : "none";
}

function isFrameReady(
  index: number,
  keys: readonly string[],
  posterFallbackReady: ReadonlySet<string>,
  decoded: ReadonlySet<string>,
  videos?: ReadonlyMap<StoryChapter, VideoWithFrameCallback>,
  allowDisplayedFrame = false,
) {
  const key = keys[index];
  const chapter = STORY_CHAPTERS[index]?.key;
  const video = chapter === undefined ? undefined : videos?.get(chapter);
  return (
    key !== undefined &&
    (posterFallbackReady.has(key) ||
      decoded.has(key) ||
      (allowDisplayedFrame &&
        video?.dataset.storySourceKey === key &&
        video.dataset.pendingSeek === "true" &&
        video.dataset.readinessKind === "displayed-frame-pending-exact" &&
        video.classList.contains("is-decoded")))
  );
}

export default function StoryMediaStack({
  interactionRef,
  onInteractiveSubjectChange,
}: StoryMediaStackProps) {
  const mobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const { staticMode } = useStoryStaticMode();
  const {
    chapterIndex,
    currentChapterId,
    progressRef,
    setCurrentChapterId,
  } = useScene();
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef(new Map<StoryChapter, HTMLDivElement>());
  const videosRef = useRef(new Map<StoryChapter, VideoWithFrameCallback>());
  const videoRefCallbacksRef = useRef(
    new Map<StoryChapter, VideoRefRegistration>(),
  );
  const videoFrameCallbacksRef = useRef(
    new Map<StoryChapter, PendingFrameCallback>(),
  );
  const frameCallbackFunctionsRef = useRef(
    new Map<StoryChapter, StableVideoFrameCallback>(),
  );
  const pendingSeeksRef = useRef(new Map<StoryChapter, PendingSeek>());
  const lastSeekRef = useRef(new Map<string, number>());
  const posterReadyRef = useRef(new Set<string>());
  const posterFallbackReadyRef = useRef(new Set<string>());
  const posterFallbackTimersRef = useRef(new Map<string, number>());
  const failedSourceKeysRef = useRef(new Set<string>());
  const decodedRef = useRef(new Set<string>());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const scheduleFrameRef = useRef<() => void>(() => undefined);
  const requestIdRef = useRef(0);
  const sourceGenerationRef = useRef(0);
  const sourceSwapPendingRef = useRef(false);
  const sourceKeysRef = useRef<string[]>([]);
  const mobileRef = useRef(mobile);
  const currentChapterRef = useRef(currentChapterId);
  const interactiveSubjectRef = useRef<InteractiveStorySubject | null>(null);
  const onInteractiveSubjectChangeRef = useRef(onInteractiveSubjectChange);
  const transitionProbeRef = useRef(
    deriveStoryTransitionState({ overallProgress: 0 }),
  );
  const transitionInputRef = useRef<StoryTransitionInput>({
    overallProgress: 0,
  });
  const transitionProbeInputRef = useRef<StoryTransitionInput>({
    overallProgress: 0,
  });

  if (mobileRef.current !== mobile) {
    mobileRef.current = mobile;
    sourceGenerationRef.current += 1;
    sourceSwapPendingRef.current = true;
  }
  currentChapterRef.current = currentChapterId;
  onInteractiveSubjectChangeRef.current = onInteractiveSubjectChange;

  const requestFrame = useCallback(() => {
    scheduleFrameRef.current();
  }, []);

  const disableActiveInteraction = useCallback(() => {
    if (interactionRef) {
      const control = interactionRef.current.control;
      control.cancel?.();
      if (control.element) {
        control.element.disabled = true;
        control.element.style.pointerEvents = "none";
        control.element.dataset.transitionDisabled = "true";
      }
    }
    if (interactiveSubjectRef.current !== null) {
      interactiveSubjectRef.current = null;
      onInteractiveSubjectChangeRef.current?.(null);
    }
  }, [interactionRef]);

  const cancelVideoFrameCallback = useCallback((chapter: StoryChapter) => {
    const pending = videoFrameCallbacksRef.current.get(chapter);
    if (!pending) return;
    pending.video.cancelVideoFrameCallback?.(pending.handle);
    videoFrameCallbacksRef.current.delete(chapter);
  }, []);

  const registerLayer = useCallback(
    (chapter: StoryChapter, node: HTMLDivElement | null) => {
      if (node) layersRef.current.set(chapter, node);
      else layersRef.current.delete(chapter);
    },
    [],
  );

  const registerVideo = useCallback(
    (chapter: StoryChapter, key: string, node: HTMLVideoElement | null) => {
      if (node) {
        node.dataset.storySourceKey = key;
        node.dataset.decodedFrameReady = "false";
        node.dataset.pendingSeek = "false";
        node.dataset.readinessKind = "poster";
        videosRef.current.set(chapter, node);
        return;
      }

      const previousVideo = videosRef.current.get(chapter);
      cancelVideoFrameCallback(chapter);
      previousVideo?.pause();
      videosRef.current.delete(chapter);
      pendingSeeksRef.current.delete(chapter);
      lastSeekRef.current.delete(key);
      decodedRef.current.delete(key);
    },
    [cancelVideoFrameCallback],
  );

  const getVideoRef = useCallback(
    (chapter: StoryChapter, key: string) => {
      const existing = videoRefCallbacksRef.current.get(chapter);
      if (existing?.key === key) return existing.callback;
      const callback = (node: HTMLVideoElement | null) => {
        registerVideo(chapter, key, node);
      };
      videoRefCallbacksRef.current.set(chapter, { callback, key });
      return callback;
    },
    [registerVideo],
  );

  const commitPosterFallback = useCallback(
    (chapter: StoryChapter, key: string) => {
      if (decodedRef.current.has(key)) return;
      posterFallbackReadyRef.current.add(key);
      pendingSeeksRef.current.delete(chapter);
      cancelVideoFrameCallback(chapter);
      const video = videosRef.current.get(chapter);
      if (video?.dataset.storySourceKey === key) {
        video.classList.remove("is-decoded");
        video.dataset.decodedFrameReady = "false";
        video.dataset.pendingSeek = "false";
        video.dataset.readinessKind = "approved-poster-fallback";
      }
      requestFrame();
    },
    [cancelVideoFrameCallback, requestFrame],
  );

  const armPosterFallback = useCallback(
    (chapter: StoryChapter, key: string) => {
      if (
        failedSourceKeysRef.current.has(key) ||
        posterFallbackReadyRef.current.has(key)
      ) {
        commitPosterFallback(chapter, key);
      } else if (
        posterReadyRef.current.has(key) &&
        !posterFallbackTimersRef.current.has(key)
      ) {
        const timer = window.setTimeout(() => {
          posterFallbackTimersRef.current.delete(key);
          commitPosterFallback(chapter, key);
        }, POSTER_FALLBACK_DELAY_MILLISECONDS);
        posterFallbackTimersRef.current.set(key, timer);
      }
    },
    [commitPosterFallback],
  );

  const markPosterReady = useCallback(
    (chapter: StoryChapter, key: string) => {
      if (posterReadyRef.current.has(key)) return;
      posterReadyRef.current.add(key);
      armPosterFallback(chapter, key);
      requestFrame();
    },
    [armPosterFallback, requestFrame],
  );

  const markDecoded = useCallback(
    (
      chapter: StoryChapter,
      key: string,
      requestId: number,
      decodedTime: number,
    ) => {
      const pending = pendingSeeksRef.current.get(chapter);
      if (
        !pending ||
        pending.requestId !== requestId ||
        pending.sourceKey !== key ||
        !Number.isFinite(decodedTime) ||
        Math.abs(decodedTime - pending.targetTime) >
          DECODED_FRAME_TOLERANCE_SECONDS
      ) {
        return;
      }

      decodedRef.current.add(key);
      posterFallbackReadyRef.current.delete(key);
      const fallbackTimer = posterFallbackTimersRef.current.get(key);
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
        posterFallbackTimersRef.current.delete(key);
      }
      pendingSeeksRef.current.delete(chapter);
      const video = videosRef.current.get(chapter);
      if (video?.dataset.storySourceKey === key) {
        video.classList.add("is-decoded");
        video.dataset.decodedFrameReady = "true";
        video.dataset.pendingSeek = "false";
        video.dataset.readinessKind = "decoded-exact";
      }
      requestFrame();
    },
    [requestFrame],
  );

  const markFallbackDecoded = useCallback(
    (chapter: StoryChapter, key: string, video: VideoWithFrameCallback) => {
      if (
        video.requestVideoFrameCallback &&
        video.cancelVideoFrameCallback
      ) {
        return;
      }
      const pending = pendingSeeksRef.current.get(chapter);
      if (
        !pending ||
        pending.sourceKey !== key ||
        video.seeking ||
        Math.abs(video.currentTime - pending.targetTime) >
          DECODED_FRAME_TOLERANCE_SECONDS
      ) {
        return;
      }
      markDecoded(chapter, key, pending.requestId, video.currentTime);
    },
    [markDecoded],
  );

  const getFrameCallback = useCallback(
    (chapter: StoryChapter) => {
      const existing = frameCallbackFunctionsRef.current.get(chapter);
      if (existing) return existing;
      const callback: StableVideoFrameCallback = (_now, metadata) => {
        const active = videoFrameCallbacksRef.current.get(chapter);
        if (!active) return;
        const pending = pendingSeeksRef.current.get(chapter);
        active.video.cancelVideoFrameCallback?.(active.handle);
        videoFrameCallbacksRef.current.delete(chapter);

        if (
          !pending ||
          pending.requestId !== active.requestId ||
          pending.sourceKey !== active.sourceKey
        ) {
          return;
        }

        if (
          !Number.isFinite(metadata.mediaTime) ||
          Math.abs(metadata.mediaTime - active.targetTime) >
            DECODED_FRAME_TOLERANCE_SECONDS
        ) {
          const nextHandle = active.video.requestVideoFrameCallback?.(callback);
          const latestPending = pendingSeeksRef.current.get(chapter);
          if (
            nextHandle !== undefined &&
            latestPending?.requestId === active.requestId &&
            latestPending.sourceKey === active.sourceKey
          ) {
            active.handle = nextHandle;
            videoFrameCallbacksRef.current.set(chapter, active);
          } else if (nextHandle !== undefined) {
            active.video.cancelVideoFrameCallback?.(nextHandle);
          }
          return;
        }

        markDecoded(
          chapter,
          active.sourceKey,
          active.requestId,
          metadata.mediaTime,
        );
      };
      frameCallbackFunctionsRef.current.set(chapter, callback);
      return callback;
    },
    [markDecoded],
  );

  const markFailed = useCallback(
    (chapter: StoryChapter, key: string) => {
      cancelVideoFrameCallback(chapter);
      pendingSeeksRef.current.delete(chapter);
      decodedRef.current.delete(key);
      const video = videosRef.current.get(chapter);
      if (video?.dataset.storySourceKey === key) {
        video.classList.remove("is-decoded");
        video.dataset.decodedFrameReady = "false";
        video.dataset.pendingSeek = "false";
        video.dataset.readinessKind = "failed";
      }
      failedSourceKeysRef.current.add(key);
      if (posterReadyRef.current.has(key)) {
        posterFallbackReadyRef.current.add(key);
      }
      const fallbackTimer = posterFallbackTimersRef.current.get(key);
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
        posterFallbackTimersRef.current.delete(key);
      }
      setFailedSources((current) => {
        if (current.has(key)) return current;
        const next = new Set(current);
        next.add(key);
        return next;
      });
      requestFrame();
    },
    [cancelVideoFrameCallback, requestFrame],
  );

  const updateFrame = useCallback(() => {
    animationFrameRef.current = undefined;
    const sceneProgress = progressRef.current;

    if (document.visibilityState === "hidden" || !sceneProgress.storyVisible) {
      for (const video of videosRef.current.values()) video.pause();
      sceneProgress.setRenderActivity?.(false);
      disableActiveInteraction();
      return;
    }

    const keys = sourceKeysRef.current;
    const previousOwnerIndex = sceneProgress.transition.ownerIndex;
    const probeInput = transitionProbeInputRef.current;
    probeInput.boundaries = sceneProgress.boundaries;
    probeInput.overallProgress = sceneProgress.story;
    probeInput.previousOwnerIndex = previousOwnerIndex;
    probeInput.lowerReady = true;
    probeInput.upperReady = true;
    const probe = deriveStoryTransitionState(
      probeInput,
      transitionProbeRef.current,
    );
    const transitionInput = transitionInputRef.current;
    transitionInput.boundaries = sceneProgress.boundaries;
    transitionInput.lowerReady = isFrameReady(
      probe.lowerIndex,
      keys,
      posterFallbackReadyRef.current,
      decodedRef.current,
      videosRef.current,
      probe.lowerIndex === previousOwnerIndex,
    );
    transitionInput.overallProgress = sceneProgress.story;
    transitionInput.previousOwnerIndex = previousOwnerIndex;
    transitionInput.upperReady = isFrameReady(
      probe.upperIndex,
      keys,
      posterFallbackReadyRef.current,
      decodedRef.current,
      videosRef.current,
      probe.upperIndex === previousOwnerIndex,
    );
    const transition = deriveStoryTransitionState(
      transitionInput,
      sceneProgress.transition,
    );
    let requestFollowupFrame = transition.ownerIndex !== previousOwnerIndex;

    if (sceneProgress.forceBlackGate) {
      const requestedIndex = sceneProgress.navigationTargetIndex;
      const targetIndex =
        requestedIndex === null ? transition.ownerIndex : requestedIndex;
      const targetReady = isFrameReady(
        targetIndex,
        keys,
        posterFallbackReadyRef.current,
        decodedRef.current,
      );

      transition.boundaryIndex = null;
      transition.interactiveIndex = null;
      transition.lowerIndex = targetIndex;
      transition.lowerOpacity = 0;
      transition.ownerIndex = targetIndex;
      transition.phase = "black-hold";
      transition.transitionProgress = 0.5;
      transition.upperIndex = targetIndex;
      transition.upperOpacity = 0;
      transition.veilOpacity = 1;
      if (requestedIndex !== null && requestedIndex !== probe.ownerIndex) {
        transition.segmentProgress = 0;
      }

      if (
        targetReady &&
        previousOwnerIndex === targetIndex &&
        probe.ownerIndex === targetIndex
      ) {
        sceneProgress.forceBlackGate = false;
        sceneProgress.navigationTargetIndex = null;
        requestFollowupFrame = true;
      } else if (previousOwnerIndex !== targetIndex) {
        requestFollowupFrame = true;
      }
    }

    const ownerChapter = STORY_CHAPTERS[transition.ownerIndex]?.key ?? "hero";
    if (currentChapterRef.current !== ownerChapter) {
      currentChapterRef.current = ownerChapter;
      setCurrentChapterId(ownerChapter);
    }

    const styleTarget = rootRef.current?.parentElement ?? rootRef.current;
    const storyRoot = rootRef.current?.closest<HTMLElement>(".gv-story");
    let bottleOpacity = 0;
    let grapeOpacity = 0;
    const lowerSubject = subjectForIndex(transition.lowerIndex);
    const upperSubject = subjectForIndex(transition.upperIndex);

    if (lowerSubject === "bottle") bottleOpacity += transition.lowerOpacity;
    if (lowerSubject === "grapes") grapeOpacity += transition.lowerOpacity;
    if (transition.upperIndex !== transition.lowerIndex) {
      if (upperSubject === "bottle") bottleOpacity += transition.upperOpacity;
      if (upperSubject === "grapes") grapeOpacity += transition.upperOpacity;
    }

    styleTarget?.style.setProperty(
      "--story-veil-opacity",
      String(transition.veilOpacity),
    );
    styleTarget?.style.setProperty(
      "--story-subject-opacity",
      String(Math.max(bottleOpacity, grapeOpacity)),
    );
    styleTarget?.style.setProperty(
      "--story-bottle-opacity",
      String(bottleOpacity),
    );
    styleTarget?.style.setProperty(
      "--story-grape-opacity",
      String(grapeOpacity),
    );
    const ownerOpacity =
      transition.upperIndex !== transition.lowerIndex &&
      transition.ownerIndex === transition.upperIndex
        ? transition.upperOpacity
        : transition.lowerOpacity;
    storyRoot?.style.setProperty("--story-copy-opacity", String(ownerOpacity));

    if (storyRoot) {
      storyRoot.dataset.storyTransitionPhase = transition.phase;
      storyRoot.dataset.storyTransitionBoundary =
        transition.boundaryIndex === null
          ? "none"
          : String(transition.boundaryIndex + 1);
      storyRoot.dataset.storyOwner = ownerChapter;
      storyRoot.dataset.blackGateOpacity = String(transition.veilOpacity);
    }

    for (const [chapter, layer] of layersRef.current) {
      const index = STORY_CHAPTER_INDEX.get(chapter) ?? -1;
      let opacity = 0;
      if (index === transition.lowerIndex) opacity = transition.lowerOpacity;
      if (
        transition.upperIndex !== transition.lowerIndex &&
        index === transition.upperIndex
      ) {
        opacity = transition.upperOpacity;
      }
      layer.style.opacity = String(opacity);
      layer.style.visibility = opacity > OPACITY_EPSILON ? "visible" : "hidden";
      layer.style.zIndex = opacity > OPACITY_EPSILON ? "2" : "0";
      layer.dataset.mediaOpacity = String(opacity);
      layer.dataset.frameReady = String(
        isFrameReady(
          index,
          keys,
          posterFallbackReadyRef.current,
          decodedRef.current,
          videosRef.current,
          index === previousOwnerIndex,
        ),
      );
      const key = keys[index];
      const video = videosRef.current.get(chapter);
      layer.dataset.frameReadiness =
        key !== undefined && decodedRef.current.has(key)
          ? "decoded-exact"
          : key !== undefined && posterFallbackReadyRef.current.has(key)
            ? "approved-poster-fallback"
            : key !== undefined &&
                video?.dataset.storySourceKey === key &&
                video.classList.contains("is-decoded")
              ? (video.dataset.readinessKind ?? "displayed-frame")
            : key !== undefined && posterReadyRef.current.has(key)
              ? "poster-waiting-for-exact-frame"
            : "pending";
    }

    if (rootRef.current) {
      const visibleIndex =
        transition.veilOpacity >= 1
          ? null
          : transition.upperOpacity > transition.lowerOpacity
            ? transition.upperIndex
            : transition.lowerIndex;
      rootRef.current.dataset.activeMedia =
        visibleIndex === null
          ? "black"
          : (STORY_CHAPTERS[visibleIndex]?.key ?? "black");
      rootRef.current.dataset.activeSubject =
        bottleOpacity > OPACITY_EPSILON
          ? "bottle"
          : grapeOpacity > OPACITY_EPSILON
            ? "grapes"
            : "none";
      rootRef.current.dataset.interactiveIndex =
        transition.interactiveIndex === null
          ? "none"
          : String(transition.interactiveIndex);
    }

    const interactiveIndex = transition.interactiveIndex;
    const interactiveSubject =
      interactiveIndex === null ? "none" : subjectForIndex(interactiveIndex);
    const nextInteractiveSubject =
      interactiveSubject === "bottle" || interactiveSubject === "grapes"
        ? interactiveSubject
        : null;
    if (interactiveSubjectRef.current !== nextInteractiveSubject) {
      if (nextInteractiveSubject === null) {
        disableActiveInteraction();
      } else {
        interactiveSubjectRef.current = nextInteractiveSubject;
        onInteractiveSubjectChangeRef.current?.(nextInteractiveSubject);
      }
    }

    if (interactionRef) {
      interactionRef.current.bottle = resetSubjectInteractionWhenHidden(
        interactionRef.current.bottle,
        bottleOpacity <= OPACITY_EPSILON,
      );
      interactionRef.current.grapes = resetSubjectInteractionWhenHidden(
        interactionRef.current.grapes,
        grapeOpacity <= OPACITY_EPSILON,
      );
    }

    for (const [chapter, video] of videosRef.current) {
      video.pause();
      const index = STORY_CHAPTER_INDEX.get(chapter) ?? -1;
      if (
        video.readyState < 1 ||
        (index !== transition.lowerIndex && index !== transition.upperIndex)
      ) {
        continue;
      }

      const targetProgress =
        index === transition.lowerIndex ? transition.segmentProgress : 0;
      const targetTime = getScrubTime(targetProgress, video.duration);
      const key = video.dataset.storySourceKey;
      if (!key) continue;
      const previousTime = lastSeekRef.current.get(key);
      if (
        previousTime !== undefined &&
        Math.abs(previousTime - targetTime) < MINIMUM_SEEK_DELTA_SECONDS
      ) {
        continue;
      }

      try {
        video.currentTime = targetTime;
        lastSeekRef.current.set(key, targetTime);
        decodedRef.current.delete(key);
        posterFallbackReadyRef.current.delete(key);
        const existingFallbackTimer = posterFallbackTimersRef.current.get(key);
        if (existingFallbackTimer !== undefined) {
          window.clearTimeout(existingFallbackTimer);
          posterFallbackTimersRef.current.delete(key);
        }
        const layerOpacity =
          index === transition.lowerIndex
            ? transition.lowerOpacity
            : index === transition.upperIndex
              ? transition.upperOpacity
              : 0;
        const retainsLastDisplayedFrame =
          index === previousOwnerIndex &&
          layerOpacity > OPACITY_EPSILON &&
          video.classList.contains("is-decoded");
        if (!retainsLastDisplayedFrame) {
          video.classList.remove("is-decoded");
        }
        video.dataset.decodedFrameReady = "false";
        video.dataset.pendingSeek = "true";
        video.dataset.readinessKind = retainsLastDisplayedFrame
          ? "displayed-frame-pending-exact"
          : "pending-exact";
        video.dataset.targetTime = String(targetTime);
        requestIdRef.current += 1;
        let pending = pendingSeeksRef.current.get(chapter);
        if (!pending) {
          pending = { requestId: 0, sourceKey: key, targetTime };
          pendingSeeksRef.current.set(chapter, pending);
        }
        pending.requestId = requestIdRef.current;
        pending.sourceKey = key;
        pending.targetTime = targetTime;
        video.dataset.seekRequestId = String(requestIdRef.current);

        cancelVideoFrameCallback(chapter);
        const requestId = requestIdRef.current;
        const callbackHandle = video.cancelVideoFrameCallback
          ? video.requestVideoFrameCallback?.(getFrameCallback(chapter))
          : undefined;
        if (callbackHandle !== undefined) {
          let frame = videoFrameCallbacksRef.current.get(chapter);
          if (!frame) {
            frame = {
              handle: callbackHandle,
              requestId,
              sourceKey: key,
              targetTime,
              video,
            };
            videoFrameCallbacksRef.current.set(chapter, frame);
          }
          frame.handle = callbackHandle;
          frame.requestId = requestId;
          frame.sourceKey = key;
          frame.targetTime = targetTime;
          frame.video = video;
        }
        armPosterFallback(chapter, key);
      } catch {
        markFailed(chapter, key);
      }
    }

    sceneProgress.setRenderActivity?.(
      bottleOpacity > OPACITY_EPSILON || grapeOpacity > OPACITY_EPSILON,
    );
    if (requestFollowupFrame) requestFrame();
  }, [
    armPosterFallback,
    cancelVideoFrameCallback,
    disableActiveInteraction,
    getFrameCallback,
    interactionRef,
    markFailed,
    progressRef,
    requestFrame,
    setCurrentChapterId,
  ]);

  const scheduleFrame = useCallback(() => {
    if (animationFrameRef.current !== undefined || staticMode) return;
    animationFrameRef.current = window.requestAnimationFrame(updateFrame);
  }, [staticMode, updateFrame]);
  scheduleFrameRef.current = scheduleFrame;

  useEffect(() => {
    if (staticMode) return undefined;
    const sceneProgress = progressRef.current;
    const videos = videosRef.current;
    const decoded = decodedRef.current;
    const lastSeeks = lastSeekRef.current;
    const pendingSeeks = pendingSeeksRef.current;
    const posterReady = posterReadyRef.current;
    const posterFallbackReady = posterFallbackReadyRef.current;
    const posterFallbackTimers = posterFallbackTimersRef.current;
    const failedSourceKeys = failedSourceKeysRef.current;
    const videoFrameCallbacks = videoFrameCallbacksRef.current;
    const videoRefCallbacks = videoRefCallbacksRef.current;
    const previousRequest = sceneProgress.requestStoryFrame;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (animationFrameRef.current !== undefined) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }
        for (const chapter of videoFrameCallbacks.keys()) {
          cancelVideoFrameCallback(chapter);
        }
        pendingSeeks.clear();
        for (const video of videos.values()) {
          const key = video.dataset.storySourceKey;
          if (key) {
            decoded.delete(key);
            lastSeeks.delete(key);
          }
          video.classList.remove("is-decoded");
          video.dataset.decodedFrameReady = "false";
          video.dataset.pendingSeek = "false";
          video.pause();
        }
        sceneProgress.setRenderActivity?.(false);
        disableActiveInteraction();
      } else {
        scheduleFrame();
      }
    };

    sceneProgress.requestStoryFrame = scheduleFrame;
    document.addEventListener("visibilitychange", handleVisibility);
    scheduleFrame();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (sceneProgress.requestStoryFrame === scheduleFrame) {
        if (previousRequest) sceneProgress.requestStoryFrame = previousRequest;
        else delete sceneProgress.requestStoryFrame;
      }
      if (animationFrameRef.current !== undefined) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = undefined;
      }
      for (const chapter of videoFrameCallbacks.keys()) {
        cancelVideoFrameCallback(chapter);
      }
      videoFrameCallbacks.clear();
      pendingSeeks.clear();
      for (const video of videos.values()) video.pause();
      lastSeeks.clear();
      decoded.clear();
      posterReady.clear();
      posterFallbackReady.clear();
      for (const timer of posterFallbackTimers.values()) {
        window.clearTimeout(timer);
      }
      posterFallbackTimers.clear();
      failedSourceKeys.clear();
      videoRefCallbacks.clear();
      sceneProgress.setRenderActivity?.(false);
      disableActiveInteraction();
    };
  }, [
    cancelVideoFrameCallback,
    disableActiveInteraction,
    progressRef,
    scheduleFrame,
    staticMode,
  ]);

  useEffect(() => {
    scheduleFrame();
  }, [chapterIndex, currentChapterId, mobile, scheduleFrame]);

  useLayoutEffect(() => {
    const sourceSwapped = sourceSwapPendingRef.current;
    sourceSwapPendingRef.current = false;
    if (sourceSwapped && !staticMode) {
      const sceneProgress = progressRef.current;
      sceneProgress.forceBlackGate = true;
      sceneProgress.navigationTargetIndex =
        STORY_CHAPTER_INDEX.get(currentChapterRef.current) ??
        sceneProgress.transition.ownerIndex;
      const styleTarget = rootRef.current?.parentElement ?? rootRef.current;
      const storyRoot = rootRef.current?.closest<HTMLElement>(".gv-story");
      styleTarget?.style.setProperty("--story-veil-opacity", "1");
      styleTarget?.style.setProperty("--story-subject-opacity", "0");
      styleTarget?.style.setProperty("--story-bottle-opacity", "0");
      styleTarget?.style.setProperty("--story-grape-opacity", "0");
      storyRoot?.style.setProperty("--story-copy-opacity", "0");
      for (const layer of layersRef.current.values()) {
        layer.style.opacity = "0";
        layer.style.visibility = "hidden";
        layer.style.zIndex = "0";
        layer.dataset.mediaOpacity = "0";
      }
      if (rootRef.current) {
        rootRef.current.dataset.activeMedia = "black";
        rootRef.current.dataset.activeSubject = "none";
        rootRef.current.dataset.interactiveIndex = "none";
      }
      disableActiveInteraction();
    }

    const activeKeys = new Set(sourceKeysRef.current);
    for (const key of posterReadyRef.current) {
      if (!activeKeys.has(key)) posterReadyRef.current.delete(key);
    }
    for (const key of decodedRef.current) {
      if (!activeKeys.has(key)) decodedRef.current.delete(key);
    }
    for (const key of posterFallbackReadyRef.current) {
      if (!activeKeys.has(key)) posterFallbackReadyRef.current.delete(key);
    }
    for (const [key, timer] of posterFallbackTimersRef.current) {
      if (!activeKeys.has(key)) {
        window.clearTimeout(timer);
        posterFallbackTimersRef.current.delete(key);
      }
    }
    for (const key of failedSourceKeysRef.current) {
      if (!activeKeys.has(key)) failedSourceKeysRef.current.delete(key);
    }
    for (const key of lastSeekRef.current.keys()) {
      if (!activeKeys.has(key)) lastSeekRef.current.delete(key);
    }
    setFailedSources(new Set());
    scheduleFrame();
  }, [
    disableActiveInteraction,
    mobile,
    progressRef,
    scheduleFrame,
    staticMode,
  ]);

  if (staticMode) return null;

  const generation = sourceGenerationRef.current;
  sourceKeysRef.current.length = STORY_CHAPTERS.length;
  STORY_CHAPTERS.forEach((chapter, index) => {
    sourceKeysRef.current[index] = sourceKey(chapter.key, mobile, generation);
  });

  return (
    <div
      aria-hidden="true"
      className="gv-story-media-stack"
      data-story-media-stack
      ref={rootRef}
    >
      {STORY_CHAPTERS.map((chapter, index) => {
        const asset = mobile
          ? CINEMATIC_MEDIA[chapter.mediaKey].mobile
          : CINEMATIC_MEDIA[chapter.mediaKey].desktop;
        const prepared = Math.abs(index - chapterIndex) <= 1;
        const key = sourceKey(chapter.key, mobile, generation);
        const videoFailed = failedSources.has(key);
        const objectPosition = mobile
          ? CINEMATIC_MEDIA[chapter.mediaKey].objectPosition?.mobile
          : CINEMATIC_MEDIA[chapter.mediaKey].objectPosition?.desktop;
        const mediaStyle = { objectPosition } satisfies CSSProperties;

        return (
          <div
            className="gv-story-media-layer"
            data-media-chapter={chapter.key}
            data-media-prepared={prepared ? "true" : "false"}
            key={chapter.key}
            ref={(node) => registerLayer(chapter.key, node)}
          >
            {prepared ? (
              <img
                alt=""
                className="gv-story-media-poster"
                decoding="async"
                loading={index === 0 ? "eager" : "lazy"}
                onLoad={() => markPosterReady(chapter.key, key)}
                src={asset.poster}
                style={mediaStyle}
              />
            ) : null}
            {prepared && !videoFailed ? (
              <video
                className="gv-story-scrub-video"
                data-decoded-frame-ready="false"
                data-pending-seek="false"
                data-readiness-kind="poster"
                data-scrub-video={chapter.key}
                disablePictureInPicture
                key={key}
                muted
                onCanPlay={(event) =>
                  markFallbackDecoded(chapter.key, key, event.currentTarget)
                }
                onError={() => markFailed(chapter.key, key)}
                onLoadedMetadata={scheduleFrame}
                onSeeked={(event) =>
                  markFallbackDecoded(chapter.key, key, event.currentTarget)
                }
                playsInline
                poster={asset.poster}
                preload={index === chapterIndex ? "auto" : "metadata"}
                ref={getVideoRef(chapter.key, key)}
                style={mediaStyle}
                tabIndex={-1}
              >
                <source src={asset.webm} type="video/webm" />
                <source src={asset.mp4} type="video/mp4" />
              </video>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
