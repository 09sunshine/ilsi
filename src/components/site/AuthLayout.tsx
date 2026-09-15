import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, GraduationCap, Users, Video } from "lucide-react";
import { useI18n } from "@/i18n/LocaleProvider";

/**
 * Split-screen authentication layout on the dark hero background:
 * left = glassy form column, right = illustrated brand panel.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  top,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  top?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="hero-dark hero-grid-lines relative min-h-screen overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full gap-6 lg:grid-cols-2">
          {/* Form column */}
          <div className="auth-dark rounded-3xl border border-white/10 bg-white/[0.05] p-6 shadow-2xl backdrop-blur-md sm:p-10">
            <div className="mx-auto w-full max-w-sm">
              {top ? <div className="mb-6">{top}</div> : null}
              <Link
                to="/"
                className="mb-10 inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-white"
              >
                <span className="grid size-7 place-items-center rounded-lg bg-hero-lime text-hero-lime-foreground">
                  <GraduationCap className="size-4" />
                </span>
                ILSI
              </Link>

              <h1 className="font-display text-4xl font-bold tracking-tight text-white">{title}</h1>
              {subtitle ? (
                <p className="mt-3 text-sm leading-relaxed text-white/70">{subtitle}</p>
              ) : null}

              <div className="mt-8">{children}</div>

              {footer ? <div className="mt-10 text-center text-sm">{footer}</div> : null}
            </div>
          </div>

          {/* Brand panel */}
          <div className="relative hidden overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_10%,oklch(0.88_0.2_118/0.12),transparent_70%)]" />
            <div className="relative flex flex-1 items-center justify-center">
              <div className="relative w-full max-w-sm">
                <div className="absolute -left-4 -top-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-white backdrop-blur">
                  <span className="grid size-8 place-items-center rounded-full bg-hero-lime/15 text-hero-lime">
                    <Users className="size-4" />
                  </span>
                  <span className="text-xs font-medium">{t("auth.card1")}</span>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-white shadow-xl backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hero-lime">
                    {t("auth.moduleLabel")}
                  </p>
                  <p className="mt-2 text-lg font-semibold">{t("auth.moduleName")}</p>
                  <div className="mt-5 space-y-3">
                    {[t("auth.step1"), t("auth.step2"), t("auth.step3")].map((s, i) => (
                      <div key={s} className="flex items-center gap-2 text-sm">
                        <CheckCircle2
                          className={
                            i < 2 ? "size-4 text-hero-lime" : "size-4 text-white/30"
                          }
                        />
                        <span className={i < 2 ? "" : "text-white/50"}>{s}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{t("auth.progress")}</span>
                      <span className="font-semibold text-hero-lime">68%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-2 w-[68%] rounded-full bg-hero-lime" />
                    </div>
                  </div>
                </div>

                <div className="absolute -bottom-6 -right-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-white backdrop-blur">
                  <span className="grid size-8 place-items-center rounded-full bg-hero-lime/15 text-hero-lime">
                    <Video className="size-4" />
                  </span>
                  <span className="text-xs font-medium">{t("auth.card2")}</span>
                </div>
              </div>
            </div>

            <p className="relative mt-12 text-center font-display text-2xl font-semibold leading-snug text-white">
              {t("auth.tagline")} <span className="text-hero-lime">ILSI</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SocialRow() {
  const { t } = useI18n();
  return (
    <div className="mt-8">
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-white/15" />
        <span className="text-xs text-white/50">{t("auth.orContinue")}</span>
        <span className="h-px flex-1 bg-white/15" />
      </div>
      <div className="mt-5 flex justify-center gap-4">
        {["G", "", "f"].map((label, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${t("auth.orContinue")} ${label || "Apple"}`}
            className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/10 text-sm font-semibold text-white transition-colors hover:bg-hero-lime hover:text-hero-lime-foreground"
          >
            {label || "A"}
          </button>
        ))}
      </div>
    </div>
  );
}
