export const STORY_CHAPTERS = [
  {
    anchorId: "chapter-01-hero",
    key: "hero",
    navLabel: "Find",
    number: "01",
    title: "Find the Bottle",
  },
  {
    anchorId: "chapter-02-discovery",
    key: "discovery",
    navLabel: "Discover",
    number: "02",
    title: "Describe the Moment",
  },
  {
    anchorId: "chapter-03-match",
    key: "match",
    navLabel: "Match",
    number: "03",
    title: "Why It Fits",
  },
  {
    anchorId: "chapter-04-taste",
    key: "taste",
    navLabel: "Taste",
    number: "04",
    title: "Taste Takes Shape",
  },
  {
    anchorId: "chapter-05-portal",
    key: "portal",
    navLabel: "Enter",
    number: "05",
    title: "Your Cellar Awaits",
  },
  {
    anchorId: "chapter-06-cellar",
    key: "cellar",
    navLabel: "Cellar",
    number: "06",
    title: "A Place for Every Bottle",
  },
  {
    anchorId: "chapter-07-memory",
    key: "memory",
    navLabel: "Remember",
    number: "07",
    title: "Save the Memory",
  },
  {
    anchorId: "chapter-08-atlas",
    key: "atlas",
    navLabel: "Atlas",
    number: "08",
    title: "Your Taste Atlas",
  },
  {
    anchorId: "chapter-09-finale",
    key: "finale",
    navLabel: "Begin",
    number: "09",
    title: "From Vine to Memory",
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
