import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app/AppShell";
import { ModuleCard } from "@/components/app/ModuleCard";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { api } from "@/lib/api";
import { NOW } from "@/lib/clock";
import { cn, resolveMediaUrl } from "@/lib/utils";
import { GraduationCap, Layers } from "lucide-react";

export const Route = createFileRoute("/learn/")({
  validateSearch: (search: Record<string, unknown>): { cohortId?: string } => {
    return {
      cohortId: (search["cohortId"] as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "My course — ILSI" },
      { name: "description", content: "Your modules, deadlines and unlock status." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "My course — ILSI" },
      { property: "og:description", content: "Your modules, deadlines and unlock status." },
    ],
  }),
  component: LearnIndex,
});

function LearnIndex() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";
  const { progress } = useLearning();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/learn/" });

  const [activeCohortId, setActiveCohortId] = useState<string | undefined>(search.cohortId);
  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadCourse(cId?: string) {
    try {
      setLoading(true);
      const data = await api.getStudentDashboard(cId);
      if (data) {
        setDashData(data);
        if (data.cohort?.id) {
          setActiveCohortId(data.cohort.id);
        }
      }
    } catch (err) {
      console.warn("Could not fetch student course:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCourse(search.cohortId);
  }, [search.cohortId]);

  const handleSelectCohort = (cohortId: string) => {
    setActiveCohortId(cohortId);
    navigate({ search: { cohortId } });
    void loadCourse(cohortId);
  };

  const program = dashData?.program;
  const cohort = dashData?.cohort;
  const enrolledCohorts = dashData?.enrolledCohorts || [];
  const rawModules = dashData?.modules || [];
  const normalizedModules = rawModules.map((item: any) => item.module || item);

  return (
    <AppShell title={t("nav.myCourse")}>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Multi-cohort switcher tabs if student is in >1 cohort */}
        {enrolledCohorts.length > 1 && (
          <div className="rounded-2xl border border-border bg-card p-3.5 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {fr ? "Vos cohortes inscrites" : "Your Enrolled Cohorts"} ({enrolledCohorts.length})
                </span>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {fr ? "Sélectionnez un cours pour basculer ses modules" : "Select a course to switch curriculum"}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {enrolledCohorts.map((ec: any) => {
                const isSelected = ec.cohortId === activeCohortId || ec.cohortId === cohort?.id;
                return (
                  <button
                    key={ec.cohortId}
                    type="button"
                    onClick={() => handleSelectCohort(ec.cohortId)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all cursor-pointer text-left",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                        : "border-border bg-background hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className={cn("size-2 rounded-full shrink-0", isSelected ? "bg-primary animate-pulse" : "bg-muted-foreground/40")} />
                    <div>
                      <div className="font-semibold text-foreground">{L(ec.programTitle)}</div>
                      <div className="text-[11px] opacity-75">
                        {L(ec.cohortName)} · {ec.progress}% {fr ? "terminé" : "done"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {program && cohort && (
          <header className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {resolveMediaUrl(cohort.thumbnailUrl || cohort.thumbnail_url || program.thumbnailUrl || program.thumbnail_url) ? (
                  <img
                    src={resolveMediaUrl(cohort.thumbnailUrl || cohort.thumbnail_url || program.thumbnailUrl || program.thumbnail_url)}
                    alt={L(program.title)}
                    className="size-14 sm:size-16 rounded-xl object-cover border border-border shadow-sm shrink-0"
                  />
                ) : null}
                <div>
                  <h2 className="font-display text-xl font-semibold">{L(program.title)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {L(cohort.name)} · {t("quiz.passing")} {cohort.passingScore || 80}%
                  </p>
                </div>
              </div>
              {cohort.status && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
                  {cohort.status}
                </span>
              )}
            </div>
          </header>
        )}

        {loading && !dashData ? (
          <div className="panel p-12 text-center">
            <div className="flex justify-center mb-3">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
            <p className="text-sm text-muted-foreground">{t("common.loading") || "Loading course modules..."}</p>
          </div>
        ) : normalizedModules.length === 0 && !loading ? (
          <div className="panel p-12 text-center">
            <GraduationCap className="size-10 mx-auto text-muted-foreground/60 mb-3" />
            <h3 className="text-base font-semibold">{t("common.empty")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {fr
                ? "Aucun module n'est encore disponible pour cette cohorte."
                : "No modules are available yet for your current cohort enrollment."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rawModules.map((item: any) => {
              const m = item.module || item;
              return (
                <ModuleCard
                  key={m.id}
                  modules={normalizedModules}
                  module={m}
                  progress={progress}
                  now={NOW}
                  serverState={item.state}
                  doneLessons={item.doneLessons}
                  totalLessons={item.totalLessons}
                  completionPercent={item.completionPercent}
                  bestScore={item.bestScore}
                />
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
