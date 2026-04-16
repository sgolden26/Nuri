/** Stable id for map pins / selection — Google Place names can repeat (e.g. 7-Eleven). */
export function restaurantPinKey(p: {
  placeId?: string;
  lat: number;
  lng: number;
}): string {
  if (p.placeId) return p.placeId;
  return `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
}
