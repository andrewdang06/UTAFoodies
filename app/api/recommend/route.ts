import restaurantsData from "@/data/restaurants.json";
import { filterRestaurants } from "@/lib/filter";
import { parseQueryToFilters } from "@/lib/gemini";
import { rankRestaurants } from "@/lib/score";
import { Restaurant } from "@/lib/types";
import { NextResponse } from "next/server";

type RecommendRequestBody = {
  query?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendRequestBody;
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    const filters = await parseQueryToFilters(query);
    const restaurants = restaurantsData as Restaurant[];
    const filtered = filterRestaurants(restaurants, filters);
    const top = rankRestaurants(filtered, filters);

    return NextResponse.json({
      query,
      filters,
      totalMatches: filtered.length,
      results: top
    });
  } catch {
    return NextResponse.json({ error: "Unable to process recommendation request." }, { status: 500 });
  }
}
