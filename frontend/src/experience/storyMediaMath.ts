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
