import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  PlayCircle,
  Loader2,
  Lock,
  Clock,
  Calendar,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { api } from "@/lib/api";
import { cn, resolveMediaUrl } from "@/lib/utils";
import { LessonVideoPlayer } from "@/components/learning/LessonVideoPlayer";
import { formatLocalizedDateTime } from "@/lib/timezone";

export const Route = createFileRoute("/learn/$moduleId/$lessonId")({
  loader: ({ params }) => {
    return { moduleId: params.moduleId, lessonId: params.lessonId };
  },
  head: () => ({
    meta: [
      { title: "Lesson — ILSI" },
      { name: "description", content: "Work through your ILSI module lesson by lesson." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Lesson — ILSI" },
      { property: "og:description", content: "Work through your ILSI module lesson by lesson." },
    ],
  }),
  component: LessonPage,
});

// In-memory client-side cache for instant lesson navigation and background prefetching
const clientLessonCache = new Map<string, any>();
let cachedDashboardData: { data: any; timestamp: number } | null = null;
const DASHBOARD_CACHE_TTL = 3 * 60 * 1000;

function LessonPage() {
  const { moduleId, lessonId } = Route.useLoaderData();
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();
  const navigate = useNavigate();
  const { progress, completeLesson } = useLearning();

  const [lesson, setLesson] = useState<any>(() => clientLessonCache.get(lessonId) || null);
  const [module, setModule] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(() => !clientLessonCache.has(lessonId));
  const [error, setError] = useState<{ message: string; code?: string; details?: any } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const cached = clientLessonCache.get(lessonId);
      if (cached) {
        setLesson(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const lRes = cached || (await api.getLesson(lessonId));
        if (mounted && !cached) {
          clientLessonCache.set(lessonId, lRes);
          setLesson(lRes);
        }

        // Fast cached lookup for parent module
        let modRes = null;
        try {
          const now = Date.now();
          if (!cachedDashboardData || now - cachedDashboardData.timestamp > DASHBOARD_CACHE_TTL) {
            const dash = await api.getStudentDashboard();
            cachedDashboardData = { data: dash, timestamp: now };
          }
          const dash = cachedDashboardData.data;
          modRes = dash?.modules?.find((m: any) => m.id === moduleId || m.module?.id === moduleId);
          if (modRes?.module) modRes = modRes.module;
        } catch (_) {}

        if (mounted) {
          setModule(modRes || { id: moduleId, title: lRes?.title || { en: "Module" }, lessons: [lRes] });
        }
      } catch (err: any) {
        if (mounted) {
          setError({
            message: err?.message || "Could not load lesson",
            code: err?.code,
            details: err?.details,
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [moduleId, lessonId]);

  const lessons: any[] = module?.lessons || (lesson ? [lesson] : []);
  const index = lessons.findIndex((l: any) => l.id === lessonId);
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;

  // Proactive background prefetch for the adjacent next lesson in sequence (0-buffer transition)
  useEffect(() => {
    if (!next?.id || clientLessonCache.has(next.id)) return;
    const timer = setTimeout(() => {
      api.getLesson(next.id)
        .then((data) => {
          if (data) clientLessonCache.set(next.id, data);
        })
        .catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [next?.id]);

  if (loading) {
    return (
      <AppShell title={t("nav.myCourse")}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !lesson) {
    const isDisqualified =
      error?.code === "DISQUALIFIED" ||
      error?.details?.lockReason === "DISQUALIFIED" ||
      error?.details?.disqualified ||
      error?.message?.toLowerCase().includes("disqualified");

    const isUpcoming =
      !isDisqualified && (
        error?.code === "MODULE_NOT_STARTED" ||
        error?.details?.state === "UPCOMING" ||
        error?.message?.toLowerCase().includes("not yet started") ||
        error?.message?.toLowerCase().includes("not available yet")
      );
    const isExpired =
      !isDisqualified && (
        error?.code === "MODULE_EXPIRED" ||
        error?.details?.state === "EXPIRED" ||
        error?.message?.toLowerCase().includes("expired") ||
        error?.message?.toLowerCase().includes("ended")
      );

    return (
      <AppShell title={t("nav.myCourse")}>
        <div className="panel mx-auto max-w-lg p-8 text-center space-y-4 animate-in fade-in-50">
          <div className="flex justify-center">
            <div
              className={cn(
                "size-14 rounded-2xl flex items-center justify-center border shadow-xs",
                isDisqualified
                  ? "bg-destructive/15 text-destructive border-destructive/30"
                  : isUpcoming
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : isExpired
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              {isDisqualified ? (
                <ShieldAlert className="size-7" />
              ) : isUpcoming ? (
                <Clock className="size-7" />
              ) : (
                <Lock className="size-7" />
              )}
            </div>
          </div>

          <div>
            <h2 className="font-display text-xl font-bold text-foreground">
              {isDisqualified
                ? fr ? "Disqualifié(e) de la cohorte" : "Disqualified from Cohort"
                : isUpcoming
                ? t("course.lessonNotStarted")
                : isExpired
                ? t("course.lessonExpired")
                : t("course.lessonLocked")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {isDisqualified ? (
                fr
                  ? "Vous avez échoué à toutes les 3 tentatives de quiz accordées. Conformément au règlement officiel du programme ILSI, vous avez été disqualifié(e) de cette cohorte et ne pouvez pas poursuivre le reste du programme."
                  : "You have failed all 3 allowed quiz attempts. In accordance with ILSI cohort learning policy, you have been disqualified from this cohort and cannot continue the rest of the coursework."
              ) : isUpcoming && error?.details?.availableFrom ? (
                <>
                  This lesson opens on{" "}
                  <span className="font-semibold text-foreground">
                    {formatLocalizedDateTime(error.details.availableFrom, locale)}
                  </span>
                  . Access is protected until this date according to the cohort schedule.
                </>
              ) : isExpired && error?.details?.accessEndedAt ? (
                <>
                  Access to this lesson concluded on{" "}
                  <span className="font-semibold text-foreground">
                    {formatLocalizedDateTime(error.details.accessEndedAt, locale)}
                  </span>
                  . The cohort learning window for this lesson has passed.
                </>
              ) : (
                error?.message || "The requested lesson is currently not accessible."
              )}
            </p>
          </div>

          <div className="pt-2">
            <Button asChild className="gap-2">
              <Link to="/learn">{t("quiz.backToCourse")}</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const isDone = !!progress.lessons[lesson?.id]?.completed || !!lesson?.completed;
  const completedCount = lessons.filter((l: any) => !!progress.lessons[l.id]?.completed || !!l.completed).length;
  const percent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  const handleComplete = async () => {
    // Optimistic UI response: update local state instantly
    completeLesson(lesson.id);
    setLesson((prev: any) => ({ ...prev, completed: true }));
    if (clientLessonCache.has(lesson.id)) {
      clientLessonCache.set(lesson.id, { ...clientLessonCache.get(lesson.id), completed: true });
    }
    toast.success(t("course.completed"));

    try {
      await api.updateLessonProgress(lesson.id, { videoPercent: 100, markComplete: true });
    } catch (_) {}
  };

  const isParticipantDisqualified =
    lesson?.access?.lockReason === "DISQUALIFIED" ||
    lesson?.access?.code === "DISQUALIFIED" ||
    (lesson?.quiz && !lesson.quiz.hasPassed && lesson.quiz.attemptsCount >= (lesson.quiz.attemptsAllowed || 3));

  return (
    <AppShell title={L(module?.title || lesson.title)}>
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-5 sm:gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Module sidebar */}
        <aside className="panel h-fit w-full min-w-0 p-3.5 sm:p-4 order-2 lg:order-1 lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("course.moduleProgress")}
          </p>
          <Progress value={percent} className="mt-2 h-1.5" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {completedCount}/{lessons.length} · {percent}%
          </p>
          <ol className="mt-4 space-y-1">
            {lessons.map((l: any, i: number) => {
              const completed = !!progress.lessons[l.id]?.completed || !!l.completed;
              const now = Date.now();
              const startMs = l.startAt || l.startDate ? new Date(l.startAt || l.startDate).getTime() : null;
              const endMs = l.endAt || l.endDate ? new Date(l.endAt || l.endDate).getTime() : null;
              const isUpcoming = startMs !== null && now < startMs;
              const isExpired = endMs !== null && now > endMs;
              const isLockedByDate = isUpcoming || isExpired;

              return (
                <li key={l.id}>
                  {isLockedByDate ? (
                    <div
                      className={cn(
                        "flex items-start gap-2 rounded-md px-2 py-2 text-sm opacity-60 cursor-not-allowed select-none transition-colors",
                        l.id === lessonId
                          ? "bg-secondary/40 font-medium text-foreground"
                          : "text-muted-foreground"
                      )}
                      title={
                        isUpcoming
                          ? `Available on ${new Date(startMs!).toLocaleDateString()}`
                          : `Access ended on ${new Date(endMs!).toLocaleDateString()}`
                      }
                    >
                      <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {i + 1}. {L(l.title)}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-2.5" />
                          {isUpcoming
                            ? `Opens: ${new Date(startMs!).toLocaleDateString()}`
                            : `Closed`}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <Link
                      to="/learn/$moduleId/$lessonId"
                      params={{ moduleId, lessonId: l.id }}
                      className={cn(
                        "flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                        l.id === lessonId
                          ? "bg-secondary font-medium text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60"
                      )}
                    >
                      {completed ? (
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : (
                        <PlayCircle className="mt-0.5 size-4 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">
                          {i + 1}. {L(l.title)}
                        </span>
                        <div className="flex items-center gap-2">
                          {l.durationMinutes ? (
                            <span className="text-xs text-muted-foreground">{l.durationMinutes} min</span>
                          ) : null}
                          {l.quiz ? (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                              <HelpCircle className="size-2.5" /> Quiz
                            </span>
                          ) : null}
                        </div>
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
          {lesson?.quiz ? (
            <Button asChild size="sm" className="mt-4 w-full gap-1.5 shadow-xs">
              <Link
                to="/learn/$moduleId/quiz"
                params={{ moduleId }}
                search={{ lessonId: lesson.id, quizId: lesson.quiz.id }}
              >
                <HelpCircle className="size-3.5" />
                {lesson.quiz.hasPassed
                  ? fr ? "Revoir le quiz de leçon" : "Review Lesson Quiz"
                  : fr ? "Quiz de la leçon" : "Take Lesson Quiz"}
              </Link>
            </Button>
          ) : null}
        </aside>

        {/* Lesson content */}
        <div className="w-full min-w-0 space-y-4 sm:space-y-5 order-1 lg:order-2">
          {/* Disqualification Banner */}
          {isParticipantDisqualified ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 sm:p-5 text-destructive-foreground shadow-sm">
              <div className="flex items-start gap-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/20 text-destructive">
                  <ShieldAlert className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-display text-base font-bold text-destructive">
                    {fr ? "Disqualifié(e) de la cohorte" : "Disqualified from Cohort"}
                  </h3>
                  <p className="text-sm leading-relaxed text-destructive/90">
                    {fr
                      ? "Vous avez échoué aux 3 tentatives accordées pour le quiz. Conformément au règlement officiel du programme ILSI, vous avez été disqualifié(e) et ne pouvez pas poursuivre le reste de la formation."
                      : "You have failed all 3 allowed quiz attempts. In accordance with ILSI cohort learning policy, you have been disqualified from this cohort and cannot continue the rest of the coursework."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="panel p-3.5 sm:p-6 w-full min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{(lesson.type || "VIDEO").replace("_", " ")}</Badge>
              {lesson.mandatory ? <Badge variant="outline">required</Badge> : null}
              <span className="text-xs text-muted-foreground">
                {t("course.lessonOf", { current: index >= 0 ? index + 1 : 1, total: lessons.length })}
              </span>
            </div>
            <h2 className="mt-3 font-display text-xl sm:text-2xl font-semibold break-words">{L(lesson.title)}</h2>

            {/* 1. Video Player */}
            <div className="mt-5">
              <LessonVideoPlayer
                url={lesson.videoUrl}
                title={L(lesson.title)}
                onProgress={async (percent) => {
                  try {
                    await api.updateLessonProgress(lesson.id, { videoPercent: percent });
                  } catch (_) {}
                }}
                onEnded={() => {
                  if (!isDone && !isParticipantDisqualified) {
                    handleComplete();
                  }
                }}
              />
            </div>

            <p className="mt-5 text-sm leading-relaxed text-muted-foreground break-words">{L(lesson.body || lesson.description || "")}</p>

            {/* 2. Attached Resources / Documents (swapped before quiz) */}
            {lesson.resources && lesson.resources.length > 0 ? (
              <div className="mt-6 min-w-0">
                <h3 className="text-sm font-semibold">{t("course.resources")}</h3>
                <ul className="mt-2 space-y-2 min-w-0">
                  {lesson.resources.map((r: any) => (
                    <li
                      key={r.id}
                      className="flex items-center justify-between gap-2 sm:gap-3 rounded-lg border border-border p-2.5 sm:p-3 min-w-0"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs sm:text-sm font-medium">{L(r.name)}</p>
                          <p className="text-[11px] text-muted-foreground sm:hidden">
                            {r.type} {r.sizeKb ? `· ${r.sizeKb} KB` : ""}
                          </p>
                        </div>
                      </div>
                      <span className="hidden sm:inline shrink-0 text-xs text-muted-foreground">
                        {r.type} {r.sizeKb ? `· ${r.sizeKb} KB` : ""}
                      </span>
                      <Button asChild size="sm" variant="ghost" aria-label="Download" className="shrink-0 size-8 p-0 sm:size-auto sm:px-3">
                        <a
                          href={r.url ? resolveMediaUrl(r.url) : "#"}
                          download={typeof r.name === "object" ? (r.name.en || "document") : (r.name || "document")}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            if (!r.url || r.url === "#") {
                              e.preventDefault();
                              toast.info("Document not available.");
                            }
                          }}
                        >
                          <Download className="size-4" />
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* 3. Attached Lesson Quiz Section (swapped after documents) */}
            {lesson.quiz ? (
              <div className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-3.5 sm:p-5 shadow-xs min-w-0">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <HelpCircle className="size-4" />
                      </span>
                      <h3 className="font-display text-sm sm:text-base font-semibold text-foreground truncate max-w-full">
                        {fr ? "Quiz de la leçon" : "Lesson Quiz"}: {L(lesson.quiz.title)}
                      </h3>
                      {lesson.quiz.hasPassed ? (
                        <Badge className="bg-success/10 text-success border-success/30 flex items-center gap-1 text-[11px] sm:text-xs">
                          <CheckCircle2 className="size-3" /> {fr ? "Réussi" : "Passed"} ({lesson.quiz.bestScore}%)
                        </Badge>
                      ) : lesson.quiz.attemptsCount >= (lesson.quiz.attemptsAllowed || 3) ? (
                        <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30 text-[11px] sm:text-xs font-semibold">
                          {fr ? "Disqualifié" : "Disqualified"} ({lesson.quiz.attemptsCount}/{lesson.quiz.attemptsAllowed || 3})
                        </Badge>
                      ) : lesson.quiz.attemptsCount > 0 ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[11px] sm:text-xs">
                          {fr ? "Dernier score" : "Latest"}: {lesson.quiz.latestAttempt?.percentage}% ({fr ? "Requis" : "Req"}: {lesson.quiz.passingScore}%)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] sm:text-xs">
                          {fr ? "À passer" : "To do"}
                        </Badge>
                      )}
                    </div>
                    {lesson.quiz.description?.en || lesson.quiz.description?.fr ? (
                      <p className="text-xs text-muted-foreground break-words">{L(lesson.quiz.description)}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        {fr ? "Score de passage" : "Passing score"}: <strong className="text-foreground">{lesson.quiz.passingScore}%</strong>
                      </span>
                      <span>
                        {fr ? "Questions" : "Questions"}: <strong className="text-foreground">{lesson.quiz.questionCount || 0}</strong>
                      </span>
                      <span>
                        {fr ? "Tentatives" : "Attempts"}: <strong className="text-foreground">{lesson.quiz.attemptsCount}/{lesson.quiz.attemptsAllowed}</strong>
                      </span>
                    </p>
                  </div>

                  <Button asChild size="sm" className="shrink-0 gap-1.5 shadow-sm w-full sm:w-auto justify-center">
                    <Link
                      to="/learn/$moduleId/quiz"
                      params={{ moduleId }}
                      search={{ lessonId: lesson.id, quizId: lesson.quiz.id }}
                    >
                      <HelpCircle className="size-3.5" />
                      {lesson.quiz.hasPassed
                        ? fr ? "Revoir les réponses" : "Review Quiz Answers"
                        : lesson.quiz.attemptsCount >= (lesson.quiz.attemptsAllowed || 3)
                        ? fr ? "Voir le résultat" : "View Results"
                        : lesson.quiz.attemptsCount > 0
                        ? fr ? "Repasser le quiz" : "Retake Quiz"
                        : fr ? "Commencer le quiz" : "Start Lesson Quiz"}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={!prev}
                onClick={() =>
                  prev &&
                  navigate({
                    to: "/learn/$moduleId/$lessonId",
                    params: { moduleId, lessonId: prev.id },
                  })
                }
                className="w-full sm:w-auto justify-center"
              >
                <ChevronLeft className="size-4" /> {t("course.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!next || isParticipantDisqualified}
                onClick={() =>
                  next &&
                  !isParticipantDisqualified &&
                  navigate({
                    to: "/learn/$moduleId/$lessonId",
                    params: { moduleId, lessonId: next.id },
                  })
                }
                className="w-full sm:w-auto justify-center"
              >
                {t("course.next")} <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              size="sm"
              disabled={isDone || isParticipantDisqualified}
              onClick={handleComplete}
              className="w-full sm:w-auto justify-center"
            >
              {isDone ? (
                <>
                  <CheckCircle2 className="size-4" /> {t("course.completed")}
                </>
              ) : (
                t("course.markComplete")
              )}
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
