export type MediaKey =
  | "hero"
  | "vineyard"
  | "dateNight"
  | "liquid"
  | "cellar"
  | "barrelHouse"
  | "memory"
  | "atlas"
  | "oceanVoyage";

export interface DeviceAsset {
  mp4: string;
  poster: string;
  webm: string;
}

export interface MediaAsset {
  desktop: DeviceAsset;
  mobile: DeviceAsset;
  objectPosition?: {
    desktop?: string;
    mobile?: string;
  };
}

const root = "/assets/video";

function acceptedScrubAsset(slug: string, device: "desktop" | "mobile") {
  return {
    mp4: `${root}/scrub/${device}/${slug}.${device}.mp4`,
    poster: `${root}/posters/${device}/${slug}.${device}.jpg`,
    webm: `${root}/scrub/${device}/${slug}.${device}.webm`,
  };
}

function newScrubAsset(slug: string, device: "desktop" | "mobile") {
  return {
    mp4: `${root}/${device}/${slug}.${device}.mp4`,
    poster: `${root}/posters/${device}/${slug}.${device}.jpg`,
    webm: `${root}/${device}/${slug}.${device}.webm`,
  };
}

export const CINEMATIC_MEDIA: Readonly<Record<MediaKey, MediaAsset>> = {
  hero: {
    desktop: acceptedScrubAsset("hero-bottle-macro", "desktop"),
    mobile: acceptedScrubAsset("hero-bottle-macro", "mobile"),
    objectPosition: { desktop: "center", mobile: "center bottom" },
  },
  vineyard: {
    desktop: newScrubAsset("vineyard-flight", "desktop"),
    mobile: newScrubAsset("vineyard-flight", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
  dateNight: {
    desktop: newScrubAsset("date-night-table-pan", "desktop"),
    mobile: newScrubAsset("date-night-table-pan", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
  liquid: {
    desktop: acceptedScrubAsset("taste-liquid-transition", "desktop"),
    mobile: acceptedScrubAsset("taste-liquid-transition", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
  cellar: {
    desktop: acceptedScrubAsset("cellar-corridor-push", "desktop"),
    mobile: acceptedScrubAsset("cellar-corridor-push", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
  barrelHouse: {
    desktop: newScrubAsset("barrel-house-pan", "desktop"),
    mobile: newScrubAsset("barrel-house-pan", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
  memory: {
    desktop: acceptedScrubAsset("memory-table-ambience", "desktop"),
    mobile: acceptedScrubAsset("memory-table-ambience", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
  atlas: {
    desktop: acceptedScrubAsset("taste-atlas-finale", "desktop"),
    mobile: acceptedScrubAsset("taste-atlas-finale", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
  oceanVoyage: {
    desktop: newScrubAsset("ocean-wine-voyage", "desktop"),
    mobile: newScrubAsset("ocean-wine-voyage", "mobile"),
    objectPosition: { desktop: "center", mobile: "center" },
  },
};
