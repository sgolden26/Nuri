import { Restaurant } from "./types";

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const WALKING_SPEED_M_PER_MIN = 80;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getNearbyRestaurants(
  lat: number,
  lng: number,
): Promise<Restaurant[]> {
  if (!PLACES_KEY) {
    console.warn("GOOGLE_PLACES_API_KEY not set — using mock restaurant data");
    return mockRestaurantsNear(lat, lng);
  }

  const url = new URL(
    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
  );
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "1600"); // ~20 min walk
  url.searchParams.set("type", "restaurant");
  url.searchParams.set("key", PLACES_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK") {
    throw new Error(`Places API error: ${data.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.results.slice(0, 15).map((place: any) => {
    const distKm = haversineKm(
      lat,
      lng,
      place.geometry.location.lat,
      place.geometry.location.lng,
    );
    return {
      name: place.name,
      address: place.vicinity,
      rating: place.rating ?? 0,
      priceLevel: place.price_level ?? 0,
      walkingMinutes: Math.round((distKm * 1000) / WALKING_SPEED_M_PER_MIN),
      types: place.types ?? [],
      placeId: place.place_id,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      photoReference: place.photos?.[0]?.photo_reference,
    };
  });
}

function mockRestaurantsNear(lat: number, lng: number): Restaurant[] {
  const offsets = [
    { name: "Green Bowl", dlat: 0.003, dlng: -0.002, rating: 4.5, priceLevel: 2, walk: 8, types: ["restaurant", "health_food"] },
    { name: "Sushi Zen", dlat: -0.004, dlng: 0.005, rating: 4.3, priceLevel: 3, walk: 12, types: ["restaurant", "japanese"] },
    { name: "Mediterranean Kitchen", dlat: 0.006, dlng: 0.003, rating: 4.6, priceLevel: 2, walk: 15, types: ["restaurant", "mediterranean"] },
    { name: "Thai Orchid", dlat: -0.002, dlng: -0.004, rating: 4.2, priceLevel: 2, walk: 10, types: ["restaurant", "thai"] },
    { name: "Farm Table", dlat: 0.007, dlng: -0.005, rating: 4.7, priceLevel: 3, walk: 18, types: ["restaurant", "american"] },
    { name: "Poke Paradise", dlat: -0.001, dlng: 0.003, rating: 4.4, priceLevel: 2, walk: 7, types: ["restaurant", "hawaiian"] },
    { name: "Tandoori Flame", dlat: 0.005, dlng: 0.006, rating: 4.1, priceLevel: 2, walk: 14, types: ["restaurant", "indian"] },
    { name: "Le Jardin", dlat: -0.006, dlng: -0.003, rating: 4.5, priceLevel: 3, walk: 16, types: ["restaurant", "french"] },
  ];
  return offsets.map((o, i) => ({
    name: o.name,
    address: `${100 + i * 111} Market St`,
    rating: o.rating,
    priceLevel: o.priceLevel,
    walkingMinutes: o.walk,
    types: o.types,
    placeId: `mock${i + 1}`,
    lat: lat + o.dlat,
    lng: lng + o.dlng,
  }));
}
