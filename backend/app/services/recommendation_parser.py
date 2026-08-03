import re
import unicodedata
from dataclasses import dataclass, field


_SPACE_RE = re.compile(r"\s+")
_TOKEN_RE = re.compile(r"[a-z0-9]+(?:['-][a-z0-9]+)?")


@dataclass(frozen=True)
class ParsedBudget:
    minimum_cents: int | None = None
    maximum_cents: int | None = None

    def to_dict(self):
        return {
            "minimumCents": self.minimum_cents,
            "maximumCents": self.maximum_cents,
        }


@dataclass(frozen=True)
class ParserEvidence:
    dimension: str
    value: str
    matched_text: str

    def to_dict(self):
        return {
            "dimension": self.dimension,
            "value": self.value,
            "matchedText": self.matched_text,
        }


@dataclass(frozen=True)
class ParserWarning:
    code: str
    message: str

    def to_dict(self):
        return {"code": self.code, "message": self.message}


@dataclass
class RecommendationIntent:
    categories: list[str] = field(default_factory=list)
    varietals: list[str] = field(default_factory=list)
    regions: list[str] = field(default_factory=list)
    countries: list[str] = field(default_factory=list)
    bodies: list[str] = field(default_factory=list)
    acidities: list[str] = field(default_factory=list)
    tannins: list[str] = field(default_factory=list)
    sweetness: list[str] = field(default_factory=list)
    excluded_sweetness: list[str] = field(default_factory=list)
    pairings: list[str] = field(default_factory=list)
    flavors: list[str] = field(default_factory=list)
    occasions: list[str] = field(default_factory=list)
    novelty: str | None = None
    budget: ParsedBudget | None = None
    evidence: list[ParserEvidence] = field(default_factory=list)
    warnings: list[ParserWarning] = field(default_factory=list)
    unparsed_terms: list[str] = field(default_factory=list)

    def to_dict(self):
        return {
            "categories": self.categories,
            "varietals": self.varietals,
            "regions": self.regions,
            "countries": self.countries,
            "bodies": self.bodies,
            "acidities": self.acidities,
            "tannins": self.tannins,
            "sweetness": self.sweetness,
            "excludedSweetness": self.excluded_sweetness,
            "pairings": self.pairings,
            "flavors": self.flavors,
            "occasions": self.occasions,
            "novelty": self.novelty,
            "budget": self.budget.to_dict() if self.budget else None,
            "evidence": [item.to_dict() for item in self.evidence],
            "warnings": [item.to_dict() for item in self.warnings],
            "unparsedTerms": self.unparsed_terms,
        }

    def has_request_constraints(self):
        return bool(
            self.categories
            or self.varietals
            or self.regions
            or self.countries
            or self.bodies
            or self.acidities
            or self.tannins
            or self.sweetness
            or self.excluded_sweetness
            or self.pairings
            or self.flavors
            or self.occasions
            or self.budget
            or self.novelty
        )


class RecommendationIntentParser:
    """Controlled, catalog-aware natural-language parser.

    Only exact dictionary phrases and explicit budget syntax become scoring
    constraints. Remaining informative tokens are surfaced, never scored.
    """

    phrase_maps = {
        "category": {
            "sparkling wine": "sparkling",
            "sparkling": "sparkling",
            "champagne": "sparkling",
            "rose wine": "rosé",
            "rosé": "rosé",
            "rose": "rosé",
            "red wine": "red",
            "white wine": "white",
            "red": "red",
            "white": "white",
        },
        "varietal": {
            "cabernet sauvignon": "Cabernet Sauvignon",
            "sauvignon blanc": "Sauvignon Blanc",
            "pinot noir": "Pinot Noir",
            "champagne blend": "Champagne Blend",
            "sangiovese": "Sangiovese",
            "tempranillo": "Tempranillo",
            "cabernet": "Cabernet Sauvignon",
        },
        "region": {
            "willamette valley": "Willamette Valley",
            "napa valley": "Napa Valley",
            "calistoga": "Calistoga",
            "champagne": "Champagne",
            "tuscany": "Tuscany",
            "rioja": "Rioja",
        },
        "country": {
            "united states": "United States",
            "american": "United States",
            "french": "France",
            "france": "France",
            "italian": "Italy",
            "italy": "Italy",
            "spanish": "Spain",
            "spain": "Spain",
        },
        "body": {
            "full bodied": "full",
            "full-bodied": "full",
            "medium bodied": "medium",
            "medium-bodied": "medium",
            "light bodied": "light",
            "light-bodied": "light",
            "bold": "full",
            "full": "full",
            "medium": "medium",
            "light": "light",
        },
        "acidity": {
            "high acidity": "high",
            "low acidity": "low",
            "medium acidity": "medium",
            "crisp": "high",
            "bright": "high",
        },
        "tannin": {
            "high tannin": "high",
            "high tannins": "high",
            "medium tannin": "medium",
            "medium tannins": "medium",
            "low tannin": "low",
            "low tannins": "low",
            "structured": "high",
            "tannic": "high",
        },
        "pairing": {
            "mushroom risotto": "mushroom risotto",
            "roast chicken": "roast chicken",
            "green salad": "green salad",
            "goat cheese": "goat cheese",
            "fried chicken": "fried chicken",
            "aged manchego": "aged manchego",
            "roasted pork": "roasted pork",
            "pasta bolognese": "pasta bolognese",
            "osso buco": "osso buco",
            "braised short ribs": "braised short ribs",
            "short ribs": "braised short ribs",
            "blue cheese": "blue cheese",
            "prime rib": "prime rib",
            "steak": "steak",
            "salmon": "salmon",
            "oysters": "oysters",
            "oyster": "oysters",
            "sushi": "sushi",
            "lamb": "lamb",
            "tapas": "tapas",
            "manchego": "aged manchego",
            "pork": "roasted pork",
            "pasta": "pasta bolognese",
            "pizza": "pizza",
            "pecorino": "pecorino",
            "caviar": "caviar",
            "brie": "brie",
            "ribs": "braised short ribs",
        },
        "flavor": {
            "red cherry": "red cherry",
            "cranberry": "cranberry",
            "rose petal": "rose petal",
            "rose-petal": "rose petal",
            "clove": "clove",
            "grapefruit": "grapefruit",
            "lemon zest": "lemon zest",
            "fresh grass": "fresh grass",
            "stone": "stone",
            "red plum": "red plum",
            "cedar": "cedar",
            "leather": "leather",
            "vanilla": "vanilla",
            "black cherry": "black cherry",
            "violet": "violet",
            "tomato leaf": "tomato leaf",
            "earth": "earth",
            "green apple": "green apple",
            "brioche": "brioche",
            "citrus": "citrus",
            "almond": "almond",
            "cassis": "cassis",
            "blackberry": "blackberry",
            "graphite": "graphite",
            "tobacco": "tobacco",
        },
        "occasion": {
            "date night": "date night",
            "steak night": "dinner",
            "dinner party": "dinner",
            "warm afternoon": "lunch",
            "celebration": "celebration",
            "birthday": "celebration",
            "anniversary": "celebration",
            "first toast": "celebration",
            "toast": "celebration",
            "gift": "gift",
            "dinner": "dinner",
            "lunch": "lunch",
        },
    }

    sweetness_phrases = {
        "off dry": "off-dry",
        "off-dry": "off-dry",
        "bone dry": "dry",
        "brut": "dry",
        "dry": "dry",
        "sweet": "sweet",
    }
    novelty_phrases = {
        "something adventurous": "adventurous",
        "something different": "adventurous",
        "something new": "adventurous",
        "adventurous": "adventurous",
        "explore": "adventurous",
        "safe choice": "familiar",
        "something familiar": "familiar",
        "familiar": "familiar",
    }
    negation_prefixes = ("avoid", "avoiding", "no", "not", "without")
    ignored_tokens = frozenset(
        {
            "a",
            "an",
            "and",
            "any",
            "bottle",
            "but",
            "choice",
            "for",
            "i",
            "is",
            "it",
            "me",
            "night",
            "not",
            "of",
            "please",
            "something",
            "that",
            "the",
            "to",
            "too",
            "want",
            "wine",
            "with",
        }
    )

    def parse(self, query):
        normalized = _SPACE_RE.sub(
            " ", unicodedata.normalize("NFKC", query).strip().casefold()
        )
        intent = RecommendationIntent()
        consumed_spans = []
        blocked_spans = []

        negated_phrases = self._negated_constraint_phrases(normalized)
        for phrase, span in negated_phrases:
            intent.warnings.append(
                ParserWarning(
                    "unsupported_negation",
                    f"The negated phrase “{phrase}” is visible but does not become "
                    "a positive matching constraint.",
                )
            )
            consumed_spans.append(span)
            blocked_spans.append(span)

        budget, budget_evidence, budget_spans, conflicting_budget = (
            self._parse_budget(normalized)
        )
        if conflicting_budget:
            intent.warnings.append(
                ParserWarning(
                    "conflicting_budget",
                    "Multiple budget clauses were found, so budget does not affect "
                    "scoring.",
                )
            )
        if (
            budget
            and budget.minimum_cents is not None
            and budget.maximum_cents is not None
            and budget.minimum_cents > budget.maximum_cents
        ):
            intent.warnings.append(
                ParserWarning(
                    "invalid_budget_range",
                    "The budget range runs from a higher amount to a lower amount, "
                    "so it does not affect scoring.",
                )
            )
            budget = None
        intent.budget = budget
        intent.evidence.extend(budget_evidence)
        consumed_spans.extend(budget_spans)
        blocked_spans.extend(budget_spans)

        exclusion_spans = []
        self._collect_phrases(
            normalized,
            "excluded_sweetness",
            {"not too sweet": "sweet", "not sweet": "sweet"},
            intent.excluded_sweetness,
            intent.evidence,
            exclusion_spans,
        )
        consumed_spans.extend(exclusion_spans)
        blocked_spans.extend(exclusion_spans)
        self._collect_phrases(
            self._mask_spans(normalized, blocked_spans),
            "sweetness",
            self.sweetness_phrases,
            intent.sweetness,
            intent.evidence,
            consumed_spans,
        )

        for dimension, phrase_map in self.phrase_maps.items():
            target = getattr(intent, self._intent_attribute(dimension))
            self._collect_phrases(
                self._mask_spans(normalized, blocked_spans),
                dimension,
                phrase_map,
                target,
                intent.evidence,
                consumed_spans,
            )

        novelty_values = []
        self._collect_phrases(
            self._mask_spans(normalized, blocked_spans),
            "novelty",
            self.novelty_phrases,
            novelty_values,
            intent.evidence,
            consumed_spans,
        )
        if novelty_values:
            intent.novelty = novelty_values[0]
        if len(set(novelty_values)) > 1:
            intent.novelty = None
            intent.warnings.append(
                ParserWarning(
                    "conflicting_novelty",
                    "Both familiar and adventurous language was found, so novelty "
                    "does not affect scoring.",
                )
            )

        intent.unparsed_terms = self._unparsed_terms(normalized, consumed_spans)
        if intent.unparsed_terms:
            intent.warnings.append(
                ParserWarning(
                    "unparsed_terms",
                    "Some words were not part of the controlled matching grammar and "
                    "do not affect scoring.",
                )
            )

        return intent

    def _collect_phrases(
        self,
        text,
        dimension,
        phrase_map,
        target,
        evidence,
        consumed_spans,
    ):
        occupied = []
        for phrase, value in sorted(
            phrase_map.items(), key=lambda item: (-len(item[0]), item[0])
        ):
            pattern = re.compile(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])")
            for match in pattern.finditer(text):
                if any(self._overlaps(match.span(), span) for span in occupied):
                    continue
                if (
                    dimension == "body"
                    and phrase == "medium"
                    and re.match(
                        r"(?:\s+|-)(?:acidity|rare|tannin|tannins|well(?:-|\s+)?(?:done)?)\b",
                        text[match.end() :],
                    )
                ):
                    continue
                if (
                    dimension == "category"
                    and value == "rosé"
                    and re.match(r"(?:\s+|-)petal\b", text[match.end() :])
                ):
                    continue
                if value not in target:
                    target.append(value)
                    evidence.append(
                        ParserEvidence(dimension, value, match.group(0))
                    )
                occupied.append(match.span())
                consumed_spans.append(match.span())

    def _parse_budget(self, text):
        amount = r"\$\s*(\d{1,4})(?:\.(\d{1,2}))?"
        range_patterns = [
            re.compile(rf"\bbetween\s+{amount}\s+(?:and|to)\s+{amount}\b"),
            re.compile(rf"\bfrom\s+{amount}\s+(?:to|through)\s+{amount}\b"),
            re.compile(rf"(?<![\w$]){amount}\s*(?:-|–|—|to)\s*{amount}(?!\w)"),
        ]
        matches = []
        for pattern in range_patterns:
            for match in pattern.finditer(text):
                if any(self._overlaps(match.span(), item[2]) for item in matches):
                    continue
                minimum = self._amount_to_cents(match.group(1), match.group(2))
                maximum = self._amount_to_cents(match.group(3), match.group(4))
                matches.append(
                    (
                        ParsedBudget(minimum, maximum),
                        ParserEvidence(
                            "budget",
                            f"{minimum}-{maximum}",
                            match.group(0),
                        ),
                        match.span(),
                    )
                )

        # Evaluate idiomatic negated bounds before their shorter positive
        # substrings. For example, ``not over $60`` is a maximum, while the
        # embedded ``over $60`` must never become a minimum.
        bound_patterns = (
            (
                "maximum",
                re.compile(
                    rf"\b(?:no|not)\s+(?:more\s+than|over|above)\s+{amount}\b"
                ),
            ),
            (
                "minimum",
                re.compile(
                    rf"\b(?:no|not)\s+(?:less\s+than|under|below)\s+{amount}\b"
                ),
            ),
            (
                "maximum",
                re.compile(
                    rf"\b(?:under|below|less\s+than|up\s+to|maximum|max)\s+{amount}\b"
                ),
            ),
            (
                "minimum",
                re.compile(
                    rf"\b(?:over|above|more\s+than|at\s+least|minimum|min)\s+{amount}\b"
                ),
            ),
        )
        for boundary, pattern in bound_patterns:
            for match in pattern.finditer(text):
                if any(self._overlaps(match.span(), item[2]) for item in matches):
                    continue
                cents = self._amount_to_cents(match.group(1), match.group(2))
                if boundary == "maximum":
                    budget = ParsedBudget(maximum_cents=cents)
                else:
                    budget = ParsedBudget(minimum_cents=cents)
                matches.append(
                    (
                        budget,
                        ParserEvidence(
                            "budget", f"{boundary} {cents}", match.group(0)
                        ),
                        match.span(),
                    )
                )

        matches.sort(key=lambda item: item[2])
        evidence = [item[1] for item in matches]
        spans = [item[2] for item in matches]
        if len(matches) > 1:
            return None, evidence, spans, True
        if matches:
            return matches[0][0], evidence, spans, False
        return None, [], [], False

    def _negated_constraint_phrases(self, text):
        phrases = set(self.sweetness_phrases)
        for phrase_map in self.phrase_maps.values():
            phrases.update(phrase_map)
        phrases.update(self.novelty_phrases)
        prefix = "|".join(re.escape(item) for item in self.negation_prefixes)
        found = []

        for phrase in sorted(phrases, key=lambda item: (-len(item), item)):
            pattern = re.compile(
                rf"(?<![a-z0-9])(?:{prefix})\s+"
                rf"(?:(?:a|an|the)\s+)?(?:too\s+)?"
                rf"{re.escape(phrase)}(?![a-z0-9])"
            )
            for match in pattern.finditer(text):
                matched_text = match.group(0)
                if matched_text in {"not sweet", "not too sweet"}:
                    continue
                if any(self._overlaps(match.span(), span) for _, span in found):
                    continue
                found.append((matched_text, match.span()))

        return sorted(found, key=lambda item: item[1])

    def _unparsed_terms(self, text, consumed_spans):
        remaining = list(text)
        for start, end in consumed_spans:
            remaining[start:end] = " " * (end - start)
        return [
            token
            for token in _TOKEN_RE.findall("".join(remaining))
            if token not in self.ignored_tokens and not token.isdigit()
        ]

    @staticmethod
    def _mask_spans(text, spans):
        masked = list(text)
        for start, end in spans:
            masked[start:end] = " " * (end - start)
        return "".join(masked)

    @staticmethod
    def _intent_attribute(dimension):
        return {
            "category": "categories",
            "varietal": "varietals",
            "region": "regions",
            "country": "countries",
            "body": "bodies",
            "acidity": "acidities",
            "tannin": "tannins",
            "pairing": "pairings",
            "flavor": "flavors",
            "occasion": "occasions",
        }[dimension]

    @staticmethod
    def _overlaps(left, right):
        return left[0] < right[1] and right[0] < left[1]

    @staticmethod
    def _amount_to_cents(dollars, decimal):
        cents = (decimal or "0").ljust(2, "0")
        return int(dollars) * 100 + int(cents)
