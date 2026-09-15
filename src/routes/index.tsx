import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  GraduationCap,
  Lock,
  MessagesSquare,
  Star,
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();
  const L = useLocalized();

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
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 lg:pb-20 lg:pt-20">
          <div className="relative mx-auto max-w-4xl text-center">
            <div className="absolute -left-4 top-28 hidden size-12 place-items-center rounded-full border border-primary text-primary lg:grid">
              <ArrowUpRight className="size-5" aria-hidden />
            </div>
            <div className="absolute -right-1 top-28 hidden size-10 place-items-center rounded-full border border-primary text-primary lg:grid">
              <BookOpenCheck className="size-4" aria-hidden />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("home.badge")}
            </p>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-6xl">
              {t("home.heroLead")} {" "}
              <span className="text-primary">{t("home.heroAccent")}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {t("home.subtitle")}
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
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
            <div className="mt-7 flex items-center justify-center gap-2 text-sm">
              <span className="flex text-warning" aria-label="Rated five out of five">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star key={index} className="size-4 fill-current" aria-hidden />
                ))}
              </span>
              <span className="font-semibold">4.9</span>
              <span className="text-muted-foreground">{t("home.heroRating")}</span>
            </div>
          </div>

          <div className="mt-12 grid auto-rows-[176px] grid-cols-2 gap-3 sm:grid-cols-6 lg:mt-14 lg:grid-cols-12 lg:items-end">
            <div className="relative col-span-2 overflow-hidden rounded-lg border border-border sm:col-span-3 lg:col-span-3 lg:h-[232px]">
              <img
                src={heroImage}
                width={1408}
                height={1008}
                alt="Participants collaborating during an ILSI cohort session"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-3 top-3 grid size-8 place-items-center rounded-full bg-card text-primary shadow-[var(--shadow-soft)]">
                <GraduationCap className="size-4" aria-hidden />
              </span>
            </div>

            <div className="col-span-2 flex flex-col justify-center rounded-lg bg-primary p-5 text-primary-foreground sm:col-span-3 lg:col-span-2 lg:h-[176px]">
              <Users className="size-5 opacity-80" aria-hidden />
              <p className="mt-4 font-display text-3xl font-semibold">1,240+</p>
              <p className="mt-1 text-sm opacity-80">{t("home.heroLearners")}</p>
            </div>

            <div className="col-span-2 flex flex-col justify-center rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:col-span-3 lg:col-span-3 lg:h-[150px]">
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-md bg-accent text-accent-foreground">
                  <BarChart3 className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-medium text-success">+12%</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t("home.statsCompletion")}</p>
              <p className="mt-1 font-display text-3xl font-semibold">87%</p>
            </div>

            <div className="col-span-2 flex flex-col items-center justify-center rounded-lg bg-accent p-5 text-center text-accent-foreground sm:col-span-3 lg:col-span-2 lg:h-[176px]">
              <Award className="size-5" aria-hidden />
              <p className="mt-3 font-display text-3xl font-semibold">6</p>
              <p className="mt-1 text-sm">{t("home.statsPrograms")}</p>
            </div>

            <div className="col-span-2 flex flex-col justify-end rounded-lg bg-foreground p-5 text-background sm:col-span-6 lg:col-span-2 lg:h-[232px]">
              <CalendarClock className="size-6" aria-hidden />
              <p className="mt-5 font-display text-xl font-semibold">{t("home.heroRhythm")}</p>
              <p className="mt-2 text-sm opacity-75">{t("home.heroPath")}</p>
            </div>
          </div>
        </div>
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
