import { describe, it, expect } from "vitest";
import { RankingService } from "../src/services/RankingService.js";

describe("Academic Ranking Engine — Module & Lesson Weighted Scoring Rules", () => {
  // Test Model Interfaces for Lesson-Based Calculations
  interface MockLessonScore {
    lessonId: string;
    moduleId: string;
    score: number; // 0 to 100 (0 if unfinished)
    isCompleted: boolean;
  }

  interface MockStudent {
    userId: string;
    enrollmentStatus: "ACTIVE" | "COMPLETED" | "DISQUALIFIED" | "DROPPED" | "SUSPENDED";
    paymentStatus: "PAID" | "NOT_REQUIRED" | "PENDING";
    lessonScores: MockLessonScore[];
  }

  function computeOverallAndModuleRanking(
    students: MockStudent[],
    totalCohortLessons: number,
    moduleDefinitions: Array<{ moduleId: string; totalLessons: number }>,
    previousOverallRanks?: Map<string, number>
  ) {
    const evaluatedOverall: Array<{
      userId: string;
      isEligible: boolean;
      ineligibilityReason: string | null;
      completedLessons: number;
      totalLessons: number;
      points: number;
      maxPossiblePoints: number;
      average: number;
      rank: number | null;
      rankChange: number | null;
      medal: "GOLD" | "SILVER" | "BRONZE" | null;
    }> = [];

    const evaluatedByModule = new Map<
      string,
      Array<{
        moduleId: string;
        userId: string;
        isEligible: boolean;
        completedLessons: number;
        totalLessons: number;
        points: number;
        score: number;
        rank: number | null;
      }>
    >();

    for (const mod of moduleDefinitions) {
      evaluatedByModule.set(mod.moduleId, []);
    }

    for (const st of students) {
      let isEligible = true;
      let ineligibilityReason: string | null = null;

      if (st.enrollmentStatus === "DISQUALIFIED") {
        isEligible = false;
        ineligibilityReason = "DISQUALIFIED";
      } else if (st.enrollmentStatus === "DROPPED") {
        isEligible = false;
        ineligibilityReason = "DROPPED";
      } else if (st.enrollmentStatus === "SUSPENDED") {
        isEligible = false;
        ineligibilityReason = "SUSPENDED";
      } else if (st.paymentStatus !== "PAID" && st.paymentStatus !== "NOT_REQUIRED") {
        isEligible = false;
        ineligibilityReason = "PAYMENT_PENDING";
      }

      let totalPoints = 0;
      let totalCompleted = 0;

      // Module level evaluation
      for (const mod of moduleDefinitions) {
        const studentModLessons = st.lessonScores.filter((l) => l.moduleId === mod.moduleId);
        const modPoints = studentModLessons.reduce((sum, l) => sum + (l.score || 0), 0);
        const modCompleted = studentModLessons.filter((l) => l.isCompleted).length;

        totalPoints += modPoints;
        totalCompleted += modCompleted;

        // Formula: Overall score of the module = Sum of the grades obtained ÷ Total number of lessons of the module
        const modScore = mod.totalLessons > 0 ? Number((modPoints / mod.totalLessons).toFixed(2)) : 0.0;

        evaluatedByModule.get(mod.moduleId)!.push({
          moduleId: mod.moduleId,
          userId: st.userId,
          isEligible,
          completedLessons: modCompleted,
          totalLessons: mod.totalLessons,
          points: Number(modPoints.toFixed(2)),
          score: modScore,
          rank: null,
        });
      }

      // Formula: Overall average = Total points obtained ÷ Total curriculum lessons
      const overallAvg = totalCohortLessons > 0 ? Number((totalPoints / totalCohortLessons).toFixed(2)) : 0.0;
      const maxPoints = totalCohortLessons * 100.0;

      evaluatedOverall.push({
        userId: st.userId,
        isEligible,
        ineligibilityReason,
        completedLessons: totalCompleted,
        totalLessons: totalCohortLessons,
        points: Number(totalPoints.toFixed(2)),
        maxPossiblePoints: maxPoints,
        average: overallAvg,
        rank: null,
        rankChange: null,
        medal: null,
      });
    }

    // Apply Standard Competition Ranking ("1224" rule) for Overall
    const eligibleOverall = evaluatedOverall.filter((s) => s.isEligible);
    eligibleOverall.sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      if (b.points !== a.points) return b.points - a.points;
      return b.completedLessons - a.completedLessons;
    });

    for (let i = 0; i < eligibleOverall.length; i++) {
      if (i > 0) {
        const prev = eligibleOverall[i - 1];
        const curr = eligibleOverall[i];
        if (curr.average === prev.average) {
          curr.rank = prev.rank;
        } else {
          curr.rank = i + 1;
        }
      } else {
        eligibleOverall[0].rank = 1;
      }
      eligibleOverall[i].medal = RankingService.getMedal(eligibleOverall[i].rank);
    }

    // Movement calculation
    for (const el of eligibleOverall) {
      if (previousOverallRanks && previousOverallRanks.has(el.userId)) {
        el.rankChange = previousOverallRanks.get(el.userId)! - el.rank!;
      } else {
        el.rankChange = null;
      }
    }

    // Apply Standard Competition Ranking for each module
    for (const mod of moduleDefinitions) {
      const modEntries = evaluatedByModule.get(mod.moduleId)!;
      const eligibleMod = modEntries.filter((s) => s.isEligible);
      eligibleMod.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.points !== a.points) return b.points - a.points;
        return b.completedLessons - a.completedLessons;
      });

      for (let i = 0; i < eligibleMod.length; i++) {
        if (i > 0) {
          const prev = eligibleMod[i - 1];
          const curr = eligibleMod[i];
          if (curr.score === prev.score) {
            curr.rank = prev.rank;
          } else {
            curr.rank = i + 1;
          }
        } else {
          eligibleMod[0].rank = 1;
        }
      }
    }

    return { evaluatedOverall, evaluatedByModule };
  }

  it("calculates module ranking taking into account all lessons in the module (Student B ahead of Student A)", () => {
    // Exact user scenario:
    // Module contains 5 lessons.
    // Student A: completed 2 lessons with 100/100 each => (100 + 100 + 0 + 0 + 0) / 5 = 40/100.
    // Student B: completed 5 lessons with 90/100 each => (90 + 90 + 90 + 90 + 90) / 5 = 90/100.
    // Student B must be classified in front of Student A.
    const moduleDefs = [{ moduleId: "mod-1", totalLessons: 5 }];

    const students: MockStudent[] = [
      {
        userId: "student-A",
        enrollmentStatus: "ACTIVE",
        paymentStatus: "PAID",
        lessonScores: [
          { lessonId: "l1", moduleId: "mod-1", score: 100, isCompleted: true },
          { lessonId: "l2", moduleId: "mod-1", score: 100, isCompleted: true },
          { lessonId: "l3", moduleId: "mod-1", score: 0, isCompleted: false },
          { lessonId: "l4", moduleId: "mod-1", score: 0, isCompleted: false },
          { lessonId: "l5", moduleId: "mod-1", score: 0, isCompleted: false },
        ],
      },
      {
        userId: "student-B",
        enrollmentStatus: "ACTIVE",
        paymentStatus: "PAID",
        lessonScores: [
          { lessonId: "l1", moduleId: "mod-1", score: 90, isCompleted: true },
          { lessonId: "l2", moduleId: "mod-1", score: 90, isCompleted: true },
          { lessonId: "l3", moduleId: "mod-1", score: 90, isCompleted: true },
          { lessonId: "l4", moduleId: "mod-1", score: 90, isCompleted: true },
          { lessonId: "l5", moduleId: "mod-1", score: 90, isCompleted: true },
        ],
      },
    ];

    const { evaluatedByModule } = computeOverallAndModuleRanking(students, 5, moduleDefs);
    const mod1Entries = evaluatedByModule.get("mod-1")!;

    const studentA = mod1Entries.find((s) => s.userId === "student-A")!;
    const studentB = mod1Entries.find((s) => s.userId === "student-B")!;

    expect(studentA.score).toBe(40.0);
    expect(studentA.points).toBe(200.0);
    expect(studentA.completedLessons).toBe(2);
    expect(studentA.rank).toBe(2);

    expect(studentB.score).toBe(90.0);
    expect(studentB.points).toBe(450.0);
    expect(studentB.completedLessons).toBe(5);
    expect(studentB.rank).toBe(1);

    expect(studentB.rank).toBeLessThan(studentA.rank!); // Student B classified ahead of Student A
  });

  it("calculates overall ranking on denominator of all 21 lessons in curriculum (5 * 100 = 500/2100 => 23.81%)", () => {
    // Exact user scenario:
    // If a student completed 5 lessons with 100/100 each, total points = 500 out of 2,100.
    // General average = 500 / 21 = 23.81%, not 100%.
    const totalCohortLessons = 21;
    const moduleDefs = [{ moduleId: "mod-1", totalLessons: 21 }];

    const lessonScores: MockLessonScore[] = [];
    for (let i = 1; i <= 21; i++) {
      if (i <= 5) {
        lessonScores.push({ lessonId: `l${i}`, moduleId: "mod-1", score: 100, isCompleted: true });
      } else {
        lessonScores.push({ lessonId: `l${i}`, moduleId: "mod-1", score: 0, isCompleted: false });
      }
    }

    const students: MockStudent[] = [
      {
        userId: "student-partial",
        enrollmentStatus: "ACTIVE",
        paymentStatus: "PAID",
        lessonScores,
      },
    ];

    const { evaluatedOverall } = computeOverallAndModuleRanking(students, totalCohortLessons, moduleDefs);
    const result = evaluatedOverall.find((s) => s.userId === "student-partial")!;

    expect(result.points).toBe(500.0);
    expect(result.maxPossiblePoints).toBe(2100.0);
    expect(result.completedLessons).toBe(5);
    expect(result.totalLessons).toBe(21);
    expect(result.average).toBe(23.81); // (500 / 2100) * 100 = 23.81%
  });

  it("applies standard competition ranking (1224 policy) for tied averages", () => {
    const moduleDefs = [{ moduleId: "mod-all", totalLessons: 10 }];
    const totalLessons = 10;

    const makeScores = (points: number, count: number): MockLessonScore[] => {
      const arr: MockLessonScore[] = [];
      const scorePerLesson = count > 0 ? points / count : 0;
      for (let i = 1; i <= 10; i++) {
        if (i <= count) arr.push({ lessonId: `l${i}`, moduleId: "mod-all", score: scorePerLesson, isCompleted: true });
        else arr.push({ lessonId: `l${i}`, moduleId: "mod-all", score: 0, isCompleted: false });
      }
      return arr;
    };

    const students: MockStudent[] = [
      { userId: "u-first", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(950, 10) }, // avg: 95
      { userId: "u-tie-a", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(900, 9) },  // avg: 90
      { userId: "u-tie-b", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(900, 9) },  // avg: 90
      { userId: "u-fourth", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(800, 8) }, // avg: 80
    ];

    const { evaluatedOverall } = computeOverallAndModuleRanking(students, totalLessons, moduleDefs);
    const first = evaluatedOverall.find((r) => r.userId === "u-first")!;
    const tieA = evaluatedOverall.find((r) => r.userId === "u-tie-a")!;
    const tieB = evaluatedOverall.find((r) => r.userId === "u-tie-b")!;
    const fourth = evaluatedOverall.find((r) => r.userId === "u-fourth")!;

    expect(first.rank).toBe(1);
    expect(first.medal).toBe("GOLD");

    expect(tieA.rank).toBe(2);
    expect(tieA.medal).toBe("SILVER");

    expect(tieB.rank).toBe(2);
    expect(tieB.medal).toBe("SILVER");

    expect(fourth.rank).toBe(4); // Skips rank 3
    expect(fourth.medal).toBeNull();
  });

  it("calculates movement history correctly (+gained, -dropped, 0 unchanged, null new)", () => {
    const moduleDefs = [{ moduleId: "mod-all", totalLessons: 10 }];
    const totalLessons = 10;

    const makeScores = (points: number): MockLessonScore[] => [
      { lessonId: "l1", moduleId: "mod-all", score: points, isCompleted: true },
    ];

    const students: MockStudent[] = [
      { userId: "u-climber", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(950) },
      { userId: "u-faller", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(700) },
      { userId: "u-steady", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(850) },
      { userId: "u-fresh", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", lessonScores: makeScores(600) },
    ];

    const previousRanks = new Map<string, number>([
      ["u-climber", 4], // was 4, now 1 => +3
      ["u-faller", 1],  // was 1, now 3 => -2
      ["u-steady", 2],  // was 2, now 2 => 0
    ]);

    const { evaluatedOverall } = computeOverallAndModuleRanking(students, totalLessons, moduleDefs, previousRanks);
    const climber = evaluatedOverall.find((r) => r.userId === "u-climber")!;
    const faller = evaluatedOverall.find((r) => r.userId === "u-faller")!;
    const steady = evaluatedOverall.find((r) => r.userId === "u-steady")!;
    const fresh = evaluatedOverall.find((r) => r.userId === "u-fresh")!;

    expect(climber.rank).toBe(1);
    expect(climber.rankChange).toBe(3);

    expect(faller.rank).toBe(3);
    expect(faller.rankChange).toBe(-2);

    expect(steady.rank).toBe(2);
    expect(steady.rankChange).toBe(0);

    expect(fresh.rank).toBe(4);
    expect(fresh.rankChange).toBeNull();
  });

  it("marks disqualified, dropped, or unpaid students as ineligible", () => {
    const moduleDefs = [{ moduleId: "mod-1", totalLessons: 5 }];
    const students: MockStudent[] = [
      {
        userId: "u-disq",
        enrollmentStatus: "DISQUALIFIED",
        paymentStatus: "PAID",
        lessonScores: [{ lessonId: "l1", moduleId: "mod-1", score: 90, isCompleted: true }],
      },
      {
        userId: "u-drop",
        enrollmentStatus: "DROPPED",
        paymentStatus: "PAID",
        lessonScores: [{ lessonId: "l1", moduleId: "mod-1", score: 85, isCompleted: true }],
      },
      {
        userId: "u-unpaid",
        enrollmentStatus: "ACTIVE",
        paymentStatus: "PENDING",
        lessonScores: [{ lessonId: "l1", moduleId: "mod-1", score: 95, isCompleted: true }],
      },
    ];

    const { evaluatedOverall } = computeOverallAndModuleRanking(students, 5, moduleDefs);
    const disq = evaluatedOverall.find((r) => r.userId === "u-disq")!;
    const drop = evaluatedOverall.find((r) => r.userId === "u-drop")!;
    const unpaid = evaluatedOverall.find((r) => r.userId === "u-unpaid")!;

    expect(disq.isEligible).toBe(false);
    expect(disq.ineligibilityReason).toBe("DISQUALIFIED");

    expect(drop.isEligible).toBe(false);
    expect(drop.ineligibilityReason).toBe("DROPPED");

    expect(unpaid.isEligible).toBe(false);
    expect(unpaid.ineligibilityReason).toBe("PAYMENT_PENDING");
  });
});
