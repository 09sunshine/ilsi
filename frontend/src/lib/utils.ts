import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function resolveMediaUrl(url?: string | null | any): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  const apiBase = ((import.meta.env as any).VITE_BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");

  // If already a backend proxy URL, return as-is
  if (trimmed.includes("/api/media/proxy")) {
    return trimmed.startsWith("http") ? trimmed : `${apiBase}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  }

  // Route Supabase storage URLs through the backend media proxy to prevent:
  // 1. Browser adblockers / Brave Shields blocking supabase.co domains (net::ERR_BLOCKED_BY_CLIENT)
  // 2. Cross-origin / mixed-content / third-party cookie restrictions
  // 3. Network timeouts by leveraging local backend disk & memory caching
  if (trimmed.includes("supabase.co/storage")) {
    return `${apiBase}/api/media/proxy?url=${encodeURIComponent(trimmed)}`;
  }

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${apiBase}${cleanPath}`;
}
