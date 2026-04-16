/**
 * Nutrition lookup — matches dish names and ingredients to the nutrition dataset
 * and returns nutrients for scoring. Used to enrich menu items with real data.
 */

import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";
import type { MenuItemInput } from "./menu-scoring";

export interface Nutrients {
  sodium_mg?: number;
  potassium_mg?: number;
  calcium_mg?: number;
  magnesium_mg?: number;
  protein_g?: number;
  carbs_g?: number;
  fiber_g?: number;
  saturatedFat_g?: number;
  sugar_g?: number;
}

interface NutritionRow {
  name: string;
  sodium_mg: number;
  potassium_mg: number;
  calcium_mg: number;
  magnesium_mg: number;
  protein_g: number;
  carbs_g: number;
  fiber_g: number;
  saturatedFat_g: number;
  sugar_g: number;
}

let cache: NutritionRow[] | null = null;

/** Parse value like "9.00 mg", "0.1g" to number (for sodium, potassium, calcium, magnesium in mg) */
function parseNutrient(val: string | undefined): number {
  if (val == null || val === "" || val === "0") return 0;
  const s = String(val).trim().replace(/,/g, "");
  const num = parseFloat(s.replace(/[^\d.-]/g, ""));
  if (Number.isNaN(num)) return 0;
  if (/g\b/i.test(s)) return num * 1000; // g → mg
  return num;
}

/** Parse grams (protein, carbs, fiber, etc.) */
function parseGrams(val: string | undefined): number {
  if (val == null || val === "" || val === "0") return 0;
  const s = String(val).trim().replace(/,/g, "");
  const num = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isNaN(num) ? 0 : num;
}

function loadDataset(): NutritionRow[] {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "src", "data", "nutrition.csv");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<string, string>[];
  const rows: NutritionRow[] = [];
  for (const r of records) {
    const name = (r.name ?? r.Name ?? "").trim();
    if (!name) continue;
    rows.push({
      name,
      sodium_mg: parseNutrient(r.sodium ?? r.Sodium),
      potassium_mg: parseNutrient(r.potassium ?? r.Potassium),
      calcium_mg: parseNutrient(r.calcium ?? r.Calcium),
      magnesium_mg: parseNutrient(r.magnesium ?? r.Magnesium),
      protein_g: parseGrams(r.protein ?? r.Protein),
      carbs_g: parseGrams(r.carbohydrate ?? r.Carbohydrate),
      fiber_g: parseGrams(r.fiber ?? r.Fiber),
      saturatedFat_g: parseGrams(r.saturated_fat ?? r.saturated_fatty_acids ?? r.Saturated_fat ?? 0),
      sugar_g: parseGrams(r.sugars ?? r.Sugars ?? 0),
    });
  }
  cache = rows;
  return rows;
}

/** Normalize for matching: lowercase, remove punctuation, collapse spaces */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Score how well a search term matches a food name. Higher = better. */
function matchScore(search: string, foodName: string): number {
  const nSearch = normalize(search);
  const nFood = normalize(foodName);
  if (nFood.includes(nSearch)) return 100;
  if (nSearch.includes(nFood)) return 80;
  const searchWords = nSearch.split(/\s+/).filter((w) => w.length > 2);
  const foodWords = nFood.split(/\s+/);
  let matches = 0;
  for (const sw of searchWords) {
    if (foodWords.some((fw) => fw.includes(sw) || sw.includes(fw))) matches++;
  }
  return searchWords.length > 0 ? (matches / searchWords.length) * 70 : 0;
}

/** Find best matching row for a search term (ingredient or dish name) */
function findBestMatch(search: string, rows: NutritionRow[]): NutritionRow | null {
  let best: { row: NutritionRow; score: number } | null = null;
  for (const row of rows) {
    const score = matchScore(search, row.name);
    if (score >= 50 && (!best || score > best.score)) {
      best = { row, score };
    }
  }
  return best?.row ?? null;
}

/** Aggregate nutrients from multiple rows (simple average for composite dishes) */
function aggregateNutrients(rows: NutritionRow[]): Nutrients {
  if (rows.length === 0) return {};
  const n = rows.length;
  return {
    sodium_mg: Math.round(rows.reduce((s, r) => s + r.sodium_mg, 0) / n),
    potassium_mg: Math.round(rows.reduce((s, r) => s + r.potassium_mg, 0) / n),
    calcium_mg: Math.round(rows.reduce((s, r) => s + r.calcium_mg, 0) / n),
    magnesium_mg: Math.round(rows.reduce((s, r) => s + r.magnesium_mg, 0) / n),
    protein_g: Math.round((rows.reduce((s, r) => s + r.protein_g, 0) / n) * 10) / 10,
    carbs_g: Math.round((rows.reduce((s, r) => s + r.carbs_g, 0) / n) * 10) / 10,
    fiber_g: Math.round((rows.reduce((s, r) => s + r.fiber_g, 0) / n) * 10) / 10,
    saturatedFat_g: Math.round((rows.reduce((s, r) => s + r.saturatedFat_g, 0) / n) * 10) / 10,
    sugar_g: Math.round((rows.reduce((s, r) => s + r.sugar_g, 0) / n) * 10) / 10,
  };
}

/** Map inferred ingredients to dataset-friendly search terms */
const INGREDIENT_ALIASES: Record<string, string> = {
  romaine: "lettuce romaine",
  lettuce: "lettuce",
  greens: "lettuce",
  kale: "kale",
  spinach: "spinach",
  parmesan: "cheese parmesan",
  cheese: "cheese",
  croutons: "bread",
  chicken: "chicken",
  salmon: "salmon",
  tuna: "tuna",
  cod: "cod",
  shrimp: "shrimp",
  beef: "beef",
  pork: "pork",
  tofu: "tofu",
  chickpea: "chickpea",
  lentils: "lentil",
  quinoa: "quinoa",
  rice: "rice",
  avocado: "avocado",
  tomato: "tomato",
  olive_oil: "olive oil",
  vegetable: "vegetable",
  broccoli: "broccoli",
  cauliflower: "cauliflower",
  eggplant: "eggplant",
  seaweed: "seaweed",
  mushroom: "mushroom",
  egg: "egg",
  yogurt: "yogurt",
  cream: "cream",
  butter: "butter",
  bread: "bread",
  pasta: "pasta",
  noodles: "noodles",
};

/**
 * Look up nutrients for a menu item using dish name and inferred ingredients.
 * Returns nutrients when dataset matches are found; otherwise undefined.
 */
export function lookupNutrition(input: MenuItemInput): Nutrients | null {
  try {
    const rows = loadDataset();
    if (rows.length === 0) return null;

    const matches: NutritionRow[] = [];
    const seen = new Set<string>();

    const addMatch = (row: NutritionRow) => {
      const key = row.name;
      if (!seen.has(key)) {
        seen.add(key);
        matches.push(row);
      }
    };

    const dishName = (input.name ?? "").trim();
    if (dishName) {
      const direct = findBestMatch(dishName, rows);
      if (direct) addMatch(direct);
      for (const word of dishName.split(/\s+/).filter((w) => w.length > 3)) {
        const m = findBestMatch(word, rows);
        if (m) addMatch(m);
      }
    }

    const ingredients = input.ingredients ?? [];
    for (const ing of ingredients) {
      const search = INGREDIENT_ALIASES[ing.toLowerCase()] ?? ing;
      const m = findBestMatch(search, rows);
      if (m) addMatch(m);
    }

    if (matches.length === 0) return null;
    return aggregateNutrients(matches);
  } catch {
    return null;
  }
}
