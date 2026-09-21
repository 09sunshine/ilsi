import { describe, it, expect } from "vitest";

// Progression Rule Evaluation Test
describe("Module Progression Engine (ModuleAccessService)", () => {
  interface MockLesson {
    id: string;
    mandatory: boolean;
    completed: boolean;
  }

  interface MockQuizAttempt {
    quizId: string;
    percentage: number;
    passed: boolean;
  }

  interface MockModule {
    id: string;
    order: number;
    startDate: Date;
    endDate: Date;
    requiredCompletion: number;
    passingScore: number;
    lessons: MockLesson[];
    quizId: string;
  }

  function evaluateProgression(
    modules: MockModule[],
    targetModuleId: string,
    now: Date,
    attempts: MockQuizAttempt[]
  ) {
    const target = modules.find((m) => m.id === targetModuleId);
    if (!target) return { allowed: false, code: "NOT_FOUND", state: "LOCKED" };

    // Calendar check for target
    if (target.startDate > now) {
      return { allowed: false, code: "MODULE_NOT_STARTED", state: "UPCOMING" };
    }

    // Prerequisite check for target.order > 1
    if (target.order > 1) {
      const prev = modules.find((m) => m.order === target.order - 1);
      if (prev) {
        // 1. Mandatory lessons
        const mandatoryDone = prev.lessons.filter((l) => l.mandatory).every((l) => l.completed);
        const doneCount = prev.lessons.filter((l) => l.completed).length;
        const percent = prev.lessons.length ? Math.round((doneCount / prev.lessons.length) * 100) : 100;

        if (!mandatoryDone || percent < prev.requiredCompletion) {
          return {
            allowed: false,
            code: "PREVIOUS_LESSONS_INCOMPLETE",
            state: "LOCKED",
          };
        }

        // 2. Quiz attempts
        const prevAttempts = attempts.filter((a) => a.quizId === prev.quizId);
        if (prevAttempts.length === 0) {
          return {
            allowed: false,
            code: "PREVIOUS_QUIZ_MISSING",
            state: "LOCKED",
          };
        }

        const best = [...prevAttempts].sort((a, b) => b.percentage - a.percentage)[0];
        if (!best.passed) {
          return {
            allowed: false,
            code: "PREVIOUS_QUIZ_FAILED",
            state: "LOCKED",
          };
        }
      }
    }

    return { allowed: true, code: "OK", state: "ACTIVE" };
  }

  const modules: MockModule[] = [
    {
      id: "mod-1",
      order: 1,
      startDate: new Date("2026-09-01"),
      endDate: new Date("2026-09-14"),
      requiredCompletion: 100,
      passingScore: 70,
      quizId: "quiz-1",
      lessons: [
        { id: "l-1", mandatory: true, completed: false },
        { id: "l-2", mandatory: true, completed: false },
      ],
    },
    {
      id: "mod-2",
      order: 2,
      startDate: new Date("2026-09-15"),
      endDate: new Date("2026-09-28"),
      requiredCompletion: 100,
      passingScore: 70,
      quizId: "quiz-2",
      lessons: [
        { id: "l-3", mandatory: true, completed: false },
      ],
    },
  ];

  it("Scenario 1: Module 2 remains LOCKED if Module 1 lessons are incomplete, even if start date arrived", () => {
    const now = new Date("2026-09-16"); // Date is past Module 2 start date
    const result = evaluateProgression(modules, "mod-2", now, []);
    expect(result.allowed).toBe(false);
    expect(result.code).toBe("PREVIOUS_LESSONS_INCOMPLETE");
    expect(result.state).toBe("LOCKED");
  });

  it("Scenario 2: Module 2 remains LOCKED if Module 1 quiz is missing or failed", () => {
    const now = new Date("2026-09-16");
    // Mark Module 1 lessons as completed
    modules[0].lessons.forEach((l) => (l.completed = true));

    // Case A: Missing quiz
    const resMissing = evaluateProgression(modules, "mod-2", now, []);
    expect(resMissing.allowed).toBe(false);
    expect(resMissing.code).toBe("PREVIOUS_QUIZ_MISSING");

    // Case B: Failed quiz (score 50% < passing 70%)
    const resFailed = evaluateProgression(modules, "mod-2", now, [
      { quizId: "quiz-1", percentage: 50, passed: false },
    ]);
    expect(resFailed.allowed).toBe(false);
    expect(resFailed.code).toBe("PREVIOUS_QUIZ_FAILED");
    expect(resFailed.state).toBe("LOCKED");
  });

  it("Scenario 3: Module 2 unlocks and becomes ACTIVE when Module 1 is complete and quiz is passed", () => {
    const now = new Date("2026-09-16");
    modules[0].lessons.forEach((l) => (l.completed = true));

    const resPassed = evaluateProgression(modules, "mod-2", now, [
      { quizId: "quiz-1", percentage: 85, passed: true },
    ]);
    expect(resPassed.allowed).toBe(true);
    expect(resPassed.code).toBe("OK");
    expect(resPassed.state).toBe("ACTIVE");
  });

  it("Scenario 4: If Module 1 is passed but Module 2 start date is in the future, returns UPCOMING", () => {
    const pastNow = new Date("2026-09-10"); // Before Module 2 starts on Sep 15
    modules[0].lessons.forEach((l) => (l.completed = true));

    const resUpcoming = evaluateProgression(modules, "mod-2", pastNow, [
      { quizId: "quiz-1", percentage: 90, passed: true },
    ]);
    expect(resUpcoming.allowed).toBe(false);
    expect(resUpcoming.code).toBe("MODULE_NOT_STARTED");
    expect(resUpcoming.state).toBe("UPCOMING");
  });
});
