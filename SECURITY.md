# ILSI LMS: Security & Access Control Model

## 1. Security Architecture Principles

The ILSI LMS enforces a zero-trust model between client applications and protected learning materials:
1. **Never trust client state**: Dates, timer offsets, completion flags, and prices supplied by the client are never accepted as authorization decisions.
2. **Server-side authorization on every media request**: Every request for video streaming, slide decks, or resource downloads undergoes RBAC and dynamic scheduling evaluation.
3. **Defense-in-depth quiz grading**: Answer keys are never sent to the client prior to final attempt submission.
4. **Timing-safe cryptographic CSRF**: OAuth integrations (Google Meet / Google Calendar) enforce HMAC SHA-256 state signatures with `crypto.timingSafeEqual` to prevent CSRF and account hijacking.

---

## 2. Access Control Pipeline

The `LessonAccessService.assertAccess(userId, lessonId, targetCohortId)` method is enforced on all content access routes:

```typescript
// Routes protected by LessonAccessService:
// 1. GET /api/lessons/:id
// 2. GET /api/lessons/:id/video
// 3. POST /api/progress/lessons/:id
// 4. GET /api/quizzes/:id
// 5. POST /api/quizzes/:id/attempts
```

### Authorization Steps
1. **Identity & Session Verification**: Better Auth session validated via HTTP-only session cookie or Bearer token.
2. **Cohort Membership**: User must have an `ACTIVE` or `COMPLETED` enrollment with `payment_status = 'PAID'` or `'NOT_REQUIRED'`.
3. **Temporal Bounds Check**: Server system clock is evaluated against `cohort_lessons.start_at` and `cohort_lessons.end_at`.
4. **Prerequisite Enforcement**: If a lesson defines `prerequisite_lesson_id`, the student must hold a `completed = true` record in `lesson_progress` and passing score in `quiz_attempts` for that prerequisite in this cohort.

---

## 3. Storage Asset Protection

### Private Supabase Buckets
- `course-videos`: Contains raw video MP4 files. Private access only.
- `course-resources`: Contains case study PDFs and exercise files. Private access only.
- `course-thumbnails`: Public read-only for program and cohort marketing thumbnails.

### Signed URL Lifecycle
- URLs generated via `supabaseAdmin.storage.from(bucket).createSignedUrl(path, 3600)`.
- Client receives a signed playback token valid for 60 minutes.
- Expired tokens cannot be refreshed without repeating `assertAccess()`.

---

## 4. Anti-Tampering & Payment Security

- **Pricing Authority**: Cohort fee amounts and currencies (`USD`, `EUR`) are queried directly from the database by `PaymentService`. Client payloads cannot override or modify prices.
- **Webhook Signature Verification**: Stripe webhook events require valid `stripe-signature` verification using `STRIPE_WEBHOOK_SECRET`.
- **Idempotent Webhook Processing**: Transactions are deduplicated against the `payments` table using `provider_payment_id` unique indexing.

---

## 5. Audit Logging

Administrative actions affecting cohorts, curriculum, and participant enrollments are recorded in `audit_logs` with:
- `user_id`: Administrator who triggered the action.
- `action`: E.g., `DELETE_COHORT`, `ASSIGN_COHORT_LESSON`, `ARCHIVE_LESSON`.
- `resource_type` & `resource_id`.
- `metadata`: JSON payload documenting change parameters and timestamp.
