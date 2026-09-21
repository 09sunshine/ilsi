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

function LessonPage() {
  const { moduleId, lessonId } = Route.useLoaderData();
  const { t } = useI18n();
  const L = useLocalized();
  const navigate = useNavigate();
  const { progress, completeLesson } = useLearning();

  const [lesson, setLesson] = useState<any>(null);
  const [module, setModule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const lRes = await api.getLesson(lessonId);
        let modRes = null;
        try {
          const dash = await api.getStudentDashboard();
          modRes = dash?.modules?.find((m: any) => m.id === moduleId);
        } catch (_) {}
        if (mounted) {
          setLesson(lRes);
          setModule(modRes || { id: moduleId, title: lRes?.title || { en: "Module" }, lessons: [lRes] });
        }
      } catch (err: any) {
        if (mounted) {
          setError(err?.message || "Could not load lesson");
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
    return (
      <AppShell title={t("nav.myCourse")}>
        <div className="panel mx-auto max-w-xl p-8 text-center">
          <h2 className="font-display text-xl font-semibold">Lesson not available</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "The requested lesson could not be loaded."}
          </p>
          <Button asChild className="mt-6">
            <Link to="/learn">{t("quiz.backToCourse")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const lessons: any[] = module?.lessons || [lesson];
  const index = lessons.findIndex((l: any) => l.id === lessonId);
  const prev = index > 0 ? lessons[index - 1] : null;
  const next = index >= 0 && index < lessons.length - 1 ? lessons[index + 1] : null;
  const isDone = !!progress.lessons[lesson.id]?.completed || !!lesson.completed;

  const completedCount = lessons.filter((l: any) => !!progress.lessons[l.id]?.completed || !!l.completed).length;
  const percent = lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;

  const handleComplete = async () => {
    try {
      await api.updateLessonProgress(lesson.id, { videoPercent: 100, markComplete: true });
    } catch (_) {}
    completeLesson(lesson.id);
    setLesson((prev: any) => ({ ...prev, completed: true }));
    toast.success(t("course.completed"));
  };

  return (
    <AppShell title={L(module?.title || lesson.title)}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Module sidebar */}
        <aside className="panel h-fit p-4 order-2 lg:order-1 lg:sticky lg:top-24">
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
              return (
                <li key={l.id}>
                  <Link
                    to="/learn/$moduleId/$lessonId"
                    params={{ moduleId, lessonId: l.id }}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                      l.id === lessonId
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60",
                    )}
                  >
                    {completed ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <PlayCircle className="mt-0.5 size-4 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate">
                        {i + 1}. {L(l.title)}
                      </span>
                      {l.durationMinutes ? (
                        <span className="text-xs text-muted-foreground">{l.durationMinutes} min</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <Link to="/learn/$moduleId/quiz" params={{ moduleId }}>
              {t("course.takeQuiz")}
            </Link>
          </Button>
        </aside>

        {/* Lesson content */}
        <div className="min-w-0 space-y-5 order-1 lg:order-2">
          <div className="panel p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{(lesson.type || "VIDEO").replace("_", " ")}</Badge>
              {lesson.mandatory ? <Badge variant="outline">required</Badge> : null}
              <span className="text-xs text-muted-foreground">
                {t("course.lessonOf", { current: index >= 0 ? index + 1 : 1, total: lessons.length })}
              </span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">{L(lesson.title)}</h2>

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
                  if (!isDone) {
                    handleComplete();
                  }
                }}
              />
            </div>

            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{L(lesson.body || lesson.description || "")}</p>

            {lesson.resources && lesson.resources.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">{t("course.resources")}</h3>
                <ul className="mt-2 space-y-2">
                  {lesson.resources.map((r: any) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{L(r.name)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {r.type} {r.sizeKb ? `· ${r.sizeKb} KB` : ""}
                      </span>
                      <Button asChild size="sm" variant="ghost" aria-label="Download">
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
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
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
              >
                <ChevronLeft className="size-4" /> {t("course.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!next}
                onClick={() =>
                  next &&
                  navigate({
                    to: "/learn/$moduleId/$lessonId",
                    params: { moduleId, lessonId: next.id },
                  })
                }
              >
                {t("course.next")} <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              size="sm"
              disabled={isDone}
              onClick={handleComplete}
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
