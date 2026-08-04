import type { DirectoryHeadingSegment } from "@/components/typography/DirectoryHeading";

import type { MediaKey } from "./media";

export type StorySubject = "bottle" | "grapes" | "none";

interface StoryChapterConfig {
  anchorId: string;
  headingSegments: readonly DirectoryHeadingSegment[];
  key: string;
  mediaKey: MediaKey;
  navLabel: string;
  number: string;
  subject: StorySubject;
  supportingLine: string;
  title: string;
}

export const STORY_CHAPTERS = [
  {
    anchorId: "chapter-01-hero",
    key: "hero",
    mediaKey: "hero",
    navLabel: "DISCOVERY",
    number: "01",
    subject: "bottle",
    supportingLine: "A private wine directory shaped by what you love.",
    headingSegments: [
      { row: 1, size: "small", text: "FIND THE", weight: "light" },
      { row: 1, size: "large", text: "BOTTLE", weight: "regular" },
      { row: 2, size: "micro", text: "KEEP THE", weight: "light" },
      {
        accent: true,
        row: 2,
        size: "medium",
        text: "MEMORY",
        weight: "regular",
      },
    ],
    title: "FIND THE BOTTLE KEEP THE MEMORY",
  },
  {
    anchorId: "chapter-02-discovery",
    key: "discovery",
    mediaKey: "vineyard",
    navLabel: "VINEYARD",
    number: "02",
    subject: "grapes",
    supportingLine: "Meal, mood, region, or price.",
    headingSegments: [
      { row: 1, size: "small", text: "DESCRIBE", weight: "light" },
      { row: 2, size: "large", text: "THE MOMENT", weight: "regular" },
    ],
    title: "DESCRIBE THE MOMENT",
  },
  {
    anchorId: "chapter-03-match",
    key: "match",
    mediaKey: "dateNight",
    navLabel: "TABLE",
    number: "03",
    subject: "none",
    supportingLine: "Clear reasons, not a mystery score.",
    headingSegments: [
      { row: 1, size: "micro", text: "WHY", weight: "light" },
      { row: 2, size: "large", text: "IT FITS", weight: "regular" },
    ],
    title: "WHY IT FITS",
  },
  {
    anchorId: "chapter-04-taste",
    key: "taste",
    mediaKey: "liquid",
    navLabel: "TASTE SIGNALS",
    number: "04",
    subject: "none",
    supportingLine: "Every rating sharpens the profile.",
    headingSegments: [
      { row: 1, size: "small", text: "TASTE", weight: "light" },
      { row: 2, size: "large", text: "TAKES SHAPE", weight: "regular" },
    ],
    title: "TASTE TAKES SHAPE",
  },
  {
    anchorId: "chapter-05-portal",
    key: "portal",
    mediaKey: "cellar",
    navLabel: "PRIVATE CELLAR",
    number: "05",
    subject: "bottle",
    supportingLine: "Save the bottles worth remembering.",
    headingSegments: [
      { row: 1, size: "small", text: "OPEN", weight: "light" },
      { row: 2, size: "large", text: "THE CELLAR", weight: "regular" },
    ],
    title: "OPEN THE CELLAR",
  },
  {
    anchorId: "chapter-06-cellar",
    key: "cellar",
    mediaKey: "barrelHouse",
    navLabel: "COLLECTION",
    number: "06",
    subject: "none",
    supportingLine: "A private record of the bottles that matter.",
    headingSegments: [
      { row: 1, size: "small", text: "BUILD", weight: "light" },
      { row: 2, size: "large", text: "THE COLLECTION", weight: "regular" },
    ],
    title: "BUILD THE COLLECTION",
  },
  {
    anchorId: "chapter-07-memory",
    key: "memory",
    mediaKey: "memory",
    navLabel: "MEMORY",
    number: "07",
    subject: "none",
    supportingLine: "The bottle, the place, the night.",
    headingSegments: [
      { row: 1, size: "small", text: "REMEMBER", weight: "light" },
      { row: 2, size: "large", text: "THE POUR", weight: "regular" },
    ],
    title: "REMEMBER THE POUR",
  },
  {
    anchorId: "chapter-08-atlas",
    key: "atlas",
    mediaKey: "atlas",
    navLabel: "TASTE ATLAS",
    number: "08",
    subject: "bottle",
    supportingLine: "See the patterns behind what you love.",
    headingSegments: [
      { row: 1, size: "small", text: "FOLLOW", weight: "light" },
      { row: 2, size: "large", text: "YOUR TASTE", weight: "regular" },
    ],
    title: "FOLLOW YOUR TASTE",
  },
  {
    anchorId: "chapter-09-finale",
    key: "finale",
    mediaKey: "oceanVoyage",
    navLabel: "JOURNEY",
    number: "09",
    subject: "none",
    supportingLine: "From vineyard to table, every bottle leaves a trace.",
    headingSegments: [
      { row: 1, size: "small", text: "KEEP", weight: "light" },
      { row: 2, size: "large", text: "THE STORY", weight: "regular" },
    ],
    title: "KEEP THE STORY",
  },
] as const satisfies readonly StoryChapterConfig[];

export type StoryChapterDefinition = (typeof STORY_CHAPTERS)[number];
export type StoryChapter = StoryChapterDefinition["key"];

export const STORY_CHAPTER_KEYS = STORY_CHAPTERS.map(
  ({ key }) => key,
) as readonly StoryChapter[];

export const STORY_SUBJECTS = Object.fromEntries(
  STORY_CHAPTERS.map(({ key, subject }) => [key, subject]),
) as Record<StoryChapter, StorySubject>;

export function getStoryChapter(chapter: StoryChapter) {
  return STORY_CHAPTERS.find(({ key }) => key === chapter) ?? STORY_CHAPTERS[0];
}
