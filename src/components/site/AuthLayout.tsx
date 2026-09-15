import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Check, GraduationCap, Lock } from "lucide-react";
import { useI18n } from "@/i18n/LocaleProvider";

/**
 * Authentication layout: soft light page with a top brand bar, a dark
 * editorial promo panel on the left and a light form card on the right.
 */
export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  top,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  top?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f2f3f5] px-3 py-3 sm:px-5 sm:py-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(45%_35%_at_0%_0%,oklch(0.95_0.14_118/0.55),transparent_60%),radial-gradient(45%_35%_at_100%_0%,oklch(0.9_0.07_265/0.45),transparent_60%),radial-gradient(50%_40%_at_100%_100%,oklch(0.93_0.1_118/0.35),transparent_65%)]" />

      <div className="relative z-10 mx-auto w-full max-w-6xl">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 shadow-sm sm:px-5">
          <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-neutral-900">
            <span className="grid size-8 place-items-center rounded-lg bg-neutral-900 text-white">
              <GraduationCap className="size-4" />
            </span>
            ILSI
          </Link>
          <p className="hidden items-center gap-2 text-xs text-neutral-500 sm:flex">
            <span className="size-1.5 rounded-full bg-hero-lime" />
            {t("auth.topNote")}
          </p>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {/* Dark promo panel */}
          <div className="relative hidden overflow-hidden rounded-[28px] bg-[#101210] p-8 lg:flex lg:flex-col sm:p-10">
            <div className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(255,255,255,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.14)_1px,transparent_1px)] [background-size:44px_44px]" />
            <div className="pointer-events-none absolute -right-10 -top-16 size-72 rounded-full bg-hero-lime/40 blur-[90px]" />
            <div className="pointer-events-none absolute right-24 top-10 size-12 rounded-full bg-hero-lime blur-xl" />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                <span className="size-1.5 rounded-full bg-hero-lime" />
                {t("auth.badge")}
              </span>

              <h2 className="mt-8 font-display text-5xl font-bold leading-[1.02] tracking-tight text-white">
                {t("auth.headline1")}
                <br />
                {t("auth.headline2")} <span className="text-hero-lime">{t("auth.headlineAccent")}</span>
              </h2>

              <p className="mt-6 max-w-sm text-sm leading-relaxed text-white/60">{t("auth.blurb")}</p>
            </div>

            {/* Floating glass graphic */}
            <div className="relative mt-auto pt-14">
              <div className="absolute -left-2 bottom-24 size-28 rounded-full bg-[radial-gradient(circle,oklch(0.75_0.12_300/0.7),transparent_70%)] blur-lg" />
              <div className="absolute -right-6 bottom-0 size-24 rounded-full border border-white/15" />

              <div className="relative rotate-[-2deg] rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-md">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-medium text-white/85">{t("auth.graphicTitle")}</p>
                  <span className="rounded-full bg-hero-lime px-3 py-1 text-[11px] font-semibold text-hero-lime-foreground">
                    {t("auth.graphicChip")}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <GraphicRow
                    icon={<ArrowUpRight className="size-4" />}
                    title={t("auth.rowA")}
                    sub={t("auth.rowASub")}
                    status={t("auth.statusOpen")}
                  />
                  <GraphicRow
                    icon={<Check className="size-4" />}
                    title={t("auth.rowB")}
                    sub={t("auth.rowBSub")}
                    status={t("auth.statusDone")}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="rounded-[28px] bg-white/85 p-6 shadow-sm backdrop-blur-sm sm:p-12">
            <div className="mx-auto w-full max-w-sm">
              {top ? <div className="mb-6">{top}</div> : null}

              {eyebrow ? <p className="text-sm text-neutral-500">{eyebrow}</p> : null}
              <h1 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 text-sm leading-relaxed text-neutral-500">{subtitle}</p>
              ) : null}

              <div className="mt-7">{children}</div>

              {footer ? (
                <div className="mt-6 text-center text-sm text-neutral-600">{footer}</div>
              ) : null}

              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-neutral-400">
                <Lock className="size-3" />
                {t("auth.secure")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphicRow({
  icon,
  title,
  sub,
  status,
}: {
  icon: ReactNode;
  title: string;
  sub: string;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 text-hero-lime">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        <p className="truncate text-xs text-white/50">{sub}</p>
      </div>
      <span className="rounded-full bg-hero-lime/90 px-3 py-1 text-[11px] font-semibold text-hero-lime-foreground">
        {status}
      </span>
    </div>
  );
}

/** Label + input field group styled for the light form card. */
export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-neutral-800">
      {children}
    </label>
  );
}

export const authInputClass =
  "h-12 rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:border-neutral-900 focus-visible:ring-0";

export const authSubmitClass =
  "h-12 w-full rounded-xl bg-neutral-900 text-white hover:bg-neutral-800";

export function SocialRow() {
  const { t } = useI18n();
  return (
    <div className="mt-6">
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-xs text-neutral-400">{t("auth.orContinue")}</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      <button
        type="button"
        className="mt-5 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
      >
        <GoogleMark />
        {t("auth.google")}
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.5c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.7-10.1 6.7-17.3z" />
      <path fill="#FBBC05" d="M10.4 28.7a14.5 14.5 0 010-9.4l-7.8-6.1a24 24 0 000 21.6l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-8.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
