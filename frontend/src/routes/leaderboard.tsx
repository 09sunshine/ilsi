import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { useI18n } from "@/i18n/LocaleProvider";
import { AcademicPerformanceLeaderboard } from "@/components/academic/AcademicPerformanceLeaderboard";

export const Route = createFileRoute("/leaderboard")({
  validateSearch: (
    search: Record<string, unknown>
  ): { cohortId?: string | undefined; moduleId?: string | undefined } => ({
    cohortId: (search["cohortId"] as string) || undefined,
    moduleId: (search["moduleId"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Academic Leaderboard — ILSI" },
      { name: "description", content: "Cohort academic rankings and performance leaderboard." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Academic Leaderboard — ILSI" },
      { property: "og:description", content: "Cohort academic rankings and performance leaderboard." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { t } = useI18n();
  const search = Route.useSearch();

  return (
    <AppShell title={t("nav.leaderboard")}>
      <div className="mx-auto max-w-7xl space-y-6">
        <AcademicPerformanceLeaderboard
          cohortId={search.cohortId}
          initialModuleId={search.moduleId}
          compact={false}
        />
      </div>
    </AppShell>
  );
}
