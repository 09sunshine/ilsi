import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  GraduationCap,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
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

type SortKey = "soonest" | "priceLow" | "priceHigh";

function matchesCategory(p: any, catId: string): boolean {
  if (!catId || catId === "trending" || catId === "all") return true;

  const titleEn = (p.title?.en || "").toLowerCase();
  const titleFr = (p.title?.fr || "").toLowerCase();
  const tagEn = (p.tagline?.en || "").toLowerCase();
  const tagFr = (p.tagline?.fr || "").toLowerCase();
  const descEn = (p.description?.en || "").toLowerCase();
  const descFr = (p.description?.fr || "").toLowerCase();
  const slug = (p.slug || "").toLowerCase();
  const combined = `${titleEn} ${titleFr} ${tagEn} ${tagFr} ${descEn} ${descFr} ${slug}`;

  switch (catId) {
    case "leadership":
      return (
        combined.includes("leader") ||
        combined.includes("women") ||
        combined.includes("femme") ||
        combined.includes("gouvernance") ||
        combined.includes("dirigeant")
      );
    case "impact":
    case "accelerator":
      return (
        combined.includes("impact") ||
        combined.includes("accelerat") ||
        combined.includes("accélérateur") ||
        combined.includes("entrepreneur") ||
        combined.includes("croissance")
      );
    case "bootcamp":
      return (
        combined.includes("bootcamp") ||
        combined.includes("camp") ||
        combined.includes("intensif") ||
        combined.includes("court")
      );
    case "scholarship":
    case "fellowship":
      return (
        combined.includes("scholarship") ||
        combined.includes("fellowship") ||
        combined.includes("bourse") ||
        combined.includes("émergent")
      );
    case "communication":
      return (
        combined.includes("communicat") ||
        combined.includes("public") ||
        combined.includes("parole") ||
        combined.includes("plaidoyer") ||
        combined.includes("médias")
      );
    case "project":
      return (
        combined.includes("project") ||
        combined.includes("projet") ||
        combined.includes("gestion") ||
        combined.includes("management") ||
        combined.includes("plan")
      );
    default:
      return true;
  }
}

function ProgramsPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();

  const [category, setCategory] = useState("trending");
  const [searchQuery, setSearchQuery] = useState("");
  const [duration, setDuration] = useState<"all" | "short" | "medium" | "long">("all");
  const [priceRange, setPriceRange] = useState<"all" | "under100" | "100to250" | "over250">("all");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("soonest");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
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

  const topFilters = [
    { id: "trending", label: t("programs.filterTrending") },
    { id: "leadership", label: t("programs.filterLeadership") },
    { id: "impact", label: t("programs.filterImpact") },
    { id: "bootcamp", label: t("programs.filterBootcamp") },
    { id: "scholarship", label: t("programs.filterScholarship") },
    { id: "communication", label: t("programs.filterCommunication") },
    { id: "project", label: t("programs.filterProject") },
  ];

  const handlePrevCategory = () => {
    const currentIndex = topFilters.findIndex((f) => f.id === category);
    const prevIndex = currentIndex <= 0 ? topFilters.length - 1 : currentIndex - 1;
    const item = topFilters[prevIndex];
    if (item) setCategory(item.id);
  };

  const handleNextCategory = () => {
    const currentIndex = topFilters.findIndex((f) => f.id === category);
    const nextIndex = currentIndex >= topFilters.length - 1 ? 0 : currentIndex + 1;
    const item = topFilters[nextIndex];
    if (item) setCategory(item.id);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (category !== "trending") count++;
    if (duration !== "all") count++;
    if (priceRange !== "all") count++;
    if (upcomingOnly) count++;
    return count;
  }, [searchQuery, category, duration, priceRange, upcomingOnly]);

  const handleResetFilters = () => {
    setCategory("trending");
    setSearchQuery("");
    setDuration("all");
    setPriceRange("all");
    setUpcomingOnly(false);
  };

  const cards = useMemo(() => {
    const enriched = programsList.map((p) => {
      const cohortList =
        p.activeCohorts && p.activeCohorts.length > 0
          ? p.activeCohorts
          : p.cohorts && p.cohorts.length > 0
          ? p.cohorts
          : [];
      const lessonCount = p.moduleCount ? p.moduleCount * 4 : 0;
      const learners = cohortList.reduce((sum: number, c: any) => sum + (c.enrolled || 0), 0);
      const nextStart = cohortList
        .map((c: any) => c.startDate)
        .filter(Boolean)
        .sort()
        .at(0);
      return { program: p, lessonCount, learners, nextStart, cohortList };
    });

    const filtered = enriched.filter(({ program: p, cohortList }) => {
      // 1. Category filter
      if (!matchesCategory(p, category)) return false;

      // 2. Search keyword filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleEn = (p.title?.en || "").toLowerCase();
        const titleFr = (p.title?.fr || "").toLowerCase();
        const taglineEn = (p.tagline?.en || "").toLowerCase();
        const taglineFr = (p.tagline?.fr || "").toLowerCase();
        const descEn = (p.description?.en || "").toLowerCase();
        const descFr = (p.description?.fr || "").toLowerCase();
        const slug = (p.slug || "").toLowerCase();
        const matched =
          titleEn.includes(query) ||
          titleFr.includes(query) ||
          taglineEn.includes(query) ||
          taglineFr.includes(query) ||
          descEn.includes(query) ||
          descFr.includes(query) ||
          slug.includes(query);
        if (!matched) return false;
      }

      // 3. Duration filter
      const w = Number(p.durationWeeks) || 0;
      if (duration === "short" && w > 4) return false;
      if (duration === "medium" && (w <= 4 || w > 16)) return false;
      if (duration === "long" && w <= 16) return false;

      // 4. Price range filter (in USD)
      const pr = Number(p.price) || 0;
      if (priceRange === "under100" && pr >= 100) return false;
      if (priceRange === "100to250" && (pr < 100 || pr > 250)) return false;
      if (priceRange === "over250" && pr <= 250) return false;

      // 5. Cohort availability filter
      if (upcomingOnly) {
        if (cohortList.length === 0) return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      const priceA = getProgramPricing(a.program, locale).amount;
      const priceB = getProgramPricing(b.program, locale).amount;
      if (sort === "priceLow") return priceA - priceB;
      if (sort === "priceHigh") return priceB - priceA;
      return (a.nextStart ?? "9999").localeCompare(b.nextStart ?? "9999");
    });
  }, [programsList, category, searchQuery, duration, priceRange, upcomingOnly, sort, locale]);

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
                onClick={handlePrevCategory}
                className="grid size-10 place-items-center rounded-full border border-hero-foreground/20 text-hero-foreground/70 transition hover:bg-hero-foreground/10"
              >
                <ArrowLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="next"
                onClick={handleNextCategory}
                className="grid size-10 place-items-center rounded-full border border-hero-foreground/20 bg-hero-foreground/10 text-hero-foreground transition hover:bg-hero-foreground/15"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Quick Category Pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {topFilters.map((f) => {
              const active = f.id === category;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCategory(f.id)}
                  className={
                    "rounded-full px-4 py-2 text-sm font-medium transition " +
                    (active
                      ? "bg-hero-lime text-hero-lime-foreground shadow-sm"
                      : "bg-hero-foreground/10 text-hero-foreground/70 hover:bg-hero-foreground/15 hover:text-hero-foreground")
                  }
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Controls Bar: Sort + Interactive Filter Toggle */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-full bg-hero-foreground/10 px-4 py-2 text-sm font-medium text-hero-foreground outline-none transition hover:bg-hero-foreground/15 [&>option]:text-foreground"
            >
              <option value="soonest">{t("programs.sortSoonest")}</option>
              <option value="priceLow">{t("programs.sortPriceLow")}</option>
              <option value="priceHigh">{t("programs.sortPriceHigh")}</option>
            </select>

            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              aria-expanded={isFilterOpen}
              className={
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer " +
                (isFilterOpen || activeFilterCount > 0
                  ? "bg-hero-lime text-hero-lime-foreground shadow-sm"
                  : "bg-hero-foreground/10 text-hero-foreground/80 hover:bg-hero-foreground/15 hover:text-hero-foreground")
              }
            >
              <SlidersHorizontal className="size-4" />
              <span>{t("programs.filter")}</span>
              {activeFilterCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-hero-lime-foreground text-[11px] font-bold text-hero-lime">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Expandable Filter Drawer / Panel */}
          {isFilterOpen && (
            <div className="mt-4 rounded-2xl border border-hero-foreground/15 bg-hero-foreground/10 p-4 backdrop-blur-md transition-all sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Search input */}
                <div className="sm:col-span-2 lg:col-span-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-hero-foreground/70 mb-1.5">
                    {locale === "fr" ? "Recherche" : "Search"}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-hero-foreground/50" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t("programs.searchPlaceholder")}
                      className="w-full rounded-xl border border-hero-foreground/20 bg-hero-foreground/10 pl-9 pr-8 py-2 text-sm text-hero-foreground placeholder:text-hero-foreground/40 outline-none focus:border-hero-lime focus:ring-1 focus:ring-hero-lime"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-hero-foreground/50 hover:text-hero-foreground"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Duration Filter */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-hero-foreground/70 mb-1.5">
                    {t("programs.duration")}
                  </label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as any)}
                    className="w-full rounded-xl border border-hero-foreground/20 bg-hero-foreground/10 px-3 py-2 text-sm text-hero-foreground outline-none focus:border-hero-lime [&>option]:text-foreground"
                  >
                    <option value="all">{t("programs.durationAll")}</option>
                    <option value="short">{t("programs.durationShort")}</option>
                    <option value="medium">{t("programs.durationMedium")}</option>
                    <option value="long">{t("programs.durationLong")}</option>
                  </select>
                </div>

                {/* Price Range Filter (USD $) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-hero-foreground/70 mb-1.5">
                    {t("programs.priceRange")}
                  </label>
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value as any)}
                    className="w-full rounded-xl border border-hero-foreground/20 bg-hero-foreground/10 px-3 py-2 text-sm text-hero-foreground outline-none focus:border-hero-lime [&>option]:text-foreground"
                  >
                    <option value="all">{t("programs.priceAll")}</option>
                    <option value="under100">{t("programs.priceUnder100")}</option>
                    <option value="100to250">{t("programs.price100to250")}</option>
                    <option value="over250">{t("programs.priceOver250")}</option>
                  </select>
                </div>

                {/* Cohort Availability Toggle */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-hero-foreground/70 mb-1.5">
                    {locale === "fr" ? "Disponibilité" : "Availability"}
                  </label>
                  <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-hero-foreground/20 bg-hero-foreground/10 px-3 text-sm text-hero-foreground transition hover:bg-hero-foreground/15">
                    <input
                      type="checkbox"
                      checked={upcomingOnly}
                      onChange={(e) => setUpcomingOnly(e.target.checked)}
                      className="size-4 rounded border-hero-foreground/30 accent-[#b5ff39]"
                    />
                    <span className="truncate text-xs font-medium">{t("programs.upcomingOnly")}</span>
                  </label>
                </div>
              </div>

              {/* Bottom Action / Status Bar */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hero-foreground/15 pt-3 text-xs text-hero-foreground/70">
                <span>
                  {cards.length} {t("programs.resultsCount")}
                </span>

                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-hero-lime hover:underline"
                  >
                    <RotateCcw className="size-3.5" />
                    {t("programs.resetFilters")}
                  </button>
                )}
              </div>
            </div>
          )}

          {cards.length === 0 ? (
            <div className="mt-10">
              <EmptyState
                icon={<GraduationCap className="size-5" />}
                title={t("programs.noMatch")}
                body={t("programs.noMatchBody")}
                action={
                  <Button onClick={handleResetFilters}>{t("programs.clearFilter")}</Button>
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
                      resolveMediaUrl(
                        p.thumbnailUrl ||
                          p.thumbnail_url ||
                          cohortList?.[0]?.thumbnailUrl ||
                          cohortList?.[0]?.thumbnail_url
                      ) ||
                      programImage[p.slug] ||
                      youngLeadersImg
                    }
                    alt={L(p.title)}
                    loading="lazy"
                    width={1008}
                    height={656}
                    className="h-44 w-full rounded-xl object-cover"
                    onError={(e) => {
                      const fallback = programImage[p.slug] || youngLeadersImg;
                      if (e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                  <p className="mt-4 truncate text-xs text-muted-foreground">
                    {cohortList.length > 0 && cohortList[0]?.name
                      ? L(cohortList[0].name)
                      : p.format
                      ? L(p.format)
                      : "Cohort Program"}
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

