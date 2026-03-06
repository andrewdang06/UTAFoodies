"use client";

import { FormEvent, useMemo, useState } from "react";

type Result = {
  name: string;
  rating: number;
  priceLevel: number;
  categories: string[];
  distanceMiles: number;
  score: number;
};

type ApiResponse = {
  query: string;
  filters: {
    category?: string;
    maxDistanceMiles: number;
    pricePreference: "cheap" | "moderate" | "any";
    mode?: "food" | "drink";
  };
  totalMatches: number;
  results: Result[];
  error?: string;
};

function priceLabel(priceLevel: number): string {
  return "$".repeat(Math.max(1, Math.min(3, priceLevel)));
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse | null>(null);

  const subtitle = useMemo(() => {
    if (!data) return "Find the best food near UTA";
    return `Top matches within ${data.filters.maxDistanceMiles} miles`;
  }, [data]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-12 pt-14">
      <header className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">Mavs What To Eat</h1>
        <p className="mt-3 text-base text-slate-600 md:text-lg">{subtitle}</p>
      </header>

      <form onSubmit={onSubmit} className="mx-auto mt-10 flex w-full max-w-2xl gap-3">
        <input
          type="text"
          className="w-full rounded-xl border border-slate-300 bg-white px-5 py-4 text-base shadow-sm outline-none transition focus:border-slate-500"
          placeholder='Try: "cheap boba" or "late night coffee"'
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-900 px-5 py-4 font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? "Searching..." : "Find"}
        </button>
      </form>

      {error && <p className="mx-auto mt-6 text-sm text-red-600">{error}</p>}

      {data && (
        <section className="mx-auto mt-10 w-full max-w-3xl">
          <div className="mb-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{data.totalMatches}</span> places matched
          </div>

          {data.results.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">
              No results found for this query. Try a broader search like "italian food" or "boba within 5 miles".
            </div>
          ) : (
            <div className="space-y-4">
              {data.results.map((restaurant, index) => (
                <article
                  key={restaurant.name}
                  className={`rounded-xl border bg-white p-5 shadow-sm ${
                    index === 0 ? "border-emerald-400 ring-2 ring-emerald-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold text-slate-900">
                      {restaurant.name} {index === 0 && <span className="text-emerald-600">(Top Pick)</span>}
                    </h2>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                      Score {restaurant.score.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700 md:grid-cols-4">
                    <p>
                      <span className="font-semibold">Rating:</span> {restaurant.rating.toFixed(1)}
                    </p>
                    <p>
                      <span className="font-semibold">Distance:</span> {restaurant.distanceMiles.toFixed(2)} mi
                    </p>
                    <p>
                      <span className="font-semibold">Price:</span> {priceLabel(restaurant.priceLevel)}
                    </p>
                    <p>
                      <span className="font-semibold">Categories:</span> {restaurant.categories.join(", ")}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
