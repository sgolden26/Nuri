"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { HealthProfile, FoodRecommendation, MealPriority } from "@/lib/types";
import { FILTER_LABELS, type FilterKey } from "@/lib/recommendation-filters";
import Logo from "@/components/logo";
import { restaurantPinKey } from "@/lib/restaurant-pin";
import PlaceFilters from "@/components/PlaceFilters";
import {
  pinMatchesPlaceFilters,
  type PriceTierFilter,
} from "@/lib/place-filters";
import type { RestaurantPin } from "@/components/ResultsMap";

const ResultsMap = dynamic(() => import("@/components/ResultsMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full rounded-2xl bg-surface border border-frame-soft animate-pulse" />
  ),
});

interface Location {
  lat: number;
  lng: number;
}

function statusColor(s: string) {
  if (s === "low" || s === "high") return "text-amber-400";
  if (s === "borderline") return "text-yellow-400";
  return "text-emerald-400";
}

type LocationMode = "home" | "office" | "destination" | "current";

interface SavedLocation {
  label: string;
  address: string;
  coords: Location;
}

const DEFAULT_SAVED: Record<"home" | "office" | "destination", SavedLocation | null> = {
  home: null,
  office: { label: "Office", address: "101 Mission St, San Francisco", coords: { lat: 37.7921, lng: -122.3951 } },
  destination: null,
};

export default function Home() {
  const [locationMode, setLocationMode] = useState<LocationMode>("office");
  const [savedLocations, setSavedLocations] = useState(DEFAULT_SAVED);
  const [geoLocation, setGeoLocation] = useState<Location | null>(null);
  const [health, setHealth] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FoodRecommendation[] | null>(null);
  const [priorities, setPriorities] = useState<MealPriority[] | null>(null);
  const [restaurantPins, setRestaurantPins] = useState<RestaurantPin[]>([]);
  const [recommendationTags, setRecommendationTags] = useState<FilterKey[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<number | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [minRatingFilter, setMinRatingFilter] = useState(0);
  const [priceTierFilter, setPriceTierFilter] = useState<PriceTierFilter>(0);
  const selectedCardRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const location: Location | null =
    locationMode === "current"
      ? geoLocation
      : savedLocations[locationMode]?.coords ?? null;

  useEffect(() => {
    if (locationMode === "current" && !geoLocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setGeoLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () =>
          setError("Location access is required for current location."),
      );
    }
  }, [locationMode, geoLocation]);

  useEffect(() => {
    fetch("/api/health-profile")
      .then((r) => r.json())
      .then((d) => {
        console.log("Health profile received:", d);
        setHealth(d);
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (selectedPlaceId && selectedCardRef.current) {
      selectedCardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedPlaceId]);

  const filteredPins = useMemo(() => {
    if (restaurantPins.length === 0) return [];
    return restaurantPins.filter((p) =>
      pinMatchesPlaceFilters(p, minRatingFilter, priceTierFilter),
    );
  }, [restaurantPins, minRatingFilter, priceTierFilter]);

  const filteredResults = useMemo(() => {
    if (!results) return null;
    const names = new Set(filteredPins.map((p) => p.name));
    return results.filter((r) => names.has(r.restaurant));
  }, [results, filteredPins]);

  useEffect(() => {
    if (!selectedPlaceId) return;
    const stillVisible = filteredPins.some((p) => restaurantPinKey(p) === selectedPlaceId);
    if (!stillVisible) setSelectedPlaceId(null);
  }, [selectedPlaceId, filteredPins]);

  useEffect(() => {
    restaurantPins.forEach((pin) => {
      if (pin.photoReference) {
        const img = new Image();
        img.src = `/api/place-photo?ref=${pin.photoReference}`;
      }
    });
  }, [restaurantPins]);

  const [userAllergies, setUserAllergies] = useState<string[]>([]);

  const findFood = useCallback(
    async (filter?: FilterKey) => {
      if (!location) return;
      setLoading(true);
      setError(null);
      setSelectedPlaceId(null);
      try {
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...location,
            userAllergens: userAllergies.length ? userAllergies : undefined,
            filter: filter ?? undefined,
            minRating: minRatingFilter > 0 ? minRatingFilter : undefined,
            priceTier: priceTierFilter > 0 ? priceTierFilter : undefined,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to get recommendations");
        }
        const data = await res.json();
        setResults(data.recommendations);
        setPriorities(data.priorities);
        setRestaurantPins(data.restaurantPins ?? []);
        setRecommendationTags(data.recommendationTags ?? []);
        setActiveFilter(filter ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [location, userAllergies, minRatingFilter, priceTierFilter],
  );

  const bioAge = health ? _deepFind(health.biologicalAge, "biologicalAge") : null;
  const chronAge = health ? _deepFind(health.biologicalAge, "chronologicalAge") : null;
  const dietaryInsights = health ? deriveDietaryInsights(health) : [];

  return (
    <main className="min-h-screen text-foreground">
      <div className="max-w-[1400px] mx-auto px-4 py-4 flex flex-col gap-3 h-screen max-h-screen">
        {/* ── Top bar ── */}
        <header className="flex items-center justify-between shrink-0 relative z-[2000]">
          <div className="flex items-center gap-2">
            <Logo />
            <h1 className="text-2xl font-bold tracking-tight">Nuri</h1>
          </div>
          <LocationBar
            locationMode={locationMode}
            setLocationMode={setLocationMode}
            savedLocations={savedLocations}
            setSavedLocations={setSavedLocations}
          />
        </header>

        {error && (
          <div className="bg-red-950/50 border border-red-900 text-red-200 px-4 py-3 rounded-xl text-sm shrink-0">
            {error}
          </div>
        )}

        {/* ── Main layout: left health tiles | right map+results ── */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3 min-h-0">
          {/* ── LEFT: Profile + Health context tiles ── */}
          <div className="flex flex-col gap-2.5 pr-1 min-h-0">
            {/* Profile section */}
            <div className="flex items-center gap-4 py-3">
              <div className="w-20 h-20 shrink-0 rounded-full overflow-hidden border-2 border-[var(--nuri-profile-ring)] shadow-lg shadow-[rgba(7,56,36,0.35)]">
                <img
                  src="/sarahprofile.jpeg"
                  alt="Sarah"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = "none";
                    target.parentElement!.classList.add(
                      "bg-gradient-to-br", "from-emerald-700", "to-teal-900",
                      "flex", "items-center", "justify-center"
                    );
                    const span = document.createElement("span");
                    span.className = "text-2xl font-bold text-emerald-200";
                    span.textContent = "CA";
                    target.parentElement!.appendChild(span);
                  }}
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-foreground leading-tight">Hi Sarah!</h2>
                {bioAge != null && chronAge != null && (
                  <p className="text-sm text-nuri-dim mt-1">
                    Age {String(chronAge)} · Bio age{" "}
                    <span className={`font-semibold ${Number(bioAge) <= Number(chronAge) ? "text-emerald-400" : "text-amber-400"}`}>
                      {String(bioAge)}
                    </span>
                    {Number(bioAge) !== Number(chronAge) && (
                      <span className={`ml-1 font-semibold ${Number(bioAge) < Number(chronAge) ? "text-emerald-400" : "text-amber-400"}`}>
                        ({Number(bioAge) < Number(chronAge) ? "−" : "+"}{Math.abs(Number(chronAge) - Number(bioAge))}yr)
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <HealthTiles health={health} userAllergies={userAllergies} setUserAllergies={setUserAllergies} />
          </div>

          {/* ── RIGHT: map beside results ── */}
          <div className="flex flex-col gap-3 min-h-0">
            {/* Map with floating sidebar overlay */}
            <div className="relative flex-1 rounded-2xl overflow-hidden border border-frame-soft min-h-[300px]">
              {location ? (
                <ResultsMap
                  userLat={location.lat}
                  userLng={location.lng}
                  restaurants={filteredPins}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlaceId={setSelectedPlaceId}
                />
              ) : (
                <div className="h-full bg-surface flex items-center justify-center text-nuri-faint text-sm">
                  Waiting for location...
                </div>
              )}

              {/* Floating sidebar — slides in from right on pin click */}
              <div
                ref={sidebarRef}
                className={`absolute top-0 right-0 h-full w-[380px] bg-surface/95 backdrop-blur-xl border-l border-frame-soft/60 transform transition-transform duration-300 ease-out z-[1000] flex flex-col ${selectedPlaceId && results
                    ? "translate-x-0"
                    : "translate-x-full pointer-events-none"
                  }`}
              >
                <button
                  onClick={() => setSelectedPlaceId(null)}
                  className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-surface-raised/85 hover:bg-surface-raised-hover flex items-center justify-center text-nuri-muted hover:text-white transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>

                {(() => {
                  const pin = filteredPins.find((p) => restaurantPinKey(p) === selectedPlaceId);
                  if (!pin) return null;
                  const recs = filteredResults?.filter((r) => r.restaurant === pin.name) ?? [];
                  return (
                    <>
                      {pin.photoReference ? (
                        <img
                          src={`/api/place-photo?ref=${pin.photoReference}`}
                          alt={pin.name}
                          className="w-full h-44 object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-full h-28 bg-gradient-to-br from-emerald-950/60 to-surface flex items-center justify-center shrink-0">
                          <span className="text-5xl font-black text-emerald-800/20">{pin.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="px-4 py-3 border-b border-frame-soft/60 shrink-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-[15px] leading-tight">{pin.name}</h3>
                            <div className="flex items-center gap-2.5 mt-1.5 text-xs text-nuri-muted flex-wrap">
                              {pin.rating != null && pin.rating > 0 && (
                                <span className="flex items-center gap-1">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fbbf24" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                  {pin.rating}
                                </span>
                              )}
                              {pin.priceLevel != null && pin.priceLevel > 0 && (
                                <span className="text-emerald-500/90 font-mono font-semibold tracking-tight">
                                  {"$".repeat(Math.min(4, pin.priceLevel))}
                                </span>
                              )}
                              {pin.walkingMinutes != null && (
                                <span>{pin.walkingMinutes} min walk</span>
                              )}
                            </div>
                          </div>
                          {pin.healthScore !== undefined && (
                            <div className="text-right shrink-0">
                              <div className="text-2xl font-bold text-emerald-400">{pin.healthScore}</div>
                              <div className="text-[9px] text-nuri-dim uppercase tracking-wider">score</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {recs.length > 0 && (
                          <div className="px-3 pt-3 pb-1">
                            <div className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold mb-2 px-1">Recommended here</div>
                            <div className="space-y-2">
                              {recs.map((r, i) => (
                                <div
                                  key={r.rank}
                                  ref={i === 0 ? selectedCardRef : undefined}
                                  className="bg-emerald-950/30 border border-emerald-800/30 rounded-xl p-3"
                                >
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-emerald-400 font-mono text-[11px] font-bold bg-emerald-950 px-1.5 py-0.5 rounded">#{r.rank}</span>
                                      </div>
                                      <div className="text-sm font-semibold leading-snug">{r.dish}</div>
                                      <div className="text-nuri-muted text-xs">{r.cuisine}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-xl font-bold text-emerald-400">{r.healthScore}</div>
                                    </div>
                                  </div>
                                  <p className="text-nuri-muted text-[11px] leading-relaxed mt-1.5">{r.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {recs.length === 0 && (
                          <div className="px-4 py-8 text-center">
                            <p className="text-nuri-dim text-sm">No scored dishes at this restaurant</p>
                            <p className="text-nuri-faint text-xs mt-1">Try a highlighted pin for recommendations</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Bottom indicator — prompts the user to click a pin */}
              {results && !selectedPlaceId && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-surface/90 backdrop-blur-sm border border-frame/55 rounded-full px-5 py-2.5 text-sm text-nuri-secondary shadow-xl whitespace-nowrap">
                  {filteredResults?.length ?? results.length}
                  {(filteredResults?.length ?? results.length) !== results.length
                    ? ` of ${results.length}`
                    : ""}{" "}
                  results &middot; Click a pin to explore
                </div>
              )}
            </div>

            {/* Bottom bar: filters (before find) + button + insights + priorities */}
            <div className="shrink-0 space-y-2">
              <PlaceFilters
                minRating={minRatingFilter}
                onMinRatingChange={setMinRatingFilter}
                priceTier={priceTierFilter}
                onPriceTierChange={setPriceTierFilter}
                disabled={!location || loading}
              />
              <div className="flex flex-col gap-3 rounded-2xl border border-frame-soft/80 bg-surface-muted/52 p-3 sm:p-3.5">
                <button
                  onClick={() => findFood()}
                  disabled={!location || loading}
                  className="w-full sm:w-auto sm:self-start shrink-0 bg-emerald-600 hover:bg-emerald-500 disabled:bg-surface-raised disabled:text-nuri-dim text-white font-semibold py-2.5 px-6 rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed text-sm shadow-md shadow-emerald-950/30"
                >
                  {loading ? "Analyzing..." : location ? "Find Options" : "Waiting..."}
                </button>
                {dietaryInsights.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 sm:flex-wrap sm:overflow-visible [scrollbar-color:rgba(63,63,70,0.5)_transparent] [scrollbar-width:thin]">
                    {dietaryInsights.map((insight, i) => {
                      const isOpen = expandedInsight === i;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setExpandedInsight(isOpen ? null : i)}
                          className={`min-w-[10.5rem] max-w-[min(100%,18rem)] sm:min-w-0 sm:max-w-none sm:flex-1 snap-start rounded-xl border px-3 py-2 text-left transition-all ${
                            isOpen
                              ? "border-emerald-400/40 bg-emerald-950/25 shadow-sm shadow-black/20"
                              : "border-frame/50 bg-surface/65 hover:border-emerald-500/30 hover:bg-surface/90"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                            <span
                              className={`text-emerald-400/95 text-[11px] font-medium leading-snug ${isOpen ? "" : "line-clamp-2 sm:truncate"}`}
                            >
                              {insight.label}
                            </span>
                          </div>
                          {isOpen && (
                            <p className="text-nuri-muted text-[10px] leading-relaxed mt-2 pt-2 border-t border-frame/45">
                              {insight.detail}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {loading && (
                <div className="flex items-center justify-center py-3 gap-3">
                  <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                  <span className="text-nuri-dim text-sm">
                    Pulling health data & scanning nearby restaurants...
                  </span>
                </div>
              )}

              {/* {(recommendationTags.length > 0 || (results && results.length > 0)) && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-nuri-dim text-xs mr-1">
                    {recommendationTags.length > 0 ? "For you:" : "Filter:"}
                  </span>
                  <button
                    type="button"
                    onClick={() => findFood()}
                    className={`rounded-full px-2.5 py-1 text-xs transition ${!activeFilter
                      ? "bg-emerald-600 text-white"
                      : "bg-surface-raised text-nuri-muted hover:bg-surface-raised-hover"
                      }`}
                  >
                    All
                  </button>
                  {(recommendationTags.length > 0
                    ? recommendationTags
                    : (["low_sodium", "high_protein", "heart_healthy"] as FilterKey[])
                  ).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => findFood(tag)}
                      className={`rounded-full px-2.5 py-1 text-xs transition ${activeFilter === tag
                        ? "bg-emerald-600 text-white"
                        : "bg-surface-raised text-nuri-muted hover:bg-surface-raised-hover"
                        }`}
                    >
                      {FILTER_LABELS[tag]}
                    </button>
                  ))}
                </div>
              )} */}

              {priorities && (
                <div className="grid grid-cols-3 gap-2">
                  {priorities.map((p) => (
                    <div
                      key={p.label}
                      className="rounded-xl border border-frame-soft/30 bg-surface/18 p-2.5 backdrop-blur-md"
                    >
                      <div className="text-base mb-0.5">{p.icon}</div>
                      <div className="text-[11px] font-semibold text-emerald-400 mb-0.5">
                        {p.label}
                      </div>
                      <div className="text-[10px] text-nuri-muted leading-snug">
                        {p.detail}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <footer className="shrink-0 py-1 border-t border-frame-soft text-nuri-faint text-[10px] text-center">
          Powered by Betterness MCP &middot; Built at OpenClaw Longevity Hackathon
        </footer>
      </div>
    </main>
  );
}

/* ── Location bar ── */

type EditableMode = "home" | "office" | "destination";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

interface AddressForm {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const EMPTY_FORM: AddressForm = { street: "", city: "", state: "", zip: "", country: "US" };

function LocationBar({
  locationMode,
  setLocationMode,
  savedLocations,
  setSavedLocations,
}: {
  locationMode: LocationMode;
  setLocationMode: (m: LocationMode) => void;
  savedLocations: Record<EditableMode, SavedLocation | null>;
  setSavedLocations: (s: Record<EditableMode, SavedLocation | null>) => void;
}) {
  const [editing, setEditing] = useState<EditableMode | null>(null);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [geocoding, setGeocoding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const streetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && streetRef.current) {
      streetRef.current.focus();
    }
  }, [editing]);

  const buildAddressString = (f: AddressForm) =>
    [f.street, f.city, f.state, f.zip, f.country].filter(Boolean).join(", ");

  const saveAddress = async (mode: EditableMode) => {
    if (!form.street.trim()) return;
    const fullAddress = buildAddressString(form);
    setGeocoding(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(fullAddress)}`);
      if (!res.ok) throw new Error("Address not found");
      const data = await res.json();
      setSavedLocations({
        ...savedLocations,
        [mode]: { label: mode, address: data.address, coords: { lat: data.lat, lng: data.lng } },
      });
      setEditing(null);
      setForm(EMPTY_FORM);
      setLocationMode(mode);
    } catch {
      setFormError("Could not find this address. Please check and try again.");
    } finally {
      setGeocoding(false);
    }
  };

  const clearLocation = (mode: EditableMode) => {
    setSavedLocations({ ...savedLocations, [mode]: null });
    if (locationMode === mode) setLocationMode("office");
  };

  const modes = ["home", "office", "destination", "current"] as const;
  const icons: Record<string, string> = { home: "⌂", office: "◻", destination: "✦", current: "◎" };

  const inputCls = "bg-surface-raised/85 border border-frame/45 rounded-md px-2.5 py-1.5 text-[12px] text-nuri-secondary placeholder-nuri-dim outline-none focus:border-emerald-700/60 transition-colors";
  const selectCls = "bg-surface-raised/85 border border-frame/45 rounded-md px-2 py-1.5 text-[12px] text-nuri-secondary outline-none focus:border-emerald-700/60 transition-colors appearance-none cursor-pointer";

  return (
    <div className="relative flex items-center gap-1.5">
      {modes.map((mode) => {
        const isActive = locationMode === mode;
        const isCurrent = mode === "current";
        const saved = !isCurrent ? savedLocations[mode] : null;
        const isEmpty = !isCurrent && !saved;
        const label = mode === "current" ? "Current" : mode.charAt(0).toUpperCase() + mode.slice(1);

        return (
          <button
            key={mode}
            type="button"
            onClick={() => {
              if (isEmpty && !isCurrent) {
                setEditing(editing === mode ? null : mode);
                setForm(EMPTY_FORM);
                setFormError(null);
              } else {
                setEditing(null);
                setLocationMode(mode);
              }
            }}
            title={
              isEmpty
                ? `Click to set ${mode} address`
                : isCurrent
                  ? "Use current GPS location"
                  : saved!.address
            }
            className={`group relative flex flex-col items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all border ${
              editing === mode
                ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/60 shadow-sm"
                : isActive
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-900/30"
                  : isEmpty
                    ? "bg-surface/65 text-nuri-dim border-dashed border-frame hover:border-emerald-500/45 hover:text-nuri-secondary cursor-pointer"
                    : "bg-surface text-nuri-muted border-frame-soft hover:text-nuri-secondary hover:border-frame"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <span className="text-[13px] leading-none">{icons[mode]}</span>
              {label}
            </span>
            {isEmpty && editing !== mode && (
              <span className="text-[9px] text-nuri-faint group-hover:text-nuri-muted mt-0.5">Click to set</span>
            )}
            {editing === mode && (
              <span className="text-[9px] text-emerald-400 mt-0.5">Editing...</span>
            )}
            {!isEmpty && !isCurrent && (
              <span className={`text-[9px] mt-0.5 max-w-[100px] truncate flex items-center gap-1 ${isActive ? "text-emerald-200/70" : "text-nuri-faint"}`}>
                {saved!.address.split(",")[0]}
                {!isActive && mode !== "office" && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); clearLocation(mode); }}
                    className="opacity-0 group-hover:opacity-100 text-nuri-dim hover:text-red-400 transition-opacity"
                  >
                    ✕
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}

      {editing && (
        <div className="absolute top-full right-0 mt-2 z-[2000] bg-surface border border-frame/55 rounded-xl p-4 shadow-2xl shadow-black/40 w-[340px]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-nuri-secondary">
              Set {editing.charAt(0).toUpperCase() + editing.slice(1)} Location
            </h3>
            <button
              type="button"
              onClick={() => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); }}
              className="text-nuri-dim hover:text-nuri-secondary transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-nuri-dim font-semibold mb-1 block">Street Address</label>
              <input
                ref={streetRef}
                type="text"
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Escape") { setEditing(null); setForm(EMPTY_FORM); setFormError(null); } }}
                placeholder="123 Main St"
                className={`${inputCls} w-full`}
              />
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-nuri-dim font-semibold mb-1 block">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="San Francisco"
                className={`${inputCls} w-full`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-nuri-dim font-semibold mb-1 block">State</label>
                <select
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className={`${selectCls} w-full`}
                >
                  <option value="">Select...</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-nuri-dim font-semibold mb-1 block">Zip Code</label>
                <input
                  type="text"
                  value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  placeholder="94105"
                  className={`${inputCls} w-full`}
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-nuri-dim font-semibold mb-1 block">Country</label>
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className={`${selectCls} w-full`}
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="GB">United Kingdom</option>
                <option value="AU">Australia</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="JP">Japan</option>
              </select>
            </div>
          </div>

          {formError && (
            <p className="text-red-400 text-[11px] mt-2">{formError}</p>
          )}

          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-frame-soft">
            <button
              type="button"
              onClick={() => { setEditing(null); setForm(EMPTY_FORM); setFormError(null); }}
              className="px-3 py-1.5 rounded-lg text-[12px] text-nuri-muted hover:text-nuri-secondary border border-frame hover:border-frame transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveAddress(editing)}
              disabled={!form.street.trim() || geocoding}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-surface-raised disabled:text-nuri-faint disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {geocoding && <div className="animate-spin h-3 w-3 border-2 border-white/30 border-t-white rounded-full" />}
              {geocoding ? "Saving..." : "Save Location"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Health tiles ── */

function HealthTiles({ health, userAllergies, setUserAllergies }: { health: HealthProfile | null; userAllergies: string[]; setUserAllergies: (a: string[]) => void }) {
  if (!health) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-nuri-faint text-sm animate-pulse">
          Loading health data...
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDemo = (health as any)._demo === true;
  const d = _deepFind;

  type Row = { label: string; value: unknown; unit: string };
  const row = (label: string, value: unknown, unit = ""): Row => ({ label, value, unit });

  const vitalRows = [
    row("Resting HR", d(health.vitals, "restingHeartRate"), "bpm"),
    row("HRV", d(health.vitals, "hrv"), "ms"),
    row("SpO2", d(health.vitals, "spO2"), "%"),
  ].filter((r) => r.value != null);

  const sleepRows = [
    row("Avg Duration", d(health.sleep, "averageDuration") ?? d(health.sleep, "duration")),
    row("Score", d(health.sleep, "sleepScore") ?? d(health.sleep, "score")),
    row("Deep", d(health.sleep, "deepSleep") ?? d(health.sleep, "deep")),
    row("REM", d(health.sleep, "remSleep") ?? d(health.sleep, "rem")),
  ].filter((r) => r.value != null);

  const activityRows = [
    row("Steps", d(health.activity, "steps")),
    row("VO2 Max", d(health.activity, "vo2Max") ?? d(health.activity, "vo2_max")),
    row("Active Cal", d(health.activity, "activeCalories") ?? d(health.activity, "calories_burned")),
    row("Workouts/wk", d(health.activity, "workoutsThisWeek") ?? d(health.activity, "workouts")),
  ].filter((r) => r.value != null);

  const bodyRows = [
    row("Weight", d(health.bodyComposition, "weight"), "lbs"),
    row("Body Fat", d(health.bodyComposition, "bodyFatPct") ?? d(health.bodyComposition, "body_fat_percentage"), "%"),
    row("BMI", d(health.bodyComposition, "bmi")),
    row("Muscle", d(health.bodyComposition, "muscleMass") ?? d(health.bodyComposition, "muscle_mass"), "lbs"),
  ].filter((r) => r.value != null);

  const biomarkers = extractBiomarkers(health.biomarkers);

  const hasAnyData =
    vitalRows.length > 0 ||
    sleepRows.length > 0 ||
    activityRows.length > 0 ||
    bodyRows.length > 0 ||
    biomarkers.length > 0;

  if (!hasAnyData) {
    return (
      <>
        <AllergyInput allergies={userAllergies} setAllergies={setUserAllergies} />
        <div className="rounded-xl border border-frame-soft/30 bg-surface/18 p-4 text-center backdrop-blur-md">
          <p className="text-nuri-muted text-sm mb-1">No health data found</p>
          <p className="text-nuri-faint text-xs">
            Connect a wearable on Betterness to see your data here.
            Using demo context for recommendations.
          </p>
        </div>
        <RawDataDump health={health} />
      </>
    );
  }

  const healthRows = [...vitalRows, ...bodyRows];
  const lifestyleRows = [...sleepRows, ...activityRows];

  return (
    <>
      {isDemo && (
        <div className="rounded-lg border border-amber-900/35 bg-amber-950/20 px-2.5 py-1.5 text-[10px] text-amber-300/80 backdrop-blur-sm">
          Demo profile — connect a wearable for real data
        </div>
      )}
      <AllergyInput allergies={userAllergies} setAllergies={setUserAllergies} />
      {healthRows.length > 0 && (
        <Tile title="Vitals & Body">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {healthRows.map((r) => (
              <KV key={r.label} label={r.label} value={`${r.value}${r.unit ? ` ${r.unit}` : ""}`} flag={flagValue(r.label, r.value)} />
            ))}
          </div>
        </Tile>
      )}
      {lifestyleRows.length > 0 && (
        <Tile title="Sleep & Activity">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {lifestyleRows.map((r) => (
              <KV key={r.label} label={r.label} value={`${r.value}${r.unit ? ` ${r.unit}` : ""}`} flag={flagValue(r.label, r.value)} />
            ))}
          </div>
        </Tile>
      )}
      {biomarkers.length > 0 && (
        <Tile title="Biomarkers">
          <div className="space-y-1.5">
            {biomarkers.map((m) => (
              <div key={m.name} className="flex justify-between text-xs">
                <span className="text-nuri-muted">{m.name}</span>
                <span className={`shrink-0 ${statusColor(m.status)}`}>
                  {m.value}
                  {m.status && m.status !== "normal" && (
                    <span className="ml-1 text-[10px] opacity-70">
                      ({m.status})
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </Tile>
      )}
    </>
  );
}

const BIOMARKER_NAMES: Record<string, string> = {
  ldl: "LDL Cholesterol",
  hdl: "HDL Cholesterol",
  crp: "CRP",
  hba1c: "HbA1c",
  vitaminD: "Vitamin D",
  vitaminB12: "Vitamin B12",
  tsh: "TSH",
  alt: "ALT",
  ast: "AST",
};

function extractBiomarkers(
  biomarkers: Record<string, unknown> | null,
): { name: string; value: string; status: string }[] {
  if (!biomarkers) return [];

  const results: { name: string; value: string; status: string }[] = [];

  function walk(obj: unknown, prefix = "") {
    if (!obj || typeof obj !== "object") return;
    const o = obj as Record<string, unknown>;

    if ("value" in o && ("unit" in o || "status" in o)) {
      const name = BIOMARKER_NAMES[prefix] ??
        (prefix.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()) || "Unknown");
      results.push({
        name,
        value: `${o.value}${o.unit ? ` ${o.unit}` : ""}`,
        status: String(o.status ?? "normal"),
      });
      return;
    }

    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object") {
        walk(v, k);
      }
    }
  }

  walk(biomarkers);
  return results;
}

function RawDataDump({ health }: { health: HealthProfile }) {
  const entries = Object.entries(health).filter(
    ([, v]) => v != null && Object.keys(v).length > 0,
  );
  if (entries.length === 0) return null;

  return (
    <Tile title="Raw Health Data (debug)">
      <pre className="text-[10px] text-nuri-dim overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
        {JSON.stringify(health, null, 2)}
      </pre>
    </Tile>
  );
}

function AllergyInput({ allergies, setAllergies }: { allergies: string[]; setAllergies: (a: string[]) => void }) {
  const [input, setInput] = useState("");

  const addAllergy = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
    }
    setInput("");
  };

  const removeAllergy = (allergy: string) => {
    setAllergies(allergies.filter((a) => a !== allergy));
  };

  return (
    <div className="rounded-xl border border-frame-soft/30 bg-surface/18 px-3.5 py-2.5 backdrop-blur-md">
      <div className="text-[10px] uppercase tracking-wider text-nuri-dim mb-1.5 font-semibold">
        Allergies
      </div>
      {allergies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {allergies.map((a) => (
            <span
              key={a}
              className="group rounded-full bg-emerald-400/10 border border-emerald-400/35 text-emerald-400 px-2.5 py-0.5 text-[11px] flex items-center gap-1"
            >
              {a.replace(/_/g, " ")}
              <button
                type="button"
                onClick={() => removeAllergy(a)}
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addAllergy();
            }
          }}
          placeholder="Add an allergy..."
          className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-[12px] text-nuri-secondary placeholder-nuri-dim outline-none transition-colors bg-surface-raised/35 border border-frame/35 backdrop-blur-sm focus:border-emerald-500/35"
        />
        <button
          type="button"
          onClick={addAllergy}
          disabled={!input.trim()}
          className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-surface-raised/40 border border-frame/35 text-nuri-secondary backdrop-blur-sm hover:bg-surface-raised-hover/55 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Tile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-frame-soft/30 bg-surface/18 px-3.5 py-3 backdrop-blur-md">
      <div className="text-[10px] uppercase tracking-wider text-nuri-dim mb-2 font-semibold">
        {title}
      </div>
      {children}
    </div>
  );
}

type HealthFlag = "good" | "warn" | "alert";

function KV({ label, value, flag }: { label: string; value: string; flag?: HealthFlag }) {
  const valueColor =
    flag === "alert" ? "text-rose-400" :
      flag === "warn" ? "text-amber-400" :
        flag === "good" ? "text-emerald-400" :
          "text-nuri-secondary";
  return (
    <div className="flex justify-between text-xs">
      <span className="text-nuri-dim">{label}</span>
      <span className={`font-medium ${valueColor}`}>{value}</span>
    </div>
  );
}

function flagValue(label: string, value: unknown): HealthFlag | undefined {
  const n = Number(value);
  if (isNaN(n)) return undefined;
  switch (label) {
    case "HRV": return n < 20 ? "alert" : n < 30 ? "warn" : undefined;
    case "SpO2": return n < 92 ? "alert" : n < 95 ? "warn" : undefined;
    case "Steps": return n < 5000 ? "warn" : undefined;
    case "VO2 Max": return n < 30 ? "warn" : n >= 45 ? "good" : undefined;
    case "Active Cal": return n < 150 ? "warn" : undefined;
    case "Workouts/wk": return n < 2 ? "warn" : n >= 4 ? "good" : undefined;
    case "Body Fat": return n > 28 ? "warn" : undefined;
    case "BMI": return n > 30 ? "alert" : n > 27 ? "warn" : undefined;
    case "Score": return n < 60 ? "alert" : n < 75 ? "warn" : undefined;
    default: return undefined;
  }
}

interface DietaryInsight {
  label: string;
  detail: string;
}

function deriveDietaryInsights(health: HealthProfile): DietaryInsight[] {
  const insights: DietaryInsight[] = [];
  const d = _deepFind;

  const biomarkers = extractBiomarkers(health.biomarkers);
  for (const m of biomarkers) {
    const name = m.name.toLowerCase();
    if (m.status === "low" && name.includes("vitamin d")) {
      insights.push({ label: "Vitamin D priority", detail: "Your vitamin D is low — looking for fatty fish, eggs, and fortified foods" });
    }
    if ((m.status === "borderline" || m.status === "high") && name.includes("ldl")) {
      insights.push({ label: "Heart-healthy fats", detail: "LDL is elevated — favoring omega-3 rich foods and reduce saturated fat" });
    }
    if (m.status === "high" && name.includes("glucose")) {
      insights.push({ label: "Blood sugar control", detail: "Glucose is elevated — choosing low-glycemic, fiber-rich options" });
    }
    if ((m.status === "high" || m.status === "borderline") && name.includes("crp")) {
      insights.push({ label: "Anti-inflammatory", detail: "CRP suggests inflammation — prioritizing leafy greens and berries" });
    }
    if (m.status === "low" && name.includes("iron")) {
      insights.push({ label: "Iron boost", detail: "Iron is low — looking for red meat, spinach, and legumes" });
    }
  }

  const sleepScore = Number(d(health.sleep, "sleepScore") ?? d(health.sleep, "score"));
  if (!isNaN(sleepScore) && sleepScore < 75) {
    insights.push({ label: "Sleep support", detail: "Sleep score is below optimal — seeking magnesium and tryptophan-rich foods" });
  }

  const workouts = Number(d(health.activity, "workoutsThisWeek") ?? d(health.activity, "workouts"));
  if (!isNaN(workouts) && workouts < 2) {
    insights.push({ label: "Low exercise", detail: "Fewer workouts this week — finding lighter, nutrient-dense meals" });
  }

  const steps = Number(d(health.activity, "steps"));
  if (!isNaN(steps) && steps < 5000) {
    insights.push({ label: "Low activity", detail: "Step count is low — looking for lighter meals with sustained energy" });
  }

  const bmi = Number(d(health.bodyComposition, "bmi"));
  if (!isNaN(bmi) && bmi > 28) {
    insights.push({ label: "Weight management", detail: "BMI is elevated — prioritizing lean protein and high-fiber options" });
  }

  return insights.slice(0, 3);
}

function _deepFind(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  if (key in o) return o[key];
  for (const v of Object.values(o)) {
    const found = _deepFind(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}
