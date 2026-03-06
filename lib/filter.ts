import { distanceFromUTA } from "@/lib/distance";
import { ParsedFilters, Restaurant, RestaurantWithDistance } from "@/lib/types";

function matchesCategory(restaurant: Restaurant, category?: string): boolean {
  if (!category) return true;
  return restaurant.categories.some((entry) => entry.toLowerCase().includes(category.toLowerCase()));
}

function matchesMode(restaurant: Restaurant, mode?: "food" | "drink"): boolean {
  if (!mode) return true;
  return restaurant.mode.includes(mode);
}

function matchesPrice(restaurant: Restaurant, preference: ParsedFilters["pricePreference"]): boolean {
  if (preference === "any") return true;
  if (preference === "cheap") return restaurant.priceLevel <= 1;
  return restaurant.priceLevel <= 2;
}

export function filterRestaurants(
  restaurants: Restaurant[],
  filters: ParsedFilters
): RestaurantWithDistance[] {
  return restaurants
    .map((restaurant) => ({
      ...restaurant,
      distanceMiles: distanceFromUTA(restaurant.lat, restaurant.lng)
    }))
    .filter((restaurant) => restaurant.rating >= 4.3)
    .filter((restaurant) => restaurant.distanceMiles <= filters.maxDistanceMiles)
    .filter((restaurant) => matchesCategory(restaurant, filters.category))
    .filter((restaurant) => matchesMode(restaurant, filters.mode))
    .filter((restaurant) => matchesPrice(restaurant, filters.pricePreference));
}
