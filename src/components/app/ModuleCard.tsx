import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, Lock, PlayCircle, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { canAccessModule, moduleLessonCompletion, moduleState } from "@/lib/access";
import type { CourseModule, ParticipantProgress } from "@/lib/domain";

const stateStyles: Record<string, string> = {
  COMPLETED: "bg-success/10 text-success border-success/20",
  ACTIVE: "bg-primary/10 text-primary border-primary/20",
  LOCKED: "bg-muted text-muted-foreground border-border",
  UPCOMING: "bg-muted text-muted-foreground border-border",
  FAILED: "bg-destructive/10 text-destructive border-destructive/20",
  EXPIRED: "bg-warning/15 text-warning-foreground border-warning/30",
};

export function ModuleCard({
  modules,
  module,
  progress,
  now,
}: {
  modules: CourseModule[];
  module: CourseModule;
  progress: ParticipantProgress;
  now: Date;
}) {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const state = moduleState(modules, module, progress, now);
  const access = canAccessModule(modules, module.id, progress, now);
  const { done, total, percent } = moduleLessonCompletion(module, progress);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
    });

  const Icon =
    state === "COMPLETED"
      ? CheckCircle2
      : state === "LOCKED" || state === "UPCOMING"
        ? Lock
        : state === "FAILED"
          ? TriangleAlert
          : PlayCircle;

  const locked = state === "LOCKED" || state === "UPCOMING";

  return (
    <article className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-lg border ${stateStyles[state]}`}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-base font-semibold">
              {module.order}. {L(module.title)}
            </h3>
            <Badge variant="outline" className={stateStyles[state]}>
              {state}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {fmt(module.startDate)} → {fmt(module.endDate)}
            </span>
            <span>
              {done}/{total} {t("dash.lessonsDone")}
            </span>
          </p>
          {locked && access.blockingModuleOrder ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("dash.lockedHint", {
                module: `${t("dash.currentModule")} ${access.blockingModuleOrder}`,
                score: access.requiredScore ?? module.passingScore,
              })}
            </p>
          ) : null}
          {!locked ? <Progress value={percent} className="mt-3 h-1.5 max-w-xs" /> : null}
        </div>
      </div>

      <div className="shrink-0">
        {locked ? (
          <Button variant="outline" size="sm" disabled>
            <Lock className="size-4" /> {t("dash.locked")}
          </Button>
        ) : (
          <Button asChild size="sm" variant={state === "COMPLETED" ? "outline" : "default"}>
            <Link
              to="/learn/$moduleId/$lessonId"
              params={{ moduleId: module.id, lessonId: module.lessons[0]!.id }}
            >
              {state === "COMPLETED" ? t("dash.review") : t("dash.continue")}
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}
