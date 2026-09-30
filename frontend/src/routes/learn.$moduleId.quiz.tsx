import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CheckCircle2, RotateCcw, TriangleAlert, XCircle, Loader2, ArrowRight, BookOpen, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { useLearning, type GradedAttempt } from "@/features/learning/LearningProvider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/learn/$moduleId/quiz")({
  validateSearch: (search: Record<string, unknown>): { quizId?: string | undefined; lessonId?: string | undefined } => {
    return {
      quizId: (search["quizId"] as string) || undefined,
      lessonId: (search["lessonId"] as string) || undefined,
    };
  },
  loader: ({ params }) => {
    return { moduleId: params.moduleId };
  },
  head: () => ({
    meta: [
      { title: "Quiz — ILSI" },
      { name: "description", content: "Take your quiz to complete your learning module or lesson." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Quiz — ILSI" },
      { property: "og:description", content: "Take your quiz to complete your learning module or lesson." },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { moduleId } = Route.useLoaderData();
  const search = Route.useSearch();
  const { quizId, lessonId } = search;
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();
  const { gradeQuiz, attemptsFor } = useLearning();

  const [quiz, setQuiz] = useState<any>(null);
  const [module, setModule] = useState<any>(null);
  const [allModules, setAllModules] = useState<any[]>([]);
  const [previousAttempts, setPreviousAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [started, setStarted] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<GradedAttempt | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        let qData: any = null;
        let prevAtt: any[] = [];

        // 1. Fetch quiz directly by quizId, lessonId, or moduleId
        const targetLookupId = quizId || lessonId || moduleId;
        try {
          const res = await api.getQuiz(targetLookupId);
          if (res) {
            qData = res.quiz || res;
            if (Array.isArray(res.previousAttempts)) {
              prevAtt = res.previousAttempts;
            }
          }
        } catch (err: any) {
          console.warn("Direct getQuiz lookup failed:", err);
          if (err?.code === "DISQUALIFIED" || err?.message?.toLowerCase().includes("disqualif")) {
            qData = {
              id: targetLookupId,
              title: { en: "Quiz", fr: "Quiz" },
              isDisqualified: true,
              disqualified: true,
              attemptsAllowed: 3,
              attemptsExhausted: true,
              questions: [],
            };
          }
        }

        // 2. If lessonId provided and quiz not resolved yet, fetch from lesson details
        if (!qData && lessonId) {
          try {
            const lRes = await api.getLesson(lessonId);
            if (lRes?.quiz?.id) {
              const res = await api.getQuiz(lRes.quiz.id);
              if (res) {
                qData = res.quiz || res;
                if (Array.isArray(res.previousAttempts)) {
                  prevAtt = res.previousAttempts;
                }
              }
            } else if (lRes?.quiz && (Array.isArray(lRes.quiz.questions) && lRes.quiz.questions.length > 0)) {
              qData = lRes.quiz;
            }
          } catch (err: any) {
            if (err?.code === "DISQUALIFIED" || err?.message?.toLowerCase().includes("disqualif")) {
              qData = {
                id: targetLookupId,
                title: { en: "Quiz", fr: "Quiz" },
                isDisqualified: true,
                disqualified: true,
                attemptsAllowed: 3,
                attemptsExhausted: true,
                questions: [],
              };
            }
          }
        }

        // 3. Fetch student dashboard to get module list and metadata
        const dash = await api.getStudentDashboard().catch(() => null);
        const moduleList = dash?.modules || [];
        const modEntry = moduleList.find(
          (m: any) => (m.module?.id || m.id) === moduleId
        );
        const mod = modEntry?.module || modEntry;

        // 3b. Check if quiz is on a lesson within mod.lessons
        if (!qData && lessonId && Array.isArray(mod?.lessons)) {
          const matchedLesson = mod.lessons.find((l: any) => l.id === lessonId);
          if (matchedLesson?.quiz) {
            if (matchedLesson.quiz.id) {
              try {
                const res = await api.getQuiz(matchedLesson.quiz.id);
                if (res) {
                  qData = res.quiz || res;
                  if (Array.isArray(res.previousAttempts)) {
                    prevAtt = res.previousAttempts;
                  }
                }
              } catch (_) {}
            }
            if (!qData && Array.isArray(matchedLesson.quiz.questions) && matchedLesson.quiz.questions.length > 0) {
              qData = matchedLesson.quiz;
            }
          }
        }

        if (!qData && mod?.quiz && (mod.quiz.questions?.length > 0 || mod.quiz.id)) {
          if (mod.quiz.questions?.length > 0) {
            qData = mod.quiz;
          } else if (mod.quiz.id) {
            try {
              const res = await api.getQuiz(mod.quiz.id);
              if (res) {
                qData = res.quiz || res;
                if (Array.isArray(res.previousAttempts)) {
                  prevAtt = res.previousAttempts;
                }
              }
            } catch (_) {}
          }
        }

        if (dash?.isDisqualified) {
          if (qData) {
            qData = { ...qData, isDisqualified: true, disqualified: true };
          } else {
            qData = {
              id: targetLookupId,
              title: { en: "Quiz", fr: "Quiz" },
              isDisqualified: true,
              disqualified: true,
              attemptsAllowed: 3,
              attemptsExhausted: true,
              questions: [],
            };
          }
        }

        if (mounted) {
          setAllModules(moduleList);
          setModule(mod);
          setQuiz(qData);
          setPreviousAttempts(prevAtt);
          if (!qData) {
            setError(
              lessonId
                ? fr ? "Aucun quiz n'a encore été créé pour cette leçon." : "No quiz has been created for this lesson yet."
                : fr ? "Aucun quiz n'a encore été créé pour ce module." : "No quiz has been created for this module yet."
            );
          }
        }
      } catch (err: any) {
        if (mounted) setError(err?.message || "Failed to load quiz");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [moduleId, quizId, lessonId]);

  if (loading) {
    return (
      <AppShell title={t("nav.myCourse")}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !quiz) {
    return (
      <AppShell title={t("nav.myCourse")}>
        <div className="panel mx-auto max-w-xl p-8 text-center">
          <h2 className="font-display text-xl font-semibold">Quiz not available</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {error || "No quiz has been created for this module yet."}
          </p>
          <Button asChild className="mt-6">
            <Link to="/learn">{t("quiz.backToCourse")}</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const localAttempts = attemptsFor(quiz.id || moduleId);
  const attempts = previousAttempts.length > 0 ? previousAttempts : localAttempts;
  const attemptsAllowed = quiz.attemptsAllowed || quiz.attempts_allowed || 3;
  const hasPassed = attempts.some((a: any) => a.passed) || !!quiz.hasPassed;
  const attemptsExhausted = (attempts.length >= attemptsAllowed && !hasPassed) || !!quiz.attemptsExhausted;
  const isDisqualified = !!quiz.isDisqualified || !!quiz.disqualified || attemptsExhausted;
  const isCompleted = hasPassed || attemptsExhausted || isDisqualified;
  const attemptsLeft = Math.max(0, attemptsAllowed - attempts.length);
  const passingScore = quiz.passingScore || quiz.passing_score || 80;
  const questions: any[] = quiz.questions || [];
  const answered = questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;

  // Determine next module and its first lesson to navigate to
  const currentModIndex = allModules.findIndex(
    (m: any) => (m.module?.id || m.id) === moduleId
  );
  const nextMod =
    currentModIndex >= 0 && currentModIndex < allModules.length - 1
      ? allModules[currentModIndex + 1]
      : null;
  const nextLesson = nextMod?.module?.lessons?.[0];
  const nextLessonUrl =
    nextMod && nextLesson
      ? `/learn/${nextMod.module?.id || nextMod.id}/${nextLesson.id}`
      : null;

  // Helper to resolve the correct answer display text
  function getCorrectAnswerDisplay(q: any, g?: any) {
    if (g?.correctAnswer?.options && g.correctAnswer.options.length > 0) {
      return g.correctAnswer.options.map((opt: any) => L(opt.label)).join(", ");
    }
    if (g?.correctAnswer?.text) {
      return g.correctAnswer.text;
    }
    if (q.correctText) {
      return q.correctText;
    }
    const correctOpts = q.options?.filter((o: any) => o.correct);
    if (correctOpts && correctOpts.length > 0) {
      return correctOpts.map((o: any) => L(o.label)).join(", ");
    }
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDisqualified) return;
    setSubmitting(true);
    try {
      const res = await api.submitQuizAttempt(quiz.id || moduleId, answers);
      if (res && res.attempt) {
        setResult({
          attempt: res.attempt,
          graded: res.graded || [],
        });
        setPreviousAttempts((prev) => [...prev, res.attempt]);
        if (res.isDisqualified || res.disqualified || (res.attempt as any)?.isDisqualified) {
          setQuiz((prev: any) => ({ ...prev, isDisqualified: true, disqualified: true }));
        }
        return;
      }
    } catch (err: any) {
      if (err?.code === "DISQUALIFIED" || err?.message?.toLowerCase().includes("disqualif")) {
        setQuiz((prev: any) => ({ ...prev, isDisqualified: true, disqualified: true }));
        setResult({
          attempt: {
            id: `att-disq-${Date.now()}`,
            quizId: quiz.id || moduleId,
            attemptNumber: attemptsAllowed,
            score: 0,
            percentage: 0,
            passed: false,
            isDisqualified: true,
            disqualified: true,
          } as any,
          graded: [],
        });
        return;
      }
      console.warn("Backend quiz submission error, falling back to local grading:", err);
      setResult(gradeQuiz(quiz, answers));
    } finally {
      setSubmitting(false);
    }
  };

  // Review screen for questions & correct answers
  if (reviewMode) {
    return (
      <AppShell title={L(quiz.title)}>
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="panel p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={isDisqualified ? "destructive" : hasPassed ? "outline" : "secondary"}
                    className={cn(
                      isDisqualified
                        ? "bg-destructive/15 text-destructive border-destructive/30"
                        : hasPassed
                        ? "bg-success/15 text-success border-success/30"
                        : ""
                    )}
                  >
                    {isDisqualified
                      ? (fr ? "Disqualifié (3 tentatives)" : "Disqualified (3 attempts)")
                      : hasPassed
                      ? (fr ? "Réussi" : "Passed")
                      : (fr ? "Terminé (3 tentatives)" : "Completed (3 attempts)")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {lessonId ? (fr ? "Quiz de leçon — Corrigé" : "Lesson Quiz — Answer Key") : (fr ? "Corrigé et révision" : "Answer Key & Review")}
                  </span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-semibold">{L(quiz.title)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fr ? "Consultez les réponses correctes et explications ci-dessous." : "Review the correct answers and explanations below."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isDisqualified && nextLessonUrl ? (
                  <Button asChild className="gap-2">
                    <Link to={nextLessonUrl}>
                      {fr ? "Continuer vers la leçon suivante" : "Continue to Next Lesson"} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  {lessonId && !isDisqualified ? (
                    <Link to="/learn/$moduleId/$lessonId" params={{ moduleId, lessonId }}>
                      {fr ? "Retour à la leçon" : "Back to Lesson"}
                    </Link>
                  ) : (
                    <Link to="/learn">{t("quiz.backToCourse")}</Link>
                  )}
                </Button>
                <Button variant="ghost" onClick={() => setReviewMode(false)}>
                  {fr ? "Fermer" : "Close"}
                </Button>
              </div>
            </div>
          </div>

          <ol className="space-y-4">
            {questions.map((q, i) => {
              const correctAnswer = getCorrectAnswerDisplay(q);
              return (
                <li key={q.id} className="panel p-5 space-y-3">
                  <p className="text-sm font-semibold">
                    {i + 1}. {L(q.prompt)}
                  </p>

                  {q.options && q.options.length > 0 ? (
                    <div className="space-y-2">
                      {q.options.map((o: any) => (
                        <div
                          key={o.id}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-3 text-sm",
                            o.correct
                              ? "border-emerald-500 bg-emerald-500/10 font-medium text-emerald-950 dark:text-emerald-200"
                              : "border-border bg-card text-muted-foreground"
                          )}
                        >
                          <span>{L(o.label)}</span>
                          {o.correct ? (
                            <Badge variant="outline" className="gap-1 text-xs bg-success/15 text-success border-success/30">
                              <CheckCircle2 className="size-3" /> Correct
                            </Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : correctAnswer ? (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">Correct Answer: </span>
                      <span>{correctAnswer}</span>
                    </div>
                  ) : null}

                  {q.explanation ? (
                    <div className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground">{t("quiz.explanation")}: </span>
                      {L(q.explanation)}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>

          <div className="flex justify-end gap-2 pt-2">
            {nextLessonUrl ? (
              <Button asChild className="gap-2">
                <Link to={nextLessonUrl}>
                  Continue to Next Lesson <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/learn">{t("quiz.backToCourse")}</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Result view right after submitting an attempt
  if (result) {
    const isAttemptPassed = result.attempt.passed;
    const isSubmissionDisqualified = Boolean(
      (result.attempt as any).isDisqualified ||
      (result.attempt as any).disqualified ||
      (!isAttemptPassed && (result.attempt.attemptNumber >= attemptsAllowed || attempts.length >= attemptsAllowed))
    );
    const isQuizCompletedNow = isAttemptPassed;

    return (
      <AppShell title={L(quiz.title)}>
        <div className="mx-auto max-w-3xl space-y-5">
          <div
            className={cn(
              "panel p-6 text-center",
              isAttemptPassed
                ? "border-success/40 bg-success/5"
                : isSubmissionDisqualified
                ? "border-destructive/40 bg-destructive/5"
                : "border-destructive/30"
            )}
          >
            {isAttemptPassed ? (
              <CheckCircle2 className="mx-auto size-10 text-success" />
            ) : isSubmissionDisqualified ? (
              <ShieldAlert className="mx-auto size-12 text-destructive animate-pulse" />
            ) : (
              <TriangleAlert className="mx-auto size-10 text-destructive" />
            )}

            <h2 className="mt-3 font-display text-2xl font-semibold">
              {isAttemptPassed
                ? t("quiz.passed")
                : isSubmissionDisqualified
                ? (fr ? "Disqualifié(e) de la cohorte" : "Disqualified from Cohort")
                : t("quiz.failed")}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {t("quiz.yourScore")}: {result.attempt.percentage}% · {t("quiz.passing")}{" "}
              {passingScore}%
            </p>

            {isSubmissionDisqualified ? (
              <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-destructive-foreground shadow-sm text-left">
                <div className="flex items-start gap-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/20 text-destructive">
                    <ShieldAlert className="size-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-display text-base font-bold text-destructive">
                      {fr ? "Avis de disqualification officiel" : "Official Disqualification Notice"}
                    </h4>
                    <p className="text-sm leading-relaxed text-destructive/90">
                      {fr
                        ? `Vous avez échoué à toutes les ${attemptsAllowed} tentatives accordées pour ce quiz (${result.attempt.percentage}% obtenu / ${passingScore}% requis). Conformément au règlement officiel du programme ILSI, vous avez été disqualifié(e) de cette cohorte et ne pouvez pas continuer le reste de la formation.`
                        : `You have exhausted all ${attemptsAllowed} attempts for this quiz without reaching the passing score of ${passingScore}% (your score: ${result.attempt.percentage}%). In accordance with ILSI cohort learning policy, you have been disqualified from this cohort and cannot continue the rest of the coursework.`}
                    </p>
                  </div>
                </div>
              </div>
            ) : isAttemptPassed ? (
              <p className="mt-2 text-sm text-success font-medium">
                Great job! You passed the quiz and unlocked the next lesson.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("quiz.reviewHint")} ({attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} left)
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {!isSubmissionDisqualified && lessonId ? (
                <Button asChild className="gap-2">
                  <Link to="/learn/$moduleId/$lessonId" params={{ moduleId, lessonId }}>
                    {fr ? "Retour à la leçon" : "Back to Lesson"} <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : !isSubmissionDisqualified && isQuizCompletedNow && nextLessonUrl ? (
                <Button asChild className="gap-2">
                  <Link to={nextLessonUrl}>
                    Continue to Next Lesson <ArrowRight className="size-4" />
                  </Link>
                </Button>
              ) : null}

              <Button asChild variant="outline">
                {lessonId && !isSubmissionDisqualified ? (
                  <Link to="/learn/$moduleId/$lessonId" params={{ moduleId, lessonId }}>
                    {fr ? "Retour à la leçon" : "Back to Lesson"}
                  </Link>
                ) : (
                  <Link to="/learn">{t("quiz.backToCourse")}</Link>
                )}
              </Button>

              {!isAttemptPassed && !isSubmissionDisqualified && attemptsLeft > 0 ? (
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
            {questions.map((q, i) => {
              const g = result.graded.find((x) => x.questionId === q.id);
              const correctAnswer = getCorrectAnswerDisplay(q, g);
              const showCorrect = isAttemptPassed || attemptsExhausted || isSubmissionDisqualified || !attemptsLeft || !!correctAnswer;

              return (
                <li key={q.id} className="panel p-5">
                  <div className="flex items-start gap-3">
                    {g?.correct === null ? (
                      <Badge variant="secondary" className="shrink-0">
                        manual
                      </Badge>
                    ) : g?.correct ? (
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                    ) : (
                      <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {i + 1}. {L(q.prompt)}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Your answer:</span>
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 font-medium",
                            g?.correct
                              ? "bg-success/15 text-success"
                              : "bg-destructive/15 text-destructive"
                          )}
                        >
                          {g?.given
                            ? q.options?.find((o: any) => o.id === g.given)
                              ? L(q.options.find((o: any) => o.id === g.given)!.label)
                              : g.given
                            : "—"}
                        </span>
                      </div>

                      {/* Display correct answer when attempts are exhausted or passed */}
                      {showCorrect && correctAnswer ? (
                        <div className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 mb-1">
                            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 inline" />
                            Correct Answer:
                          </span>
                          <span className="font-medium text-foreground">
                            {correctAnswer}
                          </span>
                        </div>
                      ) : null}

                      {q.explanation || (g as any)?.explanation ? (
                        <p className="mt-2 rounded-md bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
                          <span className="font-semibold">{t("quiz.explanation")}: </span>
                          {L(q.explanation || (g as any)?.explanation)}
                        </p>
                      ) : null}
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

  // Completed State view when returning to quiz after passing or 3 attempts
  if (isDisqualified || (!started && isCompleted)) {
    return (
      <AppShell title={L(quiz.title)}>
        <div className="panel mx-auto max-w-xl p-7 text-center space-y-4">
          <div className="flex justify-center">
            {isDisqualified ? (
              <ShieldAlert className="size-12 text-destructive animate-pulse" />
            ) : (
              <CheckCircle2 className="size-12 text-success" />
            )}
          </div>
          <h2 className="font-display text-2xl font-semibold">{L(quiz.title)}</h2>
          <Badge
            variant={isDisqualified ? "destructive" : "outline"}
            className={cn("mx-auto text-sm", !isDisqualified ? "bg-success/15 text-success border-success/30" : "")}
          >
            {isDisqualified
              ? (fr ? "Disqualifié(e) (3 tentatives échouées)" : "Disqualified (3 Failed Attempts)")
              : (fr ? "Quiz réussi" : "Quiz Passed")}
          </Badge>

          {isDisqualified ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-destructive-foreground shadow-sm text-left">
              <div className="flex items-start gap-3.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/20 text-destructive">
                  <ShieldAlert className="size-5" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-display text-base font-bold text-destructive">
                    {fr ? "Avis de disqualification officiel" : "Official Disqualification Notice"}
                  </h4>
                  <p className="text-sm leading-relaxed text-destructive/90">
                    {fr
                      ? `Vous avez épuisé vos 3 tentatives à ce quiz sans obtenir le score requis (${passingScore}%). Conformément au règlement officiel du programme ILSI, vous avez été disqualifié(e) de cette cohorte et ne pouvez pas poursuivre le reste de la formation.`
                      : `You have exhausted all 3 attempts for this quiz without achieving the passing score of ${passingScore}%. In accordance with ILSI cohort learning policy, you have been disqualified from this cohort and cannot continue the rest of the coursework.`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {fr
                ? "Vous avez validé ce quiz avec succès."
                : "You have successfully passed this quiz."}
            </p>
          )}

          <dl className="grid grid-cols-3 gap-3 text-sm pt-2">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t("quiz.passing")}</dt>
              <dd className="font-semibold">{passingScore}%</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t("quiz.attempts")}</dt>
              <dd className={cn("font-semibold", isDisqualified ? "text-destructive" : "")}>
                {attempts.length}/{attemptsAllowed}
              </dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className={cn("font-semibold", isDisqualified ? "text-destructive" : "text-success")}>
                {isDisqualified ? (fr ? "Disqualifié" : "Disqualified") : (fr ? "Réussi" : "Complete")}
              </dd>
            </div>
          </dl>

          <div className="pt-4 space-y-2">
            {!isDisqualified && nextLessonUrl ? (
              <Button asChild className="w-full gap-2">
                <Link to={nextLessonUrl}>
                  Continue to Next Lesson <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setReviewMode(true)}
            >
              <BookOpen className="size-4" /> Review Questions & Correct Answers
            </Button>

            <Button asChild variant="ghost" className="w-full">
              {lessonId && !isDisqualified ? (
                <Link to="/learn/$moduleId/$lessonId" params={{ moduleId, lessonId }}>
                  {fr ? "Retour à la leçon" : "Back to Lesson"}
                </Link>
              ) : (
                <Link to="/learn">{t("quiz.backToCourse")}</Link>
              )}
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  // Intro Screen before starting quiz
  if (!started) {
    return (
      <AppShell title={L(quiz.title)}>
        <div className="panel mx-auto max-w-xl p-7 text-center">
          <div className="flex justify-center mb-2">
            <Badge variant="outline" className="border-primary/30 text-primary">
              {lessonId ? (fr ? "Quiz de la leçon" : "Lesson Quiz") : (fr ? "Quiz du module" : "Module Quiz")}
            </Badge>
          </div>
          <h2 className="font-display text-2xl font-semibold">{L(quiz.title)}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{L(quiz.description || "")}</p>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t("quiz.passing")}</dt>
              <dd className="font-semibold">{passingScore}%</dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">{t("quiz.attempts")}</dt>
              <dd className="font-semibold">
                {attempts.length}/{attemptsAllowed}
              </dd>
            </div>
            <div className="rounded-lg border border-border p-3">
              <dt className="text-xs text-muted-foreground">min</dt>
              <dd className="font-semibold">{quiz.timeLimitMinutes || 15}</dd>
            </div>
          </dl>
          <Button
            className="mt-6 w-full"
            disabled={attemptsLeft <= 0 || isDisqualified}
            onClick={() => setStarted(true)}
          >
            {t("quiz.start")}
          </Button>
          <Button asChild variant="ghost" className="mt-2 w-full">
            {lessonId ? (
              <Link to="/learn/$moduleId/$lessonId" params={{ moduleId, lessonId }}>
                {fr ? "Retour à la leçon" : "Back to Lesson"}
              </Link>
            ) : (
              <Link to="/learn">{t("quiz.backToCourse")}</Link>
            )}
          </Button>
        </div>
      </AppShell>
    );
  }

  // Quiz Taking Screen
  return (
    <AppShell title={L(quiz.title)}>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="panel p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {answered}/{questions.length}
            </span>
            <span className="text-muted-foreground">
              {t("quiz.passing")} {passingScore}%
            </span>
          </div>
          <Progress value={questions.length > 0 ? (answered / questions.length) * 100 : 0} className="mt-2 h-1.5" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map((q, i) => (
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
                  {q.options?.map((o: any) => (
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
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {t("quiz.submit")}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/learn">{t("common.back")}</Link>
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
