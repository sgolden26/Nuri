/**
 * Recommendation filters — derive filter buttons from user state and apply
 * dimension-based filtering. When user taps "Low Sodium", show restaurants
 * with low-sodium items and recommend those specific dishes.
 */

import type { UserState } from "./user-state";
import type { ScoredCandidate } from "./constraints";

export type FilterKey =
  | "low_sodium"
  | "high_protein"
  | "heart_healthy"
  | "anxiety_friendly"
  | "weight_loss_friendly"
  | "low_caffeine"
  | "digestible";

/** All valid filter keys for validation */
export const FILTER_KEYS: FilterKey[] = [
  "low_sodium",
  "high_protein",
  "heart_healthy",
  "anxiety_friendly",
  "weight_loss_friendly",
  "low_caffeine",
  "digestible",
];

/** Human-readable labels for filter buttons */
export const FILTER_LABELS: Record<FilterKey, string> = {
  low_sodium: "Low Sodium",
  high_protein: "High Protein",
  heart_healthy: "Heart Healthy",
  anxiety_friendly: "Anxiety Friendly",
  weight_loss_friendly: "Weight Conscious",
  low_caffeine: "Low Caffeine",
  digestible: "Easy to Digest",
};

/** Minimum score (0–100) for an item to match a filter */
const FILTER_THRESHOLDS: Record<FilterKey, number> = {
  low_sodium: 70,
  high_protein: 70,
  heart_healthy: 0, // tag-based
  anxiety_friendly: 0, // tag-based
  weight_loss_friendly: 65,
  low_caffeine: 80,
  digestible: 70,
};

function filterMatches(candidate: ScoredCandidate, filterKey: FilterKey): boolean {
  const score = candidate.score;
  const tags = new Set(candidate.item.conditionTags ?? []);

  switch (filterKey) {
    case "low_sodium":
      return score.sodiumBurden.score >= FILTER_THRESHOLDS.low_sodium;
    case "high_protein":
      return score.proteinAmount.score >= FILTER_THRESHOLDS.high_protein;
    case "heart_healthy":
      return tags.has("heart_healthy") || tags.has("hypertension_friendly");
    case "anxiety_friendly":
      return tags.has("anxiety_supportive");
    case "weight_loss_friendly":
      return (
        score.portionSize.score >= FILTER_THRESHOLDS.weight_loss_friendly &&
        score.ultraProcessedProxy.score >= FILTER_THRESHOLDS.weight_loss_friendly
      );
    case "low_caffeine":
      return score.caffeineContent.score >= FILTER_THRESHOLDS.low_caffeine;
    case "digestible":
      return score.digestibilityHeaviness.score >= FILTER_THRESHOLDS.digestible;
    default:
      return true;
  }
}

/**
 * Derive which filter buttons to show based on user state.
 */
export function getRecommendationTags(state: UserState): FilterKey[] {
  const tags: FilterKey[] = [];

  if (state.possibleHypertensionFlag) tags.push("low_sodium");
  if (state.dietaryGoal === "muscle_gain") tags.push("high_protein");
  if (state.dietaryGoal === "weight_loss") tags.push("weight_loss_friendly");
  if (state.gad7Bucket === "moderate" || state.gad7Bucket === "severe") {
    tags.push("anxiety_friendly");
    if (state.isEvening) tags.push("low_caffeine");
  }
  if (
    state.phq9Bucket === "moderate" ||
    state.phq9Bucket === "moderately_severe" ||
    state.phq9Bucket === "severe"
  ) {
    tags.push("anxiety_friendly");
  }
  if (state.afibHistoryOn || state.possibleHypertensionFlag) tags.push("heart_healthy");
  if (state.crampsLogged) tags.push("digestible");

  return [...new Set(tags)];
}

/**
 * Apply a filter: keep only items matching the dimension, group by restaurant,
 * take the best item per restaurant (by composite score), return sorted list.
 */
export function applyFilter(
  candidates: ScoredCandidate[],
  filterKey: FilterKey,
): ScoredCandidate[] {
  const matching = candidates.filter((c) => filterMatches(c, filterKey));

  const byRestaurant = new Map<string, ScoredCandidate>();
  for (const c of matching) {
    const name = c.restaurant?.name ?? "Unknown";
    const existing = byRestaurant.get(name);
    if (!existing || c.score.composite > existing.score.composite) {
      byRestaurant.set(name, c);
    }
  }

  const result = [...byRestaurant.values()];
  result.sort((a, b) => b.score.composite - a.score.composite);
  return result;
}
