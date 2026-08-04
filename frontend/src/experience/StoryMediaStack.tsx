import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useStoryStaticMode } from "@/hooks/useStoryStaticMode";

import { CINEMATIC_MEDIA } from "./media";
import {
  clampStoryProgress,
  getMediaTransition,
  getScrubTime,
} from "./storyMediaMath";
import { STORY_CHAPTERS, type StoryChapter } from "./storyChapters";
import {
  deriveStorySubjectFrame,
  isAnyStorySubjectVisible,
} from "./storySubject";
import { useScene } from "./useScene";

const MOBILE_MEDIA_QUERY = "(max-width: 720px)";
const MINIMUM_SEEK_DELTA_SECONDS = 1 / 48;

type VideoWithFrameCallback = HTMLVideoElement & {
  cancelVideoFrameCallback?: (handle: number) => void;
  requestVideoFrameCallback?: (callback: () => void) => number;
};

export default function StoryMediaStack() {
  const mobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const { staticMode } = useStoryStaticMode();
  const { chapterIndex, currentChapterId, progressRef } = useScene();
  const [failed, setFailed] = useState<ReadonlySet<StoryChapter>>(
    () => new Set(),
  );
  const [decoded, setDecoded] = useState<ReadonlySet<StoryChapter>>(
    () => new Set(),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef(new Map<StoryChapter, HTMLDivElement>());
  const videosRef = useRef(new Map<StoryChapter, VideoWithFrameCallback>());
  const videoRefCallbacksRef = useRef(
    new Map<StoryChapter, (node: HTMLVideoElement | null) => void>(),
  );
  const videoFrameCallbacksRef = useRef(
    new Map<StoryChapter, { handle: number; video: VideoWithFrameCallback }>(),
  );
  const lastSeekRef = useRef(new Map<StoryChapter, number>());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const currentChapterRef = useRef(currentChapterId);
  const currentIndexRef = useRef(chapterIndex);

  currentChapterRef.current = currentChapterId;
  currentIndexRef.current = chapterIndex;

  const registerLayer = useCallback(
    (chapter: StoryChapter, node: HTMLDivElement | null) => {
      if (node) layersRef.current.set(chapter, node);
      else layersRef.current.delete(chapter);
    },
    [],
  );

  const registerVideo = useCallback(
    (chapter: StoryChapter, node: HTMLVideoElement | null) => {
      if (node) {
        videosRef.current.set(chapter, node);
        return;
      }

      const previousVideo = videosRef.current.get(chapter);
      const pendingCallback = videoFrameCallbacksRef.current.get(chapter);
      if (pendingCallback) {
        pendingCallback.video.cancelVideoFrameCallback?.(
          pendingCallback.handle,
        );
        videoFrameCallbacksRef.current.delete(chapter);
      }
      previousVideo?.pause();
      videosRef.current.delete(chapter);
      lastSeekRef.current.delete(chapter);
      setDecoded((current) => {
        if (!current.has(chapter)) return current;
        const next = new Set(current);
        next.delete(chapter);
        return next;
      });
    },
    [],
  );

  const markDecoded = useCallback((chapter: StoryChapter) => {
    setDecoded((current) => {
      if (current.has(chapter)) return current;
      const next = new Set(current);
      next.add(chapter);
      return next;
    });
  }, []);

  const getVideoRef = useCallback(
    (chapter: StoryChapter) => {
      const existing = videoRefCallbacksRef.current.get(chapter);
      if (existing) return existing;
      const callback = (node: HTMLVideoElement | null) => {
        registerVideo(chapter, node);
      };
      videoRefCallbacksRef.current.set(chapter, callback);
      return callback;
    },
    [registerVideo],
  );

  const markFailed = useCallback((chapter: StoryChapter) => {
    setDecoded((current) => {
      if (!current.has(chapter)) return current;
      const next = new Set(current);
      next.delete(chapter);
      return next;
    });
    setFailed((current) => {
      if (current.has(chapter)) return current;
      const next = new Set(current);
      next.add(chapter);
      return next;
    });
  }, []);

  const updateFrame = useCallback(() => {
    animationFrameRef.current = undefined;
    const sceneProgress = progressRef.current;

    if (document.visibilityState === "hidden" || !sceneProgress.storyVisible) {
      videosRef.current.forEach((video) => video.pause());
      sceneProgress.setRenderActivity?.(false);
      return;
    }

    const activeIndex = currentIndexRef.current;
    const activeChapter = currentChapterRef.current;
    const nextChapter =
      STORY_CHAPTERS[Math.min(activeIndex + 1, STORY_CHAPTERS.length - 1)]
        ?.key ?? activeChapter;
    const progress = clampStoryProgress(sceneProgress.chapter);
    const transition = getMediaTransition(progress);
    const subjectFrame = deriveStorySubjectFrame(activeChapter, progress);

    const styleTarget = rootRef.current?.parentElement ?? rootRef.current;
    const storyRoot = rootRef.current?.closest<HTMLElement>(".gv-story");
    styleTarget?.style.setProperty(
      "--story-veil-opacity",
      String(transition.veilOpacity),
    );
    styleTarget?.style.setProperty(
      "--story-subject-opacity",
      String(Math.max(subjectFrame.currentOpacity, subjectFrame.nextOpacity)),
    );
    styleTarget?.style.setProperty(
      "--story-bottle-opacity",
      String(
        (subjectFrame.current === "bottle"
          ? subjectFrame.currentOpacity
          : 0) +
          (subjectFrame.next === "bottle" ? subjectFrame.nextOpacity : 0),
      ),
    );
    styleTarget?.style.setProperty(
      "--story-grape-opacity",
      String(
        (subjectFrame.current === "grapes"
          ? subjectFrame.currentOpacity
          : 0) +
          (subjectFrame.next === "grapes" ? subjectFrame.nextOpacity : 0),
      ),
    );
    storyRoot?.style.setProperty(
      "--story-copy-opacity",
      String(transition.currentOpacity),
    );

    layersRef.current.forEach((layer, chapter) => {
      let opacity = 0;
      if (chapter === activeChapter) opacity = transition.currentOpacity;
      if (chapter === nextChapter && nextChapter !== activeChapter) {
        opacity = transition.nextOpacity;
      }
      layer.style.opacity = String(opacity);
      layer.style.visibility = opacity > 0.001 ? "visible" : "hidden";
    });

    videosRef.current.forEach((video, chapter) => {
      video.pause();
      if (chapter !== activeChapter || video.readyState < 1) return;

      const targetTime = getScrubTime(progress, video.duration);
      const previousTime = lastSeekRef.current.get(chapter);
      if (
        previousTime !== undefined &&
        Math.abs(previousTime - targetTime) < MINIMUM_SEEK_DELTA_SECONDS
      ) {
        return;
      }

      try {
        video.currentTime = targetTime;
        lastSeekRef.current.set(chapter, targetTime);
        const pendingCallback = videoFrameCallbacksRef.current.get(chapter);
        if (pendingCallback) {
          pendingCallback.video.cancelVideoFrameCallback?.(
            pendingCallback.handle,
          );
          videoFrameCallbacksRef.current.delete(chapter);
        }
        const callbackHandle = video.requestVideoFrameCallback?.(() => {
          videoFrameCallbacksRef.current.delete(chapter);
          markDecoded(chapter);
        });
        if (callbackHandle !== undefined) {
          videoFrameCallbacksRef.current.set(chapter, {
            handle: callbackHandle,
            video,
          });
        }
      } catch {
        markFailed(chapter);
      }
    });

    sceneProgress.setRenderActivity?.(
      isAnyStorySubjectVisible(subjectFrame),
    );
  }, [markDecoded, markFailed, progressRef]);

  const scheduleFrame = useCallback(() => {
    if (animationFrameRef.current !== undefined || staticMode) return;
    animationFrameRef.current = window.requestAnimationFrame(updateFrame);
  }, [staticMode, updateFrame]);

  useEffect(() => {
    if (staticMode) return undefined;
    const sceneProgress = progressRef.current;
    const videos = videosRef.current;
    const videoFrameCallbacks = videoFrameCallbacksRef.current;
    const lastSeek = lastSeekRef.current;
    const previousRequest = sceneProgress.requestStoryFrame;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (animationFrameRef.current !== undefined) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = undefined;
        }
        videosRef.current.forEach((video) => video.pause());
        sceneProgress.setRenderActivity?.(false);
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
      videoFrameCallbacks.forEach(({ handle, video }) => {
        video.cancelVideoFrameCallback?.(handle);
      });
      videoFrameCallbacks.clear();
      videos.forEach((video) => video.pause());
      lastSeek.clear();
      sceneProgress.setRenderActivity?.(false);
    };
  }, [progressRef, scheduleFrame, staticMode]);

  useEffect(() => {
    scheduleFrame();
  }, [chapterIndex, currentChapterId, mobile, scheduleFrame]);

  useEffect(() => {
    // Device-source changes replace the video elements below. Clear readiness
    // and failure state so an orientation change cannot expose a frame decoded
    // from the prior desktop/mobile source.
    setDecoded(new Set());
    setFailed(new Set());
    lastSeekRef.current.clear();
    scheduleFrame();
  }, [mobile, scheduleFrame]);

  if (staticMode) return null;

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
        const videoFailed = failed.has(chapter.key);
        const videoDecoded = decoded.has(chapter.key);
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
                src={asset.poster}
                style={mediaStyle}
              />
            ) : null}
            {prepared && !videoFailed ? (
              <video
                className={`gv-story-scrub-video${videoDecoded ? " is-decoded" : ""}`}
                data-scrub-video={chapter.key}
                disablePictureInPicture
                key={`${chapter.key}:${mobile ? "mobile" : "desktop"}`}
                muted
                onError={() => markFailed(chapter.key)}
                onLoadedMetadata={scheduleFrame}
                onSeeked={() => markDecoded(chapter.key)}
                playsInline
                poster={asset.poster}
                preload={index === chapterIndex ? "auto" : "metadata"}
                ref={getVideoRef(chapter.key)}
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
      <div className="gv-story-transition-veil" />
    </div>
  );
}
