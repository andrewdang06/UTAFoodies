import { isLateNight } from "@/lib/filter";
import { Badge, ParsedFilters, RestaurantWithDistance, ScoredRestaurant } from "@/lib/types";

// ── Weight constants ──
const W_CATEGORY = 10; // very strong — exact cuisine match
const W_CATEGORY_PARTIAL = 5; // partial category overlap
const W_OPEN_NOW = 6; // strong — student wants to eat now
const W_DISTANCE_MAX = 5; // strong — closer to UTA is better
const W_RATING = 2; // secondary — rating tie-breaker
const W_REVIEWS = 1; // secondary — review count tie-breaker
const W_PRICE_MATCH = 3; // when user explicitly wants cheap
const W_LATE_NIGHT = 5; // strong when user asks for late-night

// ── Scoring helpers ──

function categoryScore(
  categories: string[],
  requestedCategory?: string
): { score: number; isExact: boolean } {
  if (!requestedCategory) return { score: 0, isExact: false };
  const lower = requestedCategory.toLowerCase();
  const exact = categories.some((c) => c.toLowerCase() === lower);
  if (exact) return { score: W_CATEGORY, isExact: true };
  const partial = categories.some((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
  if (partial) return { score: W_CATEGORY_PARTIAL, isExact: false };
  return { score: 0, isExact: false };
}

function distanceScore(distanceMiles: number, maxDistanceMiles: number): number {
  const cap = Math.max(maxDistanceMiles, 1);
  const normalized = Math.max(0, 1 - distanceMiles / cap);
  return normalized * W_DISTANCE_MAX;
}

function openNowScore(isOpen: boolean): number {
  return isOpen ? W_OPEN_NOW : 0;
}

function ratingScore(rating: number): number {
  // Normalize 3.5-5.0 range to 0-1
  const normalized = Math.max(0, Math.min(1, (rating - 3.5) / 1.5));
  return normalized * W_RATING;
}

function reviewScore(reviewCount?: number): number {
  if (!reviewCount) return 0;
  // Log scale: 100 reviews → 0.5, 1000 → ~0.75, 3000 → ~0.87
  const normalized = Math.min(1, Math.log10(Math.max(1, reviewCount)) / Math.log10(5000));
  return normalized * W_REVIEWS;
}

function priceScore(priceLevel: number, preference: ParsedFilters["pricePreference"]): number {
  if (preference === "any") return 0;
  if (preference === "cheap") {
    if (priceLevel === 1) return W_PRICE_MATCH;
    if (priceLevel === 2) return W_PRICE_MATCH * 0.3;
    return 0;
  }
  // moderate
  if (priceLevel <= 2) return W_PRICE_MATCH * 0.5;
  return 0;
}

function lateNightScore(restaurant: RestaurantWithDistance, wantsLateNight?: boolean): number {
  if (!wantsLateNight) return 0;
  return isLateNight(restaurant) ? W_LATE_NIGHT : 0;
}

// ── Badge generation ──

function computeBadges(restaurant: RestaurantWithDistance, filters: ParsedFilters): Badge[] {
  const badges: Badge[] = [];

  if (restaurant.isOpenNow) badges.push("Open Now");
  if (restaurant.categories.some((c) => c.toLowerCase() === "halal")) badges.push("Halal");
  if (isLateNight(restaurant)) badges.push("Late Night");
  if (restaurant.priceLevel === 1) badges.push("Cheap Eats");
  if ((restaurant.reviewCount ?? 0) >= 800) badges.push("Popular");
  if (restaurant.distanceMiles <= 1.0) badges.push("Near Campus");

  return badges;
}

// ── Reason generation ──

function buildReason(
  restaurant: RestaurantWithDistance,
  filters: ParsedFilters,
  catMatch: { isExact: boolean }
): string {
  const parts: string[] = [];

  if (filters.category && catMatch.isExact) {
    parts.push(`Strong ${filters.category} match`);
  } else if (filters.category) {
    parts.push("Related cuisine");
  }

  parts.push(`${restaurant.distanceMiles.toFixed(1)} mi away`);

  if (restaurant.isOpenNow) {
    parts.push("open now");
  } else {
    parts.push("currently closed");
  }

  if (filters.lateNight && isLateNight(restaurant)) {
    parts.push("late-night option");
  }

  if (restaurant.priceLevel === 1) {
    parts.push("budget-friendly");
  }

  return parts.join(", ");
}

// ── Main ranking function ──

export function rankRestaurants(
  restaurants: RestaurantWithDistance[],
  filters: ParsedFilters,
  limit = 5
): ScoredRestaurant[] {
  return restaurants
    .map((restaurant) => {
      const cat = categoryScore(restaurant.categories, filters.category);

      const score =
        cat.score +
        openNowScore(restaurant.isOpenNow) +
        distanceScore(restaurant.distanceMiles, filters.maxDistanceMiles) +
        ratingScore(restaurant.rating) +
        reviewScore(restaurant.reviewCount) +
        priceScore(restaurant.priceLevel, filters.pricePreference) +
        lateNightScore(restaurant, filters.lateNight);

      const badges = computeBadges(restaurant, filters);
      const reason = buildReason(restaurant, filters, cat);

      return { ...restaurant, score, badges, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Score fallback restaurants. Identical logic but marks them as fallback.
 */
export function rankFallback(
  restaurants: RestaurantWithDistance[],
  filters: ParsedFilters,
  limit = 3
): ScoredRestaurant[] {
  return rankRestaurants(restaurants, { ...filters, category: undefined }, limit).map((r) => ({
    ...r,
    isFallback: true,
    reason: "Nearby option — " + r.reason
  }));
}

