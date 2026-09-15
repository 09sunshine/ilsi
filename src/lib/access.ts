import type { CourseModule, ModuleState, ParticipantProgress, QuizAttempt } from "./domain";

export type AccessReason =
  | "OK"
  | "MODULE_NOT_STARTED"
  | "PREVIOUS_LESSONS_INCOMPLETE"
  | "PREVIOUS_QUIZ_MISSING"
  | "PREVIOUS_QUIZ_FAILED"
  | "PAYMENT_REQUIRED";

export interface AccessResult {
  allowed: boolean;
  code: AccessReason;
  blockingModuleOrder?: number;
  requiredScore?: number;
}

export function bestAttempt(attempts: QuizAttempt[], quizId: string): QuizAttempt | undefined {
  return attempts
    .filter((a) => a.quizId === quizId)
    .sort((a, b) => b.percentage - a.percentage)[0];
}

export function moduleLessonCompletion(
  module: CourseModule,
  progress: ParticipantProgress,
): { done: number; total: number; percent: number; mandatoryDone: boolean } {
  const total = module.lessons.length;
  const done = module.lessons.filter((l) => progress.lessons[l.id]?.completed).length;
  const mandatoryDone = module.lessons
    .filter((l) => l.mandatory)
    .every((l) => progress.lessons[l.id]?.completed);
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0, mandatoryDone };
}

export function isModuleCompleted(
  module: CourseModule,
  progress: ParticipantProgress,
): boolean {
  const { mandatoryDone, percent } = moduleLessonCompletion(module, progress);
  const attempt = bestAttempt(progress.attempts, module.quiz.id);
  return mandatoryDone && percent >= module.requiredCompletion && !!attempt?.passed;
}

/**
 * Mirror of the server-side rule: calendar dates alone never unlock a module.
 * The UI uses this only to render state — the API is the source of truth.
 */
export function canAccessModule(
  modules: CourseModule[],
  moduleId: string,
  progress: ParticipantProgress,
  now: Date,
  paymentSettled = true,
): AccessResult {
  const module = modules.find((m) => m.id === moduleId);
  if (!module) return { allowed: false, code: "MODULE_NOT_STARTED" };
  if (!paymentSettled) return { allowed: false, code: "PAYMENT_REQUIRED" };

  if (new Date(module.startDate) > now) {
    return { allowed: false, code: "MODULE_NOT_STARTED" };
  }

  const previous = modules.find((m) => m.order === module.order - 1);
  if (!previous) return { allowed: true, code: "OK" };

  const { mandatoryDone, percent } = moduleLessonCompletion(previous, progress);
  if (!mandatoryDone || percent < previous.requiredCompletion) {
    return {
      allowed: false,
      code: "PREVIOUS_LESSONS_INCOMPLETE",
      blockingModuleOrder: previous.order,
      requiredScore: previous.passingScore,
    };
  }

  const attempt = bestAttempt(progress.attempts, previous.quiz.id);
  if (!attempt) {
    return {
      allowed: false,
      code: "PREVIOUS_QUIZ_MISSING",
      blockingModuleOrder: previous.order,
      requiredScore: previous.passingScore,
    };
  }
  if (!attempt.passed) {
    return {
      allowed: false,
      code: "PREVIOUS_QUIZ_FAILED",
      blockingModuleOrder: previous.order,
      requiredScore: previous.passingScore,
    };
  }

  return { allowed: true, code: "OK" };
}

export function moduleState(
  modules: CourseModule[],
  module: CourseModule,
  progress: ParticipantProgress,
  now: Date,
): ModuleState {
  if (isModuleCompleted(module, progress)) return "COMPLETED";

  const access = canAccessModule(modules, module.id, progress, now);
  if (!access.allowed) {
    return access.code === "MODULE_NOT_STARTED" ? "UPCOMING" : "LOCKED";
  }

  const attempt = bestAttempt(progress.attempts, module.quiz.id);
  if (attempt && !attempt.passed) return "FAILED";
  if (new Date(module.endDate) < now) return "EXPIRED";
  return "ACTIVE";
}

export function overallProgress(
  modules: CourseModule[],
  progress: ParticipantProgress,
): number {
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
  if (!totalLessons) return 0;
  const done = modules.reduce(
    (sum, m) => sum + m.lessons.filter((l) => progress.lessons[l.id]?.completed).length,
    0,
  );
  return Math.round((done / totalLessons) * 100);
}
