import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, SlidersHorizontal, Users } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { getProgramPricing } from "@/lib/currency";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";
import youngLeadersImg from "@/assets/program-young-leaders.jpg";
import publicCommunicationImg from "@/assets/program-public-communication.jpg";
import projectManagementImg from "@/assets/program-project-management.jpg";

export const Route = createFileRoute("/programs/")({
  head: () => ({
    meta: [
      { title: "Training programs — ILSI" },
      {
        name: "description",
        content:
          "Browse ILSI training programs: cohort-based leadership, communication and project management training with fixed schedules.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Training programs — ILSI" },
      {
        property: "og:description",
        content: "Cohort-based leadership, communication and project management training.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Training programs — ILSI" },
      {
        name: "twitter:description",
        content: "Cohort-based leadership, communication and project management training.",
      },
    ],
  }),
  component: ProgramsPage,
});

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

type SortKey = "soonest" | "priceLow" | "priceHigh";

function ProgramsPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const [category, setCategory] = useState("trending");
  const [sort, setSort] = useState<SortKey>("soonest");
  const [programsList, setProgramsList] = useState<any[]>([]);

  useEffect(() => {
    async function loadPrograms() {
      try {
        const live = await api.getPrograms();
        if (Array.isArray(live)) {
          setProgramsList(live);
        }
      } catch (err) {
        console.warn("Could not fetch programs:", err);
      }
    }
    loadPrograms();
  }, []);

  const filters = [
    { id: "trending", label: t("programs.filterTrending") },
    { id: "leadership", label: t("programs.filterLeadership") },
    { id: "communication", label: t("programs.filterCommunication") },
    { id: "project", label: t("programs.filterProject") },
  ];

  const cards = useMemo(() => {
    const enriched = programsList.map((p) => {
      const cohortList = (p.activeCohorts && p.activeCohorts.length > 0)
        ? p.activeCohorts
        : [];
      const lessonCount = p.moduleCount ? p.moduleCount * 4 : 0;
      const learners = cohortList.reduce((sum: number, c: any) => sum + (c.enrolled || 0), 0);
      const nextStart = cohortList
        .map((c: any) => c.startDate)
        .sort()
        .at(0);
      return { program: p, lessonCount, learners, nextStart, cohortList };
    });

    const filtered =
      category === "trending"
        ? enriched
        : enriched.filter((e) => (programCategory[e.program.slug] || "leadership") === category);

    return [...filtered].sort((a, b) => {
      const priceA = getProgramPricing(a.program, locale).amount;
      const priceB = getProgramPricing(b.program, locale).amount;
      if (sort === "priceLow") return priceA - priceB;
      if (sort === "priceHigh") return priceB - priceA;
      return (a.nextStart ?? "9999").localeCompare(b.nextStart ?? "9999");
    });
  }, [programsList, category, sort, locale]);

  return (
    <PublicShell>
      <section className="hero-dark hero-grid-lines relative isolate text-hero-foreground">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:pb-20 lg:pt-32">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-hero-foreground/60">
              {t("home.programsTag")}
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              {t("programs.heading")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-hero-foreground/70">
              {t("programs.subtitle")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="previous"
              className="grid size-10 place-items-center rounded-full border border-hero-foreground/20 text-hero-foreground/70 transition hover:bg-hero-foreground/10"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="next"
              className="grid size-10 place-items-center rounded-full border border-hero-foreground/20 bg-hero-foreground/10 text-hero-foreground transition hover:bg-hero-foreground/15"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f.id === category;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategory(f.id)}
                className={
                  "rounded-full px-4 py-2 text-sm font-medium transition " +
                  (active
                    ? "bg-hero-lime text-hero-lime-foreground"
                    : "bg-hero-foreground/10 text-hero-foreground/70 hover:bg-hero-foreground/15 hover:text-hero-foreground")
                }
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full bg-hero-foreground/10 px-4 py-2 text-sm font-medium text-hero-foreground outline-none [&>option]:text-foreground"
          >
            <option value="soonest">{t("programs.sortSoonest")}</option>
            <option value="priceLow">{t("programs.sortPriceLow")}</option>
            <option value="priceHigh">{t("programs.sortPriceHigh")}</option>
          </select>
          <span className="inline-flex items-center gap-2 rounded-full bg-hero-foreground/10 px-4 py-2 text-sm font-medium text-hero-foreground/70">
            <SlidersHorizontal className="size-4" />
            {t("programs.filter")}
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={<GraduationCap className="size-5" />}
              title={t("programs.noMatch")}
              body={t("programs.noMatchBody")}
              action={
                <Button onClick={() => setCategory("trending")}>{t("programs.clearFilter")}</Button>
              }
            />
          </div>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ program: p, lessonCount, learners, cohortList }) => (
              <article
                key={p.id}
                className="flex flex-col rounded-2xl border border-border bg-card p-4 text-foreground shadow-sm transition hover:shadow-md"
              >
                <img
                  src={
                    resolveMediaUrl(p.thumbnailUrl || p.thumbnail_url || cohortList?.[0]?.thumbnailUrl || cohortList?.[0]?.thumbnail_url) ||
                    programImage[p.slug] ||
                    youngLeadersImg
                  }
                  alt={L(p.title)}
                  loading="lazy"
                  width={1008}
                  height={656}
                  className="h-44 w-full rounded-xl object-cover"
                />
                <p className="mt-4 truncate text-xs text-muted-foreground">
                  {cohortList.length > 0 ? L(cohortList[0]!.name) : (p.format ? L(p.format) : "Cohort Program")}
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold leading-snug">
                  {L(p.title)}
                </h2>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <BookOpen className="size-4" />
                    {t("programs.lessons")}: {lessonCount || p.moduleCount || 6}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users className="size-4" />
                    {learners > 0
                      ? `${t("programs.learners")}: ${learners}`
                      : `${p.durationWeeks || 6} ${t("programs.weeks")}`}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("programs.price")}</p>
                    <p className="font-display text-xl font-semibold">
                      {getProgramPricing(p, locale).formatted}
                    </p>
                  </div>
                  <Button asChild className="rounded-lg">
                    <Link to="/programs/$slug" params={{ slug: p.slug }}>
                      <ArrowRight className="size-4" />
                      {t("programs.start")}
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        </div>
      </section>
    </PublicShell>
  );
}
