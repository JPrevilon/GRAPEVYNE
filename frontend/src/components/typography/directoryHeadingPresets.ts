import type { DirectoryHeadingDefinition } from "./DirectoryHeading";

export const DIRECTORY_PAGE_HEADINGS = {
  cellar: {
    ariaLabel: "YOUR CELLAR",
    segments: [
      { row: 1, size: "small", text: "YOUR", weight: "light" },
      { row: 2, size: "large", text: "CELLAR", weight: "regular" },
    ],
  },
  demoCellar: {
    ariaLabel: "DEMO CELLAR",
    segments: [
      { row: 1, size: "small", text: "DEMO", weight: "light" },
      { row: 2, size: "large", text: "CELLAR", weight: "regular" },
    ],
  },
  demoTasteAtlas: {
    ariaLabel: "DEMO TASTE ATLAS",
    segments: [
      { row: 1, size: "micro", text: "DEMO", weight: "light" },
      { row: 2, size: "large", text: "TASTE ATLAS", weight: "regular" },
    ],
  },
  discover: {
    ariaLabel: "DISCOVER WINES",
    segments: [
      { row: 1, size: "small", text: "DISCOVER", weight: "light" },
      { row: 2, size: "large", text: "WINES", weight: "regular" },
    ],
  },
  login: {
    ariaLabel: "RETURN TO YOUR CELLAR",
    segments: [
      { row: 1, size: "small", text: "RETURN TO", weight: "light" },
      { row: 2, size: "large", text: "YOUR CELLAR", weight: "regular" },
    ],
  },
  profile: {
    ariaLabel: "TASTE PROFILE",
    segments: [
      { row: 1, size: "small", text: "TASTE", weight: "light" },
      { row: 2, size: "large", text: "PROFILE", weight: "regular" },
    ],
  },
  signup: {
    ariaLabel: "CREATE YOUR CELLAR",
    segments: [
      { row: 1, size: "small", text: "CREATE", weight: "light" },
      { row: 2, size: "large", text: "YOUR CELLAR", weight: "regular" },
    ],
  },
} as const satisfies Record<string, DirectoryHeadingDefinition>;
