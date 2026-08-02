export const STORY_CHAPTERS = [
  {
    anchorId: "chapter-01-hero",
    key: "hero",
    navLabel: "DISCOVERY",
    number: "01",
    title: "FIND THE BOTTLE",
  },
  {
    anchorId: "chapter-02-discovery",
    key: "discovery",
    navLabel: "SEARCH",
    number: "02",
    title: "DESCRIBE THE MOMENT",
  },
  {
    anchorId: "chapter-03-match",
    key: "match",
    navLabel: "MATCH LOGIC",
    number: "03",
    title: "WHY IT FITS",
  },
  {
    anchorId: "chapter-04-taste",
    key: "taste",
    navLabel: "TASTE SIGNALS",
    number: "04",
    title: "TASTE TAKES SHAPE",
  },
  {
    anchorId: "chapter-05-portal",
    key: "portal",
    navLabel: "PRIVATE CELLAR",
    number: "05",
    title: "OPEN THE CELLAR",
  },
  {
    anchorId: "chapter-06-cellar",
    key: "cellar",
    navLabel: "COLLECTION",
    number: "06",
    title: "BUILD THE COLLECTION",
  },
  {
    anchorId: "chapter-07-memory",
    key: "memory",
    navLabel: "TASTING MEMORY",
    number: "07",
    title: "REMEMBER THE POUR",
  },
  {
    anchorId: "chapter-08-atlas",
    key: "atlas",
    navLabel: "TASTE ATLAS",
    number: "08",
    title: "YOUR TASTE ATLAS",
  },
  {
    anchorId: "chapter-09-finale",
    key: "finale",
    navLabel: "GRAPEVYNE",
    number: "09",
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
