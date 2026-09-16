import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Clock, Radio, Search, Video } from "lucide-react";
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

const selectCls =
  "h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground outline-none focus:ring-2 focus:ring-ring/40";

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
  const attempts = progress.attempts;

  const completedModules = modules.filter(
    (m) => moduleState(modules, m, progress, now) === "COMPLETED",
  ).length;
  const lessonsDone = modules.reduce((acc, m) => acc + moduleLessonCompletion(m, progress).done, 0);
  const lessonsTotal = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((a, b) => a + b.percentage, 0) / attempts.length)
    : 0;
  const attendance = Math.round(
    (liveSessions.filter((s) => s.status === "ENDED").length / liveSessions.length) * 100,
  );

  const rows = modules.map((m) => {
    const c = moduleLessonCompletion(m, progress);
    const best = attempts
      .filter((a) => a.quizId === m.quiz.id)
      .sort((a, b) => b.percentage - a.percentage)[0];
    const state = moduleState(modules, m, progress, now);
    const minutes = m.lessons.reduce((a, l) => a + l.durationMinutes, 0);
    return {
      module: m,
      title: L(m.title),
      lessons: m.lessons.length,
      done: c.done,
      completion: c.percent,
      score: best?.percentage ?? 0,
      state,
      hours: Math.max(1, Math.round(minutes / 60)),
    };
  });

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "ALL" || r.state === status) &&
          r.title.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [rows, status, query],
  );

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(fr ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const upcoming = liveSessions
    .filter((s) => new Date(s.date) >= now)
    .slice(0, 3);
  const sessionCards = upcoming.length ? upcoming : liveSessions.slice(-3);

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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {fr ? "Bonjour" : "Hi"}, {currentParticipant.firstName} {currentParticipant.lastName}{" "}
              <span aria-hidden>👋</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fr
                ? `Votre progression sur ${L(program.title)} est de ${overall}%, continuez ainsi.`
                : `Your progress on ${L(program.title)} is ${overall}%, keep it up.`}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
            {fmtDate(current.startDate)} – {fmtDate(current.endDate)}
            <CalendarDays className="size-3.5" />
          </span>
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
            delta="+6.2%"
            chart={<SparkBars data={[10, 18, 22, 30, 38, overall]} color="var(--chart-1)" />}
          />
          <KpiCard
            label={fr ? "Modules terminés" : "Modules completed"}
            action={
              <Link to="/learn" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${completedModules}/${modules.length}`}
            delta="+1"
            chart={<SparkLine data={[0, 0, 1, 1, 2, completedModules + 1]} color="var(--brand-blue)" />}
          />
          <KpiCard
            label={fr ? "Moyenne aux quiz" : "Quiz average"}
            action={
              <Link to="/results" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${avgScore}%`}
            delta={avgScore >= 70 ? "+9.2%" : "-4.1%"}
            positive={avgScore >= 70}
            chart={<SparkBars data={[62, 70, 66, 78, 74, avgScore]} color="var(--brand-orange)" />}
          />
          <KpiCard
            label={fr ? "Présence live" : "Live attendance"}
            action={
              <Link to="/live" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${attendance}%`}
            delta={`${lessonsDone}/${lessonsTotal}`}
            chart={<SparkPlain data={[42, 55, 48, 66, 72, attendance]} color="var(--brand-blue)" />}
          />
        </div>

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
            {sessionCards.map((s, i) => {
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
                      <a href={s.recordingUrl ?? s.meetingUrl ?? "#"}>
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
                    <span className="mt-4 inline-flex rounded-full border border-warning/50 px-3 py-1 text-[11px] font-semibold text-warning-foreground">
                      {fr ? "À venir" : "Upcoming"}
                    </span>
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
              <Button asChild size="sm" className="rounded-xl">
                <Link
                  to="/learn/$moduleId/$lessonId"
                  params={{ moduleId: current.id, lessonId: current.lessons[0]!.id }}
                >
                  {t("dash.continue")} <ArrowRight className="size-4" />
                </Link>
              </Button>
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
                    {filtered.map((r) => (
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
                          ) : (
                            <Link
                              to="/learn/$moduleId/$lessonId"
                              params={{ moduleId: r.module.id, lessonId: r.module.lessons[0]!.id }}
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
