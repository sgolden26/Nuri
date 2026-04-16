/**
 * Menu item scoring — dimensions for longevity and health.
 * Scores are 0–100: higher = better for longevity (except where noted).
 * Works with partial data: explicit nutrients when available, text heuristics otherwise.
 * Call enrichMenuItemFromName before scoring when ingredients are missing.
 */

export type ScoreConfidence = "low" | "medium" | "high";

export interface DimensionScore {
  score: number;
  confidence: ScoreConfidence;
  rawValue?: string | number;
  unit?: string;
  notes?: string;
}

export interface MenuItemScore {
  sodiumBurden: DimensionScore;
  potassiumDensity: DimensionScore;
  calciumMagnesiumDensity: DimensionScore;
  proteinAmount: DimensionScore;
  carbAmountQuality: DimensionScore;
  fiber: DimensionScore;
  saturatedFat: DimensionScore;
  alcoholContent: DimensionScore;
  caffeineContent: DimensionScore;
  ultraProcessedProxy: DimensionScore;
  omega3Proxy: DimensionScore;
  spiceHeat: DimensionScore;
  brothSauceHeaviness: DimensionScore;
  digestibilityHeaviness: DimensionScore;
  likelyAllergens: DimensionScore;
  /** New estimate-based dimensions */
  preparationMethod: DimensionScore;
  glycemicProxy: DimensionScore;
  antiInflammatory: DimensionScore;
  gutHealth: DimensionScore;
  portionSize: DimensionScore;
  /** Composite 0–100 longevity score (weighted average) */
  composite: number;
}

/** Input for scoring. All fields optional — scores incrementally as data arrives. */
export interface MenuItemInput {
  name?: string;
  description?: string;
  ingredients?: string[];
  /** Explicit nutrients when available from API (mg, g, etc.) */
  nutrients?: {
    sodium_mg?: number;
    potassium_mg?: number;
    calcium_mg?: number;
    magnesium_mg?: number;
    protein_g?: number;
    carbs_g?: number;
    fiber_g?: number;
    saturatedFat_g?: number;
    sugar_g?: number;
  };
  /** Known allergens from menu or API */
  allergens?: string[];
  /** Tags/labels: "fried", "gluten_free", etc. */
  tags?: string[];
  /** Mental health & chronic disease fit: anxiety_supportive, hypertension_adverse, etc. */
  conditionTags?: string[];
}

// —— Keyword sets for text-based heuristics ——

const SODIUM_HEAVY = [
  "soy sauce", "teriyaki", "fish sauce", "pickled", "cured", "bacon", "ham",
  "salami", "olives", "capers", "cheese", "parmesan", "feta", "salted",
  "broth", "bouillon", "ramen", "pho", "miso", "kimchi", "sauerkraut",
  "canned", "processed", "frozen meal", "chips", "pretzels", "crackers",
];

const POTASSIUM_RICH = [
  "banana", "avocado", "spinach", "kale", "swiss chard", "potato", "sweet potato",
  "beans", "lentils", "tomato", "cantaloupe", "orange", "salmon", "white beans",
  "edamame", "acorn squash", "beet", "brussels", "mushroom",
];

const CALCIUM_MAGNESIUM_RICH = [
  "dairy", "milk", "yogurt", "cheese", "kale", "collard", "broccoli",
  "almond", "tofu", "edamame", "chia", "sesame", "spinach", "fig",
  "salmon", "sardine", "dark leafy", "avocado", "banana", "dark chocolate",
];

const PROTEIN_RICH = [
  "chicken", "beef", "pork", "fish", "salmon", "tuna", "shrimp", "tofu",
  "tempeh", "lentils", "beans", "chickpea", "egg", "quinoa", "greek yogurt",
  "turkey", "lamb", "seafood", "edamame", "steak", "grilled",
];

const HIGH_QUALITY_CARBS = [
  "whole grain", "quinoa", "brown rice", "oats", "barley", "farro",
  "sweet potato", "legume", "beans", "lentils", "vegetable", "fruit",
];
const LOW_QUALITY_CARBS = [
  "white bread", "white rice", "pasta", "fries", "chips", "sugar",
  "syrup", "honey", "sweetened", "donut", "pastry", "cake",
];

const FIBER_RICH = [
  "whole grain", "oat", "barley", "beans", "lentils", "chickpea",
  "broccoli", "brussels", "avocado", "berries", "apple", "pear",
  "chia", "flax", "quinoa", "brown rice", "vegetable", "leafy",
];

const SATURATED_FAT_HEAVY = [
  "butter", "cream", "cheese", "bacon", "sausage", "ribeye", "prime rib",
  "fried", "crispy", "battered", "croissant", "pastry", "coconut cream",
  "ice cream", "whole milk", "heavy cream", "béarnaise", "hollandaise",
];

const ALCOHOL_INDICATORS = [
  "wine", "beer", "cocktail", "margarita", "martini", "whiskey",
  "bourbon", "vodka", "rum", "tequila", "sake", "champagne",
  "alcohol", "boozy", "spirits",
];

const CAFFEINE_INDICATORS = [
  "coffee", "espresso", "matcha", "tea", "caffeine", "energy drink",
  "cola", "soda", "chocolate", "mocha", "latte", "cappuccino",
];

const ULTRA_PROCESSED_PROXY = [
  "fried", "battered", "nugget", "tender", "fries", "chips",
  "processed", "canned soup", "instant", "frozen meal", "microwave",
  "hot dog", "sausage", "bacon", "deli meat", "salami",
  "white bread", "donut", "pastry", "cake", "cookie", "candy",
  "soda", "energy drink", "sweetened", "syrup", "artificial",
];

const OMEGA3_RICH = [
  "salmon", "mackerel", "sardine", "anchovy", "herring", "trout",
  "walnut", "flax", "chia", "hemp", "fish oil", "seafood",
];

const SPICE_HEAT_INDICATORS = [
  "spicy", "hot", "chili", "jalapeño", "habanero", "sriracha",
  "curry", "cayenne", "pepper", "wasabi", "ginger", "garlic",
  "cajun", "buffalo", "szechuan", "thai",
];

const HEAVY_SAUCE_BROTH = [
  "creamy", "cream sauce", "alfredo", "béarnaise", "hollandaise",
  "gravy", "cheese sauce", "ranch", "mayo", "heavy broth",
  "rich broth", "pho", "ramen", "stew", "braised", "reduction",
];

const HEAVY_DIGESTIBILITY = [
  "fried", "greasy", "rich", "heavy", "creamy", "cheesy",
  "large portion", "double", "combo", "loaded", "bacon",
  "processed meat", "deep fried", "battered",
];
const LIGHT_DIGESTIBILITY = [
  "steamed", "grilled", "poached", "raw", "salad", "soup",
  "light", "fresh", "vegetable", "leafy", "broth-based",
];

const PREPARATION_GOOD = ["grilled", "steamed", "poached", "baked", "roasted", "raw", "sautéed", "broiled"];
const PREPARATION_BAD = ["fried", "deep fried", "battered", "crispy", "breaded"];

const HIGH_GI = ["white bread", "white rice", "pasta", "fries", "donut", "pastry", "cake", "syrup", "honey", "soda", "juice", "candy"];
const LOW_GI = ["whole grain", "quinoa", "barley", "oats", "legume", "beans", "lentils", "vegetable", "leafy", "avocado", "nuts"];

const ANTI_INFLAMMATORY = ["olive oil", "turmeric", "ginger", "garlic", "leafy", "berry", "salmon", "sardine", "walnut", "green tea", "omega"];

const GUT_HEALTH = ["fiber", "fermented", "yogurt", "kefir", "miso", "kimchi", "sauerkraut", "legume", "oats", "banana", "garlic", "onion"];

const OVERSIZED_PORTION = ["double", "combo", "large", "loaded", "family", "extra", "supersize", "big"];

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  peanuts: ["peanut", "peanuts"],
  tree_nuts: ["almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia", "pine nut"],
  shellfish: ["shrimp", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "prawn"],
  fish: ["fish", "salmon", "tuna", "cod", "tilapia", "halibut", "anchovy", "sardine"],
  eggs: ["egg", "eggs"],
  dairy: ["milk", "cream", "cheese", "butter", "whey", "dairy"],
  wheat: ["wheat", "bread", "flour", "pasta"],
  soy: ["soy", "tofu", "edamame", "miso", "tempeh"],
  sesame: ["sesame", "tahini"],
  gluten: ["gluten", "wheat", "barley", "rye", "bread", "pasta"],
};

function textContains(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) count++;
  }
  return count;
}

function scoreFromKeywords(
  text: string,
  positive: string[],
  negative: string[],
  invertNegative = true,
): { score: number; confidence: ScoreConfidence } {
  const pos = textContains(text, positive);
  const neg = textContains(text, negative);
  let score = 50;
  score += Math.min(pos * 15, 50);
  score -= invertNegative ? Math.min(neg * 15, 50) : 0;
  const confidence: ScoreConfidence = pos + neg > 0 ? "medium" : "low";
  return { score: Math.max(0, Math.min(100, score)), confidence };
}

function detectAllergens(text: string, explicitAllergens: string[] = []): string[] {
  const found = new Set<string>(explicitAllergens.map((a) => a.toLowerCase()));
  const lower = text.toLowerCase();
  for (const [allergen, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) found.add(allergen);
    }
  }
  return Array.from(found);
}

/** Map user allergen terms to our canonical keys */
const USER_ALLERGEN_ALIASES: Record<string, string> = {
  peanut: "peanuts", peanuts: "peanuts",
  "tree nut": "tree_nuts", tree_nuts: "tree_nuts", almonds: "tree_nuts", walnuts: "tree_nuts",
  shellfish: "shellfish", shrimp: "shellfish", crab: "shellfish",
  fish: "fish", salmon: "fish",
  egg: "eggs", eggs: "eggs",
  milk: "dairy", dairy: "dairy", cheese: "dairy", lactose: "dairy",
  wheat: "wheat", gluten: "gluten",
  soy: "soy", tofu: "soy",
  sesame: "sesame",
};

/**
 * Check if a menu item contains any of the user's allergens.
 * Returns the list of matching allergens, or [] if safe.
 * Use for hard exclusion.
 */
export function itemContainsUserAllergens(
  input: MenuItemInput,
  userAllergens: string[],
): string[] {
  if (userAllergens.length === 0) return [];
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const detected = detectAllergens(text, input.allergens ?? []);
  const userCanonical = new Set(
    userAllergens.map((a) => USER_ALLERGEN_ALIASES[a.toLowerCase()] ?? a.toLowerCase().replace(/\s+/g, "_")),
  );
  return detected.filter((d) => userCanonical.has(d));
}

/** Score sodium: 0 = high burden, 100 = low burden */
function scoreSodium(input: MenuItemInput): DimensionScore {
  const n = input.nutrients?.sodium_mg;
  if (n != null) {
    // <400mg = good, >1000mg = bad
    const score = n <= 400 ? 100 : n >= 1000 ? 0 : 100 - ((n - 400) / 6);
    return {
      score: Math.round(Math.max(0, Math.min(100, score))),
      confidence: "high",
      rawValue: n,
      unit: "mg",
      notes: n > 800 ? "High sodium" : undefined,
    };
  }
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, SODIUM_HEAVY);
  const score = Math.max(0, 100 - hits * 25);
  return {
    score,
    confidence: "low",
    notes: hits > 0 ? `Text suggests ${hits} sodium-heavy indicator(s)` : undefined,
  };
}

/** Score potassium: higher = better density */
function scorePotassium(input: MenuItemInput): DimensionScore {
  const n = input.nutrients?.potassium_mg;
  if (n != null) {
    const score = n >= 600 ? 100 : n <= 100 ? 20 : 20 + (n - 100) / 5;
    return {
      score: Math.round(Math.max(0, Math.min(100, score))),
      confidence: "high",
      rawValue: n,
      unit: "mg",
    };
  }
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, POTASSIUM_RICH);
  return {
    score: Math.min(100, 40 + hits * 20),
    confidence: "low",
    notes: hits > 0 ? `${hits} potassium-rich indicator(s)` : undefined,
  };
}

/** Score calcium + magnesium density */
function scoreCalciumMagnesium(input: MenuItemInput): DimensionScore {
  const ca = input.nutrients?.calcium_mg;
  const mg = input.nutrients?.magnesium_mg;
  if (ca != null || mg != null) {
    const combined = (ca ?? 0) / 10 + (mg ?? 0) / 4; // rough density proxy
    const score = combined >= 15 ? 100 : combined >= 5 ? 70 : combined >= 1 ? 40 : 20;
    return {
      score: Math.round(Math.min(100, score)),
      confidence: "high",
      rawValue: ca != null && mg != null ? `${ca}mg Ca, ${mg}mg Mg` : (ca ?? mg),
      unit: "mg",
    };
  }
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, CALCIUM_MAGNESIUM_RICH);
  return {
    score: Math.min(100, 35 + hits * 22),
    confidence: "low",
    notes: hits > 0 ? `${hits} Ca/Mg-rich indicator(s)` : undefined,
  };
}

/** Score protein amount: higher = better (up to a point) */
function scoreProtein(input: MenuItemInput): DimensionScore {
  const n = input.nutrients?.protein_g;
  if (n != null) {
    const score = n >= 20 ? 100 : n >= 10 ? 80 : n >= 5 ? 60 : n >= 2 ? 40 : 20;
    return {
      score,
      confidence: "high",
      rawValue: n,
      unit: "g",
    };
  }
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, PROTEIN_RICH);
  return {
    score: Math.min(100, 30 + hits * 25),
    confidence: "low",
    notes: hits > 0 ? `${hits} protein indicator(s)` : undefined,
  };
}

/** Score carb amount + quality: whole/complex > refined/simple */
function scoreCarbQuality(input: MenuItemInput): DimensionScore {
  const carbs = input.nutrients?.carbs_g;
  const sugar = input.nutrients?.sugar_g;
  if (carbs != null) {
    const sugarRatio = sugar != null && carbs > 0 ? sugar / carbs : 0;
    let score = 50;
    if (sugarRatio > 0.5) score -= 30;
    else if (sugarRatio > 0.2) score -= 10;
    if (carbs >= 30 && sugarRatio < 0.2) score += 20; // complex carb dominant
    return {
      score: Math.max(0, Math.min(100, score)),
      confidence: "high",
      rawValue: sugar != null ? `${carbs}g carbs, ${sugar}g sugar` : `${carbs}g`,
      unit: "g",
    };
  }
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const pos = textContains(text, HIGH_QUALITY_CARBS);
  const neg = textContains(text, LOW_QUALITY_CARBS);
  const score = Math.max(0, Math.min(100, 50 + pos * 15 - neg * 20));
  return {
    score,
    confidence: "low",
    notes: pos + neg > 0 ? `Quality: +${pos} -${neg}` : undefined,
  };
}

/** Score fiber: higher = better */
function scoreFiber(input: MenuItemInput): DimensionScore {
  const n = input.nutrients?.fiber_g;
  if (n != null) {
    const score = n >= 8 ? 100 : n >= 5 ? 85 : n >= 3 ? 70 : n >= 1 ? 50 : 25;
    return {
      score,
      confidence: "high",
      rawValue: n,
      unit: "g",
    };
  }
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, FIBER_RICH);
  return {
    score: Math.min(100, 35 + hits * 22),
    confidence: "low",
    notes: hits > 0 ? `${hits} fiber indicator(s)` : undefined,
  };
}

/** Score saturated fat: 0 = high, 100 = low */
function scoreSaturatedFat(input: MenuItemInput): DimensionScore {
  const n = input.nutrients?.saturatedFat_g;
  if (n != null) {
    const score = n <= 2 ? 100 : n >= 10 ? 0 : 100 - (n - 2) * 12.5;
    return {
      score: Math.round(Math.max(0, Math.min(100, score))),
      confidence: "high",
      rawValue: n,
      unit: "g",
      notes: n > 5 ? "High saturated fat" : undefined,
    };
  }
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, SATURATED_FAT_HEAVY);
  return {
    score: Math.max(0, 100 - hits * 30),
    confidence: "low",
    notes: hits > 0 ? `${hits} saturated fat indicator(s)` : undefined,
  };
}

/** Score alcohol: 0 = present/significant, 100 = none */
function scoreAlcohol(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, ALCOHOL_INDICATORS);
  return {
    score: hits === 0 ? 100 : Math.max(0, 100 - hits * 50),
    confidence: hits > 0 ? "medium" : "low",
    notes: hits > 0 ? `Alcohol detected (${hits} indicator(s))` : undefined,
  };
}

/** Score caffeine: informational; 100 = none, lower = more caffeine */
function scoreCaffeine(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, CAFFEINE_INDICATORS);
  return {
    score: hits === 0 ? 100 : Math.max(0, 100 - hits * 50),
    confidence: hits > 0 ? "medium" : "low",
    notes: hits > 0 ? `Caffeine likely (${hits} indicator(s))` : undefined,
  };
}

/** Score ultra-processed proxy: 0 = highly processed, 100 = whole/minimal */
function scoreUltraProcessed(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, ULTRA_PROCESSED_PROXY);
  return {
    score: Math.max(0, 100 - hits * 25),
    confidence: "low",
    notes: hits > 0 ? `${hits} processed indicator(s)` : undefined,
  };
}

/** Score omega-3 proxy: higher = better */
function scoreOmega3(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, OMEGA3_RICH);
  return {
    score: Math.min(100, 40 + hits * 30),
    confidence: "low",
    notes: hits > 0 ? `${hits} omega-3 indicator(s)` : undefined,
  };
}

/** Score spice/heat: informational; 100 = mild, lower = spicier */
function scoreSpiceHeat(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, SPICE_HEAT_INDICATORS);
  return {
    score: hits === 0 ? 100 : Math.max(0, 100 - hits * 30),
    confidence: hits > 0 ? "medium" : "low",
    notes: hits > 0 ? `Spicy/heated (${hits} indicator(s))` : undefined,
  };
}

/** Score broth/sauce heaviness: 0 = heavy, 100 = light */
function scoreBrothSauceHeaviness(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const hits = textContains(text, HEAVY_SAUCE_BROTH);
  return {
    score: Math.max(0, 100 - hits * 35),
    confidence: "low",
    notes: hits > 0 ? `${hits} heavy sauce/broth indicator(s)` : undefined,
  };
}

/** Score digestibility/heaviness: 100 = light/easy, 0 = heavy */
function scoreDigestibility(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const heavy = textContains(text, HEAVY_DIGESTIBILITY);
  const light = textContains(text, LIGHT_DIGESTIBILITY);
  const score = Math.max(0, Math.min(100, 50 + light * 25 - heavy * 25));
  return {
    score,
    confidence: "low",
    notes: heavy + light > 0 ? `Heavy: ${heavy}, Light: ${light}` : undefined,
  };
}

/** Score preparation method: 100 = healthiest (grilled/steamed), 0 = worst (fried) */
function scorePreparationMethod(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? []), ...(input.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  const good = textContains(text, PREPARATION_GOOD);
  const bad = textContains(text, PREPARATION_BAD);
  const score = Math.max(0, Math.min(100, 50 + good * 20 - bad * 25));
  return { score, confidence: good + bad > 0 ? "medium" : "low" };
}

/** Score glycemic proxy: 100 = low GI, 0 = high GI */
function scoreGlycemicProxy(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? []), ...(input.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  const high = textContains(text, HIGH_GI);
  const low = textContains(text, LOW_GI);
  const sugar = input.nutrients?.sugar_g;
  let score = 50;
  if (sugar != null) score = sugar > 15 ? 20 : sugar > 8 ? 40 : 70;
  score = Math.max(0, Math.min(100, score - high * 15 + low * 12));
  return { score, confidence: high + low > 0 || sugar != null ? "medium" : "low" };
}

/** Score anti-inflammatory: 100 = highly anti-inflammatory */
function scoreAntiInflammatory(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? []), ...(input.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  const hits = textContains(text, ANTI_INFLAMMATORY);
  const inflammatory = textContains(text, ["fried", "processed", "sugary"]);
  const score = Math.max(0, Math.min(100, 40 + hits * 15 - inflammatory * 20));
  return { score, confidence: hits + inflammatory > 0 ? "medium" : "low" };
}

/** Score gut health: 100 = best for gut (fiber, fermented) */
function scoreGutHealth(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? []), ...(input.tags ?? [])].filter(Boolean).join(" ").toLowerCase();
  const hits = textContains(text, GUT_HEALTH);
  const fiber = input.nutrients?.fiber_g;
  let score = 40 + hits * 15;
  if (fiber != null) score = Math.min(100, score + fiber * 5);
  return { score: Math.min(100, score), confidence: hits > 0 || fiber != null ? "medium" : "low" };
}

/** Score portion size: 100 = reasonable, 0 = likely oversized */
function scorePortionSize(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description].filter(Boolean).join(" ").toLowerCase();
  const hits = textContains(text, OVERSIZED_PORTION);
  const score = Math.max(0, 100 - hits * 30);
  return { score, confidence: hits > 0 ? "medium" : "low" };
}

/** Score likely allergens: 100 = none detected, 0 = many */
function scoreLikelyAllergens(input: MenuItemInput): DimensionScore {
  const text = [input.name, input.description, ...(input.ingredients ?? [])].filter(Boolean).join(" ");
  const detected = detectAllergens(text, input.allergens ?? []);
  const count = detected.length;
  const score = count === 0 ? 100 : Math.max(0, 100 - count * 25);
  return {
    score,
    confidence: count > 0 ? "medium" : "low",
    rawValue: detected.length ? detected.join(", ") : undefined,
    notes: count > 0 ? `Allergens: ${detected.join(", ")}` : undefined,
  };
}

/** Weights for composite score (longevity-focused) */
const COMPOSITE_WEIGHTS: Record<keyof Omit<MenuItemScore, "composite">, number> = {
  sodiumBurden: 0.10,
  potassiumDensity: 0.05,
  calciumMagnesiumDensity: 0.04,
  proteinAmount: 0.10,
  carbAmountQuality: 0.08,
  fiber: 0.06,
  saturatedFat: 0.10,
  alcoholContent: 0.03,
  caffeineContent: 0.02,
  ultraProcessedProxy: 0.10,
  omega3Proxy: 0.05,
  spiceHeat: 0.01,
  brothSauceHeaviness: 0.03,
  digestibilityHeaviness: 0.04,
  likelyAllergens: 0.02,
  preparationMethod: 0.05,
  glycemicProxy: 0.04,
  antiInflammatory: 0.03,
  gutHealth: 0.02,
  portionSize: 0.02,
};

/**
 * Score a menu item across all dimensions.
 * Call with partial input — scores update as more data arrives.
 * Enrich with enrichMenuItemFromName first when ingredients are missing.
 */
export function scoreMenuItem(input: MenuItemInput): MenuItemScore {
  const sodiumBurden = scoreSodium(input);
  const potassiumDensity = scorePotassium(input);
  const calciumMagnesiumDensity = scoreCalciumMagnesium(input);
  const proteinAmount = scoreProtein(input);
  const carbAmountQuality = scoreCarbQuality(input);
  const fiber = scoreFiber(input);
  const saturatedFat = scoreSaturatedFat(input);
  const alcoholContent = scoreAlcohol(input);
  const caffeineContent = scoreCaffeine(input);
  const ultraProcessedProxy = scoreUltraProcessed(input);
  const omega3Proxy = scoreOmega3(input);
  const spiceHeat = scoreSpiceHeat(input);
  const brothSauceHeaviness = scoreBrothSauceHeaviness(input);
  const digestibilityHeaviness = scoreDigestibility(input);
  const likelyAllergens = scoreLikelyAllergens(input);
  const preparationMethod = scorePreparationMethod(input);
  const glycemicProxy = scoreGlycemicProxy(input);
  const antiInflammatory = scoreAntiInflammatory(input);
  const gutHealth = scoreGutHealth(input);
  const portionSize = scorePortionSize(input);

  const dimensions = {
    sodiumBurden,
    potassiumDensity,
    calciumMagnesiumDensity,
    proteinAmount,
    carbAmountQuality,
    fiber,
    saturatedFat,
    alcoholContent,
    caffeineContent,
    ultraProcessedProxy,
    omega3Proxy,
    spiceHeat,
    brothSauceHeaviness,
    digestibilityHeaviness,
    likelyAllergens,
    preparationMethod,
    glycemicProxy,
    antiInflammatory,
    gutHealth,
    portionSize,
  };

  let composite = 0;
  for (const [key, weight] of Object.entries(COMPOSITE_WEIGHTS)) {
    composite += dimensions[key as keyof typeof dimensions].score * weight;
  }

  return {
    ...dimensions,
    composite: Math.round(composite),
  };
}
