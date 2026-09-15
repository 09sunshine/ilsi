import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { ModuleCard } from "@/components/app/ModuleCard";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { cohorts, modules, programById, currentParticipant } from "@/data/demo";
import { NOW } from "@/lib/clock";

export const Route = createFileRoute("/learn/")({
  head: () => ({
    meta: [
      { title: "My course — ILSI" },
      { name: "description", content: "Your modules, deadlines and unlock status." },
      { property: "og:title", content: "My course — ILSI" },
      { property: "og:description", content: "Your modules, deadlines and unlock status." },
    ],
  }),
  component: LearnIndex,
});

function LearnIndex() {
  const { t } = useI18n();
  const L = useLocalized();
  const { progress } = useLearning();
  const program = programById(currentParticipant.programId)!;
  const cohort = cohorts.find((c) => c.id === currentParticipant.cohortId)!;

  return (
    <AppShell title={t("nav.myCourse")}>
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="panel p-5">
          <h2 className="font-display text-xl font-semibold">{L(program.title)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {L(cohort.name)} · {t("quiz.passing")} {cohort.passingScore}%
          </p>
        </header>
        <div className="space-y-3">
          {modules.map((m) => (
            <ModuleCard key={m.id} modules={modules} module={m} progress={progress} now={NOW} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
