import { z } from "zod";

export const authSchemas = {
  login: z.object({
    email: z.string().trim().email("Please provide a valid email address").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
  }),
  signup: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    email: z.string().trim().email("Please provide a valid email address").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
  }),
  onboarding: z.object({
    firstName: z.string().trim().min(2, "First name must be at least 2 characters").max(100),
    lastName: z.string().trim().min(2, "Last name must be at least 2 characters").max(100),
    phone: z.string().trim().min(6, "Phone must be at least 6 characters").max(30).optional(),
    country: z.string().trim().min(2).max(100).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    locale: z.enum(["en", "fr"]).optional(),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
    currentPassword: z.string().optional(),
  }),
  firstLoginPassword: z.object({
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(128),
  }),
  updateProfile: z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    phone: z.string().trim().max(30).optional().or(z.literal("")).nullable(),
    country: z.string().trim().max(100).optional().or(z.literal("")).nullable(),
    city: z.string().trim().max(100).optional().or(z.literal("")).nullable(),
    locale: z.enum(["en", "fr"]).optional(),
  }),
};


export const applicationSchemas = {
  submit: z.object({
    firstName: z.string().trim().min(2, "First name is too short").max(60),
    lastName: z.string().trim().min(2, "Last name is too short").max(60),
    email: z.string().trim().email("Invalid email address").max(255),
    phone: z.string().trim().min(6, "Phone number is too short").max(30),
    country: z.string().trim().min(2, "Country is required").max(60),
    city: z.string().trim().min(2, "City is required").max(60),
    dateOfBirth: z.string().optional(),
    education: z.string().trim().min(2).max(120),
    occupation: z.string().trim().min(2).max(120),
    organization: z.string().trim().max(120).optional().or(z.literal("")),
    programId: z.string().min(1, "Program selection is required"),
    cohortId: z.string().optional(),
    motivation: z.string().trim().min(40, "Motivation statement must be at least 40 characters").max(2000),
    experience: z.string().trim().max(2000).optional().or(z.literal("")),
    terms: z.boolean().refine((val) => val === true, "You must accept the terms"),
  }),
  track: z
    .object({
      email: z.string().trim().email("Invalid email address").max(255).optional().or(z.literal("")),
      applicationId: z.string().trim().max(100).optional().or(z.literal("")),
    })
    .refine((data) => Boolean((data.email && data.email.length > 0) || (data.applicationId && data.applicationId.length > 0)), {
      message: "Please provide your email address or application ID to track your application.",
    }),
};

export const paymentSchemas = {
  createIntent: z.object({
    cohortId: z.string().optional(),
    enrollmentId: z.string().optional(),
    applicationId: z.string().optional(),
    currency: z.enum(["USD", "EUR"]).optional(),
    provider: z.string().optional(),
  }),
  enrollmentPayment: z.object({
    currency: z.enum(["USD", "EUR"]).optional(),
    provider: z.string().optional(),
  }),
  verifySession: z.object({
    sessionId: z.string().min(1, "sessionId is required"),
    paymentId: z.string().optional(),
  }),
  verifyPayment: z.object({
    paymentId: z.string().min(1, "paymentId is required"),
    providerTransactionId: z.string().optional(),
  }),
};

export const progressSchemas = {
  updateLesson: z.object({
    videoPercent: z.number().int().min(0).max(100),
    markComplete: z.boolean().optional(),
  }),
};

export const quizSchemas = {
  submitAttempt: z.object({
    answers: z.record(z.string(), z.string()).refine((obj) => Object.keys(obj).length > 0, {
      message: "At least one question must be answered",
    }),
  }),
};

export const adminSchemas = {
  createCohort: z.object({
    programId: z.string().min(1, "programId is required"),
    nameEn: z.string().trim().min(3).max(255),
    nameFr: z.string().trim().min(3).max(255),
    startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date"),
    endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date"),
    capacity: z.number().int().positive().default(30),
    passingScore: z.number().int().min(1).max(100).default(70),
    feeAmount: z.number().min(0).default(0),
    feeCurrency: z.enum(["USD", "EUR"]).default("USD"),
    descriptionEn: z.string().optional(),
    descriptionFr: z.string().optional(),
    timezone: z.string().default("UTC"),
    applicationOpen: z.boolean().default(true),
    applicationDeadline: z.string().optional(),
    maxParticipants: z.number().int().positive().default(30),
    thumbnailUrl: z.string().trim().optional().or(z.literal("")).nullable(),
    status: z
      .enum(["DRAFT", "APPLICATION_OPEN", "APPLICATION_CLOSED", "UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"])
      .default("ACTIVE"),
  }),
  updateCohort: z.object({
    nameEn: z.string().trim().min(3).max(255).optional(),
    nameFr: z.string().trim().min(3).max(255).optional(),
    startDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date").optional(),
    endDate: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date").optional(),
    capacity: z.number().int().positive().optional(),
    passingScore: z.number().int().min(1).max(100).optional(),
    feeAmount: z.number().min(0).optional(),
    feeCurrency: z.enum(["USD", "EUR"]).optional(),
    descriptionEn: z.string().optional(),
    descriptionFr: z.string().optional(),
    timezone: z.string().optional(),
    applicationOpen: z.boolean().optional(),
    applicationDeadline: z.string().optional(),
    maxParticipants: z.number().int().positive().optional(),
    thumbnailUrl: z.string().trim().optional().or(z.literal("")).nullable(),
    status: z
      .enum(["DRAFT", "APPLICATION_OPEN", "APPLICATION_CLOSED", "UPCOMING", "ACTIVE", "COMPLETED", "ARCHIVED"])
      .optional(),
  }),
  createEnrollment: z.object({
    userId: z.string().min(1, "userId is required"),
    cohortId: z.string().min(1, "cohortId is required"),
    status: z
      .enum(["PENDING", "ACCEPTED", "PAYMENT_PENDING", "ACTIVE", "COMPLETED", "SUSPENDED", "CANCELLED", "DROPPED"])
      .default("ACTIVE"),
    paymentStatus: z.enum(["NOT_REQUIRED", "PENDING", "PAID", "FAILED", "REFUNDED"]).default("PAID"),
  }),
  updateEnrollment: z.object({
    status: z
      .enum(["PENDING", "ACCEPTED", "PAYMENT_PENDING", "ACTIVE", "COMPLETED", "SUSPENDED", "CANCELLED", "DROPPED"])
      .optional(),
    paymentStatus: z.enum(["NOT_REQUIRED", "PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
  }),
  manualPayment: z.object({
    amount: z.number().min(0).optional(),
    currency: z.enum(["USD", "EUR"]).optional(),
    notes: z.string().optional(),
  }),
  bulkStudentImport: z.object({
    students: z.array(
      z.object({
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().min(1, "Last name is required"),
        email: z.string().trim().email("Valid email required"),
        phone: z.string().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
      })
    ).min(1, "At least one student must be provided"),
  }),
  createLiveSession: z.object({
    cohortId: z.string().min(1, "cohortId is required"),
    moduleId: z.string().optional(),
    titleEn: z.string().trim().min(3).max(255),
    titleFr: z.string().trim().max(255).optional(),
    descriptionEn: z.string().trim().max(2000).optional(),
    descriptionFr: z.string().trim().max(2000).optional(),
    startsAt: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date/time"),
    endsAt: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date/time"),
    timezone: z.string().default("UTC"),
    instructorName: z.string().trim().min(2).max(255),
    meetUrl: z.string().trim().optional(),
  }),
  updateLiveSession: z.object({
    meetUrl: z.string().trim().optional(),
    recordingUrl: z.string().trim().optional(),
    startsAt: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid start date/time").optional(),
    endsAt: z.string().refine((d) => !isNaN(Date.parse(d)), "Invalid end date/time").optional(),
    titleEn: z.string().trim().min(3).max(255).optional(),
    titleFr: z.string().trim().max(255).optional(),
    instructorName: z.string().trim().min(2).max(255).optional(),
    status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"]).optional(),
  }),
  updateApplicationStatus: z.object({
    status: z.enum([
      "PENDING",
      "UNDER_REVIEW",
      "SELECTED",
      "ACCEPTED",
      "REJECTED",
      "WAITLISTED",
      "PAYMENT_PENDING",
      "ENROLLED",
    ]),
    reviewScore: z.number().int().min(0).max(100).optional(),
    notes: z.string().trim().max(2000).optional(),
  }),
  createFullCourse: z.object({
    slug: z.string().trim().min(2).max(100),
    titleEn: z.string().trim().min(3).max(200),
    titleFr: z.string().trim().min(3).max(200),
    taglineEn: z.string().trim().max(300).optional(),
    taglineFr: z.string().trim().max(300).optional(),
    descriptionEn: z.string().trim().min(10).max(5000),
    descriptionFr: z.string().trim().min(10).max(5000),
    durationWeeks: z.number().int().min(1).max(52).default(12),
    price: z.number().positive().default(180),
    priceEur: z.number().positive().default(165),
    currency: z.enum(["USD", "EUR"]).default("USD"),
    thumbnailUrl: z.string().trim().optional().or(z.literal("")).nullable(),
    cohort: z
      .object({
        nameEn: z.string().trim().min(2).max(150),
        nameFr: z.string().trim().min(2).max(150),
        startDate: z.string().min(4),
        endDate: z.string().min(4),
        capacity: z.number().int().min(1).max(500).default(30),
        passingScore: z.number().int().min(0).max(100).default(70),
        thumbnailUrl: z.string().trim().optional().or(z.literal("")).nullable(),
      })
      .optional(),
    modules: z
      .array(
        z.object({
          orderIndex: z.number().int().min(1),
          titleEn: z.string().trim().min(2).max(200),
          titleFr: z.string().trim().min(2).max(200),
          descriptionEn: z.string().trim().max(3000).optional(),
          descriptionFr: z.string().trim().max(3000).optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          estimatedHours: z.number().min(1).default(10),
          requiredCompletion: z.number().min(0).max(100).default(80),
          passingScore: z.number().min(0).max(100).default(70),
          lessons: z
            .array(
              z.object({
                orderIndex: z.number().int().min(1),
                type: z
                  .enum(["VIDEO", "TEXT", "CASE_STUDY", "INTERACTIVE_ACTIVITY"])
                  .default("VIDEO"),
                titleEn: z.string().trim().min(2).max(200),
                titleFr: z.string().trim().min(2).max(200),
                descriptionEn: z.string().trim().max(3000).optional(),
                descriptionFr: z.string().trim().max(3000).optional(),
                bodyEn: z.string().optional(),
                bodyFr: z.string().optional(),
                videoUrl: z.string().optional(),
                durationMinutes: z.number().int().min(1).default(20),
                mandatory: z.boolean().default(true),
                resources: z
                  .array(
                    z.object({
                      nameEn: z.string().trim().min(2).max(200),
                      nameFr: z.string().trim().min(2).max(200),
                      type: z.string().default("PDF"),
                      url: z.string().min(1),
                      sizeKb: z.number().optional().default(500),
                      downloadable: z.boolean().default(true),
                    })
                  )
                  .optional(),
                quiz: z
                  .object({
                    titleEn: z.string().trim().min(2).max(200),
                    titleFr: z.string().trim().min(2).max(200),
                    descriptionEn: z.string().trim().max(1000).optional(),
                    descriptionFr: z.string().trim().max(1000).optional(),
                    timeLimitMinutes: z.number().int().optional(),
                    passingScore: z.number().int().min(0).max(100).default(70),
                    questions: z
                      .array(
                        z.object({
                          orderIndex: z.number().int().min(1),
                          type: z
                            .enum([
                              "MULTIPLE_CHOICE",
                              "TRUE_FALSE",
                              "FILL_BLANK",
                              "SCENARIO",
                              "WRITTEN",
                              "REFLECTION",
                            ])
                            .default("MULTIPLE_CHOICE"),
                          promptEn: z.string().trim().min(2),
                          promptFr: z.string().trim().min(2),
                          points: z.number().int().min(1).default(1),
                          correctText: z.string().optional(),
                          options: z
                            .array(
                              z.object({
                                orderIndex: z.number().int().min(1),
                                labelEn: z.string().trim().min(1),
                                labelFr: z.string().trim().min(1),
                                correct: z.boolean().default(false),
                              })
                            )
                            .optional(),
                        })
                      )
                      .optional(),
                  })
                  .optional(),
                liveSession: z
                  .object({
                    titleEn: z.string().trim().min(2).max(200),
                    titleFr: z.string().trim().min(2).max(200),
                    descriptionEn: z.string().trim().max(1000).optional(),
                    descriptionFr: z.string().trim().max(1000).optional(),
                    startsAt: z.string().optional(),
                    endsAt: z.string().optional(),
                    meetUrl: z.string().optional(),
                    instructorName: z.string().trim().max(150).optional(),
                  })
                  .optional(),
              })
            )
            .optional(),
          quiz: z
            .object({
              titleEn: z.string().trim().min(2).max(200),
              titleFr: z.string().trim().min(2).max(200),
              descriptionEn: z.string().trim().max(1000).optional(),
              descriptionFr: z.string().trim().max(1000).optional(),
              timeLimitMinutes: z.number().int().optional(),
              passingScore: z.number().int().min(0).max(100).default(70),
              questions: z
                .array(
                  z.object({
                    orderIndex: z.number().int().min(1),
                    type: z
                      .enum([
                        "MULTIPLE_CHOICE",
                        "TRUE_FALSE",
                        "FILL_BLANK",
                        "SCENARIO",
                        "WRITTEN",
                        "REFLECTION",
                      ])
                      .default("MULTIPLE_CHOICE"),
                    promptEn: z.string().trim().min(2),
                    promptFr: z.string().trim().min(2),
                    points: z.number().int().min(1).default(1),
                    correctText: z.string().optional(),
                    options: z
                      .array(
                        z.object({
                          orderIndex: z.number().int().min(1),
                          labelEn: z.string().trim().min(1),
                          labelFr: z.string().trim().min(1),
                          correct: z.boolean().default(false),
                        })
                      )
                      .optional(),
                  })
                )
                .optional(),
            })
            .optional(),
          liveSession: z
            .object({
              titleEn: z.string().trim().min(2).max(200),
              titleFr: z.string().trim().min(2).max(200),
              descriptionEn: z.string().trim().max(1000).optional(),
              descriptionFr: z.string().trim().max(1000).optional(),
              startsAt: z.string(),
              endsAt: z.string(),
              meetUrl: z.string().optional(),
              instructorName: z.string().trim().max(150).optional(),
            })
            .optional(),
        })
      )
      .optional(),
  }),
};


export const supportSchemas = {
  donate: z.object({
    name: z.string().trim().min(2, "Name is required").max(150),
    email: z.string().trim().email("Invalid email address").max(255),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    amount: z.coerce.number().positive("Amount must be positive").max(1_000_000),
    currency: z.enum(["USD", "EUR"]).default("USD"),
    frequency: z.enum(["one-off", "monthly"]).default("one-off"),
    message: z.string().trim().max(2000).optional().or(z.literal("")),
  }),
  volunteer: z.object({
    name: z.string().trim().min(2, "Name is required").max(150),
    email: z.string().trim().email("Invalid email address").max(255),
    phone: z.string().trim().max(50).optional().or(z.literal("")),
    area: z.string().trim().min(2, "Area is required").max(150),
    availability: z.string().trim().min(2, "Availability is required").max(150),
    message: z.string().trim().max(2000).optional().or(z.literal("")),
  }),
};

export const contactSchemas = {
  submit: z.object({
    name: z.string().trim().min(2, "Name is required").max(150),
    email: z.string().trim().email("Invalid email address").max(255),
    subject: z.string().trim().min(2, "Subject is required").max(200),
    message: z.string().trim().min(5, "Message is required").max(5000),
  }),
};

