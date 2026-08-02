import type { DirectoryHeadingSegment } from "@/components/typography/DirectoryHeading";

export const STORY_CHAPTERS = [
  {
    anchorId: "chapter-01-hero",
    key: "hero",
    navLabel: "DISCOVERY",
    number: "01",
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
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "FIND THE BOTTLE KEEP THE MEMORY",
  },
  {
    anchorId: "chapter-02-discovery",
    key: "discovery",
    navLabel: "SEARCH",
    number: "02",
    headingSegments: [
      { row: 1, size: "small", text: "DESCRIBE", weight: "light" },
      { row: 2, size: "large", text: "THE MOMENT", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "DESCRIBE THE MOMENT",
  },
  {
    anchorId: "chapter-03-match",
    key: "match",
    navLabel: "MATCH LOGIC",
    number: "03",
    headingSegments: [
      { row: 1, size: "micro", text: "WHY", weight: "light" },
      { row: 2, size: "large", text: "IT FITS", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "WHY IT FITS",
  },
  {
    anchorId: "chapter-04-taste",
    key: "taste",
    navLabel: "TASTE SIGNALS",
    number: "04",
    headingSegments: [
      { row: 1, size: "small", text: "TASTE", weight: "light" },
      { row: 2, size: "large", text: "TAKES SHAPE", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "TASTE TAKES SHAPE",
  },
  {
    anchorId: "chapter-05-portal",
    key: "portal",
    navLabel: "PRIVATE CELLAR",
    number: "05",
    headingSegments: [
      { row: 1, size: "small", text: "OPEN", weight: "light" },
      { row: 2, size: "large", text: "THE CELLAR", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "OPEN THE CELLAR",
  },
  {
    anchorId: "chapter-06-cellar",
    key: "cellar",
    navLabel: "COLLECTION",
    number: "06",
    headingSegments: [
      { row: 1, size: "small", text: "BUILD", weight: "light" },
      { row: 2, size: "large", text: "THE COLLECTION", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "BUILD THE COLLECTION",
  },
  {
    anchorId: "chapter-07-memory",
    key: "memory",
    navLabel: "TASTING MEMORY",
    number: "07",
    headingSegments: [
      { row: 1, size: "small", text: "REMEMBER", weight: "light" },
      { row: 2, size: "large", text: "THE POUR", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "REMEMBER THE POUR",
  },
  {
    anchorId: "chapter-08-atlas",
    key: "atlas",
    navLabel: "TASTE ATLAS",
    number: "08",
    headingSegments: [
      { row: 1, size: "micro", text: "YOUR", weight: "light" },
      { row: 2, size: "large", text: "TASTE ATLAS", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "YOUR TASTE ATLAS",
  },
  {
    anchorId: "chapter-09-finale",
    key: "finale",
    navLabel: "GRAPEVYNE",
    number: "09",
    headingSegments: [
      { row: 1, size: "small", text: "KEEP", weight: "light" },
      { row: 2, size: "large", text: "THE STORY", weight: "regular" },
    ] satisfies readonly DirectoryHeadingSegment[],
    title: "KEEP THE STORY",
  },
] as const;

export type StoryChapterDefinition = (typeof STORY_CHAPTERS)[number];
export type StoryChapter = StoryChapterDefinition["key"];

export const STORY_CHAPTER_KEYS = STORY_CHAPTERS.map(
  ({ key }) => key,
) as readonly StoryChapter[];

export function getStoryChapter(chapter: StoryChapter) {
  return STORY_CHAPTERS.find(({ key }) => key === chapter) ?? STORY_CHAPTERS[0];
}
