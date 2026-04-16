/**
 * Full recommendation pipeline:
 * 1. Likely allergens (menu-scoring)
 * 2. Build user state (user-state)
 * 3. Apply hard constraints (constraints)
 * 4. Soft reranking (reranking)
 */

import { scoreMenuItem, type MenuItemInput, type MenuItemScore } from "./menu-scoring";
import { enrichMenuItemFromName } from "./dish-inference";
import { buildUserState, type UserState, type UserStateInput } from "./user-state";
import { applyHardConstraints, type ScoredCandidate } from "./constraints";
import { softRerank, type RerankedCandidate } from "./reranking";
import type { HealthProfile } from "./types";

export interface PipelineInput {
  healthProfile: HealthProfile;
  menuItems: Array<{
    item: MenuItemInput;
    restaurant?: { name: string; walkingMinutes?: number };
  }>;
  userAllergens?: string[];
  /** Optional overrides for user state */
  userStateOverrides?: Omit<UserStateInput, "profile">;
  /** Optional for soft reranking */
  userCuisinePreferences?: string[];
  historicalRatings?: Map<string, number>;
}

export interface PipelineOutput {
  userState: UserState;
  /** All candidates that passed hard constraints (for filter views) */
  filtered: ScoredCandidate[];
  /** After soft rerank */
  recommendations: RerankedCandidate[];
  /** Per-item menu scores (before constraints) */
  rawScores: Map<string, MenuItemScore>;
}

/**
 * Run the full pipeline.
 */
export function runPipeline(input: PipelineInput): PipelineOutput {
  const state = buildUserState({
    profile: input.healthProfile,
    userAllergens: input.userAllergens,
    ...input.userStateOverrides,
  });

  const scored: ScoredCandidate[] = input.menuItems.map(({ item, restaurant }) => {
    const enriched = enrichMenuItemFromName(item);
    return {
      item: enriched,
      score: scoreMenuItem(enriched),
      restaurant,
    };
  });

  const rawScores = new Map<string, MenuItemScore>();
  scored.forEach((c) => {
    const key = `${c.restaurant?.name ?? ""}-${c.item.name ?? ""}`;
    rawScores.set(key, c.score);
  });

  const { filtered } = applyHardConstraints(scored, state);
  const reranked = softRerank(filtered, state, {
    userCuisinePreferences: input.userCuisinePreferences,
    historicalRatings: input.historicalRatings,
  });

  return {
    userState: state,
    filtered,
    recommendations: reranked,
    rawScores,
  };
}
