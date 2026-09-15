import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Check, Clock, Users } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cohortsForProgram, modules, programBySlug } from "@/data/demo";

export const Route = createFileRoute("/programs/$slug")({
  loader: ({ params }) => {
    const program = programBySlug(params.slug);
    if (!program) throw notFound();
    return { slug: params.slug };
  },
  head: ({ params }) => {
    const program = programBySlug(params.slug);
    const title = program ? `${program.title.en} — ILSI` : "Program — ILSI";
    const description = program?.tagline.en ?? "ILSI training program";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  notFoundComponent: ProgramNotFound,
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
  const program = programBySlug(slug)!;
  const cohorts = cohortsForProgram(program.id);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <PublicShell>
      <div className="hero-dark hero-grid-lines relative isolate text-hero-foreground">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
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
                <Badge variant="secondary">
                  <Clock className="size-3.5" /> {program.durationWeeks} {t("programs.weeks")}
                </Badge>
                <Badge variant="secondary">
                  <CalendarDays className="size-3.5" /> {program.moduleCount} {t("programs.modules")}
                </Badge>
                <Badge variant="secondary">
                  <Users className="size-3.5" /> {L(program.format)}
                </Badge>
              </div>
            </div>
            <div className="panel h-fit p-6">
              <p className="text-sm text-muted-foreground">{t("programs.cohorts")}</p>
              <ul className="mt-3 space-y-3">
                {cohorts.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">{L(c.name)}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(c.startDate)} → {fmt(c.endDate)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.enrolled}/{c.capacity} · {c.status}
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
              {modules.map((m) => (
                <li key={m.id} className="panel p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-base font-semibold">
                      {m.order}. {L(m.title)}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {fmt(m.startDate)} → {fmt(m.endDate)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{L(m.description)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {m.lessons.length} {locale === "fr" ? "leçons" : "lessons"} · {m.estimatedHours}h
                    · {t("quiz.passing")} {m.passingScore}%
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
              {program.audience.map((a) => (
                <li key={a.en} className="flex gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {L(a)}
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-6">
            <h2 className="font-display text-lg font-semibold">{t("programs.outcomes")}</h2>
            <ul className="mt-3 space-y-2">
              {program.outcomes.map((o) => (
                <li key={o.en} className="flex gap-2 text-sm text-muted-foreground">
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
