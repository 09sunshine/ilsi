import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Lock,
  MessagesSquare,
  Users,
  Video,
} from "lucide-react";
import heroImage from "@/assets/hero-cohort.jpg";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { programs } from "@/data/demo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ILSI — Cohort-based training that people finish" },
      {
        name: "description",
        content:
          "ILSI runs guided training cohorts: scheduled modules, quizzes that gate progress, and a live debrief with a trainer after every module.",
      },
      { property: "og:title", content: "ILSI — Cohort-based training that people finish" },
      {
        property: "og:description",
        content: "Scheduled modules, merit-based unlocking and live debriefs with a trainer.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();
  const L = useLocalized();

  const stats = [
    { value: "1,240", label: t("home.statsCohort") },
    { value: "87%", label: t("home.statsCompletion") },
    { value: "6", label: t("home.statsPrograms") },
    { value: "48", label: t("home.statsSessions") },
  ];

  const problems = [
    { icon: CalendarClock, title: t("home.p1Title"), body: t("home.p1Body") },
    { icon: FileCheck2, title: t("home.p2Title"), body: t("home.p2Body") },
    { icon: Users, title: t("home.p3Title"), body: t("home.p3Body") },
  ];

  const steps = [
    { icon: FileCheck2, title: t("home.s1Title"), body: t("home.s1Body") },
    { icon: CheckCircle2, title: t("home.s2Title"), body: t("home.s2Body") },
    { icon: Lock, title: t("home.s3Title"), body: t("home.s3Body") },
    { icon: MessagesSquare, title: t("home.s4Title"), body: t("home.s4Body") },
    { icon: Video, title: t("home.s5Title"), body: t("home.s5Body") },
  ];

  return (
    <PublicShell>
      {/* Hero */}
      <section className="hero-wash border-b border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-14 lg:py-24">
          <div>
            <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("home.badge")}
            </span>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
              {t("home.title")}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("home.subtitle")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/apply">
                  {t("home.ctaPrimary")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/programs">{t("home.ctaSecondary")}</Link>
              </Button>
            </div>
          </div>
          <div className="relative">
            <img
              src={heroImage}
              width={1408}
              height={1008}
              alt="Participants working together during an ILSI training session"
              className="aspect-[7/5] w-full rounded-2xl border border-border object-cover shadow-[var(--shadow-lift)]"
            />
            <div className="panel absolute -bottom-6 left-4 hidden w-64 p-4 sm:block">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("dash.nextLive")}
              </p>
              <p className="mt-1 font-display text-sm font-semibold">Module 1 debrief</p>
              <p className="text-sm text-muted-foreground">15 Oct · 18:00</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border bg-card">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className="font-display text-3xl font-semibold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("home.problemTag")}
        </p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {t("home.problemTitle")}
          </h2>
          <p className="self-end text-sm leading-relaxed text-muted-foreground">
            {t("home.problemBody")}
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {problems.map((p) => (
            <div key={p.title} className="panel p-6">
              <p.icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("home.howTag")}
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">{t("home.howTitle")}</h2>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.title} className="panel flex h-full flex-col p-5">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <s.icon className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Programs */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("home.programsTag")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{t("home.programsTitle")}</h2>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t("home.programsBody")}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/programs">
              {t("programs.title")} <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {programs.map((p) => (
            <Link
              key={p.id}
              to="/programs/$slug"
              params={{ slug: p.slug }}
              className="panel group flex flex-col p-6 transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {p.durationWeeks} {t("programs.weeks")} · {p.moduleCount} {t("programs.modules")}
              </p>
              <h3 className="mt-3 font-display text-xl font-semibold">{L(p.title)}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {L(p.tagline)}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                {t("programs.view")}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] md:items-center lg:py-20">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">{t("home.ctaTitle")}</h2>
            <p className="mt-3 max-w-xl text-sm opacity-90">{t("home.ctaBody")}</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link to="/apply">
              {t("nav.apply")}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </PublicShell>
  );
}
