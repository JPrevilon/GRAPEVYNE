export type MediaKey = "hero" | "liquid" | "cellar" | "memory" | "atlas";
export type MediaPlayback = "loop" | "once";

export interface DeviceAsset {
  mp4: string;
  poster: string;
  webm: string;
}

export interface MediaAsset {
  desktop: DeviceAsset;
  filter?: string;
  mobile: DeviceAsset;
  objectPosition?: {
    desktop?: string;
    mobile?: string;
  };
  opacity?: number;
  playback: MediaPlayback;
}

const root = "/assets/video";

export const CINEMATIC_MEDIA: Readonly<Record<MediaKey, MediaAsset>> = {
  hero: {
    desktop: {
      webm: `${root}/desktop/hero-bottle-macro.desktop.webm`,
      mp4: `${root}/desktop/hero-bottle-macro.desktop.mp4`,
      poster: `${root}/posters/desktop/hero-bottle-macro.desktop.jpg`,
    },
    mobile: {
      webm: `${root}/mobile/hero-bottle-macro.mobile.webm`,
      mp4: `${root}/mobile/hero-bottle-macro.mobile.mp4`,
      poster: `${root}/posters/mobile/hero-bottle-macro.mobile.jpg`,
    },
    playback: "loop",
    objectPosition: { desktop: "center", mobile: "center bottom" },
  },
  liquid: {
    desktop: {
      webm: `${root}/desktop/taste-liquid-transition.desktop.webm`,
      mp4: `${root}/desktop/taste-liquid-transition.desktop.mp4`,
      poster: `${root}/posters/desktop/taste-liquid-transition.desktop.jpg`,
    },
    mobile: {
      webm: `${root}/mobile/taste-liquid-transition.mobile.webm`,
      mp4: `${root}/mobile/taste-liquid-transition.mobile.mp4`,
      poster: `${root}/posters/mobile/taste-liquid-transition.mobile.jpg`,
    },
    playback: "loop",
    objectPosition: { desktop: "center", mobile: "center" },
  },
  cellar: {
    desktop: {
      webm: `${root}/desktop/cellar-corridor-push.desktop.webm`,
      mp4: `${root}/desktop/cellar-corridor-push.desktop.mp4`,
      poster: `${root}/posters/desktop/cellar-corridor-push.desktop.jpg`,
    },
    mobile: {
      webm: `${root}/mobile/cellar-corridor-push.mobile.webm`,
      mp4: `${root}/mobile/cellar-corridor-push.mobile.mp4`,
      poster: `${root}/posters/mobile/cellar-corridor-push.mobile.jpg`,
    },
    playback: "once",
    objectPosition: { desktop: "center", mobile: "center" },
  },
  memory: {
    desktop: {
      webm: `${root}/desktop/memory-table-ambience.desktop.webm`,
      mp4: `${root}/desktop/memory-table-ambience.desktop.mp4`,
      poster: `${root}/posters/desktop/memory-table-ambience.desktop.jpg`,
    },
    mobile: {
      webm: `${root}/mobile/memory-table-ambience.mobile.webm`,
      mp4: `${root}/mobile/memory-table-ambience.mobile.mp4`,
      poster: `${root}/posters/mobile/memory-table-ambience.mobile.jpg`,
    },
    playback: "loop",
    objectPosition: { desktop: "center", mobile: "center" },
  },
  atlas: {
    desktop: {
      webm: `${root}/desktop/taste-atlas-finale.desktop.webm`,
      mp4: `${root}/desktop/taste-atlas-finale.desktop.mp4`,
      poster: `${root}/posters/desktop/taste-atlas-finale.desktop.jpg`,
    },
    mobile: {
      webm: `${root}/mobile/taste-atlas-finale.mobile.webm`,
      mp4: `${root}/mobile/taste-atlas-finale.mobile.mp4`,
      poster: `${root}/posters/mobile/taste-atlas-finale.mobile.jpg`,
    },
    playback: "once",
    objectPosition: { desktop: "center", mobile: "center" },
    filter: "brightness(0.68) saturate(0.78)",
    opacity: 0.9,
  },
};
