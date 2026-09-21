/**
 * Universal Currency & Multi-Language Pricing Helper for ILSI Platform.
 * Supports English (USD $) and French (EUR €).
 */

export type SupportedCurrency = "USD" | "EUR";

export function getCurrencyForLocale(locale: "en" | "fr" | string): SupportedCurrency {
  return locale?.toLowerCase().startsWith("fr") ? "EUR" : "USD";
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
 *   formatPrice(165, "EUR", "fr") => "165 €"
 */
export function formatPrice(
  amount: number,
  currency: string = "USD",
  locale: "en" | "fr" | string = "en"
): string {
  const curr = currency.toUpperCase();
  const isFr = locale?.toLowerCase().startsWith("fr");

  if (curr === "EUR") {
    return isFr
      ? `${amount.toLocaleString("fr-FR")} €`
      : `€${amount.toLocaleString("en-US")}`;
  }

  // Default USD
  return isFr
    ? `${amount.toLocaleString("fr-FR")} $`
    : `$${amount.toLocaleString("en-US")}`;
}

/**
 * Retrieves the specific price, currency, symbol, and formatted string
 * for a program based on the user's active locale (en -> USD, fr -> EUR).
 */
export function getProgramPricing(
  program: { price: number; priceEur?: number; currency?: string },
  locale: "en" | "fr" | string = "en"
): {
  amount: number;
  currency: SupportedCurrency;
  symbol: string;
  formatted: string;
} {
  const isFr = locale?.toLowerCase().startsWith("fr");
  if (isFr) {
    const amount =
      typeof program.priceEur === "number" && program.priceEur > 0
        ? program.priceEur
        : Math.round(program.price * 0.92);
    return {
      amount,
      currency: "EUR",
      symbol: "€",
      formatted: `${amount.toLocaleString("fr-FR")} €`,
    };
  }

  const amount = program.price;
  return {
    amount,
    currency: "USD",
    symbol: "$",
    formatted: `$${amount.toLocaleString("en-US")}`,
  };
}
