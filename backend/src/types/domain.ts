/**
 * Shared domain models matching the ILSI frontend interfaces
 */

export type Bilingual = { en: string; fr: string };

export type Role = "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR" | "PARTICIPANT";

export type ContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type LessonAccessState =
  | "LOCKED"
  | "UPCOMING"
  | "AVAILABLE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export type LockReason =
  | "NOT_ENROLLED"
  | "NOT_PUBLISHED"
  | "AVAILABLE_FROM_FUTURE"
  | "ACCESS_PERIOD_ENDED"
  | "PREREQUISITE_INCOMPLETE"
  | "PREREQUISITE_FAILED"
  | "COHORT_INACTIVE"
  | "PAYMENT_REQUIRED"
  | "CONTENT_UNAVAILABLE";

export type ModuleState =
  | "UPCOMING"
  | "ACTIVE"
  | "LOCKED"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export type LessonType =
  | "VIDEO"
  | "TEXT"
  | "PDF"
  | "RESOURCE"
  | "CASE_STUDY"
  | "INTERACTIVE_ACTIVITY";

export type QuestionType =
  | "MULTIPLE_CHOICE"
  | "TRUE_FALSE"
  | "FILL_BLANK"
  | "SCENARIO"
  | "WRITTEN"
  | "REFLECTION";

export type ApplicationStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "SELECTED"
  | "REJECTED"
  | "WAITLISTED"
  | "PAYMENT_PENDING"
  | "ENROLLED";

export type EnrollmentStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PAYMENT_PENDING"
  | "ACTIVE"
  | "COMPLETED"
  | "SUSPENDED"
  | "CANCELLED"
  | "DROPPED";

export type PaymentStatus = "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type PaymentType = "COHORT_FEE" | "DONATION";

export type CertificationStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CERTIFIED";

export type CohortStatus =
  | "DRAFT"
  | "APPLICATION_OPEN"
  | "APPLICATION_CLOSED"
  | "UPCOMING"
  | "ACTIVE"
  | "COMPLETED"
  | "ARCHIVED";

export interface ProgramDTO {
  id: string;
  slug: string;
  title: Bilingual;
  tagline: Bilingual;
  description: Bilingual;
  audience: Bilingual[];
  outcomes: Bilingual[];
  durationWeeks: number;
  moduleCount: number;
  format: Bilingual;
  price: number;
  priceEur?: number;
  currency: string;
}

export interface CohortDTO {
  id: string;
  programId: string;
  name: Bilingual;
  startDate: string;
  endDate: string;
  capacity: number;
  enrolled: number;
  status: CohortStatus;
  passingScore: number;
  feeAmount?: number;
  feeCurrency?: string;
  description?: Bilingual;
  timezone?: string;
  applicationOpen?: boolean;
  applicationDeadline?: string;
  maxParticipants?: number;
}

export interface EnrollmentDTO {
  id: string;
  userId: string;
  cohortId: string;
  cohortName: Bilingual;
  programTitle: Bilingual;
  status: EnrollmentStatus;
  paymentStatus: PaymentStatus;
  certificationStatus?: CertificationStatus;
  enrolledAt: string;
  startAt?: string;
  endAt?: string;
  completedAt?: string;
}

export interface ResourceDTO {
  id: string;
  name: Bilingual;
  type: "PDF" | "DOC" | "PPT" | "IMAGE" | "LINK";
  sizeKb?: number;
  url: string;
  downloadable: boolean;
}

export interface ChapterDTO {
  id: string;
  lessonId: string;
  order: number;
  title: Bilingual;
  description?: Bilingual;
  body?: Bilingual;
  durationMinutes: number;
  videoUrl?: string;
  status: ContentStatus;
}

export interface LessonAccessDTO {
  lessonId: string;
  cohortId?: string;
  state: LessonAccessState;
  isLocked: boolean;
  lockReason?: LockReason;
  availableFrom?: string;
  availableUntil?: string;
  prerequisite?: { id: string; title: Bilingual } | null;
  progress: number;
}

export interface LessonDTO {
  id: string;
  moduleId: string;
  order: number;
  type: LessonType;
  title: Bilingual;
  description: Bilingual;
  body: Bilingual;
  videoUrl?: string;
  durationMinutes: number;
  mandatory: boolean;
  status?: ContentStatus;
  chapters?: ChapterDTO[];
  resources: ResourceDTO[];
  access?: LessonAccessDTO;
}

export interface CohortLessonDTO {
  id: string;
  cohortId: string;
  lessonId: string;
  order: number;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  isRequired: boolean;
  isPublished: boolean;
  status: ContentStatus;
  passingScore: number;
  prerequisiteLessonId?: string | null;
  prerequisiteAssignmentId?: string | null;
  lesson?: LessonDTO;
  accessState?: LessonAccessState;
  lockReason?: LockReason;
}

export interface QuizOptionDTO {
  id: string;
  label: Bilingual;
  correct?: boolean; // Hidden for students in take-quiz view
}

export interface QuizQuestionDTO {
  id: string;
  order: number;
  type: QuestionType;
  prompt: Bilingual;
  options: QuizOptionDTO[];
  points: number;
  explanation?: Bilingual;
  required: boolean;
}

export interface QuizDTO {
  id: string;
  moduleId?: string;
  lessonId?: string;
  title: Bilingual;
  description: Bilingual;
  timeLimitMinutes?: number;
  passingScore: number;
  attemptsAllowed: number;
  questions: QuizQuestionDTO[];
  published: boolean;
  status?: ContentStatus;
}

export interface CourseModuleDTO {
  id: string;
  cohortId?: string;
  programId?: string;
  order: number;
  title: Bilingual;
  description: Bilingual;
  startDate?: string;
  endDate?: string;
  estimatedHours: number;
  requiredCompletion: number;
  passingScore: number;
  status?: ContentStatus;
  lessons: LessonDTO[];
  quiz: QuizDTO;
  resources: ResourceDTO[];
}

export interface QuizAttemptDTO {
  id: string;
  quizId: string;
  moduleId: string;
  participantId: string;
  startedAt: string;
  submittedAt: string;
  score: number;
  percentage: number;
  passed: boolean;
  attemptNumber: number;
}

export interface LiveSessionDTO {
  id: string;
  cohortId: string;
  moduleId?: string;
  title: Bilingual;
  description: Bilingual;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  meetingUrl?: string;
  recordingUrl?: string;
  instructor: string;
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
}

export interface NotificationDTO {
  id: string;
  type:
    | "MODULE_UNLOCKED"
    | "DEADLINE"
    | "QUIZ_PASSED"
    | "QUIZ_FAILED"
    | "LIVE_SCHEDULED"
    | "LIVE_REMINDER"
    | "APPLICATION"
    | "PAYMENT"
    | "CERTIFICATE";
  title: Bilingual;
  body: Bilingual;
  createdAt: string;
  read: boolean;
}

export interface EnrolledCohortSummary {
  cohortId: string;
  cohortName: Bilingual;
  programId: string;
  programSlug: string;
  programTitle: Bilingual;
  startDate: string;
  endDate: string;
  status: string;
  progress: number;
  completedModulesCount: number;
  totalModulesCount: number;
  isCurrent: boolean;
}

export interface StudentDashboardDTO {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    country?: string;
    city?: string;
    locale: "en" | "fr";
    role: Role;
    firstLogin: boolean;
    onboardingCompleted: boolean;
  };
  program: ProgramDTO | null;
  cohort: CohortDTO | null;
  enrolledCohorts: EnrolledCohortSummary[];
  overallProgress: number;
  completedModulesCount: number;
  lessonsDoneCount: number;
  lessonsTotalCount: number;
  avgScore: number;
  attendancePercent: number;
  currentModuleId: string | null;
  modules: Array<{
    module: CourseModuleDTO;
    state: ModuleState;
    doneLessons: number;
    totalLessons: number;
    completionPercent: number;
    bestScore: number;
    hours: number;
  }>;
  upcomingLiveSessions: LiveSessionDTO[];
  recentAttempts: QuizAttemptDTO[];
  progressTrend?: number[];
  completedModulesTrend?: number[];
  quizScoresTrend?: number[];
  attendanceTrend?: number[];
}
