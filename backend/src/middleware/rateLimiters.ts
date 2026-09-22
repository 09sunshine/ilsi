import rateLimit from "express-rate-limit";

const baseOptions = {
  standardHeaders: true as const,
  legacyHeaders: false as const,
  validate: { xForwardedForHeader: false },
};

export const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  message: {
    success: false,
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many requests from this IP, please try again after 15 minutes.",
    },
  },
});

export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 authentication attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: "AUTH_RATE_LIMIT",
      message: "Too many login/auth attempts from this IP. Please try again after 15 minutes.",
    },
  },
});

export const applicationLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 application submissions per hour
  message: {
    success: false,
    error: {
      code: "APPLICATION_RATE_LIMIT",
      message: "Too many applications submitted from this IP. Please wait before submitting again.",
    },
  },
});

export const quizLimiter = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // limit each IP to 15 quiz submissions per 10 minutes
  message: {
    success: false,
    error: {
      code: "QUIZ_RATE_LIMIT",
      message: "Too many quiz evaluation requests. Please slow down and try again in a few minutes.",
    },
  },
});

export const videoLimiter = rateLimit({
  ...baseOptions,
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60, // limit each IP to 60 video signed URL requests per 10 minutes
  message: {
    success: false,
    error: {
      code: "VIDEO_RATE_LIMIT",
      message: "Too many video URL requests. Please wait a moment.",
    },
  },
});

export const formSubmissionLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // limit each IP to 15 support/volunteer/donation submissions per 15 minutes
  message: {
    success: false,
    error: {
      code: "FORM_RATE_LIMIT",
      message: "Too many form submissions from this IP. Please wait a few minutes before trying again.",
    },
  },
});

export const paymentLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // limit each IP to 60 payment operations per 15 minutes
  message: {
    success: false,
    error: {
      code: "PAYMENT_RATE_LIMIT",
      message: "Too many payment operations from this IP. Please try again in a few minutes.",
    },
  },
});
