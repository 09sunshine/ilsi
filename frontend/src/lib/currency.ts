/**
 * Universal Currency & Multi-Language Pricing Helper for ILSI Platform.
 * Supports USD ($) as primary currency for both English and French.
 */

export type SupportedCurrency = "USD" | "EUR";

export function getCurrencyForLocale(_locale: "en" | "fr" | string): SupportedCurrency {
  return "USD";
}

export function getCurrencySymbol(currency: string): string {
  switch (currency?.toUpperCase()) {
    case "EUR":
      return "€";
    case "USD":
    default:
      return "$";
  }
}

/**
 * Formats a monetary amount into the appropriate currency format.
 * Examples:
 *   formatPrice(180, "USD", "en") => "$180"
 *   formatPrice(180, "USD", "fr") => "$180"
 *   formatPrice(165, "EUR", "fr") => "165 €" (retained for historical euro donations/payments)
 */
export function formatPrice(
  amount: number,
  currency: string = "USD",
  locale: "en" | "fr" | string = "en"
): string {
  const curr = currency?.toUpperCase();
  const isFr = locale?.toLowerCase().startsWith("fr");

  if (curr === "EUR") {
    return isFr
      ? `${amount.toLocaleString("fr-FR")} €`
      : `€${amount.toLocaleString("en-US")}`;
  }

  // USD is formatted as $XX in both English and French
  return `$${amount.toLocaleString("en-US")}`;
}

/**
 * Retrieves the specific price, currency, symbol, and formatted string
 * for a program. Program prices are always in USD ($) for both English and French.
 */
export function getProgramPricing(
  program: { price: number; priceEur?: number; currency?: string },
  _locale: "en" | "fr" | string = "en"
): {
  amount: number;
  currency: SupportedCurrency;
  symbol: string;
  formatted: string;
} {
  const amount = typeof program?.price === "number" ? program.price : Number(program?.price) || 0;
  return {
    amount,
    currency: "USD",
    symbol: "$",
    formatted: `$${amount.toLocaleString("en-US")}`,
  };
}
