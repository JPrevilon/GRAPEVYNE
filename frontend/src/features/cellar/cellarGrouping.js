const STEAK_TERMS = ["steak", "cabernet", "malbec", "syrah", "rib", "beef"];
const DATE_TERMS = ["date", "pinot", "champagne", "dinner", "romantic"];
const GIFT_TERMS = ["gift", "celebration", "champagne", "brut", "toast"];

function searchableText(entry) {
  const wine = entry.wine || {};

  return [
    wine.name,
    wine.winery,
    wine.varietal,
    wine.region,
    wine.country,
    wine.vintage,
    wine.description,
    entry.occasion,
    entry.notes,
    entry.status,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAny(entry, terms) {
  const text = searchableText(entry);
  return terms.some((term) => text.includes(term));
}

function sortedBySavedDate(entries) {
  return [...entries].sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
  );
}

function sortedByVintage(entries) {
  return [...entries].sort((a, b) => {
    const aVintage = Number.parseInt(a.wine?.vintage, 10);
    const bVintage = Number.parseInt(b.wine?.vintage, 10);

    if (Number.isNaN(aVintage) && Number.isNaN(bVintage)) {
      return 0;
    }

    if (Number.isNaN(aVintage)) {
      return 1;
    }

    if (Number.isNaN(bVintage)) {
      return -1;
    }

    return aVintage - bVintage;
  });
}

function uniqueEntries(entries) {
  const seen = new Set();

  return entries.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }

    seen.add(entry.id);
    return true;
  });
}

function topFallback(entries, count = 4) {
  return sortedBySavedDate(entries).slice(0, count);
}

export function buildCellarShelves(entries) {
  const recentEntries = sortedBySavedDate(entries);
  const favoriteEntries = entries.filter((entry) => entry.favorite);
  const steakEntries = entries.filter((entry) => matchesAny(entry, STEAK_TERMS));
  const dateEntries = entries.filter((entry) => matchesAny(entry, DATE_TERMS));
  const rareEntries = sortedByVintage(
    entries.filter((entry) => {
      const vintage = Number.parseInt(entry.wine?.vintage, 10);
      return !Number.isNaN(vintage) && vintage <= 2020;
    })
  );
  const giftEntries = entries.filter((entry) => matchesAny(entry, GIFT_TERMS));

  return [
    {
      id: "favorites",
      title: "Favorites",
      eyebrow: "Loved bottles",
      entries: favoriteEntries.length ? favoriteEntries : topFallback(entries),
    },
    {
      id: "recent",
      title: "Recently Tried",
      eyebrow: "Newest notes",
      entries: recentEntries.slice(0, 6),
    },
    {
      id: "steak",
      title: "Best for Steak",
      eyebrow: "Deep reds",
      entries: steakEntries.length ? steakEntries : topFallback(entries, 3),
    },
    {
      id: "date-night",
      title: "Best for Date Night",
      eyebrow: "Dinner mood",
      entries: dateEntries.length ? dateEntries : topFallback(entries, 3),
    },
    {
      id: "rare-vintages",
      title: "Rare Vintages",
      eyebrow: "Older finds",
      entries: rareEntries.length ? rareEntries : sortedByVintage(entries).slice(0, 3),
    },
    {
      id: "gifts",
      title: "Gifts / Celebrations",
      eyebrow: "Bring or send",
      entries: giftEntries.length ? giftEntries : topFallback(entries, 3),
    },
  ].map((shelf) => ({
    ...shelf,
    entries: uniqueEntries(shelf.entries),
  }));
}

