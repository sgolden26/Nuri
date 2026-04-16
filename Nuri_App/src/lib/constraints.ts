/**
 * Hard constraints — filter out menu items that violate user state.
 * Allergies → hard exclusion.
 * Hypertension → remove top sodium decile unless no alternatives.
 * AFib / alcohol-sensitive → remove alcohol-paired items.
 * Anxiety high + evening → suppress high-caffeine items.
 * Cramping → suppress very greasy/heavy items (optionally with historical ratings).
 */

import type { UserState } from "./user-state";
import { itemContainsUserAllergens } from "./menu-scoring";
import type { MenuItemInput } from "./menu-scoring";
import type { MenuItemScore } from "./menu-scoring";

export interface ScoredCandidate {
  item: MenuItemInput;
  score: MenuItemScore;
  restaurant?: { name: string; walkingMinutes?: number };
}

export interface ConstraintResult {
  passed: boolean;
  reason?: string;
}

/**
 * Allergies → hard exclusion.
 * Item fails if it contains any of the user's allergens.
 */
export function checkAllergyConstraint(
  candidate: ScoredCandidate,
  state: UserState,
): ConstraintResult {
  if (state.userAllergens.length === 0) return { passed: true };
  const matches = itemContainsUserAllergens(candidate.item, state.userAllergens);
  if (matches.length > 0) {
    return { passed: false, reason: `Contains allergens: ${matches.join(", ")}` };
  }
  return { passed: true };
}

/**
 * AFib / alcohol-sensitive mode → remove alcohol-paired recommendations.
 */
export function checkAlcoholConstraint(
  candidate: ScoredCandidate,
  state: UserState,
): ConstraintResult {
  if (!state.afibHistoryOn && !state.alcoholTriggerSelfReported) return { passed: true };
  const alcoholScore = candidate.score.alcoholContent.score;
  if (alcoholScore < 100) {
    return { passed: false, reason: "Alcohol detected; not recommended for AFib/alcohol-sensitive" };
  }
  return { passed: true };
}

/**
 * Anxiety high + evening → suppress high-caffeine items.
 */
export function checkCaffeineConstraint(
  candidate: ScoredCandidate,
  state: UserState,
): ConstraintResult {
  const anxietyHigh =
    state.gad7Bucket === "moderate" || state.gad7Bucket === "severe" ||
    state.phq9Bucket === "moderate" || state.phq9Bucket === "moderately_severe" || state.phq9Bucket === "severe";
  if (!anxietyHigh || !state.isEvening) return { passed: true };
  const caffeineScore = candidate.score.caffeineContent.score;
  if (caffeineScore < 70) {
    return { passed: false, reason: "High caffeine; suppressed for anxiety + evening" };
  }
  return { passed: true };
}

/**
 * Pregnancy / nursing → no raw fish, no alcohol, no high-mercury fish.
 */
export function checkPregnancyConstraint(
  candidate: ScoredCandidate,
  state: UserState,
): ConstraintResult {
  if (!state.pregnancyOrNursing) return { passed: true };
  const tags = new Set(candidate.item.conditionTags ?? []);
  if (tags.has("raw_fish")) return { passed: false, reason: "Raw fish; avoid during pregnancy" };
  if (tags.has("high_mercury")) return { passed: false, reason: "High-mercury fish; avoid during pregnancy" };
  if (candidate.score.alcoholContent.score < 100) return { passed: false, reason: "Alcohol; avoid during pregnancy" };
  return { passed: true };
}

/**
 * User blacklist → exclude items containing blacklisted ingredients.
 */
export function checkUserBlacklistConstraint(
  candidate: ScoredCandidate,
  state: UserState,
): ConstraintResult {
  if (state.userBlacklist.length === 0) return { passed: true };
  const text = [candidate.item.name, candidate.item.description, ...(candidate.item.ingredients ?? [])].filter(Boolean).join(" ").toLowerCase();
  const found = state.userBlacklist.filter((b) => text.includes(b.toLowerCase()));
  if (found.length > 0) return { passed: false, reason: `Contains: ${found.join(", ")}` };
  return { passed: true };
}

/**
 * Tyramine-sensitive (MAOIs) → avoid aged cheese, cured meats, fermented.
 */
export function checkTyramineConstraint(
  candidate: ScoredCandidate,
  state: UserState,
): ConstraintResult {
  if (!state.tyramineSensitive) return { passed: true };
  const text = [candidate.item.name, candidate.item.description, ...(candidate.item.ingredients ?? [])].filter(Boolean).join(" ").toLowerCase();
  const tyramineRich = ["aged cheese", "blue cheese", "parmesan", "cured", "salami", "bacon", "fermented", "sauerkraut", "kimchi", "soy sauce", "wine", "beer"];
  if (tyramineRich.some((t) => text.includes(t))) return { passed: false, reason: "High tyramine; not recommended with MAOIs" };
  return { passed: true };
}

/**
 * Vitamin K–sensitive (warfarin) → avoid very high vitamin K (leafy greens) in large amounts.
 * Soft constraint: we flag but don't hard-exclude (consistent intake matters more).
 */
export function checkVitaminKConstraint(
  candidate: ScoredCandidate,
  state: UserState,
): ConstraintResult {
  if (!state.vitaminKSensitive) return { passed: true };
  const text = [candidate.item.name, candidate.item.description, ...(candidate.item.ingredients ?? [])].filter(Boolean).join(" ").toLowerCase();
  const highK = ["kale", "spinach", "collard", "swiss chard", "turnip greens", "mustard greens", "brussels"];
  const count = highK.filter((k) => text.includes(k)).length;
  if (count >= 2) return { passed: false, reason: "Very high vitamin K; discuss with provider if on warfarin" };
  return { passed: true };
}

/**
 * Cramping → suppress very greasy/heavy items.
 * Optionally use historical ratings (not implemented yet).
 */
export function checkCrampingConstraint(
  candidate: ScoredCandidate,
  state: UserState,
  _historicalPoorRatings?: Set<string>, // for future: item ids user rated poorly when cramping
): ConstraintResult {
  if (!state.crampsLogged) return { passed: true };
  const digestibilityScore = candidate.score.digestibilityHeaviness.score;
  const saturatedFatScore = candidate.score.saturatedFat.score;
  if (digestibilityScore < 30 || saturatedFatScore < 40) {
    return { passed: false, reason: "Heavy/greasy; suppressed during cramping" };
  }
  return { passed: true };
}

/**
 * Hypertension mode → remove top sodium decile items unless no alternatives.
 * We apply this as a soft filter: only exclude if there are enough alternatives.
 */
export function checkHypertensionSodiumConstraint(
  candidate: ScoredCandidate,
  state: UserState,
  allCandidates: ScoredCandidate[],
): ConstraintResult {
  if (!state.possibleHypertensionFlag || state.homeBPStage === "normal") return { passed: true };
  const sodiumScore = candidate.score.sodiumBurden.score;
  const sodiumScores = allCandidates.map((c) => c.score.sodiumBurden.score);
  const sorted = [...sodiumScores].sort((a, b) => a - b);
  const decile9Index = Math.floor(sorted.length * 0.9);
  const topDecileThreshold = sorted[decile9Index] ?? 100;
  if (sodiumScore >= topDecileThreshold) {
    const alternativesCount = allCandidates.filter((c) => c.score.sodiumBurden.score < topDecileThreshold).length;
    if (alternativesCount >= 3) {
      return { passed: false, reason: "Top sodium decile; alternatives available" };
    }
  }
  return { passed: true };
}

/**
 * Apply all hard constraints.
 * Returns filtered candidates and per-candidate failure reasons.
 */
export function applyHardConstraints(
  candidates: ScoredCandidate[],
  state: UserState,
): { filtered: ScoredCandidate[]; failures: Map<number, string[]> } {
  const failures = new Map<number, string[]>();

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const reasons: string[] = [];

    const allergy = checkAllergyConstraint(c, state);
    if (!allergy.passed) reasons.push(allergy.reason!);

    const alcohol = checkAlcoholConstraint(c, state);
    if (!alcohol.passed) reasons.push(alcohol.reason!);

    const caffeine = checkCaffeineConstraint(c, state);
    if (!caffeine.passed) reasons.push(caffeine.reason!);

    const cramping = checkCrampingConstraint(c, state);
    if (!cramping.passed) reasons.push(cramping.reason!);

    const pregnancy = checkPregnancyConstraint(c, state);
    if (!pregnancy.passed) reasons.push(pregnancy.reason!);

    const blacklist = checkUserBlacklistConstraint(c, state);
    if (!blacklist.passed) reasons.push(blacklist.reason!);

    const tyramine = checkTyramineConstraint(c, state);
    if (!tyramine.passed) reasons.push(tyramine.reason!);

    const vitaminK = checkVitaminKConstraint(c, state);
    if (!vitaminK.passed) reasons.push(vitaminK.reason!);

    const sodium = checkHypertensionSodiumConstraint(c, state, candidates);
    if (!sodium.passed) reasons.push(sodium.reason!);

    if (reasons.length > 0) failures.set(i, reasons);
  }

  const filtered = candidates.filter((_, i) => !failures.has(i));
  return { filtered, failures };
}
