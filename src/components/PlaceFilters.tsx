"use client";

import type { PriceTierFilter } from "@/lib/place-filters";

const PRICE_LABELS: Record<Exclude<PriceTierFilter, 0>, string> = {
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};

type Props = {
  minRating: number;
  onMinRatingChange: (v: number) => void;
  priceTier: PriceTierFilter;
  onPriceTierChange: (v: PriceTierFilter) => void;
  disabled?: boolean;
};

/**
 * Minimum Google rating (0–5 in 0.5 steps) and exact price tier ($–$$$$).
 * Unknown price (0 from API) still passes the price filter so listings are not hidden.
 */
export default function PlaceFilters({
  minRating,
  onMinRatingChange,
  priceTier,
  onPriceTierChange,
  disabled,
}: Props) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <p className="text-[10px] text-zinc-500 leading-snug">
        Optional. Leave <span className="text-zinc-400">Min rating</span> and{" "}
        <span className="text-zinc-400">Price</span> on &ldquo;Any&rdquo; to search everywhere.
      </p>
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
            Min rating
          </span>
          {minRating > 0 && (
            <button
              type="button"
              onClick={() => onMinRatingChange(0)}
              className="text-[10px] text-emerald-500/90 hover:text-emerald-400 font-medium"
            >
              Any
            </button>
          )}
        </div>
        <MinRatingStars value={minRating} onChange={onMinRatingChange} />
      </div>
      <div className="sm:border-l sm:border-zinc-800 sm:pl-3">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1.5">
          Price
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onPriceTierChange(0)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
              priceTier === 0
                ? "bg-emerald-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            }`}
          >
            Any
          </button>
          {([1, 2, 3, 4] as const).map((tier) => (
            <button
              key={tier}
              type="button"
              title={priceTierTitle(tier)}
              onClick={() => onPriceTierChange(tier)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-mono font-semibold transition-colors ${
                priceTier === tier
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {PRICE_LABELS[tier]}
            </button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}

function priceTierTitle(tier: 1 | 2 | 3 | 4): string {
  switch (tier) {
    case 1:
      return "Inexpensive";
    case 2:
      return "Moderate";
    case 3:
      return "Expensive";
    case 4:
      return "Very expensive";
    default:
      return "";
  }
}

function MinRatingStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Minimum star rating">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-flex h-8 w-8 shrink-0 select-none">
          <button
            type="button"
            aria-label={`${i - 0.5} stars minimum`}
            className="absolute left-0 top-0 z-10 h-full w-1/2 cursor-pointer rounded-l-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            onClick={() => onChange(toggleMinRating(value, i - 0.5))}
          />
          <button
            type="button"
            aria-label={`${i} stars minimum`}
            className="absolute right-0 top-0 z-10 h-full w-1/2 cursor-pointer rounded-r-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            onClick={() => onChange(toggleMinRating(value, i))}
          />
          <StarGlyph fill={starFill(i, value)} />
        </span>
      ))}
      <span className="ml-1 text-[11px] text-zinc-500 tabular-nums">
        {value <= 0 ? "—" : value.toFixed(1)}
      </span>
    </div>
  );
}

/** Clicking the same segment again clears to 0. */
function toggleMinRating(current: number, next: number): number {
  if (Math.abs(current - next) < 1e-6) return 0;
  return next;
}

function starFill(starIndex: number, value: number): "empty" | "half" | "full" {
  if (value + 1e-6 >= starIndex) return "full";
  if (value + 1e-6 >= starIndex - 0.5) return "half";
  return "empty";
}

function StarGlyph({ fill }: { fill: "empty" | "half" | "full" }) {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] leading-none">
      <span className="text-zinc-600" aria-hidden>
        ★
      </span>
      {fill === "full" && (
        <span className="absolute inset-0 flex items-center justify-center text-amber-400" aria-hidden>
          ★
        </span>
      )}
      {fill === "half" && (
        <span
          className="absolute left-0 top-0 flex h-full w-1/2 items-center justify-start overflow-hidden pl-0.5 text-amber-400"
          aria-hidden
        >
          <span className="text-[22px] leading-none">★</span>
        </span>
      )}
    </span>
  );
}
