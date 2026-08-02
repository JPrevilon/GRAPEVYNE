import { type PropsWithChildren, useEffect, useMemo, useState } from "react";

import {
  SceneContext,
  type StoryChapter,
} from "./sceneContextValue";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function SceneProvider({ children }: PropsWithChildren) {
  const [chapter, setChapter] = useState<StoryChapter>("hero");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const value = useMemo(
    () => ({ chapter, prefersReducedMotion, setChapter }),
    [chapter, prefersReducedMotion]
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
}
