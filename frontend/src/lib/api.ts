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
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${res.status}`;
    const code = data?.error?.code || "API_ERROR";
    const error: any = new Error(errorMsg);
    error.code = code;
    error.details = data?.error?.details;
    throw error;
  }

  return (data?.data !== undefined ? data.data : data) as T;
}

export const api = {
  getStudentDashboard: (cohortId?: string) =>
    request<any>(cohortId ? `/api/student/dashboard?cohortId=${encodeURIComponent(cohortId)}` : "/api/student/dashboard"),
  getLesson: (id: string) => request<any>(`/api/lessons/${id}`),
  getLessonVideo: (id: string) => request<{ playbackUrl: string; durationSeconds: number; thumbnailUrl?: string }>(`/api/lessons/${id}/video`),
  updateLessonProgress: (id: string, payload: { videoPercent: number; markComplete?: boolean }) =>
    request<{ completed: boolean; videoPercent: number }>(`/api/progress/lessons/${id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getQuiz: (id: string) => request<any>(`/api/quizzes/${id}`),
  submitQuizAttempt: (id: string, answers: Record<string, string>) =>
    request<any>(`/api/quizzes/${id}/attempts`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),
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
  verifyCheckoutSession: (data: { sessionId: string; paymentId?: string }) =>
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
    phone?: string;
    amount: string | number;
    currency?: string;
    frequency?: string;
    message?: string;
  }) =>
    request<{
      donationId: string;
      sessionId: string;
      checkoutUrl: string;
      amount: number;
      currency: string;
      frequency: string;
      status: string;
    }>("/api/support/donate", { method: "POST", body: JSON.stringify(data) }),
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
  updateCohort: (id: string, data: any) =>
    request<any>(`/api/admin/cohorts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCohort: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/cohorts/${id}`, { method: "DELETE" }),
  createFullCourse: (data: any) => request<any>("/api/admin/programs/full", { method: "POST", body: JSON.stringify(data) }),
  uploadFile: async (file: File): Promise<{ url: string; name: string; filename: string; sizeKb: number; type: string }> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/api/admin/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data?.error?.message || data?.message || "File upload failed");
    }
    return data.data;
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
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append("video", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/api/admin/upload-video`);
      xhr.withCredentials = true;

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
            reject(new Error(res.error?.message || res.message || "Video upload failed"));
          }
        } catch {
          reject(new Error(`Video upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during video upload"));
      xhr.send(formData);
    });
  },
  getCohortCurriculum: (cohortId: string) => request<any[]>(`/api/admin/cohorts/${cohortId}/curriculum`),
  updateLessonVideo: (lessonId: string, data: { videoUrl: string; durationMinutes?: number }) =>
    request<any>(`/api/admin/lessons/${lessonId}/video`, { method: "PATCH", body: JSON.stringify(data) }),
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
  createLiveSession: (data: any) => request<any>("/api/admin/live-sessions", { method: "POST", body: JSON.stringify(data) }),
  updateLiveSession: (id: string, data: any) =>
    request<any>(`/api/admin/live-sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLiveSession: (id: string) =>
    request<any>(`/api/admin/live-sessions/${id}`, { method: "DELETE" }),
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
  deleteModule: (id: string) => request<any>(`/api/admin/modules/${id}`, { method: "DELETE" }),
  reorderModules: (orders: { id: string; orderIndex: number }[]) =>
    request<any>("/api/admin/modules/reorder", { method: "POST", body: JSON.stringify({ orders }) }),

  // Lesson Management (Admin)
  createLesson: (moduleId: string, data: any) =>
    request<any>(`/api/admin/modules/${moduleId}/lessons`, { method: "POST", body: JSON.stringify(data) }),
  getAdminLesson: (id: string) => request<any>(`/api/admin/lessons/${id}`),
  updateLesson: (id: string, data: any) =>
    request<any>(`/api/admin/lessons/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLesson: (id: string) => request<any>(`/api/admin/lessons/${id}`, { method: "DELETE" }),
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
  deleteQuiz: (id: string) =>
    request<any>(`/api/admin/quizzes/${id}`, { method: "DELETE" }),
  addQuizQuestion: (quizId: string, data: any) =>
    request<any>(`/api/admin/quizzes/${quizId}/questions`, { method: "POST", body: JSON.stringify(data) }),
  deleteQuizQuestion: (id: string) =>
    request<any>(`/api/admin/quiz-questions/${id}`, { method: "DELETE" }),

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
};

