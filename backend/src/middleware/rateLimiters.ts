import rateLimit from "express-rate-limit";

const baseOptions = {
  standardHeaders: true as const,
  legacyHeaders: false as const,
  validate: { xForwardedForHeader: false },
};

export const globalLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 390, // increased by 30% from 300 to 390 for student & admin panel operations
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
  max: 15, // limit each IP to 15 authentication attempts per 15 minutes (unchanged)
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
  max: 20, // increased by 30% from 15 to 20 for student quiz evaluations
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
  max: 78, // increased by 30% from 60 to 78 for student video stream requests
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

export const communityPostLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 posts per 15m
  message: {
    success: false,
    error: {
      code: "COMMUNITY_POST_RATE_LIMIT",
      message: "You are posting too frequently. Please wait a few moments before creating another post.",
    },
  },
});

export const communityCommentLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 60, // 60 comments per 15m
  message: {
    success: false,
    error: {
      code: "COMMUNITY_COMMENT_RATE_LIMIT",
      message: "You are commenting too fast. Please slow down and try again.",
    },
  },
});

export const communityReactionLimiter = rateLimit({
  ...baseOptions,
  windowMs: 5 * 60 * 1000,
  max: 150, // 150 reactions per 5m
  message: {
    success: false,
    error: {
      code: "COMMUNITY_REACTION_RATE_LIMIT",
      message: "Too many reactions submitted. Please wait a moment.",
    },
  },
});

export const communityReportLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 15, // 15 reports per 15m
  message: {
    success: false,
    error: {
      code: "COMMUNITY_REPORT_RATE_LIMIT",
      message: "Too many reports submitted. Please wait before submitting additional reports.",
    },
  },
});

export const communityUploadLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * 60 * 1000,
  max: 25, // 25 file uploads per 15m
  message: {
    success: false,
    error: {
      code: "COMMUNITY_UPLOAD_RATE_LIMIT",
      message: "Attachment upload limit reached. Please wait a few minutes before uploading more files.",
    },
  },
});

export const communitySearchLimiter = rateLimit({
  ...baseOptions,
  windowMs: 5 * 60 * 1000,
  max: 120, // 120 member directory searches per 5m
  message: {
    success: false,
    error: {
      code: "COMMUNITY_SEARCH_RATE_LIMIT",
      message: "Too many search requests. Please slow down.",
    },
  },
});

export const communityFeedLimiter = rateLimit({
  ...baseOptions,
  windowMs: 5 * 60 * 1000,
  max: 200, // 200 feed requests per 5m
  message: {
    success: false,
    error: {
      code: "COMMUNITY_FEED_RATE_LIMIT",
      message: "Too many feed requests. Please slow down.",
    },
  },
});

