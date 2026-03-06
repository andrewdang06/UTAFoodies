"use client";

import { FormEvent, useMemo, useState } from "react";

type Badge = "Open Now" | "Halal" | "Late Night" | "Cheap Eats" | "Popular" | "Near Campus";

type Result = {
  name: string;
  rating: number;
  reviewCount?: number;
  priceLevel: number;
  categories: string[];
  distanceMiles: number;
  isOpenNow: boolean;
  score: number;
  badges: Badge[];
  reason: string;
  isFallback?: boolean;
};

type ApiResponse = {
  query: string;
  filters: {
    category?: string;
    maxDistanceMiles: number;
    pricePreference: "cheap" | "moderate" | "any";
    mode?: "food" | "drink";
    lateNight?: boolean;
  };
  totalMatches: number;
  results: Result[];
  error?: string;
};

function priceLabel(priceLevel: number): string {
  return "$".repeat(Math.max(1, Math.min(3, priceLevel)));
}

const BADGE_STYLES: Record<Badge, string> = {
  "Open Now": "bg-emerald-100 text-emerald-800",
  Halal: "bg-violet-100 text-violet-800",
  "Late Night": "bg-indigo-100 text-indigo-800",
  "Cheap Eats": "bg-amber-100 text-amber-800",
  Popular: "bg-rose-100 text-rose-800",
  "Near Campus": "bg-sky-100 text-sky-800"
};

const QUICK_SEARCHES = [
  "halal near campus",
  "cheap boba",
  "late night food",
  "coffee",
  "burgers",
  "wings",
  "dessert",
  "mexican food"
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const subtitle = useMemo(() => {
    if (!data) return "The smartest way to find food near UTA";
    return `Top ${data.results.length} picks within ${data.filters.maxDistanceMiles} mi`;
  }, [data]);

  const doSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setQuery(searchQuery);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });

      const payload = (await response.json()) as ApiResponse;
      if (!response.ok) {
        setError(payload.error ?? "Failed to fetch recommendations.");
        setData(null);
      } else {
        setData(payload);
      }
    } catch {
      setError("Request failed. Try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await doSearch(query);
  };

  const primaryResults = data?.results.filter((r) => !r.isFallback) ?? [];
  const fallbackResults = data?.results.filter((r) => r.isFallback) ?? [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-12 pt-14">
      <header className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">
          <span className="text-blue-700">Mav</span>Eats
        </h1>
        <p className="mt-2 text-sm text-slate-500">Built for Mavericks. Powered by what&apos;s actually near campus.</p>
        <p className="mt-1 text-base text-slate-600 md:text-lg">{subtitle}</p>
      </header>

      <form onSubmit={onSubmit} className="mx-auto mt-10 flex w-full max-w-2xl gap-3">
        <input
          type="text"
          className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4 text-base shadow-sm outline-none transition focus:border-slate-500"
          placeholder='Try "halal near campus" or "late night wings"'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-900 px-5 py-4 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "..." : "Find"}
        </button>
      </form>

      {/* Quick search chips */}
      {!data && !loading && (
        <div className="mx-auto mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
          {QUICK_SEARCHES.map((q) => (
            <button
              key={q}
              onClick={() => doSearch(q)}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mx-auto mt-6 text-sm text-red-600">{error}</p>}

      {data && (
        <section className="mx-auto mt-10 w-full max-w-3xl">
          <div className="mb-4 flex items-baseline justify-between text-sm text-slate-600">
            <span>
              <span className="font-semibold text-slate-800">{data.totalMatches}</span> places matched
              {data.filters.category && (
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {data.filters.category}
                </span>
              )}
            </span>
            {data.filters.lateNight && (
              <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                Late-night mode
              </span>
            )}
          </div>

          {data.results.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
              No spots matched that search. Try something broader like &quot;food near me&quot; or &quot;cheap eats&quot;.
            </div>
          ) : (
            <>
              {/* Primary results */}
              <div className="space-y-4">
                {primaryResults.map((restaurant, index) => (
                  <article
                    key={restaurant.name}
                    className={`rounded-xl border bg-white p-5 shadow-sm transition ${
                      index === 0
                        ? "border-emerald-400 ring-2 ring-emerald-200"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">
                          {restaurant.name}{" "}
                          {index === 0 && <span className="text-sm font-semibold text-emerald-600">Top Pick</span>}
                        </h2>
                        {/* Badges */}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {restaurant.badges.map((badge) => (
                            <span
                              key={badge}
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[badge]}`}
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {restaurant.score.toFixed(1)} pts
                      </span>
                    </div>

                    {/* Reason line */}
                    <p className="mt-2 text-sm italic text-slate-500">{restaurant.reason}</p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700 md:grid-cols-4">
                      <p>
                        <span className="font-semibold">Rating:</span> {restaurant.rating.toFixed(1)}
                        {restaurant.reviewCount ? (
                          <span className="text-xs text-slate-400"> ({restaurant.reviewCount})</span>
                        ) : null}
                      </p>
                      <p>
                        <span className="font-semibold">Distance:</span> {restaurant.distanceMiles.toFixed(2)} mi
                      </p>
                      <p>
                        <span className="font-semibold">Price:</span> {priceLabel(restaurant.priceLevel)}
                      </p>
                      <p>
                        <span className="font-semibold">Type:</span> {restaurant.categories.slice(0, 3).join(", ")}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              {/* Fallback results */}
              {fallbackResults.length > 0 && (
                <div className="mt-8">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Related Options Nearby
                  </h3>
                  <div className="space-y-3">
                    {fallbackResults.map((restaurant) => (
                      <article
                        key={restaurant.name}
                        className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold text-slate-800">{restaurant.name}</h2>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {restaurant.badges.map((badge) => (
                                <span
                                  key={badge}
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_STYLES[badge]}`}
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                            Fallback
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm italic text-slate-500">{restaurant.reason}</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-slate-600 md:grid-cols-4">
                          <p>Rating: {restaurant.rating.toFixed(1)}</p>
                          <p>Distance: {restaurant.distanceMiles.toFixed(2)} mi</p>
                          <p>Price: {priceLabel(restaurant.priceLevel)}</p>
                          <p>Type: {restaurant.categories.slice(0, 3).join(", ")}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
