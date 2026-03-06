export type Restaurant = {
  name: string;
  rating: number;
  priceLevel: 1 | 2 | 3;
  categories: string[];
  mode: Array<"food" | "drink">;
  lat: number;
  lng: number;
};

export type PricePreference = "cheap" | "moderate" | "any";

export type ParsedFilters = {
  category?: string;
  maxDistanceMiles: number;
  pricePreference: PricePreference;
  mode?: "food" | "drink";
};

export type RestaurantWithDistance = Restaurant & {
  distanceMiles: number;
};

export type ScoredRestaurant = RestaurantWithDistance & {
  score: number;
};
