import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, GraduationCap, Users, Video } from "lucide-react";
import { useI18n } from "@/i18n/LocaleProvider";

/**
 * Split-screen authentication layout:
 * left = form column, right = illustrated brand panel.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background p-3 sm:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-6xl gap-6 rounded-3xl lg:grid-cols-2">
        {/* Form column */}
        <div className="flex flex-col justify-center px-2 py-10 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            <Link
              to="/"
              className="mb-10 inline-flex items-center gap-2 text-sm font-semibold tracking-tight"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="size-4" />
              </span>
              ILSI
            </Link>

            <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            ) : null}

            <div className="mt-8">{children}</div>

            {footer ? <div className="mt-10 text-center text-sm">{footer}</div> : null}
          </div>
        </div>

        {/* Brand panel */}
        <div className="relative hidden overflow-hidden rounded-3xl bg-accent/40 p-10 lg:flex lg:flex-col lg:justify-between">
          <div className="relative flex flex-1 items-center justify-center">
            <div className="relative w-full max-w-sm">
              <div className="absolute -left-4 -top-6 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
                <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <Users className="size-4" />
                </span>
                <span className="text-xs font-medium">{t("auth.card1")}</span>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("auth.moduleLabel")}
                </p>
                <p className="mt-2 text-lg font-semibold">{t("auth.moduleName")}</p>
                <div className="mt-5 space-y-3">
                  {[t("auth.step1"), t("auth.step2"), t("auth.step3")].map((s, i) => (
                    <div key={s} className="flex items-center gap-2 text-sm">
                      <CheckCircle2
                        className={i < 2 ? "size-4 text-primary" : "size-4 text-muted-foreground/40"}
                      />
                      <span className={i < 2 ? "" : "text-muted-foreground"}>{s}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("auth.progress")}</span>
                    <span className="font-semibold text-foreground">68%</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-2 w-[68%] rounded-full bg-primary" />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-6 -right-4 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-sm">
                <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
                  <Video className="size-4" />
                </span>
                <span className="text-xs font-medium">{t("auth.card2")}</span>
              </div>
            </div>
          </div>

          <p className="mt-12 text-center font-display text-2xl font-semibold leading-snug">
            {t("auth.tagline")} <span className="text-primary">ILSI</span>
          </p>
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
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t("auth.orContinue")}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-5 flex justify-center gap-4">
        {["G", "", "f"].map((label, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${t("auth.orContinue")} ${label || "Apple"}`}
            className="grid size-11 place-items-center rounded-full bg-foreground text-sm font-semibold text-background transition-opacity hover:opacity-85"
          >
            {label || "A"}
          </button>
        ))}
      </div>
    </div>
  );
}
