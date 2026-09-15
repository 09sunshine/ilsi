import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, GraduationCap, SlidersHorizontal, Users } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cohortsForProgram, modules, programs } from "@/data/demo";
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
      { property: "og:title", content: "Training programs — ILSI" },
      {
        property: "og:description",
        content: "Cohort-based leadership, communication and project management training.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const { t } = useI18n();
  const L = useLocalized();
  const [category, setCategory] = useState("trending");
  const [sort, setSort] = useState<SortKey>("soonest");

  const filters = [
    { id: "trending", label: t("programs.filterTrending") },
    { id: "leadership", label: t("programs.filterLeadership") },
    { id: "communication", label: t("programs.filterCommunication") },
    { id: "project", label: t("programs.filterProject") },
  ];

  const cards = useMemo(() => {
    const enriched = programs.map((p) => {
      const cohortList = cohortsForProgram(p.id).filter((c) => c.status !== "ARCHIVED");
      const lessonCount = modules
        .filter((m) => m.programId === p.id)
        .reduce((sum, m) => sum + m.lessons.length, 0);
      const learners = cohortList.reduce((sum, c) => sum + c.enrolled, 0);
      const nextStart = cohortList
        .map((c) => c.startDate)
        .sort()
        .at(0);
      return { program: p, lessonCount, learners, nextStart, cohortList };
    });

    const filtered =
      category === "trending"
        ? enriched
        : enriched.filter((e) => programCategory[e.program.slug] === category);

    return [...filtered].sort((a, b) => {
      if (sort === "priceLow") return a.program.price - b.program.price;
      if (sort === "priceHigh") return b.program.price - a.program.price;
      return (a.nextStart ?? "9999").localeCompare(b.nextStart ?? "9999");
    });
  }, [category, sort]);

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("home.programsTag")}
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              {t("programs.heading")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {t("programs.subtitle")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="previous"
              className="grid size-10 place-items-center rounded-full border border-border text-muted-foreground transition hover:bg-surface"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="next"
              className="grid size-10 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-surface"
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
                    ? "bg-primary/10 text-primary"
                    : "bg-surface text-muted-foreground hover:text-foreground")
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
            className="rounded-full bg-surface px-4 py-2 text-sm font-medium text-foreground outline-none"
          >
            <option value="soonest">{t("programs.sortSoonest")}</option>
            <option value="priceLow">{t("programs.sortPriceLow")}</option>
            <option value="priceHigh">{t("programs.sortPriceHigh")}</option>
          </select>
          <span className="inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm font-medium text-muted-foreground">
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
                className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
              >
                <img
                  src={programImage[p.slug]}
                  alt={L(p.title)}
                  loading="lazy"
                  width={1008}
                  height={656}
                  className="h-44 w-full rounded-xl object-cover"
                />
                <p className="mt-4 truncate text-xs text-muted-foreground">
                  {cohortList.length > 0 ? L(cohortList[0]!.name) : L(p.format)}
                </p>
                <h2 className="mt-1 font-display text-lg font-semibold leading-snug">
                  {L(p.title)}
                </h2>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <BookOpen className="size-4" />
                    {t("programs.lessons")}: {lessonCount || p.moduleCount}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Users className="size-4" />
                    {t("programs.learners")}: {learners}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("programs.price")}</p>
                    <p className="font-display text-xl font-semibold">
                      ${p.price}
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
      </section>
    </PublicShell>
  );
}
