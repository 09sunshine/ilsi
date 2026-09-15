import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { modules } from "@/data/demo";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Your results — ILSI" },
      { name: "description", content: "Every quiz attempt, score and pass status in your program." },
      { property: "og:title", content: "Your results — ILSI" },
      { property: "og:description", content: "Every quiz attempt, score and pass status." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const { progress } = useLearning();
  const attempts = [...progress.attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <AppShell title={t("nav.grades")}>
      <div className="mx-auto max-w-4xl">
        {attempts.length === 0 ? (
          <EmptyState icon={<Trophy className="size-5" />} title={t("common.empty")} />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <caption className="sr-only">{t("nav.grades")}</caption>
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="p-4">
                    {t("dash.currentModule")}
                  </th>
                  <th scope="col" className="p-4">
                    #
                  </th>
                  <th scope="col" className="p-4">
                    {t("quiz.yourScore")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("common.status")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("common.date")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attempts.map((a) => {
                  const mod = modules.find((m) => m.id === a.moduleId);
                  return (
                    <tr key={a.id}>
                      <td className="p-4">{mod ? L(mod.title) : a.moduleId}</td>
                      <td className="p-4 text-muted-foreground">{a.attemptNumber}</td>
                      <td className="p-4 font-semibold">{a.percentage}%</td>
                      <td className="p-4">
                        <Badge variant={a.passed ? "default" : "destructive"}>
                          {a.passed ? t("quiz.passed") : t("quiz.failed")}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(a.submittedAt).toLocaleDateString(
                          locale === "fr" ? "fr-FR" : "en-GB",
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
