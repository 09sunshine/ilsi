import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";
import { CreateCourseModal } from "@/components/admin/CreateCourseModal";
import { EditCohortModal } from "@/components/admin/EditCohortModal";
import { EditCurriculumModal } from "@/components/admin/EditCurriculumModal";
import { DeleteCohortModal } from "@/components/admin/DeleteCohortModal";
import { BookOpen, Check, Edit3, ExternalLink, Plus, RefreshCw, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/cohorts")({
  head: () => ({
    meta: [
      { title: "Cohorts & Courses — ILSI admin" },
      { name: "description", content: "Cohort dates, capacity, passing scores, course builder and modules." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Cohorts & Courses — ILSI admin" },
      { property: "og:description", content: "Cohort dates, capacity and module schedule." },
    ],
  }),
  component: AdminCohorts,
});

function AdminCohorts() {
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();
  const [cohortsList, setCohortsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCohort, setEditingCohort] = useState<any | null>(null);
  const [managingCurriculumCohort, setManagingCurriculumCohort] = useState<any | null>(null);
  const [deletingCohort, setDeletingCohort] = useState<any | null>(null);
  const [liveSessions, setLiveSessions] = useState<Record<string, any[]>>({});
  const [editingMeetUrl, setEditingMeetUrl] = useState<Record<string, string>>({});
  const [savingSession, setSavingSession] = useState<string | null>(null);

  const fetchCohorts = async () => {
    setLoading(true);
    try {
      const res = await api.getCohorts();
      if (res && Array.isArray(res)) {
        setCohortsList(res);
        // Fetch live sessions for each cohort
        for (const c of res) {
          try {
            const sessions = await api.getCohortLiveSessions(c.id);
            const sessionsData = Array.isArray(sessions) ? sessions : (sessions as any)?.data || [];
            setLiveSessions((prev) => ({ ...prev, [c.id]: sessionsData }));
            const urlMap: Record<string, string> = {};
            for (const s of sessionsData) {
              urlMap[s.id] = s.meet_url || "";
            }
            setEditingMeetUrl((prev) => ({ ...prev, ...urlMap }));
          } catch {
            // ignore per-cohort session fetch errors silently
          }
        }
      } else {
        setCohortsList([]);
      }
    } catch (err: any) {
      console.warn("Could not fetch cohorts:", err);
      setCohortsList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCohorts();
  }, []);

  const handleUpdateMeetUrl = async (sessionId: string) => {
    setSavingSession(sessionId);
    try {
      await api.updateLiveSession(sessionId, { meetUrl: editingMeetUrl[sessionId] });
      toast.success("Meeting link updated successfully!");
    } catch {
      toast.error("Failed to update meeting link.");
    } finally {
      setSavingSession(null);
    }
  };

  const handleDeleteSession = async (cohortId: string, sessionId: string) => {
    if (!confirm("Delete this live session? This cannot be undone.")) return;
    try {
      await api.deleteLiveSession(sessionId);
      setLiveSessions((prev) => ({
        ...prev,
        [cohortId]: (prev[cohortId] || []).filter((s) => s.id !== sessionId),
      }));
      toast.success("Live session deleted.");
    } catch {
      toast.error("Failed to delete live session.");
    }
  };

  return (
    <AppShell variant="admin" title={t("nav.cohorts")}>
      <div className="space-y-6">
        {/* Action Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Manage cohort lifecycle, capacity, passing thresholds, and build comprehensive courses with modules, lessons, quizzes, and live sessions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchCohorts}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {t("common.retry") || "Refresh"}
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-2 shadow-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              Create Course &amp; Curriculum
            </Button>
          </div>
        </div>

        {/* Cohorts Grid */}
        <div className="space-y-4">
          {cohortsList.length === 0 && !loading ? (
            <div className="panel p-12 text-center">
              <p className="text-muted-foreground">No cohorts or courses created yet.</p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Create First Course
              </Button>
            </div>
          ) : (
            cohortsList.map((c) => {
              const fill = c.capacity > 0 ? Math.round(((c.enrolled || 0) / c.capacity) * 100) : 0;
              const cohortModules = c.modules || [];
              const sessions = liveSessions[c.id] || [];

              return (
                <section key={c.id} className="panel p-5 transition-shadow hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {resolveMediaUrl(c.thumbnailUrl || c.thumbnail_url) ? (
                        <img
                          src={resolveMediaUrl(c.thumbnailUrl || c.thumbnail_url)}
                          alt={L(c.name)}
                          className="size-12 rounded-lg object-cover border border-border shadow-sm shrink-0"
                        />
                      ) : null}
                      <div>
                        <h2 className="font-display text-base font-semibold">{L(c.name)}</h2>
                        <p className="text-sm text-muted-foreground">
                          {typeof c.programTitle === "object" ? L(c.programTitle) : c.programTitle || c.programId}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={c.status === "ACTIVE" ? "default" : "secondary"}>{c.status}</Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setManagingCurriculumCohort(c)}
                        className="h-7 text-xs gap-1.5 font-medium text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/60 shadow-xs"
                      >
                        <BookOpen className="size-3.5" />
                        {fr ? "Éditer le curriculum" : "Edit Curriculum & Content"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingCohort(c)}
                        className="h-7 text-xs gap-1.5 font-medium hover:border-primary/50"
                      >
                        <Edit3 className="size-3.5 text-primary" />
                        {fr ? "Modifier les détails" : "Edit Details"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeletingCohort(c)}
                        className="h-7 text-xs gap-1.5 font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:border-destructive/60"
                        title={fr ? "Supprimer la cohorte" : "Delete Cohort"}
                      >
                        <Trash2 className="size-3.5" />
                        {fr ? "Supprimer" : "Delete"}
                      </Button>
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("common.date")}</dt>
                      <dd className="text-sm font-medium">
                        {c.startDate} → {c.endDate}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("admin.totalParticipants")}</dt>
                      <dd className="text-sm font-medium">
                        {c.enrolled}/{c.capacity}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("quiz.passing")}</dt>
                      <dd className="text-sm font-medium">{c.passingScore}%</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">{t("dash.modules")}</dt>
                      <dd className="text-sm font-medium">{cohortModules.length}</dd>
                    </div>
                  </dl>

                  <Progress value={fill} className="mt-4 h-1.5" />

                  {cohortModules.length > 0 ? (
                    <ol className="mt-4 divide-y divide-border border-t border-border">
                      {cohortModules.map((m: any) => (
                        <li key={m.id || m.order} className="flex flex-wrap justify-between gap-2 py-2.5 text-sm">
                          <span className="truncate">
                            {m.order}. {L(m.title)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.startDate && m.endDate ? `${m.startDate} → ${m.endDate} · ` : ""}
                            {m.lessonCount !== undefined ? `${m.lessonCount} lessons` : `${m.lessons?.length || 0} lessons`}
                            {m.passingScore ? ` · ${m.passingScore}%` : ""}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}

                  {/* Live Sessions Management */}
                  {sessions.length > 0 && (
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Video className="size-3" />
                        Live Sessions ({sessions.length}) — Edit Meeting Links
                      </p>
                      <div className="space-y-2">
                        {sessions.map((s: any) => (
                          <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/50 p-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{s.title_en}</p>
                              <p className="text-[10px] text-muted-foreground">{new Date(s.starts_at).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-1">
                              <Input
                                value={editingMeetUrl[s.id] ?? s.meet_url ?? ""}
                                onChange={(e) =>
                                  setEditingMeetUrl((prev) => ({ ...prev, [s.id]: e.target.value }))
                                }
                                placeholder="https://meet.jit.si/... or https://meet.google.com/..."
                                className="h-7 w-64 font-mono text-xs"
                              />
                              <Button
                                size="sm"
                                className="h-7 px-2"
                                disabled={savingSession === s.id}
                                onClick={() => handleUpdateMeetUrl(s.id)}
                                title="Save meeting URL"
                              >
                                {savingSession === s.id ? (
                                  <RefreshCw className="size-3 animate-spin" />
                                ) : (
                                  <Check className="size-3" />
                                )}
                              </Button>
                              {s.meet_url && (
                                <Button size="sm" variant="outline" className="h-7 px-2" asChild>
                                  <a
                                    href={editingMeetUrl[s.id] || s.meet_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Test meeting link"
                                  >
                                    <ExternalLink className="size-3" />
                                  </a>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteSession(c.id, s.id)}
                                title="Delete this live session"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* Course & Curriculum Creation Modal */}
      <CreateCourseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCourseCreated={() => {
          setIsCreateModalOpen(false);
          fetchCohorts();
          toast.success("Course and curriculum successfully published!");
        }}
      />

      {/* Edit Cohort Modal */}
      <EditCohortModal
        cohort={editingCohort}
        isOpen={!!editingCohort}
        onClose={() => setEditingCohort(null)}
        onUpdated={() => {
          setEditingCohort(null);
          fetchCohorts();
        }}
      />

      {/* Edit Cohort Curriculum, Modules, Lessons, Videos, PDFs & Quizzes Modal */}
      <EditCurriculumModal
        cohort={managingCurriculumCohort}
        isOpen={!!managingCurriculumCohort}
        onClose={() => setManagingCurriculumCohort(null)}
        onUpdated={fetchCohorts}
      />

      {/* Delete Cohort Confirmation & Purge Modal */}
      <DeleteCohortModal
        cohort={deletingCohort}
        isOpen={!!deletingCohort}
        onClose={() => setDeletingCohort(null)}
        onDeleted={() => {
          setDeletingCohort(null);
          fetchCohorts();
        }}
      />
    </AppShell>
  );
}
