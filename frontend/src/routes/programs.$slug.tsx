import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Check, Clock, Users } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { getProgramPricing } from "@/lib/currency";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";

export const Route = createFileRoute("/programs/$slug")({
  loader: ({ params }) => {
    return { slug: params.slug };
  },
  head: ({ params }) => {
    const slugName = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const title = `${slugName} — ILSI`;
    const description = `${slugName} leadership training program by ILSI`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: ProgramDetail,
});

function ProgramNotFound() {
  const { t } = useI18n();
  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">{t("programs.notFound")}</h1>
        <Button asChild className="mt-6">
          <Link to="/programs">{t("programs.title")}</Link>
        </Button>
      </div>
    </PublicShell>
  );
}

function ProgramDetail() {
  const { slug } = Route.useLoaderData();
  const { t, locale } = useI18n();
  const L = useLocalized();

  const [program, setProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDetail() {
      try {
        const live = await api.getProgramBySlug(slug);
        if (live && live.id) {
          setProgram(live);
        }
      } catch (err) {
        console.warn("Could not fetch program detail:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [slug]);

  if (!program && !loading) {
    return <ProgramNotFound />;
  }

  if (!program) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-6xl px-4 py-32 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PublicShell>
    );
  }

  const cohorts = program.cohorts || [];
  const rawModules = program.modules || [];

  const fmt = (d?: string) => {
    if (!d) return "";
    try {
      return new Date(d).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const thumbnail = resolveMediaUrl(
    program.thumbnailUrl ||
    program.thumbnail_url ||
    cohorts?.[0]?.thumbnailUrl ||
    cohorts?.[0]?.thumbnail_url
  );

  return (
    <PublicShell>
      <div className="hero-dark hero-grid-lines relative isolate text-hero-foreground">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:pb-20 lg:pt-32">
          <Link
            to="/programs"
            className="inline-flex items-center gap-1.5 text-sm text-hero-foreground/70 transition hover:text-hero-foreground"
          >
            <ArrowLeft className="size-4" /> {t("programs.title")}
          </Link>
          <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h1 className="font-display text-3xl font-semibold sm:text-4xl lg:text-5xl">{L(program.title)}</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-hero-foreground/70">
                {L(program.tagline)}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="secondary" className="font-semibold text-brand-orange">
                  {getProgramPricing(program, locale).formatted}
                </Badge>
                <Badge variant="secondary">
                  <Clock className="size-3.5" /> {program.durationWeeks || 6} {t("programs.weeks")}
                </Badge>
                <Badge variant="secondary">
                  <CalendarDays className="size-3.5" /> {program.moduleCount || rawModules.length || 6} {t("programs.modules")}
                </Badge>
                <Badge variant="secondary">
                  <Users className="size-3.5" /> {program.format ? L(program.format) : "Cohort-Based"}
                </Badge>
              </div>
            </div>
            <div className="panel h-fit p-6 overflow-hidden">
              {thumbnail && (
                <div className="mb-5 -mx-6 -mt-6 overflow-hidden rounded-t-xl aspect-[16/9] bg-muted">
                  <img
                    src={thumbnail}
                    alt={L(program.title)}
                    className="size-full object-cover"
                  />
                </div>
              )}
              <div className="flex items-baseline justify-between border-b border-border pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("programs.price")}</span>
                <span className="font-display text-2xl font-bold text-foreground">
                  {getProgramPricing(program, locale).formatted}
                </span>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{t("programs.cohorts")}</p>
              <ul className="mt-3 space-y-3">
                {cohorts.map((c: any) => (
                  <li key={c.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">{L(c.name)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(c.startDate)} → {fmt(c.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.enrolled || 0}/{c.capacity || 30} · {c.status || "UPCOMING"}
                    </p>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-5 w-full">
                <Link to="/apply" search={{ program: program.slug }}>
                  {t("programs.applyCta")}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:py-20">
        <div className="space-y-10">
          <div>
            <h2 className="font-display text-2xl font-semibold">{t("programs.overview")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {L(program.description)}
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-semibold">{t("programs.curriculum")}</h2>
            <ol className="mt-4 space-y-3">
              {rawModules.map((m: any) => (
                <li key={m.id || m.order} className="panel p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-base font-semibold">
                      {m.order || m.orderIndex}. {L(m.title)}
                    </h3>
                    {m.startDate && m.endDate ? (
                      <span className="text-xs text-muted-foreground">
                        {fmt(m.startDate)} → {fmt(m.endDate)}
                      </span>
                    ) : null}
                  </div>
                  {m.description ? (
                    <p className="mt-1.5 text-sm text-muted-foreground">{L(m.description)}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {m.lessonCount !== undefined ? `${m.lessonCount} ` : `${m.lessons?.length || 4} `}
                    {locale === "fr" ? "leçons" : "lessons"} · {m.estimatedHours || 4}h
                    · {t("quiz.passing")} {m.passingScore || 70}%
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <aside className="space-y-8">
          <div className="panel p-6">
            <h2 className="font-display text-lg font-semibold">{t("programs.audience")}</h2>
            <ul className="mt-3 space-y-2">
              {(program.audience || []).map((a: any, idx: number) => (
                <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {L(a)}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-6">
            <h2 className="font-display text-lg font-semibold">{t("programs.outcomes")}</h2>
            <ul className="mt-3 space-y-2">
              {(program.outcomes || []).map((o: any, idx: number) => (
                <li key={idx} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {L(o)}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </section>
    </PublicShell>
  );
}
