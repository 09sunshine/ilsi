/** Shared domain types for the ILSI learning platform. */

export type Bilingual = { en: string; fr: string };

export type Role = "SUPER_ADMIN" | "ADMIN" | "INSTRUCTOR" | "PARTICIPANT";

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

export type PaymentStatus = "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type CertificationStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "CERTIFIED";

export type CohortStatus = "UPCOMING" | "ACTIVE" | "COMPLETED" | "ARCHIVED";

export interface Program {
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
  currency: string;
}

export interface Cohort {
  id: string;
  programId: string;
  name: Bilingual;
  startDate: string;
  endDate: string;
  capacity: number;
  enrolled: number;
  status: CohortStatus;
  passingScore: number;
}

export interface Resource {
  id: string;
  name: Bilingual;
  type: "PDF" | "DOC" | "PPT" | "IMAGE" | "LINK";
  sizeKb?: number;
  url: string;
  downloadable: boolean;
}

export interface Lesson {
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
  resources: Resource[];
}

export interface QuizOption {
  id: string;
  label: Bilingual;
  correct: boolean;
}

export interface QuizQuestion {
  id: string;
  order: number;
  type: QuestionType;
  prompt: Bilingual;
  options: QuizOption[];
  correctText?: string;
  points: number;
  explanation: Bilingual;
  required: boolean;
}

export interface Quiz {
  id: string;
  moduleId: string;
  title: Bilingual;
  description: Bilingual;
  timeLimitMinutes?: number;
  passingScore: number;
  attemptsAllowed: number;
  questions: QuizQuestion[];
  published: boolean;
}

export interface LiveSession {
  id: string;
  cohortId: string;
  moduleId: string;
  title: Bilingual;
  description: Bilingual;
  date: string;
  startTime: string;
  endTime: string;
  meetingUrl?: string;
  recordingUrl?: string;
  instructor: string;
  status: "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";
}

export interface CourseModule {
  id: string;
  cohortId: string;
  order: number;
  title: Bilingual;
  description: Bilingual;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  requiredCompletion: number;
  passingScore: number;
  lessons: Lesson[];
  quiz: Quiz;
  resources: Resource[];
}

export interface QuizAttempt {
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

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  city: string;
  role: Role;
  programId: string;
  cohortId: string;
  paymentStatus: PaymentStatus;
  certification: CertificationStatus;
  suspended: boolean;
  firstLogin: boolean;
  locale: "en" | "fr";
  joinedAt: string;
}

export interface Application {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  programId: string;
  status: ApplicationStatus;
  submittedAt: string;
  reviewScore?: number;
  notes?: string;
  paymentStatus: PaymentStatus;
}

export interface Payment {
  id: string;
  participantName: string;
  applicationId?: string;
  cohortId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionId?: string;
  createdAt: string;
}

export interface NotificationItem {
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

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  videoPercent: number;
}

export interface ParticipantProgress {
  participantId: string;
  lessons: Record<string, LessonProgress>;
  attempts: QuizAttempt[];
}
