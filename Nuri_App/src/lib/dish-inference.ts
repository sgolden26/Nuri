/**
 * Infer ingredients, allergens, tags, and condition fit from dish names.
 * Condition tags tie dishes to mental health (anxiety, depression) and chronic disease (hypertension, diabetes, heart).
 */

import type { MenuItemInput } from "./menu-scoring";
import { lookupNutrition } from "./nutrition-lookup";

/** Condition tags for ranking: supportive = good for condition, adverse = avoid for condition */
export type ConditionTag =
  | "anxiety_supportive" | "anxiety_adverse"
  | "depression_supportive" | "depression_adverse"
  | "hypertension_friendly" | "hypertension_adverse"
  | "diabetes_friendly" | "diabetes_adverse"
  | "heart_healthy" | "heart_adverse"
  | "sleep_supportive" | "inflammatory" | "anti_inflammatory"
  | "high_mercury" | "raw_fish";

interface DishKnowledge {
  ingredients: string[];
  allergens?: string[];
  tags: string[];
  /** Mental health & chronic disease fit for ranking */
  conditionTags?: ConditionTag[];
}

/** Map dish tags → condition tags for mental health & chronic disease ranking */
const TAG_TO_CONDITION: Record<string, ConditionTag[]> = {
  fish_oily: ["anxiety_supportive", "depression_supportive", "heart_healthy"],
  olive_oil: ["heart_healthy", "anti_inflammatory"],
  leafy_green: ["anxiety_supportive", "depression_supportive", "heart_healthy"],
  legume: ["diabetes_friendly", "heart_healthy", "depression_supportive"],
  whole_grain: ["diabetes_friendly", "heart_healthy", "anxiety_supportive"],
  fermented: ["anxiety_supportive", "depression_supportive"],
  vegetable: ["diabetes_friendly", "heart_healthy"],
  fiber: ["diabetes_friendly"],
  lean_protein: ["depression_supportive"],
  caffeine: ["anxiety_adverse"],
  sugary: ["anxiety_adverse", "depression_adverse", "diabetes_adverse"],
  refined: ["diabetes_adverse"],
  fried: ["heart_adverse", "inflammatory"],
  processed: ["anxiety_adverse", "depression_adverse", "heart_adverse", "inflammatory"],
  high_sodium: ["hypertension_adverse"],
};

/** High-mercury fish — avoid during pregnancy */
const HIGH_MERCURY_FISH = ["tuna", "swordfish", "shark", "tilefish", "king mackerel", "marlin", "orange roughy"];
const RAW_FISH_INDICATORS = ["sashimi", "ceviche", "crudo", "tartare", "raw"];

/** Common dish patterns → inferred ingredients, allergens, tags, conditionTags. */
const DISH_KNOWLEDGE: Array<{ pattern: RegExp | string; knowledge: DishKnowledge }> = [
  // Salads
  { pattern: /caesar|cesar/i, knowledge: { ingredients: ["romaine", "parmesan", "croutons", "caesar dressing", "egg"], allergens: ["dairy", "gluten", "eggs", "fish"], tags: ["leafy_green"], conditionTags: ["hypertension_adverse"] } },
  { pattern: /greek\s*salad|salad\s*greek/i, knowledge: { ingredients: ["cucumber", "tomato", "olives", "feta", "onion", "olive oil"], allergens: ["dairy"], tags: ["vegetable", "olive_oil"], conditionTags: ["heart_healthy", "hypertension_adverse"] } },
  { pattern: /cobb\s*salad/i, knowledge: { ingredients: ["lettuce", "bacon", "egg", "chicken", "avocado", "tomato", "blue cheese"], allergens: ["dairy", "eggs"], tags: ["leafy_green", "lean_protein"] } },
  { pattern: /wedge\s*salad/i, knowledge: { ingredients: ["iceberg", "bacon", "blue cheese", "tomato"], allergens: ["dairy"], tags: ["leafy_green"] } },
  { pattern: /caprese|mozzarella.*tomato|tomato.*mozzarella/i, knowledge: { ingredients: ["tomato", "mozzarella", "basil", "olive oil"], allergens: ["dairy"], tags: ["vegetable"] } },
  { pattern: /kale\s*salad|salad.*kale/i, knowledge: { ingredients: ["kale", "lemon", "olive oil"], tags: ["leafy_green"] } },
  { pattern: /quinoa\s*salad|salad.*quinoa/i, knowledge: { ingredients: ["quinoa", "vegetable", "lemon"], tags: ["whole_grain", "vegetable"] } },
  { pattern: /seaweed\s*salad|wakame/i, knowledge: { ingredients: ["seaweed", "sesame", "rice vinegar"], allergens: ["sesame"], tags: ["vegetable"] } },
  { pattern: /papaya\s*salad|som\s*tam|green\s*papaya/i, knowledge: { ingredients: ["papaya", "lime", "fish sauce", "peanuts"], allergens: ["fish", "peanuts"], tags: ["vegetable"] } },
  { pattern: /house\s*salad|garden\s*salad|mixed\s*greens/i, knowledge: { ingredients: ["lettuce", "vegetable", "vinaigrette"], tags: ["leafy_green", "vegetable"] } },

  // Poke / bowls
  { pattern: /poke|ahi|tuna\s*bowl/i, knowledge: { ingredients: ["tuna", "soy", "sesame", "rice", "avocado"], allergens: ["fish", "soy", "sesame"], tags: ["fish_oily", "vegetable"] } },
  { pattern: /salmon\s*bowl|bowl.*salmon/i, knowledge: { ingredients: ["salmon", "rice", "vegetable"], allergens: ["fish"], tags: ["fish_oily", "vegetable"] } },
  { pattern: /buddha\s*bowl|grain\s*bowl|power\s*bowl/i, knowledge: { ingredients: ["quinoa", "vegetable", "chickpea", "tahini"], allergens: ["sesame"], tags: ["whole_grain", "legume", "vegetable"], conditionTags: ["anxiety_supportive", "depression_supportive", "diabetes_friendly", "heart_healthy"] } },
  { pattern: /acai\s*bowl|açaí/i, knowledge: { ingredients: ["acai", "banana", "berries", "granola"], allergens: ["gluten"], tags: ["fruit"], conditionTags: ["depression_supportive", "diabetes_adverse"] } },

  // Fish / seafood
  { pattern: /sashimi|sushi|nigiri/i, knowledge: { ingredients: ["fish", "rice", "soy"], allergens: ["fish", "soy"], tags: ["fish_oily", "lean_protein"] } },
  { pattern: /grilled\s*salmon|salmon.*grilled/i, knowledge: { ingredients: ["salmon", "herbs", "lemon", "vegetable"], allergens: ["fish"], tags: ["fish_oily", "vegetable"], conditionTags: ["anxiety_supportive", "depression_supportive", "heart_healthy"] } },
  { pattern: /fish\s*and\s*chips|fish\s*n\s*chips/i, knowledge: { ingredients: ["fish", "batter", "fries"], allergens: ["fish", "gluten"], tags: ["fried", "processed"], conditionTags: ["heart_adverse", "hypertension_adverse", "inflammatory"] } },
  { pattern: /shrimp|crispy\s*prawn|prawn/i, knowledge: { ingredients: ["shrimp"], allergens: ["shellfish"], tags: ["lean_protein"] } },
  { pattern: /lobster|crab|crawfish/i, knowledge: { ingredients: ["shellfish", "butter"], allergens: ["shellfish", "dairy"], tags: ["lean_protein"] } },
  { pattern: /miso\s*(black\s*)?cod|black\s*cod/i, knowledge: { ingredients: ["cod", "miso", "sesame"], allergens: ["fish", "soy", "sesame"], tags: ["fish_oily", "fermented"] } },
  { pattern: /ceviche/i, knowledge: { ingredients: ["fish", "lime", "onion", "cilantro"], allergens: ["fish"], tags: ["fish_oily", "vegetable"] } },

  // Poultry / meat
  { pattern: /grilled\s*chicken|chicken.*grilled/i, knowledge: { ingredients: ["chicken", "herbs"], tags: ["lean_protein"] } },
  { pattern: /fried\s*chicken|chicken\s*fried|kfc|nashville\s*hot/i, knowledge: { ingredients: ["chicken", "batter", "flour"], allergens: ["gluten", "eggs"], tags: ["fried", "processed"] } },
  { pattern: /chicken\s*parm|parmesan\s*chicken/i, knowledge: { ingredients: ["chicken", "parmesan", "marinara", "breadcrumb"], allergens: ["dairy", "gluten"], tags: ["fried"] } },
  { pattern: /burger|cheeseburger|hamburger/i, knowledge: { ingredients: ["beef", "bun", "lettuce", "tomato"], allergens: ["gluten", "wheat"], tags: ["lean_protein"] } },
  { pattern: /steak|ribeye|filet|sirloin/i, knowledge: { ingredients: ["beef", "butter"], allergens: ["dairy"], tags: ["lean_protein"] } },
  { pattern: /bacon|pork\s*belly/i, knowledge: { ingredients: ["pork", "salt"], tags: ["processed", "high_sodium"] } },
  { pattern: /tandoori\s*chicken|chicken\s*tandoori/i, knowledge: { ingredients: ["chicken", "yogurt", "spices"], allergens: ["dairy"], tags: ["lean_protein"] } },

  // Pasta / noodles
  { pattern: /alfredo|fettuccine|cream\s*sauce/i, knowledge: { ingredients: ["pasta", "cream", "parmesan", "butter"], allergens: ["dairy", "gluten"], tags: ["fried", "processed"] } },
  { pattern: /carbonara/i, knowledge: { ingredients: ["pasta", "egg", "bacon", "parmesan"], allergens: ["dairy", "gluten", "eggs"], tags: ["processed"] } },
  { pattern: /ramen|tonkotsu|miso\s*ramen/i, knowledge: { ingredients: ["noodles", "broth", "pork", "egg", "soy"], allergens: ["gluten", "eggs", "soy"], tags: ["high_sodium", "processed"], conditionTags: ["hypertension_adverse", "anxiety_adverse"] } },
  { pattern: /pho|phở/i, knowledge: { ingredients: ["noodles", "broth", "beef", "herbs"], allergens: ["gluten"], tags: ["high_sodium"] } },
  { pattern: /pad\s*thai|pad\s*thai/i, knowledge: { ingredients: ["noodles", "peanuts", "egg", "fish sauce"], allergens: ["peanuts", "eggs", "fish"], tags: ["vegetable"] } },
  { pattern: /lo\s*mein|chow\s*mein|stir\s*fry/i, knowledge: { ingredients: ["noodles", "vegetable", "soy"], allergens: ["gluten", "soy"], tags: ["vegetable"] } },

  // Soups
  { pattern: /tom\s*yum|tom\s*yam/i, knowledge: { ingredients: ["shrimp", "lemongrass", "mushroom", "lime"], allergens: ["shellfish"], tags: ["vegetable"] } },
  { pattern: /lentil\s*soup|dal|dhal/i, knowledge: { ingredients: ["lentils", "tomato", "spices"], tags: ["legume", "vegetable"] } },
  { pattern: /minestrone/i, knowledge: { ingredients: ["vegetable", "beans", "pasta", "tomato"], allergens: ["gluten"], tags: ["legume", "vegetable"] } },
  { pattern: /clam\s*chowder|clam\s*chowder/i, knowledge: { ingredients: ["clam", "cream", "potato", "bacon"], allergens: ["shellfish", "dairy"], tags: ["processed"] } },
  { pattern: /miso\s*soup/i, knowledge: { ingredients: ["miso", "tofu", "seaweed"], allergens: ["soy"], tags: ["fermented", "high_sodium"] } },
  { pattern: /gazpacho/i, knowledge: { ingredients: ["tomato", "cucumber", "pepper", "olive oil"], tags: ["vegetable", "olive_oil"] } },

  // Vegetarian / plant-based
  { pattern: /chana\s*masala|chickpea\s*curry/i, knowledge: { ingredients: ["chickpea", "tomato", "ginger", "spices"], tags: ["legume", "vegetable"] } },
  { pattern: /dal|dhal|dahl/i, knowledge: { ingredients: ["lentils", "turmeric", "cumin", "tomato"], tags: ["legume", "herbs_spices"] } },
  { pattern: /tofu|tempeh/i, knowledge: { ingredients: ["tofu", "soy"], allergens: ["soy"], tags: ["lean_protein"] } },
  { pattern: /falafel/i, knowledge: { ingredients: ["chickpea", "herbs", "tahini"], allergens: ["sesame"], tags: ["legume"] } },
  { pattern: /hummus|houmous/i, knowledge: { ingredients: ["chickpea", "tahini", "lemon"], allergens: ["sesame"], tags: ["legume"] } },
  { pattern: /ratatouille/i, knowledge: { ingredients: ["eggplant", "zucchini", "tomato", "herbs"], tags: ["vegetable"] } },
  { pattern: /niçoise|nicoise/i, knowledge: { ingredients: ["tuna", "egg", "olives", "greens"], allergens: ["fish", "eggs"], tags: ["fish_oily", "leafy_green"] } },

  // Breakfast / brunch
  { pattern: /avocado\s*toast|toast.*avocado/i, knowledge: { ingredients: ["avocado", "bread", "egg"], allergens: ["gluten", "eggs"], tags: ["vegetable"] } },
  { pattern: /eggs\s*benedict|benedict/i, knowledge: { ingredients: ["egg", "english muffin", "hollandaise", "bacon"], allergens: ["gluten", "eggs", "dairy"], tags: ["processed"] } },
  { pattern: /pancake|waffle/i, knowledge: { ingredients: ["flour", "egg", "butter", "syrup"], allergens: ["gluten", "eggs", "dairy"], tags: ["sugary", "refined"] } },
  { pattern: /oatmeal|oat\s*bowl|porridge/i, knowledge: { ingredients: ["oats", "fruit"], tags: ["whole_grain", "fiber"] } },
  { pattern: /smoothie|smoothie\s*bowl/i, knowledge: { ingredients: ["fruit", "banana", "milk", "yogurt"], allergens: ["dairy"], tags: ["fruit"] } },

  // Sides / snacks
  { pattern: /fries|french\s*fries|chips/i, knowledge: { ingredients: ["potato", "oil", "salt"], tags: ["fried", "high_sodium"] } },
  { pattern: /onion\s*rings/i, knowledge: { ingredients: ["onion", "batter", "flour"], allergens: ["gluten"], tags: ["fried"] } },
  { pattern: /mozzarella\s*sticks|cheese\s*sticks/i, knowledge: { ingredients: ["mozzarella", "breadcrumb"], allergens: ["dairy", "gluten"], tags: ["fried"] } },
  { pattern: /guacamole|guac/i, knowledge: { ingredients: ["avocado", "lime", "onion", "cilantro"], tags: ["vegetable"] } },
  { pattern: /edamame/i, knowledge: { ingredients: ["edamame", "salt"], allergens: ["soy"], tags: ["legume"] } },

  // Desserts / drinks
  { pattern: /ice\s*cream|gelato/i, knowledge: { ingredients: ["cream", "sugar", "milk"], allergens: ["dairy"], tags: ["sugary", "processed"] } },
  { pattern: /tiramisu/i, knowledge: { ingredients: ["mascarpone", "coffee", "egg", "ladyfinger"], allergens: ["dairy", "eggs", "gluten"], tags: ["sugary", "caffeine"] } },
  { pattern: /cheesecake/i, knowledge: { ingredients: ["cream cheese", "sugar", "graham cracker"], allergens: ["dairy", "gluten"], tags: ["sugary", "processed"] } },
  { pattern: /latte|cappuccino|espresso|mocha|coffee/i, knowledge: { ingredients: ["coffee", "milk"], allergens: ["dairy"], tags: ["caffeine"], conditionTags: ["anxiety_adverse", "depression_adverse"] } },
  { pattern: /matcha|green\s*tea/i, knowledge: { ingredients: ["matcha", "milk"], allergens: ["dairy"], tags: ["caffeine"], conditionTags: ["anxiety_adverse"] } },
  { pattern: /wine|beer|cocktail|margarita|martini/i, knowledge: { ingredients: ["alcohol"], tags: [], conditionTags: ["anxiety_adverse", "depression_adverse"] } },
  { pattern: /oatmeal|oat\s*bowl|porridge/i, knowledge: { ingredients: ["oats", "fruit"], tags: ["whole_grain", "fiber"], conditionTags: ["anxiety_supportive", "diabetes_friendly", "sleep_supportive"] } },
  { pattern: /lentil\s*soup|dal|dhal/i, knowledge: { ingredients: ["lentils", "tomato", "spices"], tags: ["legume", "vegetable"], conditionTags: ["depression_supportive", "diabetes_friendly", "heart_healthy"] } },
];

/** Keywords in dish name that suggest ingredients (for fallback when no pattern matches) */
const NAME_INGREDIENT_HINTS: Array<{ pattern: RegExp; ingredient: string; allergen?: string; tag?: string }> = [
  { pattern: /salmon|tuna|cod|trout|mackerel|sardine/i, ingredient: "fish", allergen: "fish", tag: "fish_oily" },
  { pattern: /shrimp|prawn|crab|lobster|clam|mussel/i, ingredient: "shellfish", allergen: "shellfish" },
  { pattern: /chicken|poultry/i, ingredient: "chicken", tag: "lean_protein" },
  { pattern: /beef|steak|burger/i, ingredient: "beef", tag: "lean_protein" },
  { pattern: /pork|bacon|ham/i, ingredient: "pork", tag: "processed" },
  { pattern: /tofu|tempeh|edamame|miso/i, ingredient: "soy", allergen: "soy" },
  { pattern: /peanut|peanuts/i, ingredient: "peanuts", allergen: "peanuts" },
  { pattern: /almond|walnut|cashew|pecan|pistachio/i, ingredient: "tree_nuts", allergen: "tree_nuts" },
  { pattern: /cheese|parmesan|feta|mozzarella|cream/i, ingredient: "dairy", allergen: "dairy" },
  { pattern: /egg|eggs/i, ingredient: "egg", allergen: "eggs" },
  { pattern: /bread|pasta|noodle|flour|crouton/i, ingredient: "gluten", allergen: "gluten" },
  { pattern: /sesame|tahini/i, ingredient: "sesame", allergen: "sesame" },
  { pattern: /kale|spinach|lettuce|arugula|greens/i, ingredient: "leafy_green", tag: "leafy_green" },
  { pattern: /quinoa|brown\s*rice|oat|barley/i, ingredient: "whole_grain", tag: "whole_grain" },
  { pattern: /lentil|chickpea|bean|black\s*bean/i, ingredient: "legume", tag: "legume" },
  { pattern: /avocado/i, ingredient: "avocado", tag: "vegetable" },
  { pattern: /fried|crispy|battered/i, ingredient: "fried", tag: "fried" },
  { pattern: /grilled|roasted|steamed/i, ingredient: "cooked", tag: "lean_protein" },
];

/** Derive condition tags from dish tags (for ranking by mental health & chronic disease) */
function deriveConditionTagsFromTags(tags: string[]): ConditionTag[] {
  const out = new Set<ConditionTag>();
  for (const tag of tags) {
    const mapped = TAG_TO_CONDITION[tag];
    if (mapped) mapped.forEach((c) => out.add(c));
  }
  return Array.from(out);
}

/**
 * Infer ingredients, allergens, tags, and condition tags from dish name (and optional description).
 * Condition tags tie to mental health (anxiety, depression) and chronic disease (hypertension, diabetes, heart).
 */
export function inferFromDishName(
  name: string,
  description?: string,
): { ingredients: string[]; allergens: string[]; tags: string[]; conditionTags: ConditionTag[] } {
  const text = `${name ?? ""} ${description ?? ""}`.toLowerCase().trim();
  if (!text) return { ingredients: [], allergens: [], tags: [], conditionTags: [] };

  const ingredients = new Set<string>();
  const allergens = new Set<string>();
  const tags = new Set<string>();
  const conditionTags = new Set<ConditionTag>();

  for (const { pattern, knowledge } of DISH_KNOWLEDGE) {
    const match = typeof pattern === "string" ? text.includes(pattern.toLowerCase()) : pattern.test(text);
    if (match) {
      knowledge.ingredients.forEach((i) => ingredients.add(i));
      (knowledge.allergens ?? []).forEach((a) => allergens.add(a));
      knowledge.tags.forEach((t) => tags.add(t));
      (knowledge.conditionTags ?? []).forEach((c) => conditionTags.add(c));
    }
  }

  for (const { pattern, ingredient, allergen, tag } of NAME_INGREDIENT_HINTS) {
    if (pattern.test(text)) {
      ingredients.add(ingredient);
      if (allergen) allergens.add(allergen);
      if (tag) tags.add(tag);
    }
  }

  deriveConditionTagsFromTags(Array.from(tags)).forEach((c) => conditionTags.add(c));

  if (HIGH_MERCURY_FISH.some((f) => text.includes(f))) conditionTags.add("high_mercury");
  if (RAW_FISH_INDICATORS.some((r) => text.includes(r))) conditionTags.add("raw_fish");

  return {
    ingredients: Array.from(ingredients),
    allergens: Array.from(allergens),
    tags: Array.from(tags),
    conditionTags: Array.from(conditionTags),
  };
}

/**
 * Enrich a menu item with inferred data when ingredients are missing.
 * Merges inferred ingredients/allergens/tags with any existing ones.
 * Optionally merges nutrients from nutrition dataset via lookupNutrition.
 */
export function enrichMenuItemFromName(input: MenuItemInput): MenuItemInput {
  const hasIngredients = (input.ingredients?.length ?? 0) > 0;
  const name = input.name ?? "";

  if (!name) return input;

  const inferred = inferFromDishName(name, input.description);

  const base = {
    ...input,
    ingredients: hasIngredients ? input.ingredients : [...(input.ingredients ?? []), ...inferred.ingredients],
    allergens: [...new Set([...(input.allergens ?? []), ...inferred.allergens])],
    tags: [...new Set([...(input.tags ?? []), ...inferred.tags])],
    conditionTags: [...new Set([...(input.conditionTags || []), ...(inferred.conditionTags || [])])],
  };

  const nutrients = lookupNutrition(base);
  if (nutrients && Object.keys(nutrients).length > 0) {
    return { ...base, nutrients: { ...input.nutrients, ...nutrients } };
  }

  return base;
}
