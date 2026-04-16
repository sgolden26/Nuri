/**
 * Menu provider — returns menu items per restaurant.
 * Uses mock data until external menu API is implemented.
 */

import type { Restaurant } from "./types";
import type { MenuItemInput } from "./menu-scoring";

/** Cuisine-specific dish templates — 6 per cuisine for variety */
const DISH_TEMPLATES: Record<string, MenuItemInput[]> = {
  health_food: [
    { name: "Kale Caesar", description: "Kale, parmesan, lemon tahini, croutons", ingredients: ["kale", "parmesan", "lemon", "tahini", "croutons"], allergens: ["dairy", "gluten"], tags: ["leafy_green"], nutrients: { sodium_mg: 380, protein_g: 12, fiber_g: 6, saturatedFat_g: 3 } },
    { name: "Quinoa Buddha Bowl", description: "Quinoa, roasted vegetables, chickpeas, tahini", ingredients: ["quinoa", "vegetable", "chickpea", "tahini"], allergens: ["sesame"], tags: ["whole_grain", "legume", "vegetable"], nutrients: { sodium_mg: 290, protein_g: 16, fiber_g: 12, saturatedFat_g: 1 } },
    { name: "Green Smoothie Bowl", description: "Spinach, banana, almond milk, chia, berries", ingredients: ["spinach", "banana", "almond", "chia", "berries"], allergens: ["tree_nuts"], tags: ["leafy_green", "fruit", "fiber"] },
    { name: "Acai Power Bowl", description: "Acai, granola, banana, hemp seeds, almond butter", ingredients: ["acai", "granola", "banana", "hemp", "almond"], allergens: ["tree_nuts"], tags: ["fruit", "fiber"] },
    { name: "Turmeric Chickpea Stew", description: "Chickpeas, turmeric, spinach, coconut milk", ingredients: ["chickpea", "turmeric", "spinach", "coconut"], tags: ["legume", "herbs_spices", "vegetable"], nutrients: { sodium_mg: 320, protein_g: 14, fiber_g: 10, saturatedFat_g: 2 } },
    { name: "Avocado Toast with Seeds", description: "Whole grain bread, avocado, flax, pumpkin seeds, lemon", ingredients: ["bread", "avocado", "flax", "pumpkin seeds", "lemon"], allergens: ["gluten"], tags: ["whole_grain", "fiber"] },
  ],
  japanese: [
    { name: "Salmon Sashimi", description: "Wild salmon, ginger, soy", ingredients: ["salmon", "ginger", "soy"], allergens: ["fish", "soy"], tags: ["fish_oily", "lean_protein"], nutrients: { sodium_mg: 200, protein_g: 28, saturatedFat_g: 1.5 } },
    { name: "Miso Glazed Black Cod", description: "Black cod, miso, mirin, sesame", ingredients: ["cod", "miso", "sesame"], allergens: ["fish", "soy", "sesame"], tags: ["fish_oily", "fermented"], nutrients: { sodium_mg: 420, protein_g: 26, saturatedFat_g: 2 } },
    { name: "Seaweed Salad", description: "Wakame, cucumber, rice vinegar, sesame", ingredients: ["seaweed", "cucumber", "sesame"], allergens: ["sesame"], tags: ["vegetable"] },
    { name: "Grilled Teriyaki Salmon", description: "Salmon fillet, teriyaki glaze, steamed rice, broccoli", ingredients: ["salmon", "teriyaki", "rice", "broccoli"], allergens: ["fish", "soy"], tags: ["fish_oily", "lean_protein"], nutrients: { sodium_mg: 480, protein_g: 32, saturatedFat_g: 2, fiber_g: 3 } },
    { name: "Edamame", description: "Steamed soybeans, sea salt", ingredients: ["edamame", "salt"], allergens: ["soy"], tags: ["legume"], nutrients: { sodium_mg: 150, protein_g: 18, fiber_g: 8, saturatedFat_g: 0.5 } },
    { name: "Chirashi Bowl", description: "Assorted sashimi over seasoned rice with pickled ginger", ingredients: ["tuna", "salmon", "shrimp", "rice", "ginger"], allergens: ["fish", "shellfish"], tags: ["fish_oily", "lean_protein"] },
  ],
  mediterranean: [
    { name: "Grilled Salmon", description: "Wild salmon, olive oil, herbs, roasted vegetables", ingredients: ["salmon", "olive oil", "herbs", "vegetable"], allergens: ["fish"], tags: ["fish_oily", "olive_oil", "vegetable"], nutrients: { sodium_mg: 250, protein_g: 34, saturatedFat_g: 2, fiber_g: 4 } },
    { name: "Mediterranean Kale Salad", description: "Kale, chickpeas, olive oil, lemon, herbs", ingredients: ["kale", "chickpea", "olive oil", "lemon"], tags: ["leafy_green", "legume", "olive_oil"], nutrients: { sodium_mg: 280, protein_g: 12, fiber_g: 9, saturatedFat_g: 1 } },
    { name: "Lentil Soup", description: "Lentils, tomato, spinach, olive oil", ingredients: ["lentils", "tomato", "spinach", "olive oil"], tags: ["legume", "vegetable"] },
    { name: "Grilled Chicken Souvlaki", description: "Herb-marinated chicken, tzatziki, cucumber, tomato", ingredients: ["chicken", "yogurt", "cucumber", "tomato", "herbs"], allergens: ["dairy"], tags: ["lean_protein", "vegetable"], nutrients: { sodium_mg: 350, protein_g: 30, saturatedFat_g: 3, fiber_g: 2 } },
    { name: "Hummus & Grilled Veggie Plate", description: "Chickpea hummus, grilled zucchini, peppers, whole wheat pita", ingredients: ["chickpea", "zucchini", "pepper", "pita", "olive oil"], allergens: ["gluten", "sesame"], tags: ["legume", "vegetable", "olive_oil"] },
    { name: "Tabbouleh with Feta", description: "Bulgur, parsley, tomato, mint, olive oil, feta", ingredients: ["bulgur", "parsley", "tomato", "mint", "olive oil", "feta"], allergens: ["gluten", "dairy"], tags: ["whole_grain", "vegetable"] },
  ],
  thai: [
    { name: "Papaya Salad", description: "Green papaya, lime, fish sauce, peanuts", ingredients: ["papaya", "lime", "fish sauce", "peanuts"], allergens: ["fish", "peanuts"], tags: ["vegetable"] },
    { name: "Tom Yum Soup", description: "Shrimp, lemongrass, galangal, mushroom", ingredients: ["shrimp", "lemongrass", "mushroom"], allergens: ["shellfish"], tags: ["vegetable"], nutrients: { sodium_mg: 520, protein_g: 18, saturatedFat_g: 1, fiber_g: 2 } },
    { name: "Stir-Fried Vegetables", description: "Seasonal vegetables, light soy, ginger", ingredients: ["vegetable", "soy", "ginger"], allergens: ["soy"], tags: ["vegetable"] },
    { name: "Chicken Larb", description: "Ground chicken, mint, lime, chilies, lettuce cups", ingredients: ["chicken", "mint", "lime", "chili", "lettuce"], tags: ["lean_protein", "leafy_green"], nutrients: { sodium_mg: 400, protein_g: 24, saturatedFat_g: 2, fiber_g: 3 } },
    { name: "Green Curry with Tofu", description: "Tofu, green curry, Thai basil, bamboo shoots, brown rice", ingredients: ["tofu", "curry", "basil", "bamboo", "rice"], allergens: ["soy"], tags: ["legume", "vegetable", "herbs_spices"] },
    { name: "Grilled Lemongrass Chicken", description: "Chicken breast, lemongrass, jasmine rice, bok choy", ingredients: ["chicken", "lemongrass", "rice", "bok choy"], tags: ["lean_protein", "vegetable"], nutrients: { sodium_mg: 360, protein_g: 28, saturatedFat_g: 2 } },
  ],
  american: [
    { name: "Grilled Chicken Salad", description: "Grilled chicken, mixed greens, vinaigrette", ingredients: ["chicken", "greens", "vinaigrette"], tags: ["lean_protein", "leafy_green"], nutrients: { sodium_mg: 350, protein_g: 32, saturatedFat_g: 2, fiber_g: 4 } },
    { name: "Roasted Vegetable Bowl", description: "Root vegetables, quinoa, herbs", ingredients: ["vegetable", "quinoa", "herbs"], tags: ["vegetable", "whole_grain"] },
    { name: "Grass-Fed Burger", description: "Beef, lettuce, tomato, whole grain bun", ingredients: ["beef", "lettuce", "tomato", "bread"], allergens: ["gluten", "wheat"], tags: ["lean_protein"] },
    { name: "Wild Salmon Fillet", description: "Pan-seared salmon, asparagus, lemon butter", ingredients: ["salmon", "asparagus", "lemon", "butter"], allergens: ["fish", "dairy"], tags: ["fish_oily", "vegetable"], nutrients: { sodium_mg: 280, protein_g: 36, saturatedFat_g: 3, fiber_g: 3 } },
    { name: "Turkey Avocado Wrap", description: "Roasted turkey, avocado, spinach, whole wheat wrap", ingredients: ["turkey", "avocado", "spinach", "wrap"], allergens: ["gluten"], tags: ["lean_protein", "leafy_green"] },
    { name: "Sweet Potato & Black Bean Bowl", description: "Roasted sweet potato, black beans, kale, tahini", ingredients: ["sweet potato", "beans", "kale", "tahini"], allergens: ["sesame"], tags: ["vegetable", "legume", "leafy_green"], nutrients: { sodium_mg: 310, protein_g: 14, fiber_g: 14, saturatedFat_g: 1 } },
  ],
  hawaiian: [
    { name: "Ahi Poke Bowl", description: "Tuna, soy, sesame, avocado, rice", ingredients: ["tuna", "soy", "sesame", "avocado", "rice"], allergens: ["fish", "soy", "sesame"], tags: ["fish_oily", "vegetable"], nutrients: { sodium_mg: 380, protein_g: 28, saturatedFat_g: 1.5, fiber_g: 4 } },
    { name: "Salmon Poke", description: "Salmon, coconut aminos, ginger, seaweed", ingredients: ["salmon", "ginger", "seaweed"], allergens: ["fish"], tags: ["fish_oily"] },
    { name: "Tropical Salad", description: "Greens, mango, macadamia, light dressing", ingredients: ["greens", "mango", "macadamia"], allergens: ["tree_nuts"], tags: ["leafy_green", "fruit"] },
    { name: "Grilled Mahi Mahi", description: "Mahi mahi, pineapple salsa, coconut rice", ingredients: ["mahi", "pineapple", "coconut", "rice"], allergens: ["fish"], tags: ["fish_oily", "lean_protein"], nutrients: { sodium_mg: 300, protein_g: 30, saturatedFat_g: 2, fiber_g: 2 } },
    { name: "Acai Bowl", description: "Acai blend, banana, coconut, granola, honey", ingredients: ["acai", "banana", "coconut", "granola"], tags: ["fruit", "fiber"] },
    { name: "Kalua Chicken Plate", description: "Slow-cooked chicken, brown rice, steamed greens", ingredients: ["chicken", "rice", "greens"], tags: ["lean_protein", "whole_grain", "leafy_green"] },
  ],
  indian: [
    { name: "Dal Tadka", description: "Yellow lentils, turmeric, cumin, tomato, garlic", ingredients: ["lentils", "turmeric", "cumin", "tomato", "garlic"], tags: ["legume", "herbs_spices"], nutrients: { sodium_mg: 340, protein_g: 16, fiber_g: 12, saturatedFat_g: 1 } },
    { name: "Tandoori Chicken", description: "Chicken, yogurt, spices, lemon", ingredients: ["chicken", "yogurt", "spices", "lemon"], allergens: ["dairy"], tags: ["lean_protein"], nutrients: { sodium_mg: 380, protein_g: 32, saturatedFat_g: 3 } },
    { name: "Chana Masala", description: "Chickpeas, tomato, ginger, spices", ingredients: ["chickpea", "tomato", "ginger"], tags: ["legume", "vegetable"] },
    { name: "Fish Tikka", description: "Spiced grilled fish, mint chutney, onion", ingredients: ["fish", "mint", "spices", "onion"], allergens: ["fish"], tags: ["fish_oily", "lean_protein", "herbs_spices"], nutrients: { sodium_mg: 320, protein_g: 28, saturatedFat_g: 2 } },
    { name: "Palak Paneer", description: "Spinach curry, paneer cheese, garlic, cumin", ingredients: ["spinach", "paneer", "garlic", "cumin"], allergens: ["dairy"], tags: ["leafy_green", "vegetable"] },
    { name: "Rajma", description: "Kidney bean curry, tomato, ginger, spices, brown rice", ingredients: ["kidney beans", "tomato", "ginger", "spices", "rice"], tags: ["legume", "whole_grain", "herbs_spices"], nutrients: { sodium_mg: 360, protein_g: 14, fiber_g: 13, saturatedFat_g: 1 } },
  ],
  french: [
    { name: "Salade Nicoise", description: "Tuna, eggs, olives, greens, vinaigrette", ingredients: ["tuna", "egg", "olives", "greens"], allergens: ["fish", "eggs"], tags: ["fish_oily", "leafy_green"], nutrients: { sodium_mg: 380, protein_g: 26, saturatedFat_g: 3, fiber_g: 5 } },
    { name: "Grilled Trout", description: "Trout, herbs, lemon, vegetables", ingredients: ["trout", "herbs", "lemon", "vegetable"], allergens: ["fish"], tags: ["fish_oily", "vegetable"], nutrients: { sodium_mg: 260, protein_g: 30, saturatedFat_g: 2, fiber_g: 3 } },
    { name: "Ratatouille", description: "Eggplant, zucchini, tomato, herbs, olive oil", ingredients: ["eggplant", "zucchini", "tomato", "herbs", "olive oil"], tags: ["vegetable", "olive_oil"] },
    { name: "Duck Breast with Greens", description: "Seared duck breast, arugula, cherry vinaigrette", ingredients: ["duck", "arugula", "cherry", "vinaigrette"], tags: ["lean_protein", "leafy_green"] },
    { name: "Herb-Crusted Lamb Chops", description: "Lamb, rosemary, garlic, roasted root vegetables", ingredients: ["lamb", "rosemary", "garlic", "vegetable"], tags: ["lean_protein", "vegetable"] },
    { name: "Provencal Fish Stew", description: "White fish, fennel, tomato, saffron broth", ingredients: ["fish", "fennel", "tomato", "saffron"], allergens: ["fish"], tags: ["fish_oily", "vegetable"], nutrients: { sodium_mg: 400, protein_g: 24, saturatedFat_g: 2, fiber_g: 4 } },
  ],
  mexican: [
    { name: "Fish Tacos", description: "Grilled fish, cabbage slaw, lime crema, corn tortilla", ingredients: ["fish", "cabbage", "lime", "tortilla"], allergens: ["fish"], tags: ["fish_oily", "vegetable"] },
    { name: "Chicken Burrito Bowl", description: "Grilled chicken, black beans, brown rice, salsa", ingredients: ["chicken", "beans", "rice", "salsa"], tags: ["lean_protein", "legume", "whole_grain"], nutrients: { sodium_mg: 420, protein_g: 30, fiber_g: 10, saturatedFat_g: 2 } },
    { name: "Guacamole & Veggies", description: "Avocado, lime, vegetables, jicama chips", ingredients: ["avocado", "lime", "vegetable"], tags: ["vegetable", "fiber"] },
    { name: "Ceviche", description: "Fresh shrimp, lime, cilantro, avocado, tomato", ingredients: ["shrimp", "lime", "cilantro", "avocado", "tomato"], allergens: ["shellfish"], tags: ["lean_protein", "vegetable"], nutrients: { sodium_mg: 280, protein_g: 22, saturatedFat_g: 1, fiber_g: 4 } },
    { name: "Black Bean Soup", description: "Black beans, cumin, roasted peppers, cilantro, lime", ingredients: ["beans", "cumin", "pepper", "cilantro", "lime"], tags: ["legume", "fiber", "vegetable"], nutrients: { sodium_mg: 350, protein_g: 14, fiber_g: 15, saturatedFat_g: 0.5 } },
    { name: "Grilled Shrimp Fajitas", description: "Shrimp, peppers, onions, corn tortillas, pico de gallo", ingredients: ["shrimp", "pepper", "onion", "tortilla"], allergens: ["shellfish"], tags: ["lean_protein", "vegetable"] },
  ],
  chinese: [
    { name: "Steamed Sea Bass", description: "Sea bass, ginger, scallion, light soy", ingredients: ["sea bass", "ginger", "scallion", "soy"], allergens: ["fish", "soy"], tags: ["fish_oily", "lean_protein"], nutrients: { sodium_mg: 320, protein_g: 30, saturatedFat_g: 1.5 } },
    { name: "Mapo Tofu", description: "Silken tofu, chili, Sichuan peppercorn, garlic", ingredients: ["tofu", "chili", "garlic"], allergens: ["soy"], tags: ["legume", "herbs_spices"] },
    { name: "Stir-Fried Bok Choy", description: "Bok choy, garlic, sesame oil", ingredients: ["bok choy", "garlic", "sesame oil"], allergens: ["sesame"], tags: ["leafy_green", "vegetable"] },
    { name: "Kung Pao Chicken", description: "Chicken, peanuts, chili, vegetables, light sauce", ingredients: ["chicken", "peanuts", "chili", "vegetable"], allergens: ["peanuts"], tags: ["lean_protein", "vegetable"] },
    { name: "Wonton Soup", description: "Shrimp wontons, bok choy, clear broth, scallion", ingredients: ["shrimp", "wonton", "bok choy", "broth"], allergens: ["shellfish", "gluten"], tags: ["lean_protein", "vegetable"], nutrients: { sodium_mg: 480, protein_g: 18, saturatedFat_g: 1, fiber_g: 2 } },
    { name: "Steamed Vegetable Dumplings", description: "Cabbage, mushroom, ginger, soy dipping sauce", ingredients: ["cabbage", "mushroom", "ginger", "soy"], allergens: ["gluten", "soy"], tags: ["vegetable"] },
  ],
  default: [
    { name: "Grilled Chicken & Greens", description: "Herb-marinated chicken breast, mixed greens, lemon vinaigrette", ingredients: ["chicken", "greens", "lemon", "olive oil"], tags: ["lean_protein", "leafy_green"], nutrients: { sodium_mg: 340, protein_g: 34, saturatedFat_g: 2, fiber_g: 4 } },
    { name: "Pan-Seared Salmon", description: "Wild salmon, roasted vegetables, herb sauce", ingredients: ["salmon", "vegetable", "herbs"], allergens: ["fish"], tags: ["fish_oily", "vegetable"], nutrients: { sodium_mg: 270, protein_g: 32, saturatedFat_g: 2, fiber_g: 3 } },
    { name: "Grain Bowl", description: "Farro, roasted vegetables, chickpeas, tahini", ingredients: ["farro", "vegetable", "chickpea", "tahini"], allergens: ["sesame"], tags: ["whole_grain", "legume", "vegetable"], nutrients: { sodium_mg: 300, protein_g: 14, fiber_g: 11, saturatedFat_g: 1 } },
    { name: "Herb-Roasted Chicken", description: "Half chicken, rosemary, garlic, seasonal vegetables", ingredients: ["chicken", "rosemary", "garlic", "vegetable"], tags: ["lean_protein", "vegetable"] },
    { name: "Grilled Shrimp Plate", description: "Jumbo shrimp, garlic, lemon, steamed broccoli, rice", ingredients: ["shrimp", "garlic", "lemon", "broccoli", "rice"], allergens: ["shellfish"], tags: ["lean_protein", "vegetable"], nutrients: { sodium_mg: 310, protein_g: 26, saturatedFat_g: 1, fiber_g: 4 } },
    { name: "Mixed Veggie Stir-Fry", description: "Seasonal vegetables, tofu, ginger, brown rice", ingredients: ["vegetable", "tofu", "ginger", "rice"], allergens: ["soy"], tags: ["vegetable", "whole_grain"] },
  ],
};

const NAME_HINTS: Record<string, string[]> = {
  japanese: ["sushi", "ramen", "izakaya", "japanese", "teriyaki", "tempura", "udon", "soba", "yakitori", "hibachi", "zen", "matcha", "sake", "bento"],
  thai: ["thai", "pad", "bangkok", "orchid", "basil", "lemongrass", "siamese"],
  indian: ["tandoori", "masala", "curry", "indian", "tikka", "naan", "biryani", "dosa", "flame", "spice"],
  mediterranean: ["mediterranean", "hummus", "falafel", "pita", "greek", "kebab", "gyro", "olive"],
  hawaiian: ["poke", "hawaiian", "aloha", "tiki", "island", "paradise"],
  french: ["bistro", "brasserie", "french", "café", "cafe", "le ", "la ", "jardin", "patisserie", "crêpe"],
  health_food: ["green", "bowl", "juice", "salad bar", "farm", "organic", "vegan", "plant", "sprout", "nourish", "vitality"],
  american: ["grill", "burger", "steak", "bbq", "diner", "farm table", "smokehouse", "tavern"],
  mexican: ["taco", "burrito", "mexican", "cantina", "taqueria", "enchilada", "guac"],
  chinese: ["chinese", "wok", "dim sum", "szechuan", "sichuan", "dumpling", "noodle", "peking", "dynasty", "dragon", "golden"],
};

function getCuisineKey(types: string[], name: string): string {
  const cuisines = Object.keys(DISH_TEMPLATES).filter((k) => k !== "default");
  for (const c of cuisines) {
    if (types.some((t) => t.includes(c))) return c;
  }
  const nameLower = name.toLowerCase();
  for (const [cuisine, hints] of Object.entries(NAME_HINTS)) {
    if (hints.some((h) => nameLower.includes(h))) return cuisine;
  }
  return "default";
}

/** Deterministic hash from a string — used to vary dish selection per restaurant */
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pick a varied subset of dishes based on restaurant name */
function pickDishes(templates: MenuItemInput[], restaurantName: string, count: number): MenuItemInput[] {
  if (templates.length <= count) return templates;
  const offset = nameHash(restaurantName) % templates.length;
  const picked: MenuItemInput[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(templates[(offset + i) % templates.length]);
  }
  return picked;
}

export interface MenuItemWithRestaurant {
  item: MenuItemInput;
  restaurant: { name: string; walkingMinutes?: number };
}

/**
 * Get menu items for a list of restaurants.
 * Uses mock data keyed by restaurant types until menu API is available.
 */
export function getMenuItemsForRestaurants(restaurants: Restaurant[]): MenuItemWithRestaurant[] {
  const result: MenuItemWithRestaurant[] = [];
  for (const r of restaurants) {
    const key = getCuisineKey(r.types, r.name);
    const templates = DISH_TEMPLATES[key] ?? DISH_TEMPLATES.default;
    const dishes = pickDishes(templates, r.name, 4);
    for (const t of dishes) {
      result.push({
        item: { ...t },
        restaurant: { name: r.name, walkingMinutes: r.walkingMinutes },
      });
    }
  }
  return result;
}
