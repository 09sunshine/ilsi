import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="hero-dark hero-grid-lines relative isolate text-hero-foreground">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hero-foreground/60">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 max-w-3xl font-display text-3xl font-semibold sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-hero-foreground/70">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
