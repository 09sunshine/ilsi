import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CourseModule, ParticipantProgress, Quiz, QuizAttempt } from "@/lib/domain";

type Answers = Record<string, string>;

export interface GradedQuestion {
  questionId: string;
  correct: boolean | null;
  given: string;
  points: number;
  earned: number;
}

export interface GradedAttempt {
  attempt: QuizAttempt;
  graded: GradedQuestion[];
}

type LearningContextValue = {
  progress: ParticipantProgress;
  completeLesson: (lessonId: string) => void;
  setVideoPercent: (lessonId: string, percent: number) => void;
  attemptsFor: (quizId: string) => QuizAttempt[];
  gradeQuiz: (quiz: Quiz, answers: Answers) => GradedAttempt;
  lastResult: GradedAttempt | null;
  clearResult: () => void;
};

const LearningContext = createContext<LearningContextValue | null>(null);

export function LearningProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ParticipantProgress>(() => ({
    participantId: "",
    lessons: {},
    attempts: [],
  }));
  const [lastResult, setLastResult] = useState<GradedAttempt | null>(null);

  const completeLesson = useCallback((lessonId: string) => {
    setProgress((prev) => ({
      ...prev,
      lessons: {
        ...prev.lessons,
        [lessonId]: { lessonId, completed: true, videoPercent: 100 },
      },
    }));
  }, []);

  const setVideoPercent = useCallback((lessonId: string, percent: number) => {
    setProgress((prev) => {
      const current = prev.lessons[lessonId];
      const next = Math.max(current?.videoPercent ?? 0, Math.round(percent));
      return {
        ...prev,
        lessons: {
          ...prev.lessons,
          [lessonId]: {
            lessonId,
            completed: current?.completed || next >= 80,
            videoPercent: next,
          },
        },
      };
    });
  }, []);

  const attemptsFor = useCallback(
    (quizId: string) => progress.attempts.filter((a) => a.quizId === quizId),
    [progress.attempts],
  );

  const gradeQuiz = useCallback(
    (quiz: Quiz, answers: Answers): GradedAttempt => {
      const graded: GradedQuestion[] = quiz.questions.map((q) => {
        const given = answers[q.id] ?? "";
        if (q.type === "WRITTEN" || q.type === "REFLECTION") {
          // Manual grading: awarded on submission, reviewed by the trainer afterwards.
          const earned = given.trim().length >= 20 ? q.points : 0;
          return { questionId: q.id, correct: null, given, points: q.points, earned };
        }
        if (q.type === "FILL_BLANK") {
          const ok =
            given.trim().toLowerCase() === (q.correctText ?? "").trim().toLowerCase();
          return { questionId: q.id, correct: ok, given, points: q.points, earned: ok ? q.points : 0 };
        }
        const ok = q.options.some((o) => o.id === given && o.correct);
        return { questionId: q.id, correct: ok, given, points: q.points, earned: ok ? q.points : 0 };
      });

      const totalPoints = quiz.questions.reduce((s, q) => s + q.points, 0);
      const score = graded.reduce((s, g) => s + g.earned, 0);
      const percentage = totalPoints ? Math.round((score / totalPoints) * 100) : 0;
      const attemptNumber = progress.attempts.filter((a) => a.quizId === quiz.id).length + 1;

      const attempt: QuizAttempt = {
        id: `att-${quiz.id}-${attemptNumber}`,
        quizId: quiz.id,
        moduleId: quiz.moduleId,
        participantId: progress.participantId,
        startedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        score,
        percentage,
        passed: percentage >= quiz.passingScore,
        attemptNumber,
      };

      setProgress((prev) => ({ ...prev, attempts: [...prev.attempts, attempt] }));
      const result = { attempt, graded };
      setLastResult(result);
      return result;
    },
    [progress.attempts, progress.participantId],
  );

  const value = useMemo(
    () => ({
      progress,
      completeLesson,
      setVideoPercent,
      attemptsFor,
      gradeQuiz,
      lastResult,
      clearResult: () => setLastResult(null),
    }),
    [progress, completeLesson, setVideoPercent, attemptsFor, gradeQuiz, lastResult],
  );

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning() {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error("useLearning must be used inside LearningProvider");
  return ctx;
}

export const courseModules: CourseModule[] = [];
