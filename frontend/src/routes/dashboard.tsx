import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowRight, CalendarDays, Clock, Layers, Radio, Search, Video } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  CompletionBar,
  KpiCard,
  SectionHeading,
  SparkBars,
  SparkLine,
  SparkPlain,
  StatusPill,
  panelCard,
} from "@/components/app/dash";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { moduleLessonCompletion, moduleState, overallProgress } from "@/lib/access";
import { NOW } from "@/lib/clock";
import { cn, resolveMediaUrl } from "@/lib/utils";
import { api } from "@/lib/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — ILSI" },
      { name: "description", content: "Track your ILSI program progress, deadlines and live sessions." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your dashboard — ILSI" },
      { property: "og:description", content: "Progress, deadlines and live sessions in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

const selectCls =
  "h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground outline-none focus:ring-2 focus:ring-ring/40";

function DashboardPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const { progress } = useLearning();
  const now = NOW;
  const fr = locale === "fr";

  const [dashData, setDashData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadDash(cId?: string) {
    try {
      setLoading(true);
      const data = await api.getStudentDashboard(cId);
      if (data) {
        setDashData(data);
      }
    } catch (err) {
      console.warn("Could not fetch student dashboard:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDash();
  }, []);

  const switchCohort = (cId: string) => {
    void loadDash(cId);
  };

  const participant = dashData?.student || dashData?.participant || { firstName: "", lastName: "" };
  const program = dashData?.program;
  const cohort = dashData?.cohort;
  const enrolledCohorts = dashData?.enrolledCohorts || [];
  const rawModules = dashData?.modules || [];
  const overall = typeof dashData?.overallProgress === "number"
    ? dashData.overallProgress
    : (dashData?.overallProgress?.completionPercentage ?? 0);

  const attempts = dashData?.recentAttempts || dashData?.recentQuizAttempts || progress.attempts || [];

  const completedModules = typeof dashData?.completedModulesCount === "number"
    ? dashData.completedModulesCount
    : (dashData?.overallProgress?.completedModules ?? 0);
  const lessonsDone = typeof dashData?.lessonsDoneCount === "number"
    ? dashData.lessonsDoneCount
    : (dashData?.overallProgress?.completedLessons ?? 0);
  const lessonsTotal = typeof dashData?.lessonsTotalCount === "number"
    ? dashData.lessonsTotalCount
    : (dashData?.overallProgress?.totalLessons ?? (rawModules.length * 4));
  const avgScore = typeof dashData?.avgScore === "number"
    ? dashData.avgScore
    : (attempts.length
      ? Math.round(attempts.reduce((a: any, b: any) => a + (b.percentage || 0), 0) / attempts.length)
      : 0);

  const liveSessionsList = dashData?.upcomingLiveSessions || dashData?.liveSessions || [];
  const attendance = typeof dashData?.attendancePercent === "number"
    ? dashData.attendancePercent
    : (liveSessionsList.length
      ? Math.round((liveSessionsList.filter((s: any) => s.status === "ENDED").length / liveSessionsList.length) * 100)
      : 0);

  const rows = rawModules.map((item: any) => {
    const m = item.module || item;
    const state = item.state || m.accessState || "LOCKED";
    const title = m.title ? L(m.title) : (m.titleEn || "Module");
    const lessonsCount = item.totalLessons ?? (m.lessonCount || (Array.isArray(m.lessons) ? m.lessons.length : 0));
    const doneCount = item.doneLessons ?? (m.completedLessons || 0);
    const completion = item.completionPercent ?? (m.completionPercentage || 0);
    const score = item.bestScore ?? (m.bestQuizScore || 0);
    const hours = item.hours ?? Math.max(1, Math.round(((Array.isArray(m.lessons) ? m.lessons.reduce((a: any, l: any) => a + (l.durationMinutes || 10), 0) : 40)) / 60));

    return {
      module: m,
      title,
      lessons: lessonsCount,
      done: doneCount,
      completion,
      score,
      state,
      hours,
    };
  });

  const current =
    rows.find((r: any) => r.state === "ACTIVE")?.module ??
    rows.find((r: any) => r.state === "FAILED")?.module ??
    rows[0]?.module;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r: any) =>
          (status === "ALL" || r.state === status) &&
          r.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [rows, status, query],
  );

  const fmtDate = (d?: string) => {
    if (!d) return "";
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(fr ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const upcoming = liveSessionsList
    .filter((s: any) => s.date && new Date(s.date) >= now)
    .slice(0, 3);
  const sessionCards = upcoming.length ? upcoming : liveSessionsList.slice(-3);

  const stateLabel = (s: string) =>
    s === "COMPLETED"
      ? fr
        ? "Terminé"
        : "Completed"
      : s === "ACTIVE"
        ? fr
          ? "En cours"
          : "In progress"
        : s === "FAILED"
          ? fr
            ? "À repasser"
            : "Retake"
          : fr
            ? "Verrouillé"
            : "Locked";

  const stateTone = (s: string) =>
    s === "COMPLETED" ? "success" : s === "ACTIVE" ? "warning" : s === "FAILED" ? "danger" : "muted";

  return (
    <AppShell title={t("nav.dashboard")}>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Greeting header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {resolveMediaUrl(cohort?.thumbnailUrl || cohort?.thumbnail_url || program?.thumbnailUrl || program?.thumbnail_url) ? (
              <img
                src={resolveMediaUrl(cohort?.thumbnailUrl || cohort?.thumbnail_url || program?.thumbnailUrl || program?.thumbnail_url)}
                alt={program ? L(program.title) : "Course thumbnail"}
                className="size-14 sm:size-16 rounded-xl object-cover border border-border shadow-sm shrink-0"
              />
            ) : null}
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                {fr ? "Bonjour" : "Hi"}
                {participant.firstName ? `, ${participant.firstName} ${participant.lastName}` : ""}{" "}
                <span aria-hidden>👋</span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {program ? (
                  fr
                    ? `Votre progression sur ${L(program.title)} est de ${overall}%, continuez ainsi.`
                    : `Your progress on ${L(program.title)} is ${overall}%, keep it up.`
                ) : (
                  fr
                    ? "Consultez vos cours et vos prochaines sessions en direct."
                    : "Track your cohort modules, progression and upcoming live debriefs."
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {enrolledCohorts.length > 1 && (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 shadow-sm">
                <Layers className="size-3.5 text-primary" />
                <span className="text-xs text-muted-foreground font-medium hidden sm:inline">{fr ? "Cohorte :" : "Cohort:"}</span>
                <select
                  value={cohort?.id}
                  onChange={(e) => switchCohort(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer max-w-[200px] truncate"
                  aria-label={fr ? "Choisir une cohorte" : "Choose cohort"}
                >
                  {enrolledCohorts.map((ec: any) => (
                    <option key={ec.cohortId} value={ec.cohortId} className="bg-popover text-popover-foreground">
                      {L(ec.programTitle)} — {L(ec.cohortName)} ({ec.progress}%)
                    </option>
                  ))}
                </select>
              </div>
            )}
            {current && current.startDate && current.endDate && (
              <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                {fmtDate(current.startDate)} – {fmtDate(current.endDate)}
                <CalendarDays className="size-3.5" />
              </span>
            )}
          </div>
        </div>

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("dash.overall")}
            action={
              <Link to="/learn" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${overall}%`}
            delta={`${lessonsDone}/${lessonsTotal} ${fr ? "leçons" : "lessons"}`}
            chart={
              <SparkBars
                data={dashData?.progressTrend?.length ? dashData.progressTrend : [overall]}
                color="var(--chart-1)"
              />
            }
          />
          <KpiCard
            label={fr ? "Modules terminés" : "Modules completed"}
            action={
              <Link to="/learn" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${completedModules}/${rows.length}`}
            delta={`${completedModules} ${fr ? "validés" : "completed"}`}
            chart={
              <SparkLine
                data={
                  dashData?.completedModulesTrend?.length
                    ? dashData.completedModulesTrend
                    : [completedModules]
                }
                color="var(--brand-blue)"
              />
            }
          />
          <KpiCard
            label={fr ? "Moyenne aux quiz" : "Quiz average"}
            action={
              <Link to="/results" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${avgScore}%`}
            delta={`${attempts.length} ${fr ? "tentatives" : "attempts"}`}
            positive={avgScore >= (current?.passingScore || 70)}
            chart={
              <SparkBars
                data={
                  dashData?.quizScoresTrend?.length
                    ? dashData.quizScoresTrend
                    : attempts.length
                    ? attempts.map((a: any) => a.percentage || 0)
                    : [avgScore]
                }
                color="var(--brand-orange)"
              />
            }
          />
          <KpiCard
            label={fr ? "Présence live" : "Live attendance"}
            action={
              <Link to="/live" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${attendance}%`}
            delta={`${liveSessionsList.length} ${fr ? "sessions" : "sessions"}`}
            chart={
              <SparkPlain
                data={dashData?.attendanceTrend?.length ? dashData.attendanceTrend : [attendance]}
                color="var(--brand-blue)"
              />
            }
          />
        </div>

        {/* All Enrolled Cohorts (multi-cohort overview) */}
        {enrolledCohorts.length > 1 && (
          <section className="space-y-3">
            <SectionHeading
              title={fr ? "Mes cohortes inscrites" : "My Enrolled Cohorts"}
              description={fr ? "Poursuivez vos différents cursus simultanément et passez d'un cours à l'autre." : "Progress through your enrolled programs simultaneously and switch between curriculums."}
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {enrolledCohorts.map((ec: any) => {
                const isCurrent = ec.cohortId === cohort?.id;
                return (
                  <div
                    key={ec.cohortId}
                    className={cn(
                      "panel relative flex flex-col justify-between p-4.5 transition-all shadow-sm",
                      isCurrent ? "border-primary/60 ring-1 ring-primary/20 bg-primary/[0.02]" : "hover:border-border/90"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={isCurrent ? "default" : "outline"} className="text-[10px]">
                          {isCurrent ? (fr ? "Affichage actif" : "Current View") : (fr ? "Inscrit" : "Enrolled")}
                        </Badge>
                        <span className="text-xs font-bold text-primary">{ec.progress}%</span>
                      </div>
                      <h4 className="mt-2.5 font-display text-sm font-semibold text-foreground">{L(ec.programTitle)}</h4>
                      <p className="text-xs text-muted-foreground">{L(ec.cohortName)} · {ec.status}</p>
                      <Progress value={ec.progress} className="mt-3 h-1.5" />
                      <p className="mt-2 text-[11px] text-muted-foreground flex justify-between">
                        <span>{ec.completedModulesCount}/{ec.totalModulesCount} {fr ? "modules terminés" : "modules completed"}</span>
                        <span>{fmtDate(ec.startDate)} → {fmtDate(ec.endDate)}</span>
                      </p>
                    </div>
                    <div className="mt-4 flex items-center gap-2 pt-3 border-t border-border/60">
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs flex-1"
                          onClick={() => switchCohort(ec.cohortId)}
                        >
                          {fr ? "Afficher ce tableau" : "Switch View"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        asChild
                        className={cn("h-7 text-xs", isCurrent ? "w-full" : "flex-1")}
                      >
                        <Link to="/learn" search={{ cohortId: ec.cohortId }}>
                          {fr ? "Accéder aux cours" : "Go to Course"} <ArrowRight className="size-3.5 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Upcoming sessions */}
        <section className="space-y-3">
          <SectionHeading
            title={fr ? "Sessions à venir" : "Upcoming sessions"}
            right={
              <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                {fr ? `${sessionCards.length} sessions prévues` : `${sessionCards.length} sessions scheduled`}
                <Clock className="size-3.5" />
              </span>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            {sessionCards.map((s: any, i: number) => {
              const highlight = i === 0;
              return (
                <article
                  key={s.id}
                  className={cn(
                    "rounded-2xl border p-4",
                    highlight
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-[0.12em]",
                        highlight ? "opacity-80" : "text-muted-foreground",
                      )}
                    >
                      {fr ? "Session live" : "Live session"}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                        highlight ? "bg-primary-foreground/15" : "bg-surface text-muted-foreground",
                      )}
                    >
                      60 {fr ? "min" : "mins"}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-display text-sm font-semibold">{L(s.title)}</h3>
                  <p className={cn("mt-1 text-[11px]", highlight ? "opacity-80" : "text-muted-foreground")}>
                    {fmtDate(s.date)} · {s.startTime}–{s.endTime} · {s.instructor}
                  </p>
                  {highlight ? (
                    <Button asChild size="sm" variant="secondary" className="mt-4 rounded-full">
                      <a
                        href={s.recordingUrl ?? s.meetingUrl ?? (s.id ? `https://meet.jit.si/ilsi-live-${s.id.substring(0, 8)}` : "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.recordingUrl ? (
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
                  ) : (
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full border border-warning/50 px-3 py-1 text-[11px] font-semibold text-warning-foreground">
                        {fr ? "À venir" : "Upcoming"}
                      </span>
                      {s.meetingUrl && (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs rounded-full">
                          <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer">
                            <Radio className="size-3 mr-1" /> {t("dash.join")}
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Modules table */}
        <section className="space-y-3">
          <SectionHeading
            title={fr ? "Mes modules" : "My modules"}
            right={
              current?.id && current.lessons?.[0]?.id ? (
                <Button asChild size="sm" className="rounded-xl">
                  <Link
                    to="/learn/$moduleId/$lessonId"
                    params={{ moduleId: current.id, lessonId: current.lessons[0].id }}
                  >
                    {t("dash.continue")} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild size="sm" className="rounded-xl">
                  <Link to="/learn">
                    {t("dash.continue")} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              )
            }
          />

          <div className={cn(panelCard, "overflow-hidden")}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
              <select
                className={selectCls}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label={fr ? "Statut" : "Status"}
              >
                <option value="ALL">{fr ? "Tous les statuts" : "All status"}</option>
                <option value="ACTIVE">{fr ? "En cours" : "In progress"}</option>
                <option value="COMPLETED">{fr ? "Terminé" : "Completed"}</option>
                <option value="LOCKED">{fr ? "Verrouillé" : "Locked"}</option>
              </select>
              <div className="relative ml-auto w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={fr ? "Rechercher…" : "Search…"}
                  aria-label={fr ? "Rechercher un module" : "Search modules"}
                  className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                {fr ? "Aucun module ne correspond à votre recherche." : "No modules match your search."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">{fr ? "Module" : "Module"}</th>
                      <th className="px-4 py-3 font-medium">{fr ? "Leçons" : "Lessons"}</th>
                      <th className="px-4 py-3 font-medium">{fr ? "Durée" : "Duration"}</th>
                      <th className="px-4 py-3 font-medium">{fr ? "Statut" : "Status"}</th>
                      <th className="px-4 py-3 font-medium">{fr ? "Avancement" : "Completion"}</th>
                      <th className="px-4 py-3 font-medium text-right">{fr ? "Action" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r: any) => (
                      <tr key={r.module.id} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-blue/10 text-[11px] font-bold text-brand-blue">
                              M{r.module.order}
                            </span>
                            <span className="min-w-0 truncate font-medium">{r.title}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.done}/{r.lessons}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.hours} {fr ? "h" : "hrs"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={stateTone(r.state) as "success" | "warning" | "muted" | "danger"}>
                            {stateLabel(r.state)}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <CompletionBar value={r.completion} />
                            <span className="text-xs font-semibold text-muted-foreground">
                              {r.completion}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.state === "LOCKED" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : r.module.lessons?.[0]?.id ? (
                            <Link
                              to="/learn/$moduleId/$lessonId"
                              params={{ moduleId: r.module.id, lessonId: r.module.lessons[0].id }}
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                            >
                              {fr ? "Ouvrir" : "Open"} <ArrowRight className="size-3" />
                            </Link>
                          ) : (
                            <Link
                              to="/learn"
                              className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                            >
                              {fr ? "Ouvrir" : "Open"} <ArrowRight className="size-3" />
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                {fr
                  ? `Affichage 1-${filtered.length} sur ${rows.length} modules`
                  : `Showing 1-${filtered.length} of ${rows.length} modules`}
              </span>
              <Link to="/learn" className="font-semibold text-primary hover:underline">
                {fr ? "Voir tout" : "View all"}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
