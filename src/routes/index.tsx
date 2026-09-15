import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileCheck2,
  GraduationCap,
  Layers,
  Lock,
  MessagesSquare,
  Star,
  Users,
  Video,
} from "lucide-react";
import heroImage from "@/assets/hero-cohort.jpg";
import youngLeadersImg from "@/assets/program-young-leaders.jpg";
import publicCommunicationImg from "@/assets/program-public-communication.jpg";
import projectManagementImg from "@/assets/program-project-management.jpg";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { programs } from "@/data/demo";

const programImage: Record<string, string> = {
  "young-leaders": youngLeadersImg,
  "public-communication": publicCommunicationImg,
  "project-management-essentials": projectManagementImg,
};

const programCategory: Record<string, string> = {
  "young-leaders": "leadership",
  "public-communication": "communication",
  "project-management-essentials": "project",
};

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

  const cohortBenefits = [
    { title: t("home.p1Title"), body: t("home.p1Body") },
    { title: t("home.p2Title"), body: t("home.p2Body") },
    { title: t("home.p3Title"), body: t("home.p3Body") },
  ];

  const steps = [
    { icon: FileCheck2, title: t("home.s1Title"), body: t("home.s1Body") },
    { icon: CheckCircle2, title: t("home.s2Title"), body: t("home.s2Body") },
    { icon: Lock, title: t("home.s3Title"), body: t("home.s3Body") },
    { icon: MessagesSquare, title: t("home.s4Title"), body: t("home.s4Body") },
    { icon: Video, title: t("home.s5Title"), body: t("home.s5Body") },
    { icon: Award, title: t("home.s6Title"), body: t("home.s6Body") },
  ];

  return (
    <PublicShell>
      {/* Hero */}
      <section className="hero-wash border-b border-border">
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

      {/* Why cohorts */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 lg:py-24">
          <div className="relative mx-auto w-full max-w-lg rounded-lg bg-surface px-5 py-9 sm:px-10 sm:py-12" aria-label={t("home.cohortVisualLabel")}>
            <div className="w-[78%] rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <p className="text-xs text-muted-foreground">{t("home.cohortProgress")}</p>
              <div className="mt-1 flex items-end gap-2">
                <p className="font-display text-2xl font-semibold">87%</p>
                <span className="mb-1 text-xs font-medium text-success">+12%</span>
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <div className="space-y-3 text-[11px] text-muted-foreground">
                  <div className="grid grid-cols-[72px_1fr_28px] items-center gap-2">
                    <span>{t("home.cohortCompleted")}</span>
                    <span className="h-2 rounded-sm bg-muted"><span className="block h-full w-[87%] rounded-sm bg-primary" /></span>
                    <span className="text-right text-foreground">87%</span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr_28px] items-center gap-2">
                    <span>{t("home.cohortActive")}</span>
                    <span className="h-2 rounded-sm bg-muted"><span className="block h-full w-[64%] rounded-sm bg-success" /></span>
                    <span className="text-right text-foreground">64%</span>
                  </div>
                  <div className="grid grid-cols-[72px_1fr_28px] items-center gap-2">
                    <span>{t("home.cohortSupport")}</span>
                    <span className="h-2 rounded-sm bg-muted"><span className="block h-full w-[94%] rounded-sm bg-accent-foreground" /></span>
                    <span className="text-right text-foreground">94%</span>
                  </div>
                </div>
              </div>
              <div className="mt-7 flex h-24 items-end gap-3 border-b border-border px-1">
                {[48, 68, 57, 82, 74].map((height, index) => (
                  <span
                    key={height}
                    className={index % 2 === 0 ? "w-full rounded-t-sm bg-primary" : "w-full rounded-t-sm bg-success"}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="absolute bottom-5 right-2 w-[48%] rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-lift)] sm:bottom-8 sm:right-5 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Users className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-medium text-success">+8%</span>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{t("home.cohortLearners")}</p>
              <p className="mt-1 font-display text-2xl font-semibold sm:text-3xl">1,240+</p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{t("home.cohortLearnersNote")}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("home.problemTag")}</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">{t("home.problemTitle")}</h2>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("home.problemBody")}</p>
            <ul className="mt-8 space-y-7">
              {cohortBenefits.map((benefit) => (
                <li key={benefit.title} className="grid grid-cols-[auto_1fr] gap-4">
                  <CheckCircle2 className="mt-0.5 size-5 fill-primary text-primary-foreground" aria-hidden />
                  <div>
                    <h3 className="text-base font-semibold">{benefit.title}</h3>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{benefit.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">{t("home.howTitle")}</h2>
            <p className="mt-4 text-sm leading-relaxed opacity-70 sm:text-base">{t("home.howBody")}</p>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {steps.map((s) => (
              <li
                key={s.title}
                className="group flex min-h-56 flex-col rounded-lg border border-primary-foreground/5 bg-primary-foreground/5 p-6 transition-colors hover:bg-primary-foreground/10 sm:p-7"
              >
                <div className="flex items-start justify-between">
                  <s.icon className="size-8 stroke-[1.5] opacity-90" aria-hidden />
                  <ArrowUpRight className="size-5 opacity-90 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                </div>
                <div className="mt-auto pt-10">
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed opacity-70">{s.body}</p>
                </div>
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
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {programs.map((p) => {
            const cat = programCategory[p.slug] ?? "leadership";
            const catLabel =
              cat === "communication"
                ? t("programs.filterCommunication")
                : cat === "project"
                  ? t("programs.filterProject")
                  : t("programs.filterLeadership");
            return (
              <Link
                key={p.id}
                to="/programs/$slug"
                params={{ slug: p.slug }}
                className="panel group flex flex-col overflow-hidden !p-0 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <div className="aspect-[3/2] overflow-hidden">
                  <img
                    src={programImage[p.slug]}
                    alt={L(p.title)}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="size-3.5 fill-current" />
                      ))}
                    </span>
                    <span className="ml-1 font-medium">
                      {p.moduleCount * 5}x {t("programs.lessons")}
                    </span>
                  </div>
                  <h3 className="mt-2.5 font-display text-lg font-semibold leading-snug">
                    {L(p.title)}
                  </h3>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                    <span className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted">
                        <GraduationCap className="size-4 text-muted-foreground" />
                      </span>
                      <span className="text-sm font-medium">ILSI</span>
                    </span>
                    <span className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock className="size-4 text-primary" aria-hidden />
                        {p.durationWeeks} {t("programs.weeks")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Layers className="size-4 text-primary" aria-hidden />
                        {p.moduleCount} {t("programs.modules")}
                      </span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="cohort-cta-grid relative isolate overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lift">
          <div className="relative z-10 flex min-h-72 flex-col items-center justify-center px-6 py-16 text-center lg:min-h-80">
            <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">{t("home.ctaTitle")}</h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed opacity-70">{t("home.ctaBody")}</p>
            <Button asChild size="lg" variant="secondary" className="mt-7 rounded-full px-7">
              <Link to="/apply">{t("nav.apply")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
