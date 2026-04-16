import Anthropic from "@anthropic-ai/sdk";
import {
  HealthProfile,
  Restaurant,
  FoodRecommendation,
  MealPriority,
} from "./types";

const anthropic = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
});

export interface RecommendationResult {
  recommendations: FoodRecommendation[];
  priorities: MealPriority[];
}

export async function getRecommendations(
  healthProfile: HealthProfile,
  restaurants: Restaurant[],
): Promise<RecommendationResult> {
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a longevity-focused nutritionist. Given a person's real health data from wearables and lab work, plus a list of nearby restaurants, do two things:

1. Identify their TOP 3 meal priorities right now based on their health data
2. Recommend the TOP 5 specific dishes they should eat

## Health Profile
${JSON.stringify(healthProfile, null, 2)}

## Nearby Restaurants
${JSON.stringify(restaurants, null, 2)}

Consider:
- Their specific biomarkers and deficiencies (e.g. low vitamin D → vitamin D-rich foods)
- Anti-inflammatory, longevity-promoting ingredients
- Sleep quality (if poor, suggest foods that support better sleep)
- Activity level and body composition (appropriate caloric/protein density)
- Biomarker red flags (high glucose → low glycemic; high LDL → low saturated fat)
- Their biological age vs chronological age

For each restaurant, reason about what healthy dishes they likely serve based on name and cuisine type. Explicitly reference the user's biological age and at least one biomarker in your reasoning when relevant.

Return ONLY valid JSON with no markdown fences and no other text, in this exact shape:
{
  "priorities": [
    {
      "label": "Short label e.g. 'Vitamin D Boost'",
      "detail": "One sentence why, tied to their data",
      "icon": "single emoji"
    }
  ],
  "recommendations": [
    {
      "rank": 1,
      "dish": "Specific dish name",
      "restaurant": "Restaurant Name (must match a restaurant from the list)",
      "cuisine": "Cuisine type",
      "walkingMinutes": 12,
      "reason": "One short sentence referencing a specific biomarker or health flag",
      "healthScore": 92
    }
  ]
}

3 priorities, 7 recommendations. Health scores 0-100 relative to THIS person's specific needs. Keep each reason under 15 words.`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse response from Claude");
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    recommendations: parsed.recommendations,
    priorities: parsed.priorities,
  };
}

export interface RecommendationForReasoning {
  dish: string;
  restaurant: string;
  cuisine: string;
  walkingMinutes?: number;
}

/**
 * Generate AI explanations for why each dish/restaurant is recommended
 * based on the user's health profile.
 */
export async function generateRecommendationReasons(
  healthProfile: HealthProfile,
  recommendations: RecommendationForReasoning[],
): Promise<string[]> {
  if (recommendations.length === 0) return [];

  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `For each dish below, write ONE short sentence (max 15 words) explaining why it fits this person's health needs. Reference a specific biomarker, deficiency, or health flag — not generic nutrition advice.

## Health Profile
${JSON.stringify(healthProfile, null, 2)}

## Dishes
${JSON.stringify(recommendations, null, 2)}

Return ONLY valid JSON: an array of strings, one per dish in order. Example:
["Omega-3s to support your borderline LDL.", "High protein for your active recovery needs."]`,
      },
    ],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Failed to parse reasons from Claude");
  const parsed = JSON.parse(jsonMatch[0]) as string[];
  return Array.isArray(parsed) ? parsed : [];
}
