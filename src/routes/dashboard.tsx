import { createFileRoute, Link } from "@tanstack/react-router";
import { Award, CalendarClock, CheckCircle2, FileText, Radio, Video } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { ModuleCard } from "@/components/app/ModuleCard";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { currentParticipant, liveSessions, modules, programById } from "@/data/demo";
import { moduleState, overallProgress } from "@/lib/access";
import { NOW } from "@/lib/clock";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — ILSI" },
      { name: "description", content: "Track your ILSI program progress, deadlines and live sessions." },
      { property: "og:title", content: "Your dashboard — ILSI" },
      { property: "og:description", content: "Progress, deadlines and live sessions in one place." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const { progress } = useLearning();
  const now = NOW;

  const program = programById(currentParticipant.programId)!;
  const overall = overallProgress(modules, progress);
  const current =
    modules.find((m) => moduleState(modules, m, progress, now) === "ACTIVE") ??
    modules.find((m) => moduleState(modules, m, progress, now) === "FAILED") ??
    modules[0]!;
  const nextLive =
    liveSessions.find((s) => new Date(s.date) >= now) ?? liveSessions[liveSessions.length - 1]!;
  const recentAttempts = [...progress.attempts].reverse().slice(0, 3);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <AppShell title={t("nav.dashboard")}>
      <div className="mx-auto max-w-5xl space-y-8">
        <header>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">
            {t("dash.greeting")}, {currentParticipant.firstName} 👋
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{L(program.title)}</p>
        </header>

        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="panel p-5 md:col-span-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-muted-foreground">{t("dash.overall")}</p>
              <p className="font-display text-2xl font-semibold">{overall}%</p>
            </div>
            <Progress value={overall} className="mt-3 h-2" />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dash.currentModule")}
                </p>
                <p className="mt-1 font-display text-sm font-semibold">
                  {current.order}. {L(current.title)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("dash.deadline")}: {fmtDate(current.endDate)}
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link
                    to="/learn/$moduleId/$lessonId"
                    params={{ moduleId: current.id, lessonId: current.lessons[0]!.id }}
                  >
                    {t("dash.continue")}
                  </Link>
                </Button>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("dash.nextLive")}
                </p>
                <p className="mt-1 font-display text-sm font-semibold">{L(nextLive.title)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fmtDate(nextLive.date)} · {nextLive.startTime}–{nextLive.endTime}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <a href={nextLive.recordingUrl ?? nextLive.meetingUrl ?? "#"}>
                    {nextLive.recordingUrl ? (
                      <>
                        <Video className="size-4" /> {t("dash.watchRecording")}
                      </>
                    ) : (
                      <>
                        <Radio className="size-4" /> {t("dash.join")}
                      </>
                    )}
                  </a>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("dash.certification")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Award className="size-5 text-primary" aria-hidden />
                <Badge variant="secondary">{currentParticipant.certification}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {locale === "fr"
                  ? "La certification s'ouvre après le module 5."
                  : "Certification opens after module 5."}
              </p>
            </div>
            <div className="panel p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("dash.quizResults")}
              </p>
              <ul className="mt-3 space-y-2">
                {recentAttempts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-muted-foreground">
                      {a.moduleId.replace("mod-", "Module ")}
                    </span>
                    <span
                      className={
                        a.passed ? "font-semibold text-success" : "font-semibold text-destructive"
                      }
                    >
                      {a.percentage}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Modules */}
        <section>
          <h3 className="font-display text-lg font-semibold">{t("dash.modules")}</h3>
          <div className="mt-4 space-y-3">
            {modules.map((m) => (
              <ModuleCard key={m.id} modules={modules} module={m} progress={progress} now={now} />
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <h3 className="font-display text-lg font-semibold">{t("dash.recent")}</h3>
          {recentAttempts.length === 0 ? (
            <EmptyState
              className="mt-4"
              icon={<FileText className="size-5" />}
              title={t("common.empty")}
              body={t("dash.noActivity")}
            />
          ) : (
            <ul className="panel mt-4 divide-y divide-border">
              {recentAttempts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-4">
                  {a.passed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  ) : (
                    <CalendarClock className="size-4 shrink-0 text-destructive" aria-hidden />
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {a.passed ? t("quiz.passed") : t("quiz.failed")} — {a.percentage}%
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDate(a.submittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
