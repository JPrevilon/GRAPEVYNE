const SEEK_END_EPSILON_SECONDS = 0.04;

export function clampStoryProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function getScrubTime(progress: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return (
    clampStoryProgress(progress) *
    Math.max(0, duration - SEEK_END_EPSILON_SECONDS)
  );
}

export function getMediaTransition(progress: number) {
  const value = clampStoryProgress(progress);
  const fadeOut = clampStoryProgress((value - 0.7) / 0.14);
  const fadeIn = clampStoryProgress((value - 0.9) / 0.1);
  const currentOpacity = 1 - fadeOut;
  const nextOpacity = fadeIn;
  const veilOpacity = Math.min(
    clampStoryProgress((value - 0.7) / 0.16),
    1 - clampStoryProgress((value - 0.86) / 0.14),
  );

  return { currentOpacity, nextOpacity, veilOpacity };
}
