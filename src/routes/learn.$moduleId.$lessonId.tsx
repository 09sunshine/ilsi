import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Lock,
  PlayCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning } from "@/features/learning/LearningProvider";
import { modules } from "@/data/demo";
import { canAccessModule, moduleLessonCompletion } from "@/lib/access";
import { NOW } from "@/lib/clock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/$moduleId/$lessonId")({
  loader: ({ params }) => {
    const module = modules.find((m) => m.id === params.moduleId);
    const lesson = module?.lessons.find((l) => l.id === params.lessonId);
    if (!module || !lesson) throw notFound();
    return { moduleId: params.moduleId, lessonId: params.lessonId };
  },
  head: () => ({
    meta: [
      { title: "Lesson — ILSI" },
      { name: "description", content: "Work through your ILSI module lesson by lesson." },
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

  const module = modules.find((m) => m.id === moduleId)!;
  const lesson = module.lessons.find((l) => l.id === lessonId)!;
  const access = canAccessModule(modules, module.id, progress, NOW);
  const { percent, done, total } = moduleLessonCompletion(module, progress);
  const index = module.lessons.findIndex((l) => l.id === lessonId);
  const prev = module.lessons[index - 1];
  const next = module.lessons[index + 1];
  const isDone = !!progress.lessons[lesson.id]?.completed;

  if (!access.allowed) {
    return (
      <AppShell title={L(module.title)}>
        <div className="mx-auto max-w-xl">
          <div className="panel p-8 text-center">
            <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <Lock className="size-5" />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold">{t("dash.locked")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("dash.lockedHint", {
                module: `${t("dash.currentModule")} ${access.blockingModuleOrder ?? module.order - 1}`,
                score: access.requiredScore ?? module.passingScore,
              })}
            </p>
            <p className="mt-3 font-mono text-xs text-muted-foreground">{access.code}</p>
            <Button asChild className="mt-6">
              <Link to="/learn">{t("quiz.backToCourse")}</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={L(module.title)}>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Module sidebar */}
        <aside className="panel h-fit p-4 lg:sticky lg:top-24">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("course.moduleProgress")}
          </p>
          <Progress value={percent} className="mt-2 h-1.5" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {done}/{total} · {percent}%
          </p>
          <ol className="mt-4 space-y-1">
            {module.lessons.map((l, i) => {
              const completed = !!progress.lessons[l.id]?.completed;
              return (
                <li key={l.id}>
                  <Link
                    to="/learn/$moduleId/$lessonId"
                    params={{ moduleId: module.id, lessonId: l.id }}
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
                      <span className="text-xs text-muted-foreground">{l.durationMinutes} min</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <Link to="/learn/$moduleId/quiz" params={{ moduleId: module.id }}>
              {t("course.takeQuiz")}
            </Link>
          </Button>
        </aside>

        {/* Lesson content */}
        <div className="min-w-0 space-y-5">
          <div className="panel p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{lesson.type.replace("_", " ")}</Badge>
              {lesson.mandatory ? <Badge variant="outline">required</Badge> : null}
              <span className="text-xs text-muted-foreground">
                {t("course.lessonOf", { current: index + 1, total: module.lessons.length })}
              </span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-semibold">{L(lesson.title)}</h2>

            {lesson.videoUrl ? (
              <video
                controls
                className="mt-5 aspect-video w-full rounded-lg border border-border bg-foreground/5"
                src={lesson.videoUrl}
              >
                <track kind="captions" />
              </video>
            ) : null}

            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{L(lesson.body)}</p>

            {lesson.resources.length > 0 ? (
              <div className="mt-6">
                <h3 className="text-sm font-semibold">{t("course.resources")}</h3>
                <ul className="mt-2 space-y-2">
                  {lesson.resources.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-sm">{L(r.name)}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {r.type} · {r.sizeKb} KB
                      </span>
                      <Button size="sm" variant="ghost" aria-label="Download">
                        <Download className="size-4" />
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
                    params: { moduleId: module.id, lessonId: prev.id },
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
                    params: { moduleId: module.id, lessonId: next.id },
                  })
                }
              >
                {t("course.next")} <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              size="sm"
              disabled={isDone}
              onClick={() => {
                completeLesson(lesson.id);
                toast.success(t("course.completed"));
              }}
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
