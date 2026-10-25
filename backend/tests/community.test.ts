import { describe, it, expect, vi, beforeEach } from "vitest";
import { communitySchemas } from "../src/validators/schemas.js";
import { CommunityService } from "../src/services/CommunityService.js";
import { pool } from "../src/database/pool.js";

describe("Community Platform: Private Cohort Spaces & Global Social Network", () => {
  describe("Schema Validation & Anti-Tampering", () => {
    it("validates valid cohort post creation", () => {
      const cohortId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
      const result = communitySchemas.createPost.safeParse({
        scope: "cohort",
        cohortId,
        type: "DISCUSSION",
        title: "Session 1 Debrief Discussion",
        content: "What were your main takeaways from today's strategic planning session?",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scope).toBe("cohort");
        expect(result.data.cohortId).toBe(cohortId);
      }
    });

    it("rejects cohort post if cohortId is missing", () => {
      const result = communitySchemas.createPost.safeParse({
        scope: "cohort",
        type: "DISCUSSION",
        content: "Cohort post without cohortId",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("cohortId");
      }
    });

    it("validates valid global post creation", () => {
      const result = communitySchemas.createPost.safeParse({
        scope: "global",
        type: "ACHIEVEMENT",
        title: "Graduated Cohort 2026!",
        content: "Excited to share that our cohort capstone project on clean water management is completed!",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scope).toBe("global");
        expect(result.data.cohortId).toBeUndefined();
      }
    });

    it("rejects global post if cohortId is supplied (prevents scope confusion)", () => {
      const result = communitySchemas.createPost.safeParse({
        scope: "global",
        cohortId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        content: "Global post trying to attach cohortId",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("cohortId");
      }
    });

    it("enforces post content minimum and maximum character limits", () => {
      const tooShort = communitySchemas.createPost.safeParse({
        scope: "global",
        content: "hi",
      });
      expect(tooShort.success).toBe(false);

      const validContent = communitySchemas.createPost.safeParse({
        scope: "global",
        content: "Hello everyone, excited to be here!",
      });
      expect(validContent.success).toBe(true);
    });

    it("validates reactions and rejects unauthorized emoji types", () => {
      const valid = communitySchemas.reaction.safeParse({
        targetType: "post",
        targetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        reactionType: "heart",
      });
      expect(valid.success).toBe(true);

      const invalidReaction = communitySchemas.reaction.safeParse({
        targetType: "post",
        targetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        reactionType: "poop",
      });
      expect(invalidReaction.success).toBe(false);
    });

    it("validates content report schema", () => {
      const validReport = communitySchemas.report.safeParse({
        targetType: "post",
        targetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        reason: "SPAM",
        details: "Repeated promotional advertising links",
      });
      expect(validReport.success).toBe(true);

      const invalidReason = communitySchemas.report.safeParse({
        targetType: "post",
        targetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        reason: "INVALID_REASON",
      });
      expect(invalidReason.success).toBe(false);
    });

    it("validates user community profile update schema", () => {
      const profile = communitySchemas.updateCommunityProfile.safeParse({
        headline: "Tech Lead & Community Organizer",
        bio: "Passionate about decentralized systems and youth leadership development.",
        skills: ["Project Management", "TypeScript", "Public Speaking"],
        interests: ["Education", "Social Entrepreneurship"],
        linkedinUrl: "https://linkedin.com/in/ilsi-alumni",
        githubUrl: "https://github.com/ilsi-dev",
        isProfilePublic: true,
      });

      expect(profile.success).toBe(true);
    });
  });

  describe("Cohort Access Control & Isolation Rules", () => {
    it("grants access to SUPER_ADMIN and ADMIN unconditionally", async () => {
      const superAdminAccess = await CommunityService.canAccessCohort(
        "admin-user-1",
        "cohort-uuid-1",
        "SUPER_ADMIN"
      );
      const adminAccess = await CommunityService.canAccessCohort(
        "admin-user-2",
        "cohort-uuid-1",
        "ADMIN"
      );

      expect(superAdminAccess).toBe(true);
      expect(adminAccess).toBe(true);
    });

    it("verifies instructor cohort assignment via cohort_instructors", async () => {
      const spy = vi.spyOn(pool, "query").mockResolvedValueOnce({
        rows: [{ 1: 1 }],
      } as any);

      const isInstructorAuthorized = await CommunityService.canAccessCohort(
        "instructor-1",
        "cohort-uuid-1",
        "INSTRUCTOR"
      );

      expect(isInstructorAuthorized).toBe(true);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("verifies student enrollment in cohort (must be ACTIVE or COMPLETED and PAID)", async () => {
      const spy = vi
        .spyOn(pool, "query")
        .mockResolvedValueOnce({ rows: [{ 1: 1 }] } as any); // unified access query returns matching record

      const studentHasAccess = await CommunityService.canAccessCohort(
        "student-1",
        "cohort-uuid-1",
        "PARTICIPANT"
      );

      expect(studentHasAccess).toBe(true);
      spy.mockRestore();
    });

    it("denies access to non-enrolled students and members of other cohorts", async () => {
      const spy = vi
        .spyOn(pool, "query")
        .mockResolvedValueOnce({ rows: [] } as any); // no access found

      const unauthorizedStudentAccess = await CommunityService.canAccessCohort(
        "other-cohort-student",
        "cohort-uuid-1",
        "PARTICIPANT"
      );

      expect(unauthorizedStudentAccess).toBe(false);
      spy.mockRestore();
    });

    it("throws 403 Forbidden when assertCohortAccess is called for unauthorized member", async () => {
      const spy = vi
        .spyOn(pool, "query")
        .mockResolvedValueOnce({ rows: [] } as any); // no access found

      await expect(
        CommunityService.assertCohortAccess("stranger-user", "cohort-uuid-1", "PARTICIPANT")
      ).rejects.toThrow("You do not have access to this private cohort community space.");

      spy.mockRestore();
    });
  });

  describe("Privacy & Data Protection Principles", () => {
    it("never exposes sensitive personal information (phone, email, password) in community profile", async () => {
      const mockUserRow = {
        id: "student-user-123",
        name: "Marie Claire",
        image: "https://avatar.example.com/mc.png",
        role: "PARTICIPANT",
        created_at: new Date(),
        headline: "Healthcare Initiative Director",
        bio: "Leading community clinics in rural areas.",
        skills: ["Healthcare Leadership", "Operations"],
        interests: ["Global Health", "Social Policy"],
        portfolio_url: "https://marieclaire.org",
        linkedin_url: "https://linkedin.com/in/marieclaire",
        github_url: null,
        website_url: null,
        is_profile_public: true,
        show_enrolled_programs: true,
      };

      const spy = vi
        .spyOn(pool, "query")
        .mockResolvedValueOnce({ rows: [mockUserRow] } as any) // user profile
        .mockResolvedValueOnce({ rows: [] } as any) // programs
        .mockResolvedValueOnce({ rows: [] } as any); // projects

      const profile = await CommunityService.getCommunityProfile("student-user-123", "viewer-user");

      // Verification: Sensitive fields must NOT exist in returned object
      expect((profile as any).email).toBeUndefined();
      expect((profile as any).phone).toBeUndefined();
      expect((profile as any).password).toBeUndefined();
      expect((profile as any).status).toBeUndefined();
      expect(profile.name).toBe("Marie Claire");
      expect(profile.headline).toBe("Healthcare Initiative Director");

      spy.mockRestore();
    });
  });
});
