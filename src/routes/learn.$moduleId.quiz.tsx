import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Lock, RotateCcw, TriangleAlert, XCircle } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning, type GradedAttempt } from "@/features/learning/LearningProvider";
import { modules } from "@/data/demo";
import { canAccessModule } from "@/lib/access";
import { NOW } from "@/lib/clock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/$moduleId/quiz")({
  loader: ({ params }) => {
    const module = modules.find((m) => m.id === params.moduleId);
    if (!module) throw notFound();
    return { moduleId: params.moduleId };
  },
  head: () => ({
    meta: [
      { title: "Module quiz — ILSI" },
      { name: "description", content: "Take the module quiz to unlock the next module." },
      { property: "og:title", content: "Module quiz — ILSI" },
      { property: "og:description", content: "Take the module quiz to unlock the next module." },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { moduleId } = Route.useLoaderData();
  const { t } = useI18n();
  const L = useLocalized();
  const { progress, gradeQuiz, attemptsFor } = useLearning();

  const module = modules.find((m) => m.id === moduleId)!;
  const quiz = module.quiz;
  const access = canAccessModule(modules, module.id, progress, NOW);
  const attempts = attemptsFor(quiz.id);

  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradedAttempt | null>(null);

  if (!access.allowed) {
    return (
      <AppShell title={L(quiz.title)}>
        <div className="panel mx-auto max-w-xl p-8 text-center">
          <Lock className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-4 font-display text-xl font-semibold">{t("dash.locked")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("dash.lockedHint", {
              module: `${t("dash.currentModule")} ${access.blockingModuleOrder ?? module.order - 1}`,
              score: access.requiredScore ?? module.passingScore,
            })}
          </p>
          <Button asChild className="mt-6">
            <Link to="/learn">{t("quiz.backToCourse")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const answered = quiz.questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const attemptsLeft = quiz.attemptsAllowed - attempts.length;

  if (result) {
    return (
      <AppShell title={L(quiz.title)}>
        <div className="mx-auto max-w-3xl space-y-5">
          <div
            className={cn(
              "panel p-6 text-center",
              result.attempt.passed ? "border-success/30" : "border-destructive/30",
            )}
          >
            {result.attempt.passed ? (
              <CheckCircle2 className="mx-auto size-8 text-success" />
            ) : (
              <TriangleAlert className="mx-auto size-8 text-destructive" />
            )}
            <h2 className="mt-3 font-display text-2xl font-semibold">
              {result.attempt.passed ? t("quiz.passed") : t("quiz.failed")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("quiz.yourScore")}: {result.attempt.percentage}% · {t("quiz.passing")}{" "}
              {quiz.passingScore}%
            </p>
            {!result.attempt.passed ? (
              <p className="mt-3 text-sm text-muted-foreground">{t("quiz.reviewHint")}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link to="/learn">{t("quiz.backToCourse")}</Link>
              </Button>
              {!result.attempt.passed && attemptsLeft > 0 ? (
                <Button
                  onClick={() => {
                    setResult(null);
                    setAnswers({});
                    setStarted(true);
                  }}
                >
                  <RotateCcw className="size-4" /> {t("quiz.retake")}
                </Button>
              ) : null}
            </div>
          </div>

          <ol className="space-y-3">
            {quiz.questions.map((q, i) => {
              const g = result.graded.find((x) => x.questionId === q.id)!;
              return (
                <li key={q.id} className="panel p-5">
                  <div className="flex items-start gap-3">
                    {g.correct === null ? (
                      <Badge variant="secondary" className="shrink-0">
                        manual
                      </Badge>
                    ) : g.correct ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {i + 1}. {L(q.prompt)}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {g.given
                          ? q.options.find((o) => o.id === g.given)
                            ? L(q.options.find((o) => o.id === g.given)!.label)
                            : g.given
                          : "—"}
                      </p>
                      <p className="mt-2 rounded-md bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-semibold">{t("quiz.explanation")}: </span>
                        {L(q.explanation)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </AppShell>
    );
  }

  if (!started) {
    return (
      <AppShell title={L(quiz.title)}>
        <div className="panel mx-auto max-w-xl p-7 text-center">
          <h2 className="font-display text-2xl font-semibold">{L(quiz.title)}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{L(quiz.description)}</p>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t("quiz.passing")}</dt>
              <dd className="font-semibold">{quiz.passingScore}%</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t("quiz.attempts")}</dt>
              <dd className="font-semibold">
                {attempts.length}/{quiz.attemptsAllowed}
              </dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">min</dt>
              <dd className="font-semibold">{quiz.timeLimitMinutes}</dd>
            </div>
          </dl>
          <Button
            className="mt-6 w-full"
            disabled={attemptsLeft <= 0}
            onClick={() => setStarted(true)}
          >
            {t("quiz.start")}
          </Button>
          <Button asChild variant="ghost" className="mt-2 w-full">
            <Link to="/learn">{t("quiz.backToCourse")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={L(quiz.title)}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="panel p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {answered}/{quiz.questions.length}
            </span>
            <span className="text-muted-foreground">
              {t("quiz.passing")} {quiz.passingScore}%
            </span>
          </div>
          <Progress value={(answered / quiz.questions.length) * 100} className="mt-2 h-1.5" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setResult(gradeQuiz(quiz, answers));
          }}
          className="space-y-4"
        >
          {quiz.questions.map((q, i) => (
            <fieldset key={q.id} className="panel p-5">
              <legend className="sr-only">{L(q.prompt)}</legend>
              <p className="text-sm font-medium">
                {i + 1}. {L(q.prompt)}
                {q.required ? <span className="text-destructive"> *</span> : null}
              </p>

              {q.type === "WRITTEN" || q.type === "REFLECTION" ? (
                <>
                  <Textarea
                    rows={4}
                    className="mt-3"
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">{t("quiz.writtenNote")}</p>
                </>
              ) : q.type === "FILL_BLANK" ? (
                <Input
                  className="mt-3"
                  value={answers[q.id] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              ) : (
                <div className="mt-3 space-y-2">
                  {q.options.map((o) => (
                    <Label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm font-normal transition-colors",
                        answers[q.id] === o.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary/60",
                      )}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={o.id}
                        checked={answers[q.id] === o.id}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))}
                        className="mt-0.5 size-4 accent-[var(--color-primary)]"
                      />
                      <span>{L(o.label)}</span>
                    </Label>
                  ))}
                </div>
              )}
            </fieldset>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="submit">{t("quiz.submit")}</Button>
            <Button asChild type="button" variant="outline">
              <Link to="/learn">{t("common.back")}</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
