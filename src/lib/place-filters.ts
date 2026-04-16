export type RestaurantPinLike = {
  rating?: number;
  priceLevel?: number;
};

/** Google Places: 0 = any/unknown, 1–4 = $ through $$$$ */
export type PriceTierFilter = 0 | 1 | 2 | 3 | 4;

export function pinMatchesPlaceFilters(
  pin: RestaurantPinLike,
  minRating: number,
  priceTier: PriceTierFilter,
): boolean {
  const r = pin.rating ?? 0;
  if (minRating > 0 && r + 1e-6 < minRating) return false;
  if (priceTier === 0) return true;
  const pl = pin.priceLevel ?? 0;
  if (pl === 0) return true;
  return pl === priceTier;
}

/** `0` min rating and `0` price tier = no filtering (include all). */
export function parsePlaceFilterBody(raw: {
  minRating?: unknown;
  priceTier?: unknown;
}): { minRating: number; priceTier: PriceTierFilter } {
  let minRating = 0;
  if (raw.minRating !== undefined && raw.minRating !== null) {
    const n = Number(raw.minRating);
    if (Number.isFinite(n) && n > 0) {
      minRating = Math.min(5, Math.max(0.5, Math.round(n * 2) / 2));
    }
  }

  let priceTier: PriceTierFilter = 0;
  if (raw.priceTier !== undefined && raw.priceTier !== null) {
    const t = Number(raw.priceTier);
    if (t === 1 || t === 2 || t === 3 || t === 4) priceTier = t;
  }

  return { minRating, priceTier };
}
