import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Globe,
  Radio,
  Target,
  TrendingUp,
  Video,
} from "lucide-react";
import {
  Area,
  ComposedChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { currentParticipant, liveSessions, modules, programById } from "@/data/demo";
import { moduleLessonCompletion, moduleState, overallProgress } from "@/lib/access";
import { NOW } from "@/lib/clock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — ILSI" },
      { name: "description", content: "Track your ILSI program progress, deadlines and live sessions." },
      { property: "og:title", content: "Your dashboard — ILSI" },
      { property: "og:description", content: "Progress, deadlines and live sessions in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const card = "rounded-2xl border border-border bg-card p-4 sm:p-5";
const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground";

function Spark({ data, color }: { data: number[]; color: string }) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={44}>
      <LineChart data={series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <Line isAnimationActive={false} type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Stat({
  label,
  value,
  delta,
  positive = true,
  chart,
  note,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  chart: React.ReactNode;
  note: string;
}) {
  return (
    <div className={card}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="grid size-5 place-items-center rounded-full bg-accent text-accent-foreground">
          <Activity className="size-3" />
        </span>
        {label}
      </div>
      <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-2">{chart}</div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-semibold",
            positive ? "text-success" : "text-destructive",
          )}
        >
          <TrendingUp className={cn("size-3", !positive && "rotate-180")} /> {delta}
        </span>
        {note}
      </p>
    </div>
  );
}

function DashboardPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const { progress } = useLearning();
  const now = NOW;
  const fr = locale === "fr";

  const program = programById(currentParticipant.programId)!;
  const overall = overallProgress(modules, progress);
  const current =
    modules.find((m) => moduleState(modules, m, progress, now) === "ACTIVE") ??
    modules.find((m) => moduleState(modules, m, progress, now) === "FAILED") ??
    modules[0]!;
  const nextLive =
    liveSessions.find((s) => new Date(s.date) >= now) ?? liveSessions[liveSessions.length - 1]!;
  const attempts = progress.attempts;
  const recentAttempts = [...attempts].reverse().slice(0, 3);

  const completedModules = modules.filter(
    (m) => moduleState(modules, m, progress, now) === "COMPLETED",
  ).length;
  const lessonsDone = modules.reduce(
    (acc, m) => acc + moduleLessonCompletion(m, progress).done,
    0,
  );
  const lessonsTotal = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((a, b) => a + b.percentage, 0) / attempts.length)
    : 0;
  const attendance = Math.round(
    (liveSessions.filter((s) => s.status === "ENDED").length / liveSessions.length) * 100,
  );

  const perModule = modules.map((m) => {
    const c = moduleLessonCompletion(m, progress);
    const best = attempts.filter((a) => a.quizId === m.quiz.id).sort((a, b) => b.percentage - a.percentage)[0];
    return {
      name: `M${m.order}`,
      title: L(m.title),
      completion: c.percent,
      score: best?.percentage ?? 0,
      state: moduleState(modules, m, progress, now),
      module: m,
    };
  });

  const paceData = modules.map((m, i) => {
    const sofar = perModule.slice(0, i + 1).reduce((a, b) => a + b.completion, 0);
    return {
      name: `M${m.order}`,
      you: Math.round(sofar / modules.length),
      plan: Math.round(((i + 1) / modules.length) * 100),
    };
  });

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(current.endDate).getTime() - now.getTime()) / 86400000),
  );

  const topModules = [...perModule].sort((a, b) => b.completion - a.completion).slice(0, 3);
  const attentionModule =
    perModule.find((p) => p.state === "FAILED") ?? perModule.find((p) => p.state === "ACTIVE")!;

  return (
    <AppShell title={t("nav.dashboard")}>
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {fr ? "Vue d'ensemble" : "Overview"}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className={chip}>
              <Globe className="size-3.5" /> {L(program.title)}
            </span>
            <span className={chip}>
              <BookOpen className="size-3.5" /> {currentParticipant.cohortId.toUpperCase()}
            </span>
            <span className={chip}>
              <CalendarDays className="size-3.5" /> {fmtDate(current.startDate)} –{" "}
              {fmtDate(current.endDate)}
              <ChevronDown className="size-3.5" />
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 text-xs font-medium">
              <span className="grid size-6 place-items-center rounded-full bg-secondary text-[10px] font-bold">
                {currentParticipant.firstName[0]}
                {currentParticipant.lastName[0]}
              </span>
              {currentParticipant.firstName}
            </span>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label={t("dash.overall")}
            value={`${overall}%`}
            delta="+6,2%"
            note={fr ? "vs semaine dernière" : "vs last week"}
            chart={<Spark data={[10, 18, 22, 30, 38, 44, overall]} color="var(--chart-1)" />}
          />
          <Stat
            label={fr ? "Modules terminés" : "Modules completed"}
            value={`${completedModules}/${modules.length}`}
            delta="+1"
            note={fr ? "ce mois-ci" : "this month"}
            chart={<Spark data={[0, 0, 1, 1, 2, completedModules]} color="var(--chart-2)" />}
          />
          <Stat
            label={fr ? "Moyenne aux quiz" : "Quiz average"}
            value={`${avgScore}%`}
            delta={avgScore >= 70 ? "+9,2%" : "-4,1%"}
            positive={avgScore >= 70}
            note={fr ? "seuil 70%" : "70% pass mark"}
            chart={<Spark data={[62, 70, 66, 78, 74, avgScore]} color="var(--chart-1)" />}
          />
          <Stat
            label={fr ? "Leçons / présence" : "Lessons / attendance"}
            value={`${lessonsDone}/${lessonsTotal}`}
            delta={`${attendance}%`}
            note={fr ? "présence live" : "live attendance"}
            chart={
              <ResponsiveContainer width="100%" height={44}>
                <BarChart data={perModule} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <Bar isAnimationActive={false} dataKey="completion" radius={2} fill="var(--chart-2)" />
                </BarChart>
              </ResponsiveContainer>
            }
          />
        </div>

        {/* Pace chart + certification */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold">
                  {fr ? "Progression vs rythme du programme" : "Your progress vs program pace"}
                </h3>
                <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-chart-1" />
                    {fr ? "Vous" : "You"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-chart-2" />
                    {fr ? "Rythme prévu" : "Planned pace"}
                  </span>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {overall >= 44
                  ? fr
                    ? "En avance"
                    : "Ahead of plan"
                  : fr
                    ? "À rattraper"
                    : "Catching up"}
              </Badge>
            </div>
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paceData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="youFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Area
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="you"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#youFill)"
                  />
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="plan"
                    stroke="var(--chart-2)"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-display text-sm font-semibold">
              {fr ? "Position certification" : "Certification position"}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-primary p-4 text-primary-foreground">
                <p className="text-[11px] opacity-80">{fr ? "Progression" : "Completed now"}</p>
                <p className="font-display text-2xl font-semibold">{overall}%</p>
                <Link
                  to="/learn/$moduleId/$lessonId"
                  params={{ moduleId: current.id, lessonId: current.lessons[0]!.id }}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline"
                >
                  {t("dash.continue")} <ArrowRight className="size-3" />
                </Link>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-[11px] text-muted-foreground">
                  {fr ? "Couverture quiz" : "Quiz coverage"}
                </p>
                <p className="mt-1 font-display text-2xl font-semibold">{avgScore}%</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {fr ? "Cible : 70%" : "Target: 70%"}
                </p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Target className="size-4 shrink-0" />
                  <span className="truncate">{t("dash.currentModule")}</span>
                </span>
                <span className="shrink-0 font-medium">
                  {current.order}. {L(current.title)}
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4" /> {t("dash.deadline")}
                </span>
                <span className="font-medium">
                  {fmtDate(current.endDate)}{" "}
                  <span className="text-muted-foreground">
                    ({daysLeft} {fr ? "j" : "d"})
                  </span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Award className="size-4" /> {t("dash.certification")}
                </span>
                <Badge variant="secondary">{currentParticipant.certification}</Badge>
              </li>
            </ul>
          </div>
        </div>

        {/* Module loop + engagement */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className={card}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold">
                {fr ? "Boucle des modules" : "Module loop"}
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[11px] font-medium text-accent-foreground">
                <CheckCircle2 className="size-3" />
                {completedModules} {fr ? "modules validés" : "modules validated"}
              </span>
            </div>
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perModule} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  />
                  <Bar isAnimationActive={false} dataKey="completion" radius={[6, 6, 6, 6]} barSize={38}>
                    {perModule.map((p) => (
                      <Cell
                        key={p.name}
                        fill={
                          p.state === "COMPLETED"
                            ? "var(--chart-1)"
                            : p.state === "ACTIVE"
                              ? "var(--chart-2)"
                              : "var(--muted)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-display text-sm font-semibold">
              {fr ? "Engagement" : "Engagement readout"}
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {fr ? "Leçons" : "Lessons done"}
                </p>
                <p className="font-display text-lg font-semibold">{lessonsDone}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {fr ? "Tentatives" : "Quiz attempts"}
                </p>
                <p className="font-display text-lg font-semibold">{attempts.length}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">
                  {fr ? "Présence" : "Attendance"}
                </p>
                <p className="font-display text-lg font-semibold">{attendance}%</p>
              </div>
            </div>
            <div className="mt-3 h-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={[42, 55, 48, 66, 72, 68, avgScore].map((v, i) => ({ i, v }))}
                  margin={{ top: 6, right: 0, bottom: 0, left: 0 }}
                >
                  <Line
                    isAnimationActive={false}
                    type="monotone"
                    dataKey="v"
                    stroke="var(--chart-1)"
                    strokeWidth={1.75}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 rounded-xl border border-border bg-surface p-3">
              <p className="text-[11px] text-muted-foreground">{t("dash.nextLive")}</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{L(nextLive.title)}</p>
              <p className="text-[11px] text-muted-foreground">
                {fmtDate(nextLive.date)} · {nextLive.startTime}–{nextLive.endTime}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2 w-full">
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

        {/* Top modules + attention */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className={card}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold">
                {fr ? "Modules les plus avancés" : "Top modules"}
              </h3>
              <Link
                to="/learn"
                className="text-xs font-semibold text-primary underline-offset-4 hover:underline"
              >
                {fr ? "Tout voir" : "View all"}
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {topModules.map((p) => (
                <div key={p.name} className="rounded-xl border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-card text-xs font-bold">
                      {p.name}
                    </span>
                    <p className="min-w-0 truncate text-sm font-semibold">{p.title}</p>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        {fr ? "Meilleur score" : "Best score"}
                      </p>
                      <p className="font-display text-base font-semibold">{p.score}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">
                        {fr ? "Avancement" : "Completion"}
                      </p>
                      <p
                        className={cn(
                          "font-display text-base font-semibold",
                          p.completion >= 100
                            ? "text-success"
                            : p.completion >= 50
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {p.completion}%
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={card}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-semibold">
                {fr ? "À traiter" : "Attention"}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">
                <AlertTriangle className="size-3" /> {fr ? "Prioritaire" : "Priority"}
              </span>
            </div>
            <div className="mt-3 flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface">
                <BookOpen className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {attentionModule.name} — {attentionModule.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {attentionModule.state === "FAILED"
                    ? fr
                      ? "Quiz non validé — une nouvelle tentative est requise."
                      : "Quiz not passed — a retake is required."
                    : fr
                      ? `${attentionModule.completion}% terminé · échéance dans ${daysLeft} jours.`
                      : `${attentionModule.completion}% done · due in ${daysLeft} days.`}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <Link
                    to="/learn/$moduleId/$lessonId"
                    params={{
                      moduleId: attentionModule.module.id,
                      lessonId: attentionModule.module.lessons[0]!.id,
                    }}
                  >
                    {attentionModule.state === "FAILED"
                      ? fr
                        ? "Repasser le quiz"
                        : "Retake quiz"
                      : t("dash.continue")}
                  </Link>
                </Button>
              </div>
            </div>
            <ul className="mt-4 space-y-2 border-t border-border pt-3">
              {recentAttempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate text-muted-foreground">
                    {a.moduleId.replace("mod-", fr ? "Module " : "Module ")}
                  </span>
                  <span
                    className={cn(
                      "font-semibold",
                      a.passed ? "text-success" : "text-destructive",
                    )}
                  >
                    {a.percentage}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
