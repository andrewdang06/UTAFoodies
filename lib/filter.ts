import { distanceFromUTA } from "@/lib/distance";
import { ParsedFilters, Restaurant, RestaurantWithDistance } from "@/lib/types";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/**
 * Check if a restaurant is currently open based on its hours data.
 */
export function isOpenNow(restaurant: Restaurant): boolean {
  if (!restaurant.hours) return true; // assume open if no hours data

  const now = new Date();
  const day = DAYS[now.getDay()];
  const todayHours = restaurant.hours[day];

  if (!todayHours || todayHours === "closed") return false;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todayHours.open.split(":").map(Number);
  const [closeH, closeM] = todayHours.close.split(":").map(Number);
  const openMinutes = openH * 60 + openM;
  let closeMinutes = closeH * 60 + closeM;

  // Handle overnight hours (e.g. open 11:00, close 02:00)
  if (closeMinutes <= openMinutes) {
    // Either we're after open today, or before close (next day portion)
    return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
  }

  // Handle 24-hour places (00:00 - 23:59)
  if (openMinutes === 0 && closeMinutes >= 1439) return true;

  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

/**
 * Check if a restaurant is a late-night option (open past 11 PM on any day).
 */
export function isLateNight(restaurant: Restaurant): boolean {
  if (restaurant.categories.some((c) => c.toLowerCase() === "late-night")) return true;
  if (!restaurant.hours) return false;

  return Object.values(restaurant.hours).some((h) => {
    if (h === "closed" || !h) return false;
    const [closeH] = h.close.split(":").map(Number);
    // Close at or after 11 PM, or in the early morning hours (overnight)
    return closeH >= 23 || (closeH >= 0 && closeH <= 4);
  });
}

function matchesCategory(restaurant: Restaurant, category?: string): boolean {
  if (!category) return true;
  const lower = category.toLowerCase();
  return restaurant.categories.some((entry) => entry.toLowerCase().includes(lower));
}

function matchesMode(restaurant: Restaurant, mode?: "food" | "drink"): boolean {
  if (!mode) return true;
  return restaurant.mode.includes(mode);
}

function matchesPrice(restaurant: Restaurant, preference: ParsedFilters["pricePreference"]): boolean {
  if (preference === "any") return true;
  if (preference === "cheap") return restaurant.priceLevel <= 2;
  return restaurant.priceLevel <= 2;
}

/**
 * Primary filter: returns restaurants that match ALL criteria.
 * Removed: minimum rating gate (4.3) — we now score all restaurants and let ranking decide.
 */
export function filterRestaurants(
  restaurants: Restaurant[],
  filters: ParsedFilters
): RestaurantWithDistance[] {
  return restaurants
    .filter((r) => !r.permanentlyClosed)
    .map((restaurant) => ({
      ...restaurant,
      distanceMiles: distanceFromUTA(restaurant.lat, restaurant.lng),
      isOpenNow: isOpenNow(restaurant)
    }))
    .filter((restaurant) => restaurant.distanceMiles <= filters.maxDistanceMiles)
    .filter((restaurant) => matchesCategory(restaurant, filters.category))
    .filter((restaurant) => matchesMode(restaurant, filters.mode))
    .filter((restaurant) => matchesPrice(restaurant, filters.pricePreference));
}

/**
 * Fallback filter: wider search when primary returns too few results.
 * Drops category and mode requirements, only keeps distance + not closed.
 */
export function fallbackFilter(
  restaurants: Restaurant[],
  filters: ParsedFilters,
  excludeNames: Set<string>
): RestaurantWithDistance[] {
  const widerDistance = Math.min(filters.maxDistanceMiles * 1.5, 10);
  return restaurants
    .filter((r) => !r.permanentlyClosed)
    .filter((r) => !excludeNames.has(r.name))
    .map((restaurant) => ({
      ...restaurant,
      distanceMiles: distanceFromUTA(restaurant.lat, restaurant.lng),
      isOpenNow: isOpenNow(restaurant)
    }))
    .filter((restaurant) => restaurant.distanceMiles <= widerDistance)
    .filter((restaurant) => matchesPrice(restaurant, filters.pricePreference));
}

