export type Restaurant = {
  name: string;
  rating: number;
  reviewCount?: number;
  priceLevel: 1 | 2 | 3;
  categories: string[];
  mode: Array<"food" | "drink">;
  lat: number;
  lng: number;
  permanentlyClosed?: boolean;
  hours?: {
    [day: string]: { open: string; close: string } | "closed";
  };
};

export type PricePreference = "cheap" | "moderate" | "any";

export type ParsedFilters = {
  category?: string;
  maxDistanceMiles: number;
  pricePreference: PricePreference;
  mode?: "food" | "drink";
  lateNight?: boolean;
  wantsCheap?: boolean;
};

export type RestaurantWithDistance = Restaurant & {
  distanceMiles: number;
  isOpenNow: boolean;
};

export type Badge = "Open Now" | "Halal" | "Late Night" | "Cheap Eats" | "Popular" | "Near Campus";

export type ScoredRestaurant = RestaurantWithDistance & {
  score: number;
  badges: Badge[];
  reason: string;
  isFallback?: boolean;
};
