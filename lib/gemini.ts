import { ParsedFilters } from "@/lib/types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

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
  "chicken"
];

function fallbackParse(query: string): ParsedFilters {
  const lower = query.toLowerCase();
  const distanceMatch = lower.match(/within\s+(\d+(?:\.\d+)?)\s*mile/);
  const category = allowedCategories.find((entry) => lower.includes(entry));

  let pricePreference: ParsedFilters["pricePreference"] = "any";
  if (/(cheap|budget|low cost|inexpensive)/.test(lower)) {
    pricePreference = "cheap";
  } else if (/(moderate|mid|not too expensive)/.test(lower)) {
    pricePreference = "moderate";
  }

  let mode: ParsedFilters["mode"];
  if (/(drink|coffee|boba|tea|smoothie)/.test(lower)) {
    mode = "drink";
  } else if (/(food|meal|lunch|dinner|eat)/.test(lower)) {
    mode = "food";
  }

  return {
    category,
    maxDistanceMiles: distanceMatch ? Number(distanceMatch[1]) : 5,
    pricePreference,
    mode
  };
}

function safeJsonParse(text: string): ParsedFilters | null {
  try {
    const cleaned = text.replace(/```json|```/gi, "").trim();
    const parsed = JSON.parse(cleaned) as ParsedFilters;
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
      mode: parsed.mode === "food" || parsed.mode === "drink" ? parsed.mode : undefined
    };
  } catch {
    return null;
  }
}

export async function parseQueryToFilters(query: string): Promise<ParsedFilters> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fallbackParse(query);
  }

  const prompt = `
You extract search filters for a restaurant recommendation app near UTA.
Return ONLY valid JSON (no markdown, no extra text) with keys:
category (string | undefined),
maxDistanceMiles (number),
pricePreference ("cheap" | "moderate" | "any"),
mode ("food" | "drink" | undefined).

Rules:
- Default maxDistanceMiles to 5 if user gives no distance.
- If user says "within X miles", use X.
- category should be one of: ${allowedCategories.join(", ")} when possible.
- "boba", "tea", "coffee", "drink spot" imply mode "drink".
- food words imply mode "food".
- cheap/budget => "cheap"; moderate/mid-range => "moderate"; else "any".

User query: "${query}"
`;

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0 }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return fallbackParse(query);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n") ?? "";
  const parsed = safeJsonParse(text);
  return parsed ?? fallbackParse(query);
}
