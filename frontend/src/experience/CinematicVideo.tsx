import { type CSSProperties, useEffect, useRef, useState } from "react";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotion } from "@/hooks/useReducedMotion";

import { CINEMATIC_MEDIA, type MediaKey } from "./media";

const MOBILE_MEDIA_QUERY = "(max-width: 720px)";
const LAZY_LOAD_ROOT_MARGIN = "320px 0px";
const MEANINGFUL_VISIBILITY = 0.35;
const ENDING_FRAME_EPSILON = 0.08;

type NonHeroMediaKey = Exclude<MediaKey, "hero">;

export type CinematicVideoProps =
  | {
      className?: string;
      mediaKey: "hero";
      priority?: boolean;
    }
  | {
      className?: string;
      mediaKey: NonHeroMediaKey;
      priority?: never;
    };

function isAtEndingFrame(video: HTMLVideoElement) {
  return (
    video.ended ||
    (Number.isFinite(video.duration) &&
      video.duration > 0 &&
      video.currentTime >= video.duration - ENDING_FRAME_EPSILON)
  );
}

export default function CinematicVideo({
  mediaKey,
  className = "",
  priority = false,
}: CinematicVideoProps) {
  const media = CINEMATIC_MEDIA[mediaKey];
  const mobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadedAsset, setLoadedAsset] = useState<string | null>(null);
  const [blockedAsset, setBlockedAsset] = useState<string | null>(null);

  const asset = mobile ? media.mobile : media.desktop;
  const isPriority = mediaKey === "hero" && priority;
  const sourcesReady = isPriority || loadedAsset === asset.mp4;
  const playbackBlocked = blockedAsset === asset.mp4;
  const objectPosition = mobile
    ? (media.objectPosition?.mobile ?? "center")
    : (media.objectPosition?.desktop ?? "center");
  const visualStyle: CSSProperties = {
    filter: media.filter,
    objectPosition,
    opacity: media.opacity,
  };

  useEffect(() => {
    if (reducedMotion || playbackBlocked || sourcesReady) {
      return undefined;
    }

    const video = videoRef.current;

    if (!video) {
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      setLoadedAsset(asset.mp4);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }

        setLoadedAsset(asset.mp4);
        observer.disconnect();
      },
      { rootMargin: LAZY_LOAD_ROOT_MARGIN },
    );

    observer.observe(video);

    return () => observer.disconnect();
  }, [asset.mp4, playbackBlocked, reducedMotion, sourcesReady]);

  useEffect(() => {
    if (reducedMotion || playbackBlocked || !sourcesReady) {
      return;
    }

    videoRef.current?.load();
  }, [asset.mp4, playbackBlocked, reducedMotion, sourcesReady]);

  useEffect(() => {
    if (reducedMotion || playbackBlocked) {
      return undefined;
    }

    const video = videoRef.current;

    if (!video) {
      return undefined;
    }

    let active = true;
    let meaningfullyVisible = false;
    let onceCompleted = false;
    let playPending = false;
    let playbackFailed = false;
    let playAttemptToken = 0;

    const handlePlaybackFailure = (attemptToken: number, error: unknown) => {
      if (
        !active ||
        playbackFailed ||
        attemptToken !== playAttemptToken
      ) {
        return;
      }

      playPending = false;

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      playbackFailed = true;
      video.pause();
      setBlockedAsset(asset.mp4);
    };

    const pausePlayback = () => {
      playAttemptToken += 1;
      playPending = false;
      video.pause();
    };

    const attemptPlayback = () => {
      if (
        !sourcesReady ||
        !meaningfullyVisible ||
        document.visibilityState === "hidden" ||
        playbackFailed ||
        playPending ||
        (media.playback === "once" &&
          (onceCompleted || isAtEndingFrame(video)))
      ) {
        return;
      }

      const attemptToken = ++playAttemptToken;
      playPending = true;

      try {
        const playResult = video.play();

        void playResult.then(
          () => {
            if (active && attemptToken === playAttemptToken) {
              playPending = false;
            }
          },
          (error: unknown) => handlePlaybackFailure(attemptToken, error),
        );
      } catch (error) {
        handlePlaybackFailure(attemptToken, error);
      }
    };

    const resetOncePlayback = () => {
      onceCompleted = false;

      if (video.currentTime !== 0) {
        try {
          video.currentTime = 0;
        } catch {
          // A source can disappear during a responsive swap; the keyed video
          // will be replaced, so no additional recovery is needed here.
        }
      }
    };

    const handleIntersection = ([entry]: IntersectionObserverEntry[]) => {
      if (!entry) {
        return;
      }

      const fullyOutside =
        !entry.isIntersecting || entry.intersectionRatio <= 0;
      meaningfullyVisible =
        entry.isIntersecting &&
        entry.intersectionRatio >= MEANINGFUL_VISIBILITY;

      if (meaningfullyVisible) {
        attemptPlayback();
        return;
      }

      pausePlayback();

      if (fullyOutside && media.playback === "once") {
        resetOncePlayback();
      }
    };

    const handleEnded = () => {
      if (media.playback === "once") {
        onceCompleted = true;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pausePlayback();
        return;
      }

      attemptPlayback();
    };

    video.addEventListener("ended", handleEnded);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let observer: IntersectionObserver | undefined;

    if (typeof IntersectionObserver === "undefined") {
      meaningfullyVisible = true;
      attemptPlayback();
    } else {
      observer = new IntersectionObserver(handleIntersection, {
        rootMargin: "0px",
        threshold: [0, MEANINGFUL_VISIBILITY],
      });
      observer.observe(
        video.closest<HTMLElement>("[data-story-chapter]") ?? video,
      );
    }

    return () => {
      active = false;
      meaningfullyVisible = false;
      playAttemptToken += 1;
      playPending = false;
      observer?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      video.removeEventListener("ended", handleEnded);
      video.pause();
    };
  }, [asset.mp4, media.playback, playbackBlocked, reducedMotion, sourcesReady]);

  if (reducedMotion || playbackBlocked) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={className}
        loading={isPriority ? "eager" : "lazy"}
        src={asset.poster}
        style={visualStyle}
      />
    );
  }

  return (
    <video
      key={asset.mp4}
      ref={videoRef}
      aria-hidden="true"
      className={className}
      disablePictureInPicture
      loop={media.playback === "loop"}
      muted
      onError={() => setBlockedAsset(asset.mp4)}
      playsInline
      poster={sourcesReady ? asset.poster : undefined}
      preload={isPriority ? "auto" : sourcesReady ? "metadata" : "none"}
      style={visualStyle}
      tabIndex={-1}
    >
      {sourcesReady ? (
        <>
          <source src={asset.webm} type="video/webm" />
          <source src={asset.mp4} type="video/mp4" />
        </>
      ) : null}
    </video>
  );
}
