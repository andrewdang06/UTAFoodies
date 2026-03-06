import restaurantsData from "@/data/restaurants.json";
import { fallbackFilter, filterRestaurants } from "@/lib/filter";
import { parseQueryToFilters } from "@/lib/gemini";
import { rankFallback, rankRestaurants } from "@/lib/score";
import { Restaurant } from "@/lib/types";
import { NextResponse } from "next/server";

type RecommendRequestBody = {
  query?: string;
};

const MIN_RESULTS = 3;
const PRIMARY_LIMIT = 5;
const FALLBACK_LIMIT = 3;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendRequestBody;
    const query = body.query?.trim();

    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    const filters = await parseQueryToFilters(query);
    const restaurants = restaurantsData as Restaurant[];

    // Primary filter + rank
    const filtered = filterRestaurants(restaurants, filters);
    const primary = rankRestaurants(filtered, filters, PRIMARY_LIMIT);

    // If not enough primary results, run fallback with wider criteria
    let fallback: ReturnType<typeof rankFallback> = [];
    if (primary.length < MIN_RESULTS) {
      const excludeNames = new Set(primary.map((r) => r.name));
      const fallbackPool = fallbackFilter(restaurants, filters, excludeNames);
      fallback = rankFallback(fallbackPool, filters, FALLBACK_LIMIT);
    }

    const results = [...primary, ...fallback];

    return NextResponse.json({
      query,
      filters,
      totalMatches: filtered.length,
      results
    });
  } catch {
    return NextResponse.json({ error: "Unable to process recommendation request." }, { status: 500 });
  }
}
