import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cohorts, modules, programById } from "@/data/demo";

export const Route = createFileRoute("/admin/cohorts")({
  head: () => ({
    meta: [
      { title: "Cohorts — ILSI admin" },
      { name: "description", content: "Cohort dates, capacity, passing scores and modules." },
      { property: "og:title", content: "Cohorts — ILSI admin" },
      { property: "og:description", content: "Cohort dates, capacity and module schedule." },
    ],
  }),
  component: AdminCohorts,
});

function AdminCohorts() {
  const { t } = useI18n();
  const L = useLocalized();

  return (
    <AppShell variant="admin" title={t("nav.cohorts")}>
      <div className="space-y-4">
        {cohorts.map((c) => {
          const program = programById(c.programId);
          const fill = Math.round((c.enrolled / c.capacity) * 100);
          const cohortModules = modules.filter((m) => m.cohortId === c.id);
          return (
            <section key={c.id} className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold">{L(c.name)}</h2>
                  <p className="text-sm text-muted-foreground">
                    {program ? L(program.title) : c.programId}
                  </p>
                </div>
                <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status}</Badge>
              </div>

              <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">{t("common.date")}</dt>
                  <dd className="text-sm font-medium">
                    {c.startDate} → {c.endDate}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("admin.totalParticipants")}</dt>
                  <dd className="text-sm font-medium">
                    {c.enrolled}/{c.capacity}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("quiz.passing")}</dt>
                  <dd className="text-sm font-medium">{c.passingScore}%</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("dash.modules")}</dt>
                  <dd className="text-sm font-medium">{cohortModules.length}</dd>
                </div>
              </dl>

              <Progress value={fill} className="mt-4 h-1.5" />

              {cohortModules.length > 0 ? (
                <ol className="mt-4 divide-y divide-border border-t border-border">
                  {cohortModules.map((m) => (
                    <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                      <span className="truncate">
                        {m.order}. {L(m.title)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {m.startDate} → {m.endDate} · {m.lessons.length} · {m.passingScore}%
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
