import { Restaurant } from "./types";

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;
const WALKING_SPEED_M_PER_MIN = 80;

/** Meters; Google Nearby Search max radius is 50_000 */
const NEARBY_RADIUS_METERS = Number(
  process.env.GOOGLE_PLACES_NEARBY_RADIUS_METERS ?? "1600",
);

/**
 * [Place type](https://developers.google.com/maps/documentation/places/web-service/place-types)
 * passed to Nearby Search as the `type` parameter (Table A). We use `restaurant` only.
 */
const NEARBY_PLACE_TYPE = "restaurant" as const;

/**
 * `1` = search only from the user's location.
 * `5` = also search from 4 points ~45% of the radius N/E/S/W (more coverage, more API calls).
 */
function parseGridSize(): 1 | 5 {
  const raw = process.env.GOOGLE_PLACES_NEARBY_GRID?.trim();
  if (raw === "5") return 5;
  return 1;
}

/**
 * Google returns up to 20 results per request and exposes up to 3 pages via
 * `next_page_token` (60 results max per center for this type). Requests using a
 * page token must wait ~2s after the previous response or the token is invalid.
 */
const PLACES_PAGE_DELAY_MS = 2000;
const MAX_NEARBY_PAGES = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

type RawPlace = {
  place_id: string;
  name: string;
  vicinity?: string;
  rating?: number;
  price_level?: number;
  types?: string[];
  geometry: { location: { lat: number; lng: number } };
  photos?: Array<{ photo_reference?: string }>;
};

/** Sample centers: one search misses venues ranked lower than the top ~60 for that query; extra points help. */
function samplingCenters(
  lat: number,
  lng: number,
  radiusM: number,
  grid: 1 | 5,
): [number, number][] {
  if (grid === 1) return [[lat, lng]];
  const d = radiusM * 0.45;
  const metersToLat = d / 111320;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const metersToLng = cosLat > 0.01 ? d / (111320 * cosLat) : metersToLat;
  return [
    [lat, lng],
    [lat + metersToLat, lng],
    [lat - metersToLat, lng],
    [lat, lng + metersToLng],
    [lat, lng - metersToLng],
  ];
}

async function fetchNearbyPlacesPaginated(
  lat: number,
  lng: number,
  radius: number,
): Promise<RawPlace[]> {
  const rawPlaces: RawPlace[] = [];
  let nextPageToken: string | undefined;

  for (let page = 0; page < MAX_NEARBY_PAGES; page++) {
    if (page > 0) {
      await delay(PLACES_PAGE_DELAY_MS);
    }

    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
    );
    url.searchParams.set("location", `${lat},${lng}`);
    url.searchParams.set("radius", String(radius));
    url.searchParams.set("type", NEARBY_PLACE_TYPE);
    url.searchParams.set("key", PLACES_KEY!);
    if (nextPageToken) {
      url.searchParams.set("pagetoken", nextPageToken);
    }

    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      status: string;
      results?: RawPlace[];
      next_page_token?: string;
      error_message?: string;
    };

    if (data.status === "ZERO_RESULTS") {
      break;
    }

    if (data.status !== "OK") {
      throw new Error(
        `Places API error (${NEARBY_PLACE_TYPE}): ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`,
      );
    }

    const batch = data.results ?? [];
    rawPlaces.push(...batch);

    nextPageToken = data.next_page_token;
    if (!nextPageToken) {
      break;
    }
  }

  return rawPlaces;
}

export async function getNearbyRestaurants(
  lat: number,
  lng: number,
): Promise<Restaurant[]> {
  if (!PLACES_KEY) {
    console.warn("GOOGLE_PLACES_API_KEY not set — using mock restaurant data");
    return mockRestaurantsNear(lat, lng);
  }

  const radius = Number.isFinite(NEARBY_RADIUS_METERS)
    ? Math.min(50_000, Math.max(1, Math.round(NEARBY_RADIUS_METERS)))
    : 1600;

  const grid = parseGridSize();
  const centers = samplingCenters(lat, lng, radius, grid);

  const batches = await Promise.all(
    centers.map(([clat, clng]) =>
      fetchNearbyPlacesPaginated(clat, clng, radius),
    ),
  );

  const merged = batches.flat();
  const seen = new Set<string>();
  const unique = merged.filter((p) => {
    if (!p.place_id || seen.has(p.place_id)) return false;
    seen.add(p.place_id);
    return true;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return unique.map((place: any) => {
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
