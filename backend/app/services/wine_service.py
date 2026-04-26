MOCK_WINES = [
    {
        "externalWineId": "mock-argyle-reserve-pinot-noir-2021",
        "source": "mock",
        "name": "Reserve Pinot Noir",
        "winery": "Argyle",
        "varietal": "Pinot Noir",
        "region": "Willamette Valley",
        "country": "United States",
        "vintage": "2021",
        "description": (
            "A graceful, cool-climate Pinot Noir with cherry, cranberry, rose, "
            "soft spice, and a clean mineral finish."
        ),
        "imageUrl": None,
        "averageRating": 4.3,
        "priceCents": 4200,
        "pairings": ["salmon", "mushroom risotto", "roast chicken"],
        "tastingNotes": ["red cherry", "cranberry", "rose petal", "clove"],
        "body": "medium",
        "acidity": "bright",
        "sweetness": "dry",
        "occasion": "date night dinner",
        "servingTemp": "55-60 F",
    },
    {
        "externalWineId": "mock-frogs-leap-estate-sauvignon-blanc-2022",
        "source": "mock",
        "name": "Estate Sauvignon Blanc",
        "winery": "Frog's Leap",
        "varietal": "Sauvignon Blanc",
        "region": "Napa Valley",
        "country": "United States",
        "vintage": "2022",
        "description": (
            "A crisp, mineral white with grapefruit, lemon zest, fresh herbs, "
            "and a bright finish suited to seafood and spring vegetables."
        ),
        "imageUrl": None,
        "averageRating": 4.1,
        "priceCents": 3000,
        "pairings": ["oysters", "goat cheese", "green salad", "sushi"],
        "tastingNotes": ["grapefruit", "lemon zest", "fresh grass", "stone"],
        "body": "light",
        "acidity": "high",
        "sweetness": "dry",
        "occasion": "warm afternoon lunch",
        "servingTemp": "45-50 F",
    },
    {
        "externalWineId": "mock-la-rioja-alta-reserva-2018",
        "source": "mock",
        "name": "Rioja Reserva",
        "winery": "La Rioja Alta",
        "varietal": "Tempranillo",
        "region": "Rioja",
        "country": "Spain",
        "vintage": "2018",
        "description": (
            "A polished Rioja with red plum, dried cherry, cedar, leather, "
            "vanilla, and savory structure."
        ),
        "imageUrl": None,
        "averageRating": 4.5,
        "priceCents": 5200,
        "pairings": ["lamb", "tapas", "aged manchego", "roasted pork"],
        "tastingNotes": ["red plum", "cedar", "leather", "vanilla"],
        "body": "medium",
        "acidity": "balanced",
        "sweetness": "dry",
        "occasion": "gift bottle",
        "servingTemp": "60-65 F",
    },
    {
        "externalWineId": "mock-antinori-chianti-classico-riserva-2020",
        "source": "mock",
        "name": "Chianti Classico Riserva",
        "winery": "Marchesi Antinori",
        "varietal": "Sangiovese",
        "region": "Tuscany",
        "country": "Italy",
        "vintage": "2020",
        "description": (
            "A savory Tuscan red with black cherry, violet, tomato leaf, "
            "earth, and firm but elegant tannins."
        ),
        "imageUrl": None,
        "averageRating": 4.2,
        "priceCents": 3600,
        "pairings": ["pasta bolognese", "pizza", "osso buco", "pecorino"],
        "tastingNotes": ["black cherry", "violet", "tomato leaf", "earth"],
        "body": "medium",
        "acidity": "bright",
        "sweetness": "dry",
        "occasion": "Italian dinner",
        "servingTemp": "58-62 F",
    },
    {
        "externalWineId": "mock-veuve-clicquot-brut-champagne-nv",
        "source": "mock",
        "name": "Brut Champagne",
        "winery": "Veuve Clicquot",
        "varietal": "Champagne Blend",
        "region": "Champagne",
        "country": "France",
        "vintage": "NV",
        "description": (
            "A celebratory sparkling wine with apple, brioche, citrus, fine "
            "bubbles, and a clean golden finish."
        ),
        "imageUrl": None,
        "averageRating": 4.4,
        "priceCents": 6400,
        "pairings": ["caviar", "fried chicken", "brie", "celebration toast"],
        "tastingNotes": ["green apple", "brioche", "citrus", "almond"],
        "body": "light",
        "acidity": "lively",
        "sweetness": "brut",
        "occasion": "celebration",
        "servingTemp": "43-48 F",
    },
    {
        "externalWineId": "mock-chateau-montelena-cabernet-sauvignon-2019",
        "source": "mock",
        "name": "Estate Cabernet Sauvignon",
        "winery": "Chateau Montelena",
        "varietal": "Cabernet Sauvignon",
        "region": "Calistoga",
        "country": "United States",
        "vintage": "2019",
        "description": (
            "A structured Napa Cabernet with cassis, blackberry, graphite, "
            "tobacco, and refined oak."
        ),
        "imageUrl": None,
        "averageRating": 4.6,
        "priceCents": 9500,
        "pairings": ["steak", "braised short ribs", "blue cheese", "prime rib"],
        "tastingNotes": ["cassis", "blackberry", "graphite", "tobacco"],
        "body": "full",
        "acidity": "balanced",
        "sweetness": "dry",
        "occasion": "steakhouse dinner",
        "servingTemp": "60-65 F",
    },
]


class WineService:
    """Wine discovery abstraction.

    The current implementation uses local mock data. A future external provider
    should preserve this public method shape so routes and frontend contracts do
    not need to change.
    """

    source = "mock"

    def search(self, query):
        normalized_query = self._normalize_query(query)

        if not normalized_query:
            return {
                "query": query,
                "results": [],
                "source": self.source,
            }

        terms = normalized_query.split()
        results = [
            wine
            for wine in MOCK_WINES
            if all(term in self._search_blob(wine) for term in terms)
        ]

        return {
            "query": query,
            "results": results,
            "source": self.source,
        }

    def get_by_external_id(self, external_wine_id):
        return next(
            (
                wine
                for wine in MOCK_WINES
                if wine["externalWineId"] == external_wine_id
            ),
            None,
        )

    def _normalize_query(self, query):
        if not isinstance(query, str):
            return ""

        return " ".join(query.lower().strip().split())

    def _search_blob(self, wine):
        fields = [
            wine.get("name"),
            wine.get("winery"),
            wine.get("varietal"),
            wine.get("region"),
            wine.get("country"),
            wine.get("vintage"),
            wine.get("description"),
            wine.get("occasion"),
            wine.get("body"),
            wine.get("acidity"),
            wine.get("sweetness"),
            " ".join(wine.get("pairings", [])),
            " ".join(wine.get("tastingNotes", [])),
        ]

        return " ".join(value for value in fields if value).lower()
