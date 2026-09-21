/**
 * Auto-translation and currency conversion utilities for ILSI Cohort Learning
 */

// Exchange rate: 1 USD = 0.92 EUR (approximate standard cohort learning conversion)
export const USD_TO_EUR_RATE = 0.92;

export function convertUsdToEur(usd: number): number {
  if (isNaN(usd) || usd < 0) return 0;
  return Math.round(usd * USD_TO_EUR_RATE);
}

export function convertEurToUsd(eur: number): number {
  if (isNaN(eur) || eur < 0) return 0;
  return Math.round(eur / USD_TO_EUR_RATE);
}

// In-memory translation cache to prevent repeated API calls
const translationCache = new Map<string, string>();

/**
 * Bi-directional translation between English and French
 * @param text The source text to translate
 * @param from Source language ('en' | 'fr')
 * @param to Target language ('en' | 'fr')
 */
export async function translateText(
  text: string,
  from: "en" | "fr",
  to: "en" | "fr"
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || from === to) return trimmed;

  const cacheKey = `${from}:${to}:${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        trimmed
      )}&langpair=${from}|${to}`
    );
    if (!res.ok) {
      throw new Error(`Translation failed: ${res.status}`);
    }
    const json = await res.json();
    const translated = json.responseData?.translatedText;
    if (translated && typeof translated === "string" && !translated.startsWith("MYMEMORY WARNING")) {
      translationCache.set(cacheKey, translated);
      return translated;
    }
    return trimmed;
  } catch (err) {
    console.warn("Translation service notice:", err);
    return trimmed;
  }
}
