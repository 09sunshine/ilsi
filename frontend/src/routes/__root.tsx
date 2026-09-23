import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LocaleProvider } from "@/i18n/LocaleProvider";
import { LearningProvider } from "@/features/learning/LearningProvider";
import { Toaster } from "@/components/ui/sonner";
import { setStoredSessionToken } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=5" },
      { name: "theme-color", content: "#09090b" },
      { name: "author", content: "ILSI Leadership Institute" },
      { title: "ILSI — Cohort-based leadership training" },
      {
        name: "description",
        content:
          "ILSI runs structured, time-bound training cohorts with scheduled modules, quizzes and live debriefs.",
      },
      { property: "og:site_name", content: "ILSI Cohort Learning" },
      { property: "og:title", content: "ILSI — Cohort-based leadership training" },
      {
        property: "og:description",
        content: "Structured training cohorts with scheduled modules, quizzes and live debriefs.",
      },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "/hero-cohort.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "ILSI Cohort Learning Platform" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "ILSI — Cohort-based leadership training" },
      {
        name: "twitter:description",
        content: "Structured training cohorts with scheduled modules, quizzes and live debriefs.",
      },
      { name: "twitter:image", content: "/hero-cohort.jpg" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Sync Better Auth session to localStorage for Bearer token fallback (supports Incognito / cross-domain)
      authClient.getSession().then((res: any) => {
        if (res?.data?.session?.token) {
          setStoredSessionToken(res.data.session.token);
        }
      }).catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <LearningProvider>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
          <Toaster position="top-right" richColors />
        </LearningProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
