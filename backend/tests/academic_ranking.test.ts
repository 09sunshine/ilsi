import { describe, it, expect } from "vitest";
import { RankingService } from "../src/services/RankingService.js";

describe("Academic Ranking Engine — Deterministic Scoring & Competition Rules", () => {
  // Test Model Interfaces
  interface MockStudentResult {
    userId: string;
    enrollmentStatus: "ACTIVE" | "COMPLETED" | "DISQUALIFIED" | "DROPPED" | "SUSPENDED";
    paymentStatus: "PAID" | "NOT_REQUIRED" | "PENDING";
    moduleScores: number[]; // percentage marks of completed modules
  }

  function computeRanking(
    students: MockStudentResult[],
    previousRanks?: Map<string, number>
  ) {
    const evaluated: Array<{
      userId: string;
      isEligible: boolean;
      ineligibilityReason: string | null;
      completedModules: number;
      average: number;
      points: number;
      rank: number | null;
      rankChange: number | null;
      medal: "GOLD" | "SILVER" | "BRONZE" | null;
    }> = [];

    for (const st of students) {
      if (st.enrollmentStatus === "DISQUALIFIED") {
        evaluated.push({
          userId: st.userId,
          isEligible: false,
          ineligibilityReason: "DISQUALIFIED",
          completedModules: 0,
          average: 0.0,
          points: 0.0,
          rank: null,
          rankChange: null,
          medal: null,
        });
        continue;
      }

      if (st.enrollmentStatus === "DROPPED") {
        evaluated.push({
          userId: st.userId,
          isEligible: false,
          ineligibilityReason: "DROPPED",
          completedModules: 0,
          average: 0.0,
          points: 0.0,
          rank: null,
          rankChange: null,
          medal: null,
        });
        continue;
      }

      if (st.paymentStatus !== "PAID" && st.paymentStatus !== "NOT_REQUIRED") {
        evaluated.push({
          userId: st.userId,
          isEligible: false,
          ineligibilityReason: "PAYMENT_PENDING",
          completedModules: 0,
          average: 0.0,
          points: 0.0,
          rank: null,
          rankChange: null,
          medal: null,
        });
        continue;
      }

      if (st.moduleScores.length === 0) {
        evaluated.push({
          userId: st.userId,
          isEligible: false,
          ineligibilityReason: "NO_COMPLETED_MODULES",
          completedModules: 0,
          average: 0.0,
          points: 0.0,
          rank: null,
          rankChange: null,
          medal: null,
        });
        continue;
      }

      const scoreSum = st.moduleScores.reduce((a, b) => a + b, 0);
      const roundedAvg = Number((scoreSum / st.moduleScores.length).toFixed(2));
      const totalPoints = Number(scoreSum.toFixed(2));

      evaluated.push({
        userId: st.userId,
        isEligible: true,
        ineligibilityReason: null,
        completedModules: st.moduleScores.length,
        average: roundedAvg,
        points: totalPoints,
        rank: null,
        rankChange: null,
        medal: null,
      });
    }

    // Standard competition ranking ("1224" ranking)
    const eligible = evaluated.filter((s) => s.isEligible);
    eligible.sort((a, b) => {
      if (b.average !== a.average) return b.average - a.average;
      if (b.points !== a.points) return b.points - a.points;
      return b.completedModules - a.completedModules;
    });

    for (let i = 0; i < eligible.length; i++) {
      if (i > 0) {
        const prev = eligible[i - 1];
        const curr = eligible[i];
        if (curr.average === prev.average) {
          curr.rank = prev.rank;
        } else {
          curr.rank = i + 1;
        }
      } else {
        eligible[0].rank = 1;
      }
      currMedal: eligible[i].medal = RankingService.getMedal(eligible[i].rank);
    }

    // Movement calculation
    for (const el of eligible) {
      if (previousRanks && previousRanks.has(el.userId)) {
        const prevRank = previousRanks.get(el.userId)!;
        el.rankChange = prevRank - el.rank!;
      } else {
        el.rankChange = null; // New to ranking
      }
    }

    return evaluated;
  }

  it("calculates exact academic averages and cumulative points deterministically", () => {
    const students: MockStudentResult[] = [
      {
        userId: "user-1",
        enrollmentStatus: "ACTIVE",
        paymentStatus: "PAID",
        moduleScores: [80, 90, 100],
      },
      {
        userId: "user-2",
        enrollmentStatus: "ACTIVE",
        paymentStatus: "PAID",
        moduleScores: [75, 85],
      },
    ];

    const results = computeRanking(students);
    const u1 = results.find((r) => r.userId === "user-1")!;
    const u2 = results.find((r) => r.userId === "user-2")!;

    expect(u1.average).toBe(90.0);
    expect(u1.points).toBe(270.0);
    expect(u1.rank).toBe(1);

    expect(u2.average).toBe(80.0);
    expect(u2.points).toBe(160.0);
    expect(u2.rank).toBe(2);
  });

  it("applies standard competition ranking (1224 policy) for tied averages", () => {
    const students: MockStudentResult[] = [
      { userId: "u-first", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [95] },
      { userId: "u-tie-a", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [90] },
      { userId: "u-tie-b", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [90] },
      { userId: "u-fourth", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [85] },
    ];

    const results = computeRanking(students);
    const first = results.find((r) => r.userId === "u-first")!;
    const tieA = results.find((r) => r.userId === "u-tie-a")!;
    const tieB = results.find((r) => r.userId === "u-tie-b")!;
    const fourth = results.find((r) => r.userId === "u-fourth")!;

    expect(first.rank).toBe(1);
    expect(first.medal).toBe("GOLD");

    expect(tieA.rank).toBe(2);
    expect(tieA.medal).toBe("SILVER");

    expect(tieB.rank).toBe(2);
    expect(tieB.medal).toBe("SILVER");

    expect(fourth.rank).toBe(4); // Skips rank 3 because of 2 shared rank 2s
    expect(fourth.medal).toBeNull();
  });

  it("awards bronze medal to rank 3", () => {
    const students: MockStudentResult[] = [
      { userId: "u-1", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [98] },
      { userId: "u-2", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [92] },
      { userId: "u-3", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [88] },
      { userId: "u-4", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [80] },
    ];

    const results = computeRanking(students);
    const bronze = results.find((r) => r.userId === "u-3")!;
    expect(bronze.rank).toBe(3);
    expect(bronze.medal).toBe("BRONZE");
  });

  it("calculates movement history correctly (+gained, -dropped, 0 unchanged, null new)", () => {
    const students: MockStudentResult[] = [
      { userId: "u-climber", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [95] }, // currently rank 1
      { userId: "u-faller", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [85] },  // currently rank 3
      { userId: "u-steady", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [90] },  // currently rank 2
      { userId: "u-fresh", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [80] },   // currently rank 4
    ];

    const previousRanks = new Map<string, number>([
      ["u-climber", 4], // was 4, now 1 => +3 (gained 3 places)
      ["u-faller", 1],  // was 1, now 3 => -2 (dropped 2 places)
      ["u-steady", 2],  // was 2, now 2 => 0 (unchanged)
      // u-fresh was not ranked previously => null
    ]);

    const results = computeRanking(students, previousRanks);
    const climber = results.find((r) => r.userId === "u-climber")!;
    const faller = results.find((r) => r.userId === "u-faller")!;
    const steady = results.find((r) => r.userId === "u-steady")!;
    const fresh = results.find((r) => r.userId === "u-fresh")!;

    expect(climber.rank).toBe(1);
    expect(climber.rankChange).toBe(3); // 4 - 1 = +3

    expect(faller.rank).toBe(3);
    expect(faller.rankChange).toBe(-2); // 1 - 3 = -2

    expect(steady.rank).toBe(2);
    expect(steady.rankChange).toBe(0); // 2 - 2 = 0

    expect(fresh.rank).toBe(4);
    expect(fresh.rankChange).toBeNull(); // New to ranking
  });

  it("marks disqualified, dropped, unpaid, or 0-module students as ineligible with documented reasons", () => {
    const students: MockStudentResult[] = [
      { userId: "u-disq", enrollmentStatus: "DISQUALIFIED", paymentStatus: "PAID", moduleScores: [90] },
      { userId: "u-drop", enrollmentStatus: "DROPPED", paymentStatus: "PAID", moduleScores: [85] },
      { userId: "u-unpaid", enrollmentStatus: "ACTIVE", paymentStatus: "PENDING", moduleScores: [90] },
      { userId: "u-newbie", enrollmentStatus: "ACTIVE", paymentStatus: "PAID", moduleScores: [] },
    ];

    const results = computeRanking(students);

    const disq = results.find((r) => r.userId === "u-disq")!;
    expect(disq.isEligible).toBe(false);
    expect(disq.ineligibilityReason).toBe("DISQUALIFIED");
    expect(disq.rank).toBeNull();

    const drop = results.find((r) => r.userId === "u-drop")!;
    expect(drop.isEligible).toBe(false);
    expect(drop.ineligibilityReason).toBe("DROPPED");

    const unpaid = results.find((r) => r.userId === "u-unpaid")!;
    expect(unpaid.isEligible).toBe(false);
    expect(unpaid.ineligibilityReason).toBe("PAYMENT_PENDING");

    const newbie = results.find((r) => r.userId === "u-newbie")!;
    expect(newbie.isEligible).toBe(false);
    expect(newbie.ineligibilityReason).toBe("NO_COMPLETED_MODULES");
  });
});
