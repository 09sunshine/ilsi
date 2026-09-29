/**
 * Utility to transform raw errors, database exceptions, HTML stack traces,
 * and technical validation payloads into friendly, human-language messages.
 */

export function formatHumanErrorMessage(raw: any, fallback = "An unexpected error occurred. Please try again."): string {
  if (!raw) return fallback;

  // If Error instance, extract message and details
  let msg = typeof raw === "string" ? raw : raw?.message || raw?.error?.message || raw?.error || fallback;
  const details = raw?.details || raw?.error?.details;

  if (typeof msg !== "string") {
    try {
      msg = JSON.stringify(msg);
    } catch {
      msg = String(msg);
    }
  }

  // 1. Detect HTML error responses (e.g. Express 404, nginx 502/504, cloudflare HTML)
  if (msg.includes("<!DOCTYPE") || msg.includes("<html") || msg.includes("<pre>") || msg.includes("<title>")) {
    if (msg.includes("Cannot PATCH") || msg.includes("Cannot POST") || msg.includes("Cannot GET") || msg.includes("Cannot DELETE")) {
      const match = msg.match(/Cannot\s+(PATCH|POST|GET|DELETE)\s+([^\s<]+)/i);
      if (match) {
        return `The requested action (${match[1]} on ${match[2]}) is currently unavailable. Please verify the endpoint or contact support.`;
      }
      return "The requested action or service is currently unavailable. Please try again later.";
    }

    if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
      return "The requested page or resource could not be found.";
    }
    if (msg.includes("502") || msg.toLowerCase().includes("bad gateway")) {
      return "The server is temporarily unreachable. Please try again in a few moments.";
    }
    if (msg.includes("504") || msg.toLowerCase().includes("gateway timeout")) {
      return "The server took too long to respond. Please check your connection and try again.";
    }
    return "A server communication error occurred. Please refresh the page and try again.";
  }

  // 2. Postgres Database Constraints & Exceptions
  if (msg.includes("violates not-null constraint")) {
    const colMatch = msg.match(/column "(.*?)" of relation/);
    if (colMatch) {
      const colName = colMatch[1].replace(/_/g, " ");
      return `Please fill in the required field: ${colName}.`;
    }
    return "A required field was left blank. Please fill in all required fields and try again.";
  }

  if (msg.includes("violates unique constraint") || msg.includes("already exists")) {
    const keyMatch = msg.match(/Key \((.*?)\)=\((.*?)\) already exists/);
    if (keyMatch) {
      const field = keyMatch[1].replace(/_/g, " ");
      return `An item with this ${field} ("${keyMatch[2]}") already exists. Please choose a different value.`;
    }
    return "A record with this information already exists. Please check your inputs.";
  }

  if (msg.includes("violates foreign key constraint")) {
    return "The referenced module, lesson, or resource is no longer available or has been deleted.";
  }

  if (msg.includes("invalid input syntax for type uuid") || msg.includes("invalid input syntax")) {
    return "Invalid data format provided. Please reload the page and try again.";
  }

  // 3. Technical validation messages (e.g. Zod "Invalid request payload")
  if (msg.toLowerCase().includes("invalid request payload") || msg.toLowerCase() === "validation error") {
    if (Array.isArray(details) && details.length > 0) {
      const formatted = details
        .map((d: any) => {
          const field = d.path ? String(d.path).replace(/_/g, " ").replace(/\./g, " ") : "";
          const fCapitalized = field ? field.charAt(0).toUpperCase() + field.slice(1) + ": " : "";
          return `${fCapitalized}${d.message}`;
        })
        .slice(0, 3)
        .join(". ");
      return formatted || "Please check your inputs and ensure all required fields are filled out.";
    }
    return "Please verify your input details. One or more fields need your attention.";
  }

  // 4. Network and browser fetch errors
  if (msg === "Failed to fetch" || msg.includes("NetworkError") || msg.includes("Load failed")) {
    return "Unable to connect to the server. Please check your internet connection.";
  }

  // 5. Clean up any remaining JSON or code snippets
  if (msg.startsWith("{") && msg.endsWith("}")) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.message) return formatHumanErrorMessage(parsed.message, fallback);
      if (parsed.error) return formatHumanErrorMessage(parsed.error, fallback);
    } catch {
      // ignore
    }
  }

  return msg;
}
