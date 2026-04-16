import { NextRequest, NextResponse } from "next/server";
import { getHealthProfile } from "@/lib/betterness";
import { getNearbyRestaurants } from "@/lib/places";
import { getRecommendations, generateRecommendationReasons } from "@/lib/claude";
import { runPipeline } from "@/lib/pipeline";
import { getMenuItemsForRestaurants } from "@/lib/menu-provider";
import {
  getRecommendationTags,
  applyFilter,
  FILTER_KEYS,
  type FilterKey,
} from "@/lib/recommendation-filters";
import { softRerank } from "@/lib/reranking";
import type { UserStateInput } from "@/lib/user-state";

export interface RecommendBody {
  lat: number;
  lng: number;
  /** Filter by dimension (e.g. low_sodium) — shows restaurants with matching items */
  filter?: FilterKey;
  userAllergens?: string[];
  userCuisinePreferences?: string[];
  crampsLogged?: boolean;
  afibHistoryOn?: boolean;
  alcoholTriggerSelfReported?: boolean;
  caffeineTriggerSelfReported?: boolean;
  gad7Bucket?: UserStateInput["gad7Bucket"];
  phq9Bucket?: UserStateInput["phq9Bucket"];
  pregnancyOrNursing?: boolean;
  dietaryGoal?: UserStateInput["dietaryGoal"];
  tyramineSensitive?: boolean;
  vitaminKSensitive?: boolean;
  userBlacklist?: string[];
}

function formatReason(rec: { componentScores: Record<string, number>; score: { composite: number } }): string {
  const { componentScores } = rec;
  if (componentScores.clinicalFit > 75) return "Strong clinical match for your profile";
  if (componentScores.recovery > 70) return "Supports your recovery needs";
  if (componentScores.symptomRelief > 70) return "Gentle on digestion";
  return "Good longevity score overall";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RecommendBody;
    const { lat, lng, filter, userAllergens, userCuisinePreferences, ...stateOverrides } = body;

    if (typeof lat !== "number" || typeof lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required numbers" },
        { status: 400 },
      );
    }

    const [healthProfile, restaurants] = await Promise.all([
      getHealthProfile(),
      getNearbyRestaurants(lat, lng),
    ]);

    const menuItems = getMenuItemsForRestaurants(restaurants);
    const pipelineInput = {
      healthProfile,
      menuItems,
      userAllergens: userAllergens ?? [],
      userStateOverrides:
        Object.keys(stateOverrides).length > 0
          ? (stateOverrides as Omit<UserStateInput, "profile">)
          : undefined,
      userCuisinePreferences,
    };

    const { recommendations: pipelineRecs, filtered, userState } = runPipeline(pipelineInput);

    const recommendationTags = getRecommendationTags(userState);
    const validFilter = filter && FILTER_KEYS.includes(filter) ? filter : undefined;
    const toShow =
      validFilter
        ? softRerank(applyFilter(filtered, validFilter), userState, {
            userCuisinePreferences: pipelineInput.userCuisinePreferences,
          })
        : pipelineRecs;

    const rawRecs = toShow.slice(0, 7).map((r, i) => ({
      rank: i + 1,
      dish: r.item.name ?? "Unknown",
      restaurant: r.restaurant?.name ?? "Unknown",
      cuisine: r.restaurant?.name?.split(" ")[0] ?? "Restaurant",
      walkingMinutes: r.restaurant?.walkingMinutes ?? 10,
      reason: formatReason(r),
      healthScore: r.rerankScore,
      _raw: r,
    }));

    let recommendations: { rank: number; dish: string; restaurant: string; cuisine: string; walkingMinutes: number; reason: string; healthScore: number }[];
    try {
      const aiReasons = await generateRecommendationReasons(healthProfile, rawRecs.map((r) => ({
        dish: r.dish,
        restaurant: r.restaurant,
        cuisine: r.cuisine,
        walkingMinutes: r.walkingMinutes,
      })));
      recommendations = rawRecs.map((r, i) => ({
        rank: r.rank,
        dish: r.dish,
        restaurant: r.restaurant,
        cuisine: r.cuisine,
        walkingMinutes: r.walkingMinutes,
        reason: aiReasons[i] ?? r.reason,
        healthScore: r.healthScore,
      }));
    } catch (e) {
      console.warn("AI reason generation failed, using formatReason:", e);
      recommendations = rawRecs.map(({ _raw, ...r }) => r);
    }

    const scoreByRestaurant = new Map<string, number>();
    for (const r of recommendations) {
      const existing = scoreByRestaurant.get(r.restaurant);
      if (existing === undefined || r.healthScore > existing) {
        scoreByRestaurant.set(r.restaurant, r.healthScore);
      }
    }

    const buildPins = (scores: Map<string, number>) =>
      restaurants.map((r) => ({
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        healthScore: scores.get(r.name),
        photoReference: r.photoReference,
        walkingMinutes: r.walkingMinutes,
        rating: r.rating,
        placeId: r.placeId,
      }));

    if (recommendations.length === 0) {
      const claudeRecs = await getRecommendations(healthProfile, restaurants);
      const claudeScores = new Map<string, number>();
      for (const rec of claudeRecs.recommendations ?? []) {
        const existing = claudeScores.get(rec.restaurant);
        if (existing === undefined || rec.healthScore > existing) {
          claudeScores.set(rec.restaurant, rec.healthScore);
        }
      }
      return NextResponse.json({
        recommendations: claudeRecs.recommendations ?? [],
        priorities: claudeRecs.priorities ?? [],
        recommendationTags,
        healthProfile,
        restaurants,
        restaurantPins: buildPins(claudeScores),
        source: "claude",
      });
    }

    return NextResponse.json({
      recommendations,
      priorities: [],
      recommendationTags,
      healthProfile,
      restaurants,
      restaurantPins: buildPins(scoreByRestaurant),
      userState,
      source: "pipeline",
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
