import { useEffect, useState } from "react";

import { useReducedMotion } from "./useReducedMotion";

interface NavigatorWithConnection extends Navigator {
  connection?: {
    addEventListener?: (type: "change", listener: () => void) => void;
    removeEventListener?: (type: "change", listener: () => void) => void;
    saveData?: boolean;
  };
}

function readsSaveData() {
  if (typeof navigator === "undefined") return false;
  return (navigator as NavigatorWithConnection).connection?.saveData === true;
}

export function useStoryStaticMode() {
  const reducedMotion = useReducedMotion();
  const [saveData, setSaveData] = useState(readsSaveData);

  useEffect(() => {
    const connection = (navigator as NavigatorWithConnection).connection;
    const handleChange = () => setSaveData(readsSaveData());

    connection?.addEventListener?.("change", handleChange);
    return () => connection?.removeEventListener?.("change", handleChange);
  }, []);

  return {
    reason: reducedMotion ? "reduced-motion" : saveData ? "save-data" : null,
    staticMode: reducedMotion || saveData,
  } as const;
}
