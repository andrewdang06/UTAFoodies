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

/* ========== ABUSE-PREVENTION LAYER ========== */

// --- Per-IP rate limiter (sliding window) ---
const IP_WINDOW_MS = 60_000;           // 1 minute
const IP_MAX_PER_WINDOW = 8;           // 8 requests / minute / IP
const ipHits = new Map<string, number[]>();

function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS);
  if (hits.length >= IP_MAX_PER_WINDOW) {
    ipHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  ipHits.set(ip, hits);
  return false;
}

// --- Global rate limiter (all users combined) ---
const GLOBAL_WINDOW_MS = 60_000;       // 1 minute
const GLOBAL_MAX_PER_WINDOW = 30;      // 30 total requests / minute across all users
let globalHits: number[] = [];

function isGlobalRateLimited(): boolean {
  const now = Date.now();
  globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (globalHits.length >= GLOBAL_MAX_PER_WINDOW) return true;
  globalHits.push(now);
  return false;
}

// --- Daily Gemini call budget ---
const DAILY_GEMINI_LIMIT = 500;        // max 500 Gemini API calls per day
let dailyCalls = 0;
let dailyResetDate = new Date().toDateString();

export function trackGeminiCall(): boolean {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyCalls = 0;
    dailyResetDate = today;
  }
  if (dailyCalls >= DAILY_GEMINI_LIMIT) return false; // budget exhausted
  dailyCalls++;
  return true;
}

export function isDailyBudgetExhausted(): boolean {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyCalls = 0;
    dailyResetDate = today;
  }
  return dailyCalls >= DAILY_GEMINI_LIMIT;
}

// --- Query validation ---
const MAX_QUERY_LENGTH = 200;          // no one needs a 200+ char food query
const SUSPICIOUS_PATTERNS = /(<script|<\/|javascript:|on\w+=|SELECT\s|DROP\s|INSERT\s|DELETE\s|UNION\s|--\s)/i;

function sanitizeQuery(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > MAX_QUERY_LENGTH) return null;
  if (SUSPICIOUS_PATTERNS.test(trimmed)) return null;
  // Strip any non-printable / control characters
  return trimmed.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "").trim() || null;
}

// --- Periodic cleanup (prevent memory leaks) ---
const CLEANUP_INTERVAL_MS = 5 * 60_000; // every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of ipHits.entries()) {
    const active = hits.filter((t) => now - t < IP_WINDOW_MS);
    if (active.length === 0) ipHits.delete(ip);
    else ipHits.set(ip, active);
  }
  globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);
}, CLEANUP_INTERVAL_MS);

/* ============================================ */

export async function POST(request: Request) {
  try {
    // 1) Global rate limit
    if (isGlobalRateLimited()) {
      return NextResponse.json(
        { error: "Server is busy. Please try again in a moment." },
        { status: 429 }
      );
    }

    // 2) Per-IP rate limit
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
    if (isIpRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    // 3) Body size guard (reject payloads > 1 KB)
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 1024) {
      return NextResponse.json({ error: "Request too large." }, { status: 413 });
    }

    const body = (await request.json()) as RecommendRequestBody;

    // 4) Query validation & sanitization
    if (!body.query || typeof body.query !== "string") {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }
    const query = sanitizeQuery(body.query);
    if (!query) {
      return NextResponse.json(
        { error: "Invalid query. Keep it under 200 characters." },
        { status: 400 }
      );
    }

    // 5) Daily budget check — if exhausted, skip Gemini and use local fallback parser
    const filters = await parseQueryToFilters(query, isDailyBudgetExhausted());

    // Track the call (only counted if Gemini was actually used — handled inside gemini.ts)
    if (!isDailyBudgetExhausted()) trackGeminiCall();

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
