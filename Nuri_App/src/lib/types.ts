export interface HealthProfile {
  vitals: Record<string, unknown> | null;
  sleep: Record<string, unknown> | null;
  activity: Record<string, unknown> | null;
  bodyComposition: Record<string, unknown> | null;
  biomarkers: Record<string, unknown> | null;
  biologicalAge: Record<string, unknown> | null;
  allergies: string[] | null;
}

export interface Restaurant {
  name: string;
  address: string;
  rating: number;
  priceLevel: number;
  walkingMinutes: number;
  types: string[];
  placeId: string;
  lat: number;
  lng: number;
  photoReference?: string;
}

export interface FoodRecommendation {
  rank: number;
  dish: string;
  restaurant: string;
  cuisine: string;
  walkingMinutes: number;
  reason: string;
  healthScore: number;
}

export interface MealPriority {
  label: string;
  detail: string;
  icon: string;
}
