import { ParsedFilters, RestaurantWithDistance, ScoredRestaurant } from "@/lib/types";

function categoryBonus(restaurant: RestaurantWithDistance, category?: string): number {
  if (!category) return 0;
  return restaurant.categories.some((entry) => entry.toLowerCase() === category.toLowerCase()) ? 2 : 0;
}

function distanceBonus(distanceMiles: number, maxDistanceMiles: number): number {
  const cap = Math.max(maxDistanceMiles, 1);
  const normalized = Math.max(0, 1 - distanceMiles / cap);
  return normalized * 3;
}

function priceBonus(priceLevel: number, preference: ParsedFilters["pricePreference"]): number {
  if (preference === "any") return 0;
  if (preference === "cheap") {
    if (priceLevel === 1) return 2;
    if (priceLevel === 2) return 0.5;
    return 0;
  }
  if (priceLevel <= 2) return 1.5;
  return 0;
}

export function rankRestaurants(
  restaurants: RestaurantWithDistance[],
  filters: ParsedFilters
): ScoredRestaurant[] {
  return restaurants
    .map((restaurant) => {
      const score =
        restaurant.rating * 2 +
        categoryBonus(restaurant, filters.category) +
        distanceBonus(restaurant.distanceMiles, filters.maxDistanceMiles) +
        priceBonus(restaurant.priceLevel, filters.pricePreference);

      return {
        ...restaurant,
        score
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
