const STEAK_TERMS = [
  "steak",
  "beef",
  "red meat",
  "ribeye",
  "lamb",
  "grilled meat",
  "barbecue",
  "cabernet",
  "malbec",
  "syrah",
  "bordeaux",
  "rioja",
  "barolo",
  "zinfandel",
];

const DATE_TERMS = [
  "date",
  "date night",
  "dinner",
  "romantic",
  "anniversary",
  "pinot",
  "champagne",
  "sparkling",
  "silky",
  "elegant",
];

const RARE_TERMS = [
  "rare",
  "limited",
  "library",
  "reserve",
  "single vineyard",
  "old vine",
  "grand cru",
  "gran reserva",
  "collectible",
];

const GIFT_TERMS = [
  "gift",
  "celebration",
  "birthday",
  "wedding",
  "holiday",
  "promotion",
  "toast",
  "party",
  "champagne",
  "sparkling",
  "brut",
];

function compactList(values) {
  return values
    .flat()
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => String(value));
}

function normalizeTags(entry) {
  return compactList([
    Array.isArray(entry.tags) ? entry.tags : [],
    Array.isArray(entry.occasionTags) ? entry.occasionTags : [],
    entry.occasion,
    entry.category,
    entry.status,
  ]);
}

function wineText(entry) {
  const wine = entry.wine || {};
  const apiDetails = entry.apiDetails || {};

  return compactList([
    entry.wineName,
    entry.winery,
    entry.type,
    entry.style,
    entry.category,
    entry.tastingNotes,
    entry.notes,
    entry.occasion,
    entry.status,
    normalizeTags(entry),
    entry.pairingSuggestions || [],
    apiDetails.foodPairings || [],
    apiDetails.tastingProfile || [],
    apiDetails.grapes || [],
    wine.name,
    wine.winery,
    wine.varietal,
    wine.region,
    wine.country,
    wine.vintage,
    wine.description,
  ])
    .join(" ")
    .toLowerCase();
}

function tagOccasionPairingText(entry) {
  const apiDetails = entry.apiDetails || {};

  return compactList([
    normalizeTags(entry),
    entry.occasion,
    entry.pairingSuggestions || [],
    apiDetails.foodPairings || [],
  ])
    .join(" ")
    .toLowerCase();
}

function groupingText(entry) {
  return compactList([tagOccasionPairingText(entry), wineText(entry)])
    .join(" ")
    .toLowerCase();
}

function matchesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function parsedVintage(entry) {
  const value = entry.vintage ?? entry.wine?.vintage;
  const vintage = Number.parseInt(value, 10);
  return Number.isNaN(vintage) ? null : vintage;
}

function dateValue(value) {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
}

function getDateAdded(entry) {
  return (
    entry.dateAdded ||
    entry.date_added ||
    entry.savedAt ||
    entry.saved_at ||
    entry.createdAt ||
    entry.created_at ||
    null
  );
}

function getDateConsumed(entry) {
  return (
    entry.dateConsumed ||
    entry.date_consumed ||
    entry.dateTried ||
    entry.date_tried ||
    entry.consumedAt ||
    entry.consumed_at ||
    entry.tastedAt ||
    entry.tasted_at ||
    null
  );
}

function sortByRecent(entries) {
  return [...entries].sort((a, b) => {
    const aDate = dateValue(a.dateConsumed || a.dateAdded || a.updatedAt);
    const bDate = dateValue(b.dateConsumed || b.dateAdded || b.updatedAt);
    return bDate - aDate;
  });
}

function sortByRating(entries) {
  return [...entries].sort((a, b) => {
    const ratingDelta = Number(b.personalRating || 0) - Number(a.personalRating || 0);

    if (ratingDelta !== 0) {
      return ratingDelta;
    }

    return dateValue(b.dateAdded) - dateValue(a.dateAdded);
  });
}

function sortByRare(entries) {
  return [...entries].sort((a, b) => {
    const aScore = a.apiDetails?.rarityScore ?? 0;
    const bScore = b.apiDetails?.rarityScore ?? 0;

    if (aScore !== bScore) {
      return bScore - aScore;
    }

    return (parsedVintage(a) || 9999) - (parsedVintage(b) || 9999);
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

function fallbackEntries(entries, count = 4) {
  return sortByRating(entries).slice(0, count);
}

function inferWineType(value = "") {
  const text = value.toLowerCase();

  if (text.includes("champagne") || text.includes("sparkling") || text.includes("brut")) {
    return "sparkling";
  }

  if (
    text.includes("sauvignon blanc") ||
    text.includes("chardonnay") ||
    text.includes("riesling") ||
    text.includes("sancerre") ||
    text.includes("white")
  ) {
    return "white";
  }

  if (text.includes("rose") || text.includes("rosé")) {
    return "rose";
  }

  return "red";
}

function inferPairings(entry) {
  const text = wineText(entry);
  const type = entry.type || inferWineType(`${entry.wine?.varietal || ""} ${entry.style || ""}`);

  if (matchesAny(text, STEAK_TERMS)) {
    return ["Steak", "Red meat", "Aged cheese"];
  }

  if (matchesAny(text, DATE_TERMS)) {
    return ["Dinner", "Roast chicken", "Soft cheeses"];
  }

  if (type === "white") {
    return ["Seafood", "Goat cheese", "Spring vegetables"];
  }

  if (type === "sparkling") {
    return ["Oysters", "Fried chicken", "Celebration toast"];
  }

  return ["Charcuterie", "Roast dinner", "Aged cheese"];
}

function buildApiDetails(entry) {
  const wine = entry.wine || {};
  const existingDetails = entry.apiDetails || {};

  return {
    criticScore:
      existingDetails.criticScore ??
      (wine.averageRating ? Math.round(Number(wine.averageRating) * 20) : null),
    averagePrice:
      existingDetails.averagePrice ??
      (wine.priceCents ? Math.round(Number(wine.priceCents) / 100) : null),
    grapes: existingDetails.grapes || (wine.varietal ? [wine.varietal] : []),
    appellation: existingDetails.appellation || wine.region || entry.region || "",
    producerDescription:
      existingDetails.producerDescription || wine.description || entry.description || "",
    tastingProfile: existingDetails.tastingProfile || [],
    foodPairings: existingDetails.foodPairings || entry.pairingSuggestions || [],
    rarityScore: existingDetails.rarityScore ?? null,
    imageUrl: existingDetails.imageUrl || wine.imageUrl || entry.imageUrl || null,
  };
}

export function normalizeCellarEntry(entry) {
  const wine = entry.wine || {};
  const apiDetails = buildApiDetails(entry);
  const dateAdded = getDateAdded(entry);
  const dateConsumed = getDateConsumed(entry);
  const occasionTags = normalizeTags(entry);
  const style = entry.style || wine.varietal || "Cellar selection";
  const type = entry.type || inferWineType(`${style} ${wine.name || entry.wineName || ""}`);
  const pairingSuggestions = compactList([
    entry.pairingSuggestions || [],
    apiDetails.foodPairings || [],
  ]);

  return {
    ...entry,
    id: entry.id,
    wineName: entry.wineName || wine.name || "Untitled bottle",
    winery: entry.winery || wine.winery || "Unknown winery",
    vintage: entry.vintage ?? wine.vintage ?? null,
    region: entry.region || wine.region || "",
    country: entry.country || wine.country || "",
    type,
    style,
    imageUrl: entry.imageUrl || apiDetails.imageUrl || wine.imageUrl || null,
    personalRating: entry.personalRating ?? entry.userRating ?? null,
    tastingNotes: entry.tastingNotes ?? entry.notes ?? "",
    pairingSuggestions: pairingSuggestions.length ? pairingSuggestions : inferPairings(entry),
    category: entry.category || entry.status || "saved",
    isFavorite: entry.isFavorite ?? Boolean(entry.favorite),
    dateAdded,
    dateConsumed,
    occasion: entry.occasion || "",
    occasionTags,
    apiDetails,
    userCellar: {
      notes: entry.notes ?? entry.tastingNotes ?? "",
      rating: entry.userRating ?? entry.personalRating ?? null,
      occasion: entry.occasion || "",
      favorite: entry.favorite ?? entry.isFavorite ?? false,
      tags: occasionTags,
      status: entry.status || "saved",
      dateAdded,
      dateConsumed,
      createdAt: entry.createdAt || entry.created_at || null,
      updatedAt: entry.updatedAt || entry.updated_at || null,
    },
    wineDetails: {
      id: wine.id || entry.wineId || entry.externalWineId || null,
      externalWineId:
        entry.externalWineId || wine.externalWineId || wine.externalApiId || null,
      source: wine.source || entry.source || "cellar",
      name: wine.name || entry.wineName || "Untitled bottle",
      winery: wine.winery || entry.winery || "Unknown winery",
      vintage: wine.vintage ?? entry.vintage ?? null,
      region: wine.region || entry.region || "",
      country: wine.country || entry.country || "",
      type,
      style,
      imageUrl: wine.imageUrl || entry.imageUrl || apiDetails.imageUrl || null,
      description: wine.description || entry.description || "",
      averageRating: wine.averageRating ?? null,
      priceCents: wine.priceCents ?? null,
      pairingSuggestions: pairingSuggestions.length
        ? pairingSuggestions
        : inferPairings(entry),
    },
  };
}

export function normalizeCellarEntries(entries = []) {
  return entries.map(normalizeCellarEntry);
}

export function buildOpenCellarShelves(entries = []) {
  const normalizedEntries = normalizeCellarEntries(entries);
  const recentEntries = sortByRecent(normalizedEntries);
  const favoriteEntries = normalizedEntries.filter((entry) => entry.isFavorite);
  const steakEntries = normalizedEntries.filter((entry) =>
    matchesAny(groupingText(entry), STEAK_TERMS)
  );
  const dateEntries = normalizedEntries.filter((entry) =>
    matchesAny(groupingText(entry), DATE_TERMS)
  );
  const rareEntries = sortByRare(
    normalizedEntries.filter((entry) => {
      const vintage = parsedVintage(entry);
      const isOlderVintage = vintage && vintage <= new Date().getFullYear() - 8;
      const hasRareSignal = matchesAny(wineText(entry), RARE_TERMS);

      return Number(entry.apiDetails?.rarityScore) >= 70 || isOlderVintage || hasRareSignal;
    })
  );
  const giftEntries = normalizedEntries.filter((entry) =>
    matchesAny(groupingText(entry), GIFT_TERMS)
  );

  return [
    {
      id: "favorites",
      title: "Favorites",
      eyebrow: "Private reserve",
      mood: "Loved bottles with a little gravity.",
      entries: favoriteEntries.length ? favoriteEntries : fallbackEntries(normalizedEntries),
    },
    {
      id: "recently-tried",
      title: "Recently Tried",
      eyebrow: "Newest memories",
      mood: "The latest pours, notes, and near misses.",
      entries: recentEntries.slice(0, 6),
    },
    {
      id: "best-for-steak",
      title: "Best for Steak",
      eyebrow: "Fire and tannin",
      mood: "Structured reds for the serious plate.",
      entries: steakEntries.length ? steakEntries : fallbackEntries(normalizedEntries),
    },
    {
      id: "date-night",
      title: "Best for Date Night",
      eyebrow: "Low light bottles",
      mood: "Elegant, generous, and ready for a slower dinner.",
      entries: dateEntries.length ? dateEntries : fallbackEntries(normalizedEntries),
    },
    {
      id: "rare-vintages",
      title: "Rare Vintages",
      eyebrow: "Hidden room",
      mood: "Older, prized, or quietly collectible bottles.",
      entries: rareEntries.length ? rareEntries : sortByRare(normalizedEntries).slice(0, 4),
    },
    {
      id: "gifts-celebrations",
      title: "Gifts / Celebrations",
      eyebrow: "Bring or send",
      mood: "Bottles with a little ceremony built in.",
      entries: giftEntries.length ? giftEntries : fallbackEntries(normalizedEntries),
    },
  ].map((shelf) => ({
    ...shelf,
    entries: uniqueEntries(shelf.entries).slice(0, 8),
  }));
}
