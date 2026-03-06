import { ParsedFilters } from "@/lib/types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const allowedCategories = [
  "italian",
  "american",
  "mexican",
  "halal",
  "boba",
  "coffee",
  "dessert",
  "burger",
  "chicken",
  "asian",
  "indian",
  "vietnamese",
  "mediterranean",
  "pizza",
  "tacos",
  "wings",
  "sandwich",
  "breakfast",
  "healthy",
  "fast-food",
  "fast-casual",
  "middle-eastern",
  "pakistani",
  "kebab",
  "chinese",
  "pho",
  "tea",
  "gyro",
  "biryani",
  "korean",
  "thai",
  "japanese",
  "sushi",
  "smoothie",
  "bakery",
  "cookies",
  "cake",
  "ice-cream",
  "bbq",
  "bar",
  "late-night",
  "cafe"
];

function fallbackParse(query: string): ParsedFilters {
  const lower = query.toLowerCase();
  const distanceMatch = lower.match(/within\s+(\d+(?:\.\d+)?)\s*mile/);
  const category = allowedCategories.find((entry) => lower.includes(entry));

  let pricePreference: ParsedFilters["pricePreference"] = "any";
  if (/(cheap|budget|low cost|inexpensive|affordable|\$\s)/.test(lower)) {
    pricePreference = "cheap";
  } else if (/(moderate|mid|not too expensive)/.test(lower)) {
    pricePreference = "moderate";
  }

  let mode: ParsedFilters["mode"];
  if (/(drink|coffee|boba|tea|smoothie)/.test(lower)) {
    mode = "drink";
  } else if (/(food|meal|lunch|dinner|eat|hungry)/.test(lower)) {
    mode = "food";
  }

  const lateNight = /(late\s*night|midnight|open\s*late|after\s*hours|2\s*am|3\s*am)/.test(lower);

  const wantsCheap = pricePreference === "cheap";

  return {
    category,
    maxDistanceMiles: distanceMatch ? Number(distanceMatch[1]) : 5,
    pricePreference,
    mode,
    lateNight,
    wantsCheap
  };
}

function safeJsonParse(text: string): ParsedFilters | null {
  try {
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedFilters & { lateNight?: boolean; wantsCheap?: boolean };
    return {
      category: typeof parsed.category === "string" ? parsed.category.toLowerCase() : undefined,
      maxDistanceMiles:
        typeof parsed.maxDistanceMiles === "number" && parsed.maxDistanceMiles > 0
          ? Math.min(parsed.maxDistanceMiles, 10)
          : 5,
      pricePreference:
        parsed.pricePreference === "cheap" ||
        parsed.pricePreference === "moderate" ||
        parsed.pricePreference === "any"
          ? parsed.pricePreference
          : "any",
      mode: parsed.mode === "food" || parsed.mode === "drink" ? parsed.mode : undefined,
      lateNight: parsed.lateNight === true,
      wantsCheap: parsed.wantsCheap === true || parsed.pricePreference === "cheap"
    };
  } catch {
    return null;
  }
}

export async function parseQueryToFilters(query: string, skipGemini = false): Promise<ParsedFilters> {
  // If daily budget is exhausted or flag is set, skip Gemini entirely
  if (skipGemini) {
    return fallbackParse(query);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackParse(query);
  }

  const prompt = `
You extract search filters for MavEats, a student food finder for UTA (University of Texas at Arlington).
Return ONLY valid JSON (no markdown, no extra text) with keys:
category (string | undefined),
maxDistanceMiles (number),
pricePreference ("cheap" | "moderate" | "any"),
mode ("food" | "drink" | undefined),
lateNight (boolean),
wantsCheap (boolean).

Rules:
- Default maxDistanceMiles to 5 if user gives no distance.
- If user says "within X miles", use X.
- category should be one of: ${allowedCategories.join(", ")} when possible.
- "halal" queries must set category to "halal".
- "boba", "tea" queries must set category to "boba" and mode to "drink".
- "coffee" queries must set category to "coffee" and mode to "drink".
- "late night", "open late", "midnight food" must set lateNight to true.
- "cheap", "budget", "affordable", "$" must set pricePreference to "cheap" AND wantsCheap to true.
- food words (meal, lunch, dinner, eat, hungry) imply mode "food".
- drink words (drink, boba, tea, coffee, smoothie) imply mode "drink".
- If the query is general like "food near me" or "what should I eat", leave category undefined.

User query: "${query}"
`;

  try {
    // Abort if Gemini takes longer than 5 seconds
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 150  // small cap — we only need a tiny JSON object
        }
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return fallbackParse(query);
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
    const parsed = safeJsonParse(text);
    return parsed ?? fallbackParse(query);
  } catch {
    return fallbackParse(query);
  }
}

