import { useEffect, useState } from "react";

import { getBottleTone, type BottleTone } from "./bottleTone";

interface WineBottleFallbackProps {
  label?: string;
  tone?: BottleTone;
}

export function WineBottleFallback({
  label = "GRAPEVYNE",
  tone = "red",
}: WineBottleFallbackProps) {
  return (
    <span aria-hidden="true" className={`gv-bottle gv-bottle--${tone}`}>
      <span className="gv-bottle__capsule" />
      <span className="gv-bottle__glass">
        <span className="gv-bottle__shine" />
        <span className="gv-bottle__label">
          <b>G</b>
          <small>{label}</small>
        </span>
      </span>
    </span>
  );
}

interface WineVisualProps {
  alt?: string;
  imageUrl?: string | null;
  label: string;
  loading?: "eager" | "lazy";
  varietal?: string | null;
}

export function WineVisual({
  alt = "",
  imageUrl,
  label,
  loading = "lazy",
  varietal,
}: WineVisualProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  if (imageUrl && !imageFailed) {
    return (
      <img
        alt={alt}
        loading={loading}
        onError={() => setImageFailed(true)}
        src={imageUrl}
      />
    );
  }

  return (
    <WineBottleFallback label={label} tone={getBottleTone(varietal)} />
  );
}
