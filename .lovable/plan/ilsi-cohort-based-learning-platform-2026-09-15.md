# ILSI — Cohort-Based Learning Platform

A complete, real learning platform for ILSI: public site, applications, participant learning experience with time-locked sequential modules, quizzes, live sessions, payments, notifications, certificates, and full admin/instructor back-office. English + French throughout.

## One important stack note

This project runs on Lovable's built-in stack: React + TypeScript + Vite + Tailwind + TanStack Router/Query + React Hook Form + Zod + Lucide — exactly as requested on the frontend. For the backend, the app already has a production server runtime with typed server endpoints plus a managed PostgreSQL database, storage, and authentication (Lovable Cloud). So instead of a separate Express + Better Auth server, the same architecture is implemented here: controllers/services/repositories, Zod validation on every endpoint, role-based access control, secure sessions, and all access checks enforced server-side. No business rule is trusted from the browser. Everything you asked for is delivered; only the server framework name differs.

## Architecture

```text
Program → Cohort → Module → Lesson → (video | text | pdf | case study | activity)
                      └── Quiz → Questions → Attempts → Answers
                      └── Live session (+ recording)
```

### Database (PostgreSQL, UUID keys, timestamps, RLS)
users/profiles, user_roles (separate table, never on profile), programs, cohorts, cohort_members, applications, payments, modules, lessons, resources, lesson_resources, quizzes, quiz_questions, quiz_options, quiz_attempts, quiz_answers, lesson_progress, module_progress, live_sessions, live_attendance, notifications, certificates, settings. Bilingual columns (`title_en`/`title_fr`, `content_en`/`content_fr`, …) on all content tables. Indexes on every foreign key and on the progress lookups the dashboard runs.

### Module access rule (server-side, single source of truth)
`canAccessModule(userId, cohortId, moduleId)` returns allow/deny + a reason code. Module N unlocks only when: the cohort schedule has opened it, module N−1 is complete, every mandatory lesson of N−1 is complete, its required quiz is submitted, and the score meets the configured passing score. Payment must be settled when the cohort requires it. Dates alone never unlock anything. Every lesson, quiz, and resource endpoint runs this check and returns `MODULE_LOCKED` with a translated message when it fails. Admin override is a separate audited action.

### Quiz engine
Multiple choice, true/false, fill-in-the-blank, scenario, written answer, reflection. Auto-grading for objective types, manual grading queue for written ones. Every attempt stored with score, percentage, pass/fail, attempt number. Results screen shows correct/incorrect answers with explanations; failures prompt a retake within the configured attempt limit.

### Consistent API responses
`{ success: false, error: { code: "MODULE_LOCKED", message } }` with meaningful codes the frontend maps to localized UX messages.

## What gets built

**Public site** — Home, Programs, Program detail, Apply, About, Contact, Login, Forgot/Reset password. Clean editorial layout inspired by the reference: soft warm-to-cool gradient hero, generous whitespace, restrained type, subtle bordered cards.

**Application flow** — Configurable application form with full applicant fields, statuses PENDING → UNDER_REVIEW → SELECTED / REJECTED / WAITLISTED → PAYMENT_PENDING → ENROLLED. Approval does not grant access; enrollment does.

**Accounts & first login** — Admin creates accounts with a temporary password; first login forces profile setup, password change, and terms acceptance before the dashboard opens.

**Participant experience** — Dashboard (progress, current module, next deadline, next live session, recent quiz results, notifications, certification status), module roadmap with UPCOMING/ACTIVE/LOCKED/COMPLETED/FAILED/EXPIRED states, and a course player: module sidebar, lesson content, resources, video progress tracking with a completion threshold, prev/next navigation and progress indicators.

**Instructor** — Assigned cohorts, participants, progress, quiz performance, manual grading, live sessions.

**Admin** — Overview analytics, participants (search/filter/detail/suspend/reset/manual unlock), applications review with confirmation dialogs, and full CRUD for programs, cohorts, modules, lessons, resources, quizzes, questions, live sessions, payments, notifications, certificates, settings (passing scores, thresholds, dates).

**Cross-cutting** — Notification center, payment records behind a provider-agnostic `PaymentService` with a working development provider, certificate eligibility engine, EN/FR i18n with locale files and a profile-stored preference, skeleton loaders, empty states, error states, toasts, responsive layouts (sidebar → collapsible → mobile bottom nav) verified at 375/390/768/1024/1440, accessibility, and seed data: 1 admin, 2 instructors, ~8 participants, "Young Leaders Training" / "September 2026 Cohort", 5 modules with lessons, resources, quizzes of mixed types, live sessions, applications, and payments.

## Build order

1. Database schema, roles, RLS, seed data
2. Auth, first-login flow, route protection by role
3. Access-control service + module/lesson/quiz endpoints
4. Design system, i18n, shared UI (states, tables, forms)
5. Public site + application flow
6. Participant dashboard + course player
7. Quiz engine end to end
8. Live sessions, notifications, payments, certificates
9. Admin + instructor back-office
10. Verification pass of the Section 43 scenario, including direct API calls against a locked module

This is large. I will build it in these stages and report progress as each lands; the first response will cover stages 1–3 so the rules are correct before any screen is built.
