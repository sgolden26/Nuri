/**
 * Soft reranking — weighted combination of:
 * - clinical fit score
 * - recovery score
 * - symptom-relief score
 * - cuisine preference score
 * - convenience / proximity score
 * - user historical satisfaction score
 */

import type { UserState } from "./user-state";
import type { ScoredCandidate } from "./constraints";
import type { MenuItemScore } from "./menu-scoring";

export interface RerankWeights {
  clinicalFit: number;
  recovery: number;
  symptomRelief: number;
  cuisinePreference: number;
  convenienceProximity: number;
  userHistoricalSatisfaction: number;
}

const DEFAULT_WEIGHTS: RerankWeights = {
  clinicalFit: 0.30,
  recovery: 0.20,
  symptomRelief: 0.15,
  cuisinePreference: 0.15,
  convenienceProximity: 0.10,
  userHistoricalSatisfaction: 0.10,
};

export interface RerankedCandidate extends ScoredCandidate {
  rerankScore: number;
  componentScores: {
    clinicalFit: number;
    recovery: number;
    symptomRelief: number;
    cuisinePreference: number;
    convenienceProximity: number;
    userHistoricalSatisfaction: number;
  };
}

/**
 * Clinical fit — how well the item matches user's clinical needs (BP, biomarkers, conditions).
 * Uses conditionTags from dish inference for mental health & chronic disease ranking.
 */
function clinicalFitScore(candidate: ScoredCandidate, score: MenuItemScore, state: UserState): number {
  let fit = score.composite;
  const tags = new Set(candidate.item.conditionTags ?? []);

  if (state.possibleHypertensionFlag) {
    fit = (fit + score.sodiumBurden.score) / 2;
    if (tags.has("hypertension_friendly")) fit = Math.min(100, fit + 10);
    if (tags.has("hypertension_adverse")) fit = Math.max(0, fit - 15);
  }

  const anxietyRelevant = state.gad7Bucket === "moderate" || state.gad7Bucket === "severe";
  const depressionRelevant = ["moderate", "moderately_severe", "severe"].includes(state.phq9Bucket ?? "");
  if (anxietyRelevant || depressionRelevant) {
    if (tags.has("anxiety_supportive") || tags.has("depression_supportive")) fit = Math.min(100, fit + 12);
    if (tags.has("anxiety_adverse") || tags.has("depression_adverse")) fit = Math.max(0, fit - 15);
    if (state.isEvening && tags.has("anxiety_adverse")) fit = Math.max(0, fit - 10);
  }

  if (state.afibHistoryOn || state.alcoholTriggerSelfReported) {
    fit = (fit + score.alcoholContent.score) / 2;
  }

  if (tags.has("heart_healthy")) fit = Math.min(100, fit + 5);
  if (tags.has("heart_adverse")) fit = Math.max(0, fit - 10);
  if (tags.has("diabetes_friendly")) fit = Math.min(100, fit + 5);
  if (tags.has("diabetes_adverse")) fit = Math.max(0, fit - 10);
  if (tags.has("sleep_supportive")) fit = Math.min(100, fit + 5);
  if (tags.has("inflammatory")) fit = Math.max(0, fit - 8);

  if (state.dietaryGoal === "weight_loss") {
    fit = (fit + score.portionSize.score + score.ultraProcessedProxy.score) / 3;
  }
  if (state.dietaryGoal === "muscle_gain") {
    fit = (fit + score.proteinAmount.score) / 2;
  }
  if (state.dietaryGoal === "weight_loss" || state.possibleHypertensionFlag) {
    fit = (fit + score.glycemicProxy.score) / 2;
  }

  return fit;
}

/**
 * Recovery — supports post-workout / training recovery (protein, carbs, electrolytes).
 */
function recoveryScore(score: MenuItemScore, state: UserState): number {
  if (state.recentTrainingLoad < 30) return 75;
  const protein = score.proteinAmount.score;
  const carbs = score.carbAmountQuality.score;
  const potassium = score.potassiumDensity.score;
  return protein * 0.45 + carbs * 0.35 + potassium * 0.2;
}

/**
 * Symptom relief — supports current symptoms (cramping → easy digestibility; anxiety → low caffeine).
 */
function symptomReliefScore(score: MenuItemScore, state: UserState): number {
  let s = 75;
  if (state.crampsLogged) {
    s = (s + score.digestibilityHeaviness.score + score.saturatedFat.score) / 2;
  }
  if (state.gad7Bucket === "moderate" || state.gad7Bucket === "severe" || state.phq9Bucket === "moderate" || state.phq9Bucket === "moderately_severe" || state.phq9Bucket === "severe") {
    if (state.isEvening) {
      s = (s + score.caffeineContent.score) / 2;
    }
  }
  return s;
}

/**
 * Cuisine preference — placeholder; would use user's stated preferences.
 */
function cuisinePreferenceScore(
  _candidate: ScoredCandidate,
  _state: UserState,
  userCuisinePreferences?: string[],
): number {
  if (!userCuisinePreferences?.length) return 80;
  const types = _candidate.restaurant?.name?.toLowerCase() ?? "";
  const match = userCuisinePreferences.some((c) => types.includes(c.toLowerCase()));
  return match ? 90 : 50;
}

/**
 * Convenience / proximity — walking minutes, distance.
 */
function convenienceProximityScore(candidate: ScoredCandidate): number {
  const mins = candidate.restaurant?.walkingMinutes;
  if (mins == null) return 70;
  if (mins <= 5) return 100;
  if (mins <= 10) return 90;
  if (mins <= 15) return 75;
  if (mins <= 20) return 60;
  return Math.max(30, 60 - mins);
}

/**
 * User historical satisfaction — placeholder; would use past ratings.
 */
function userHistoricalSatisfactionScore(
  _candidate: ScoredCandidate,
  historicalRatings?: Map<string, number>,
): number {
  if (!historicalRatings?.size) return 80;
  const key = `${_candidate.restaurant?.name ?? ""}-${_candidate.item.name ?? ""}`;
  const rating = historicalRatings.get(key);
  return rating != null ? rating : 70;
}

/**
 * Soft rerank candidates by weighted score.
 */
export function softRerank(
  candidates: ScoredCandidate[],
  state: UserState,
  options?: {
    weights?: Partial<RerankWeights>;
    userCuisinePreferences?: string[];
    historicalRatings?: Map<string, number>;
  },
): RerankedCandidate[] {
  const weights = { ...DEFAULT_WEIGHTS, ...options?.weights };
  const prefs = options?.userCuisinePreferences;
  const ratings = options?.historicalRatings;

  const reranked: RerankedCandidate[] = candidates.map((c) => {
    const clinicalFit = clinicalFitScore(c, c.score, state);
    const recovery = recoveryScore(c.score, state);
    const symptomRelief = symptomReliefScore(c.score, state);
    const cuisinePreference = cuisinePreferenceScore(c, state, prefs);
    const convenienceProximity = convenienceProximityScore(c);
    const userHistoricalSatisfaction = userHistoricalSatisfactionScore(c, ratings);

    const rawScore =
      clinicalFit * weights.clinicalFit +
      recovery * weights.recovery +
      symptomRelief * weights.symptomRelief +
      cuisinePreference * weights.cuisinePreference +
      convenienceProximity * weights.convenienceProximity +
      userHistoricalSatisfaction * weights.userHistoricalSatisfaction;

    const rerankScore = Math.min(99, Math.round(rawScore * 1.15));

    return {
      ...c,
      rerankScore,
      componentScores: {
        clinicalFit,
        recovery,
        symptomRelief,
        cuisinePreference,
        convenienceProximity,
        userHistoricalSatisfaction,
      },
    };
  });

  reranked.sort((a, b) => b.rerankScore - a.rerankScore);
  return reranked;
}
