import { formatHumanErrorMessage } from "./humanError";

const API_BASE = ((import.meta.env as any).VITE_BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");

export function setStoredSessionToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("ilsi_token", token);
  } else {
    localStorage.removeItem("ilsi_token");
  }
}

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("ilsi_token") ||
    localStorage.getItem("better-auth.session_token") ||
    null
  );
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const token = getStoredSessionToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    credentials: "include", // Sends session cookies
    headers,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { message: text || `HTTP ${res.status}: ${res.statusText}` } };
  }

  if (!res.ok || (data && data.success === false)) {
    const rawError = data?.error || data;
    const cleanMsg = formatHumanErrorMessage(rawError, `Request failed with status ${res.status}`);
    const code = data?.error?.code || "API_ERROR";
    const error: any = new Error(cleanMsg);
    error.code = code;
    error.details = data?.error?.details;
    throw error;
  }

  return (data?.data !== undefined ? data.data : data) as T;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const studentDashboardCache = new Map<string, CacheEntry<any>>();
const DASHBOARD_CACHE_TTL = 3 * 60 * 1000; // 3 minutes fresh

export function getCachedStudentDashboard(cohortId?: string): any | null {
  const key = cohortId || "default";
  const entry = studentDashboardCache.get(key);
  if (!entry) return null;
  return entry.data;
}

export function invalidateStudentDashboardCache(cohortId?: string) {
  if (cohortId) {
    studentDashboardCache.delete(cohortId);
  } else {
    studentDashboardCache.clear();
  }
}

export const api = {
  getStudentDashboard: async (cohortId?: string, options?: { forceRefresh?: boolean }) => {
    const key = cohortId || "default";
    const now = Date.now();
    const cached = studentDashboardCache.get(key);

    if (!options?.forceRefresh && cached && now - cached.timestamp < DASHBOARD_CACHE_TTL) {
      return cached.data;
    }

    const endpoint = cohortId
      ? `/api/student/dashboard?cohortId=${encodeURIComponent(cohortId)}`
      : "/api/student/dashboard";
    const data = await request<any>(endpoint);
    if (data) {
      studentDashboardCache.set(key, { data, timestamp: Date.now() });
      if (!cohortId && data.cohort?.id) {
        studentDashboardCache.set(data.cohort.id, { data, timestamp: Date.now() });
      }
    }
    return data;
  },
  getLesson: (id: string) => request<any>(`/api/lessons/${id}`),
  getLessonVideo: (id: string) => request<{ playbackUrl: string; durationSeconds: number; thumbnailUrl?: string }>(`/api/lessons/${id}/video`),
  updateLessonProgress: async (id: string, payload: { videoPercent: number; markComplete?: boolean }) => {
    const res = await request<{ completed: boolean; videoPercent: number }>(`/api/progress/lessons/${id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (payload.markComplete) {
      invalidateStudentDashboardCache();
    }
    return res;
  },
  getQuiz: (id: string) => request<any>(`/api/quizzes/${id}`),
  submitQuizAttempt: async (id: string, answers: Record<string, string>) => {
    const res = await request<any>(`/api/quizzes/${id}/attempts`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
    invalidateStudentDashboardCache();
    return res;
  },
  getLiveSessions: () => request<any[]>("/api/live-sessions"),
  getNotifications: () => request<any[]>("/api/notifications"),
  markAllNotificationsRead: () => request<{ success: boolean }>("/api/notifications/mark-all-read", { method: "POST" }),
  markNotificationRead: (id: string) => request<{ success: boolean }>(`/api/notifications/${id}/read`, { method: "PATCH" }),
  deleteNotification: (id: string) => request<{ success: boolean }>(`/api/notifications/${id}`, { method: "DELETE" }),

  // Profile & Onboarding
  getProfile: () => request<any>("/api/profile"),
  updateProfile: (data: any) => request<any>("/api/profile", { method: "PATCH", body: JSON.stringify(data) }),
  completeOnboarding: (data: any) =>
    request<any>("/api/profile/complete-onboarding", { method: "POST", body: JSON.stringify(data) }),

  // Public Programs & Curriculum
  getPrograms: () => request<any[]>("/api/programs"),
  getProgramBySlug: (slug: string) => request<any>(`/api/programs/${slug}`),

  // Public Admissions
  submitApplication: (data: any) =>
    request<any>("/api/applications", { method: "POST", body: JSON.stringify(data) }),
  trackApplication: (params: { email?: string; applicationId?: string }) =>
    request<any>("/api/applications/track", {
      method: "POST",
      body: JSON.stringify(params),
    }),
  getPaymentMethods: () =>
    request<{
      methods: Array<{
        id: string;
        name: string;
        enabled: boolean;
        currencies: string[];
        descriptionEn?: string;
        descriptionFr?: string;
        subMethods?: Array<{ id: string; name: string }>;
      }>;
    }>("/api/payments/methods"),
  createPaymentIntent: (data: {
    cohortId?: string | undefined;
    enrollmentId?: string | undefined;
    applicationId?: string | undefined;
    currency?: string | undefined;
    provider?: string | undefined;
    paymMethod?: string | undefined;
    phoneNumber?: string | undefined;
  }) =>
    request<{
      paymentId: string;
      enrollmentId?: string;
      amount: number;
      currency: string;
      cohortId: string;
      status: string;
      checkoutUrl?: string;
      sessionId?: string;
      internalReference?: string;
      provider?: string;
      instructions?: string;
    }>("/api/payments/create-intent", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyProviderPayment: (data: {
    provider: string;
    paymentId?: string | undefined;
    orderId?: string | undefined;
    referenceId?: string | undefined;
    transactionId?: string | undefined;
    applicationId?: string | undefined;
  }) =>
    request<{ status: string; message: string }>("/api/payments/verify-provider", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyCheckoutSession: (data: { sessionId: string; paymentId?: string | undefined }) =>
    request<{ status: string; message: string }>("/api/payments/verify-session", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  activateApplicationAccount: (data: { applicationId: string; email: string; password: string }) =>
    request<{ success: boolean; message: string }>("/api/applications/activate-account", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Public Support (Donations & Volunteers) & Contact
  submitDonation: (data: {
    name: string;
    email: string;
    phone?: string | undefined;
    amount: string | number;
    currency?: string | undefined;
    frequency?: string | undefined;
    message?: string | undefined;
    provider?: string | undefined;
    paymMethod?: string | undefined;
    phoneNumber?: string | undefined;
  }) =>
    request<{
      donationId: string;
      sessionId: string;
      checkoutUrl?: string;
      instructions?: string;
      amount: number;
      currency: string;
      frequency: string;
      status: string;
      provider: string;
      internalReference?: string;
    }>("/api/support/donate", { method: "POST", body: JSON.stringify(data) }),
  verifyProviderDonation: (data: {
    provider: string;
    donationId?: string | undefined;
    orderId?: string | undefined;
    referenceId?: string | undefined;
    transactionId?: string | undefined;
    sessionId?: string | undefined;
  }) =>
    request<{
      status: "COMPLETED" | "PENDING" | "FAILED";
      donationId: string;
      amount: number;
      currency: string;
      frequency: string;
      donorName: string;
      donorEmail: string;
      paidAt?: string;
      message?: string;
      provider?: string;
    }>("/api/support/verify-donation-provider", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  verifyDonationSession: (data: { sessionId: string; donationId?: string | undefined }) =>
    request<{
      status: "COMPLETED" | "PENDING" | "FAILED";
      donationId: string;
      amount: number;
      currency: string;
      frequency: string;
      donorName: string;
      donorEmail: string;
      paidAt?: string;
      message?: string;
    }>("/api/support/verify-donation-session", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  submitVolunteer: (data: any) =>
    request<any>("/api/support/volunteer", { method: "POST", body: JSON.stringify(data) }),
  submitContact: (data: any) =>
    request<any>("/api/contact", { method: "POST", body: JSON.stringify(data) }),

  // Auth / First Login
  changeFirstLoginPassword: (data: { newPassword: string; currentPassword?: string | undefined }) =>
    request<{ success: boolean; message: string }>("/api/auth/first-login-password", {
      method: "POST",
      body: JSON.stringify(data),
    }),


  // Admin
  getAdminDashboard: () => request<any>("/api/admin/dashboard"),
  getCohorts: () => request<any[]>("/api/admin/cohorts"),
  createCohort: (data: any) => request<any>("/api/admin/cohorts", { method: "POST", body: JSON.stringify(data) }),
  updateCohort: async (id: string, data: any) => {
    const res = await request<any>(`/api/admin/cohorts/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    invalidateStudentDashboardCache(id);
    return res;
  },
  deleteCohort: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/cohorts/${id}`, { method: "DELETE" }),
  createFullCourse: (data: any) => request<any>("/api/admin/programs/full", { method: "POST", body: JSON.stringify(data) }),
  uploadFile: async (file: File): Promise<{ url: string; name: string; filename: string; sizeKb: number; type: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const token = getStoredSessionToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/upload`, {
        method: "POST",
        credentials: "include",
        headers,
        body: formData,
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: { message: text } };
      }

      if (!res.ok || data.success === false) {
        throw new Error(formatHumanErrorMessage(data?.error || data, `Upload failed with status ${res.status}`));
      }
      return data.data;
    } catch (err: any) {
      throw new Error(formatHumanErrorMessage(err, "Failed to upload document. Please try again."));
    }
  },
  uploadVideo: async (
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<{
    storagePath: string;
    url: string;
    fileName: string;
    fileSizeBytes: number;
    sizeMb: number;
    mimeType: string;
  }> => {
    // Attempt 1: Direct signed URL upload to Supabase Storage
    // This bypasses reverse proxies (Render 100s timeout, Cloudflare 100MB body limits)
    // and uploads 300MB+ files directly to Supabase CDN at full network speed.
    try {
      const initRes = await request<{
        uploadUrl: string;
        token: string;
        storagePath: string;
        fileName: string;
      }>("/api/admin/request-video-upload-url", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type || "video/mp4",
          fileSize: file.size,
        }),
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", initRes.uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");

        if (onProgress && xhr.upload) {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const percent = Math.min(99, Math.round((e.loaded / e.total) * 100));
              onProgress(percent);
            }
          });
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            if (onProgress) onProgress(100);
            resolve();
          } else {
            let errorMsg = `Storage upload failed with status ${xhr.status}`;
            try {
              const body = JSON.parse(xhr.responseText || "{}");
              if (body.message || body.error) {
                errorMsg = body.message || body.error;
              }
            } catch {}
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Direct upload to Supabase Storage was interrupted."));
        };

        xhr.send(file);
      });

      // Confirm upload with backend and obtain signed playback URL
      const confirmRes = await request<any>("/api/admin/confirm-video-upload", {
        method: "POST",
        body: JSON.stringify({
          storagePath: initRes.storagePath,
          fileName: initRes.fileName,
          fileSizeBytes: file.size,
          mimeType: file.type || "video/mp4",
        }),
      });

      return confirmRes;
    } catch (directErr: any) {
      console.warn("[uploadVideo] Direct cloud upload failed or unsupported, trying fallback:", directErr?.message);

      // If file is 50MB or smaller, attempt server-buffered upload fallback
      if (file.size <= 50 * 1024 * 1024) {
        return new Promise((resolve, reject) => {
          const formData = new FormData();
          formData.append("video", file);

          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API_BASE}/api/admin/upload-video`);
          xhr.withCredentials = true;

          const token = getStoredSessionToken();
          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }

          if (onProgress && xhr.upload) {
            xhr.upload.addEventListener("progress", (e) => {
              if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
              }
            });
          }

          xhr.onload = () => {
            try {
              const res = JSON.parse(xhr.responseText || "{}");
              if (xhr.status >= 200 && xhr.status < 300 && res.success !== false) {
                resolve(res.data);
              } else {
                const msg = formatHumanErrorMessage(res.error || res, "Video upload failed");
                reject(new Error(msg));
              }
            } catch {
              const msg = formatHumanErrorMessage(xhr.responseText, `Video upload failed with status ${xhr.status}`);
              reject(new Error(msg));
            }
          };

          xhr.onerror = () => reject(new Error("Network connection error during fallback video upload."));
          xhr.send(formData);
        });
      }

      throw new Error(
        formatHumanErrorMessage(
          directErr,
          `Video upload failed (${Math.round(file.size / (1024 * 1024))}MB). Please check your internet connection.`
        )
      );
    }
  },
  getCohortCurriculum: (cohortId: string) => request<any[]>(`/api/admin/cohorts/${cohortId}/curriculum`),
  updateLessonVideo: async (lessonId: string, data: { videoUrl: string; durationMinutes?: number }) => {
    try {
      return await request<any>(`/api/admin/lessons/${lessonId}/video`, { method: "PATCH", body: JSON.stringify(data) });
    } catch (err: any) {
      // Fallback to general lesson update endpoint if dedicated video sub-route is unavailable
      if (err?.code === "ENDPOINT_NOT_FOUND" || err?.message?.includes("not found")) {
        return await request<any>(`/api/admin/lessons/${lessonId}`, { method: "PATCH", body: JSON.stringify(data) });
      }
      throw err;
    }
  },
  getParticipants: (cohortId?: string) => request<any[]>(`/api/admin/participants${cohortId ? `?cohortId=${cohortId}` : ""}`),

  createParticipant: (data: any) => request<any>("/api/admin/participants", { method: "POST", body: JSON.stringify(data) }),
  deleteParticipant: (id: string) => request<any>(`/api/admin/participants/${id}`, { method: "DELETE" }),
  getApplications: (status?: string) => request<any[]>(`/api/admin/applications${status ? `?status=${status}` : ""}`),
  updateApplicationStatus: (id: string, data: any) =>
    request<any>(`/api/admin/applications/${id}/status`, { method: "PATCH", body: JSON.stringify(data) }),
  getPayments: () => request<any[]>("/api/admin/payments"),
  getAdminDonations: () => request<any[]>("/api/admin/donations"),
  updateDonationStatus: (id: string, status: string) =>
    request<any>(`/api/admin/donations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getAdminVolunteers: () => request<any[]>("/api/admin/volunteers"),
  updateVolunteerStatus: (id: string, status: string) =>
    request<any>(`/api/admin/volunteers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  getAdminContactMessages: () => request<any[]>("/api/admin/contact-messages"),
  updateContactMessageStatus: (id: string, status: string) =>
    request<any>(`/api/admin/contact-messages/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  createLiveSession: async (data: any) => {
    const res = await request<any>("/api/admin/live-sessions", { method: "POST", body: JSON.stringify(data) });
    invalidateStudentDashboardCache(data?.cohortId);
    return res;
  },
  updateLiveSession: async (id: string, data: any) => {
    const res = await request<any>(`/api/admin/live-sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    invalidateStudentDashboardCache();
    return res;
  },
  deleteLiveSession: async (id: string) => {
    const res = await request<any>(`/api/admin/live-sessions/${id}`, { method: "DELETE" });
    invalidateStudentDashboardCache();
    return res;
  },
  getCohortLiveSessions: (cohortId: string) =>
    request<any[]>(`/api/admin/cohorts/${cohortId}/live-sessions`),
  getSettings: () => request<any>("/api/admin/settings"),
  updateSettings: (data: any) => request<any>("/api/admin/settings", { method: "PUT", body: JSON.stringify(data) }),

  // Program Management (Admin)
  getAdminPrograms: () => request<any[]>("/api/admin/programs"),
  getAdminProgram: (id: string) => request<any>(`/api/admin/programs/${id}`),
  createProgram: (data: any) => request<any>("/api/admin/programs", { method: "POST", body: JSON.stringify(data) }),
  updateProgram: (id: string, data: any) =>
    request<any>(`/api/admin/programs/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProgram: (id: string) => request<any>(`/api/admin/programs/${id}`, { method: "DELETE" }),

  // Module Management (Admin)
  createModule: (programId: string, data: any) =>
    request<any>(`/api/admin/programs/${programId}/modules`, { method: "POST", body: JSON.stringify(data) }),
  addCohortModule: (cohortId: string, data: any) =>
    request<any>(`/api/admin/cohorts/${cohortId}/modules`, { method: "POST", body: JSON.stringify(data) }),
  updateModule: (id: string, data: any) =>
    request<any>(`/api/admin/modules/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteModule: (id: string, force = true) =>
    request<any>(`/api/admin/modules/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  reorderModules: (orders: { id: string; orderIndex: number }[]) =>
    request<any>("/api/admin/modules/reorder", { method: "POST", body: JSON.stringify({ orders }) }),

  // Lesson Management (Admin)
  createLesson: (moduleId: string, data: any) =>
    request<any>(`/api/admin/modules/${moduleId}/lessons`, { method: "POST", body: JSON.stringify(data) }),
  getAdminLesson: (id: string) => request<any>(`/api/admin/lessons/${id}`),
  updateLesson: (id: string, data: any) =>
    request<any>(`/api/admin/lessons/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLesson: (id: string, force = true) =>
    request<any>(`/api/admin/lessons/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  reorderLessons: (orders: { id: string; orderIndex: number }[]) =>
    request<any>("/api/admin/lessons/reorder", { method: "POST", body: JSON.stringify({ orders }) }),

  // Chapter Management (Admin)
  createChapter: (lessonId: string, data: any) =>
    request<any>(`/api/admin/lessons/${lessonId}/chapters`, { method: "POST", body: JSON.stringify(data) }),
  updateChapter: (id: string, data: any) =>
    request<any>(`/api/admin/chapters/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteChapter: (id: string) => request<any>(`/api/admin/chapters/${id}`, { method: "DELETE" }),
  reorderChapters: (orders: { id: string; orderIndex: number }[]) =>
    request<any>("/api/admin/chapters/reorder", { method: "POST", body: JSON.stringify({ orders }) }),

  // Resource / Document Management (Admin)
  addResource: (data: any) =>
    request<any>("/api/admin/resources", { method: "POST", body: JSON.stringify(data) }),
  deleteResource: (id: string) =>
    request<any>(`/api/admin/resources/${id}`, { method: "DELETE" }),

  // Quiz Management (Admin)
  createQuiz: (data: any) =>
    request<any>("/api/admin/quizzes", { method: "POST", body: JSON.stringify(data) }),
  getAdminQuiz: (id: string) =>
    request<any>(`/api/admin/quizzes/${id}`),
  updateQuiz: (id: string, data: any) =>
    request<any>(`/api/admin/quizzes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteQuiz: (id: string, force?: boolean) =>
    request<any>(`/api/admin/quizzes/${id}${force ? "?force=true" : ""}`, { method: "DELETE" }),
  addQuizQuestion: (quizId: string, data: any) =>
    request<any>(`/api/admin/quizzes/${quizId}/questions`, { method: "POST", body: JSON.stringify(data) }),
  deleteQuizQuestion: (id: string) =>
    request<any>(`/api/admin/quiz-questions/${id}`, { method: "DELETE" }),
  getQuizLongAnswers: (params?: { quizId?: string | null | undefined; cohortId?: string | null | undefined; status?: string | null | undefined; search?: string | null | undefined }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      if (params.cohortId && params.cohortId !== "undefined" && params.cohortId !== "null") {
        searchParams.set("cohortId", params.cohortId);
      }
      if (params.quizId && params.quizId !== "undefined" && params.quizId !== "null") {
        searchParams.set("quizId", params.quizId);
      }
      if (params.status && params.status !== "undefined" && params.status !== "ALL") {
        searchParams.set("status", params.status);
      }
      if (params.search && params.search.trim() && params.search !== "undefined") {
        searchParams.set("search", params.search.trim());
      }
    }
    const q = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return request<any[]>(`/api/admin/quiz-submissions/long-answers${q}`);
  },
  gradeQuizAnswer: (answerId: string, data: { manualScore?: number | null; manualRating?: string | null; manualFeedback?: string | null }) =>
    request<any>(`/api/admin/quiz-answers/${answerId}/grade`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Cohort Lesson Assignments & Scheduling (Admin)
  getCohortLessons: (cohortId: string) => request<any[]>(`/api/admin/cohorts/${cohortId}/lessons`),
  assignCohortLesson: (cohortId: string, data: any) =>
    request<any>(`/api/admin/cohorts/${cohortId}/lessons`, { method: "POST", body: JSON.stringify(data) }),
  bulkAssignCohortLessons: (cohortId: string) =>
    request<any>(`/api/admin/cohorts/${cohortId}/lessons/bulk-assign`, { method: "POST" }),
  updateCohortLesson: (id: string, data: any) =>
    request<any>(`/api/admin/cohort-lessons/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCohortLesson: (id: string) => request<any>(`/api/admin/cohort-lessons/${id}`, { method: "DELETE" }),
  reorderCohortLessons: (cohortId: string, orders: { id: string; orderIndex: number }[]) =>
    request<any>(`/api/admin/cohorts/${cohortId}/lessons/reorder`, {
      method: "POST",
      body: JSON.stringify({ orders }),
    }),

  // Student Cohort-Scoped Lessons
  getCurrentCohortLessons: () => request<any[]>("/api/student/current-cohort/lessons"),
  getCurrentCohortProgress: () => request<any>("/api/student/current-cohort/progress"),

  // Community Platform (Cohort Spaces & Global Social Network)
  getAccessibleCohorts: () => request<any[]>("/api/community/cohorts"),
  getCommunityPosts: (params?: {
    scope?: "cohort" | "global" | undefined;
    cohortId?: string | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    type?: string | undefined;
    search?: string | undefined;
    authorId?: string | undefined;
  }) => {
    const q = new URLSearchParams();
    if (params?.scope) q.set("scope", params.scope);
    if (params?.cohortId) q.set("cohortId", params.cohortId);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.type) q.set("type", params.type);
    if (params?.search) q.set("search", params.search);
    if (params?.authorId) q.set("authorId", params.authorId);
    const queryString = q.toString() ? `?${q.toString()}` : "";
    return request<{ posts: any[]; pagination: any }>(`/api/community/posts${queryString}`);
  },
  getCommunityPost: (id: string) => request<any>(`/api/community/posts/${id}`),
  createCommunityPost: (data: any) =>
    request<any>("/api/community/posts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCommunityPost: (id: string, data: any) =>
    request<any>(`/api/community/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteCommunityPost: (id: string, reason?: string | undefined) =>
    request<any>(`/api/community/posts/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }),
  getPostComments: (postId: string) =>
    request<any[]>(`/api/community/posts/${postId}/comments`),
  createPostComment: (postId: string, data: { content: string; parentCommentId?: string | undefined }) =>
    request<any>(`/api/community/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deletePostComment: (commentId: string) =>
    request<any>(`/api/community/comments/${commentId}`, { method: "DELETE" }),
  toggleCommunityReaction: (data: {
    targetType: "post" | "comment";
    targetId: string;
    reactionType: string;
  }) =>
    request<any>("/api/community/reactions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  uploadCommunityAttachment: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const token = getStoredSessionToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/api/community/upload-attachment`, {
      method: "POST",
      credentials: "include",
      headers,
      body: formData,
    });

    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: { message: text || `HTTP ${res.status}` } };
    }

    if (!res.ok || data?.success === false) {
      throw new Error(data?.error?.message || data?.message || "Failed to upload attachment");
    }

    return (data?.data !== undefined ? data.data : data) as {
      storagePath: string;
      fileName: string;
      fileType: "IMAGE" | "DOCUMENT" | "PDF";
      mimeType: string;
      fileSizeBytes: number;
      url: string;
    };
  },
  getAttachmentAccessUrl: (attachmentId: string) =>
    request<any>(`/api/community/attachments/${attachmentId}/access-url`),
  getCommunityProfile: (userId: string) =>
    request<any>(`/api/community/profiles/${userId}`),
  updateCommunityProfile: (data: any) =>
    request<any>("/api/community/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  searchCommunityMembers: (params?: {
    q?: string | undefined;
    skill?: string | undefined;
    interest?: string | undefined;
    programId?: string | undefined;
  }) => {
    const q = new URLSearchParams();
    if (params?.q) q.set("q", params.q);
    if (params?.skill) q.set("skill", params.skill);
    if (params?.interest) q.set("interest", params.interest);
    if (params?.programId) q.set("programId", params.programId);
    const queryString = q.toString() ? `?${q.toString()}` : "";
    return request<any[]>(`/api/community/members${queryString}`);
  },
  createCommunityProject: (data: any) =>
    request<any>("/api/community/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCommunityProject: (id: string) =>
    request<any>(`/api/community/projects/${id}`, { method: "DELETE" }),
  reportCommunityContent: (data: {
    targetType: "post" | "comment" | "user";
    targetId: string;
    reason: string;
    details?: string | undefined;
  }) =>
    request<any>("/api/community/reports", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getAdminCommunityStats: () => request<any>("/api/community/admin/stats"),
  getAdminCommunityReports: (status?: string | undefined) => {
    const q = status ? `?status=${status}` : "";
    return request<any[]>(`/api/community/admin/reports${q}`);
  },
  resolveAdminCommunityReport: (reportId: string, resolution: any) =>
    request<any>(`/api/community/admin/reports/${reportId}/resolve`, {
      method: "POST",
      body: JSON.stringify(resolution),
    }),
  moderateCommunityPost: (postId: string, action: string, reason?: string | undefined) =>
    request<any>(`/api/community/admin/posts/${postId}/moderate`, {
      method: "POST",
      body: JSON.stringify({ action, reason }),
    }),
  getAdminCommunityAuditLogs: (params?: { limit?: number | undefined; offset?: number | undefined }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set("limit", params.limit.toString());
    if (params?.offset) q.set("offset", params.offset.toString());
    const queryString = q.toString() ? `?${q.toString()}` : "";
    return request<any[]>(`/api/community/admin/audit-logs${queryString}`);
  },

  // Academic Leaderboard & Ranking APIs
  getStudentRankingSummary: (cohortId?: string, moduleId?: string) => {
    const params = new URLSearchParams();
    if (cohortId) params.set("cohortId", cohortId);
    if (moduleId && moduleId !== "all") params.set("moduleId", moduleId);
    const q = params.toString() ? `?${params.toString()}` : "";
    return request<any>(`/api/student/rankings/summary${q}`);
  },
  getStudentCohortLeaderboard: (cohortId?: string, page = 1, limit = 50, moduleId?: string) => {
    const params = new URLSearchParams();
    if (cohortId) params.set("cohortId", cohortId);
    params.set("page", page.toString());
    params.set("limit", limit.toString());
    if (moduleId && moduleId !== "all") params.set("moduleId", moduleId);
    return request<any>(`/api/student/rankings/leaderboard?${params.toString()}`);
  },
  getAdminCohortRankings: (cohortId: string, moduleId?: string) => {
    const params = new URLSearchParams();
    if (moduleId && moduleId !== "all") params.set("moduleId", moduleId);
    const q = params.toString() ? `?${params.toString()}` : "";
    return request<any>(`/api/admin/cohorts/${encodeURIComponent(cohortId)}/rankings${q}`);
  },
  recalculateAdminCohortRanking: (cohortId: string) =>
    request<any>(`/api/admin/cohorts/${encodeURIComponent(cohortId)}/rankings/recalculate`, {
      method: "POST",
    }),
  getAdminHistoricalSnapshots: (cohortId: string) =>
    request<any[]>(`/api/admin/cohorts/${encodeURIComponent(cohortId)}/rankings/snapshots`),
  getAdminSnapshotDetails: (snapshotId: string) =>
    request<any>(`/api/admin/cohorts/any/rankings/snapshots/${encodeURIComponent(snapshotId)}`),
};

