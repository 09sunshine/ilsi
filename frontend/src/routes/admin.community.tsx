import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Filter,
  MessageSquare,
  Pin,
  RefreshCw,
  Search,
  Shield,
  Star,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/community")({
  head: () => ({
    meta: [
      { title: "Community Moderation — ILSI Admin" },
      { name: "description", content: "Moderate cohort and global community spaces, resolve reports, and inspect audit logs." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminCommunityPage,
});

function AdminCommunityPage() {
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();

  const [activeTab, setActiveTab] = useState<"reports" | "cohorts" | "posts" | "audit">("reports");
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Reports
  const [reports, setReports] = useState<any[]>([]);
  const [reportsStatusFilter, setReportsStatusFilter] = useState<string>("PENDING");
  const [loadingReports, setLoadingReports] = useState(false);
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Cohorts
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);

  // Global Posts
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postsSearch, setPostsSearch] = useState("");

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Action states
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await api.getAdminCommunityStats();
      const data = (res as any)?.data !== undefined ? (res as any).data : res;
      if (data) {
        setStats(data);
      }
    } catch (err) {
      console.warn("Could not load community stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchReports = async (status = reportsStatusFilter) => {
    setLoadingReports(true);
    try {
      const res = await api.getAdminCommunityReports(status === "ALL" ? undefined : status);
      const data = Array.isArray(res) ? res : ((res as any)?.data || []);
      setReports(data);
    } catch (err: any) {
      toast.error(err?.message || "Could not load reports");
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchCohorts = async () => {
    setLoadingCohorts(true);
    try {
      const res = await api.getCohorts();
      const data = Array.isArray(res) ? res : ((res as any)?.data || []);
      setCohorts(data);
    } catch (err: any) {
      toast.error(err?.message || "Could not load cohorts");
    } finally {
      setLoadingCohorts(false);
    }
  };

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await api.getCommunityPosts({ scope: "global", limit: 30 });
      const postsList = Array.isArray(res) ? res : ((res as any)?.posts || (res as any)?.data?.posts || (res as any)?.data || []);
      setPosts(postsList);
    } catch (err: any) {
      toast.error(err?.message || "Could not load global posts");
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const res = await api.getAdminCommunityAuditLogs({ limit: 50 });
      const data = Array.isArray(res) ? res : ((res as any)?.data || []);
      setAuditLogs(data);
    } catch (err: any) {
      toast.error(err?.message || "Could not load audit logs");
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    fetchStats();
    if (activeTab === "reports") fetchReports();
    if (activeTab === "cohorts") fetchCohorts();
    if (activeTab === "posts") fetchPosts();
    if (activeTab === "audit") fetchAuditLogs();
  }, [activeTab]);

  const handleResolveReport = async (reportId: string, status: "ACTION_TAKEN" | "DISMISSED") => {
    setActionInProgress(reportId);
    try {
      await api.resolveAdminCommunityReport(reportId, {
        status,
        notes: resolutionNotes || (status === "ACTION_TAKEN" ? "Moderation action taken." : "Report reviewed and dismissed."),
      });
      toast.success(status === "ACTION_TAKEN" ? (fr ? "Rapport résolu avec action" : "Report resolved with action") : (fr ? "Rapport rejeté" : "Report dismissed"));
      setResolvingReportId(null);
      setResolutionNotes("");
      fetchReports();
      fetchStats();
    } catch (err: any) {
      toast.error(err?.message || "Failed to resolve report");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleModeratePost = async (postId: string, action: string, reason?: string) => {
    setActionInProgress(postId);
    try {
      await api.moderateCommunityPost(postId, action, reason);
      toast.success(fr ? "Action de modération effectuée" : "Moderation action applied");
      fetchPosts();
      fetchStats();
      if (activeTab === "audit") fetchAuditLogs();
    } catch (err: any) {
      toast.error(err?.message || "Moderation action failed");
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {fr ? "Modération de la Communauté" : "Community Moderation & Spaces"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {fr
                ? "Supervision des espaces privés de cohortes, du fil mondial, des signalements et journaux d'audit."
                : "Manage cohort communities, global feed content, user reports, and moderation logs."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStats();
              if (activeTab === "reports") fetchReports();
              if (activeTab === "cohorts") fetchCohorts();
              if (activeTab === "posts") fetchPosts();
              if (activeTab === "audit") fetchAuditLogs();
            }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {fr ? "Actualiser" : "Refresh"}
          </Button>
        </div>

        {/* Stats KPI Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{fr ? "Discussions" : "Total Posts"}</span>
              <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold text-foreground">
              {loadingStats ? "…" : stats?.totalPosts ?? 0}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{fr ? "Commentaires" : "Comments"}</span>
              <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold text-foreground">
              {loadingStats ? "…" : stats?.totalComments ?? 0}
            </div>
          </div>

          <div
            className={cn(
              "rounded-xl border bg-card p-4 shadow-sm",
              (stats?.pendingReports ?? 0) > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border"
            )}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{fr ? "Signalements" : "Pending Reports"}</span>
              <AlertTriangle className={cn("h-4 w-4 shrink-0", (stats?.pendingReports ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground")} />
            </div>
            <div className={cn("mt-2 text-xl sm:text-2xl font-bold", (stats?.pendingReports ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
              {loadingStats ? "…" : stats?.pendingReports ?? 0}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{fr ? "Espaces Cohorte" : "Cohort Spaces"}</span>
              <Users className="h-4 w-4 text-blue-600 shrink-0" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold text-foreground">
              {loadingStats ? "…" : stats?.activeCohortSpaces ?? 0}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">{fr ? "Contributeurs" : "Active Members"}</span>
              <Shield className="h-4 w-4 text-purple-600 shrink-0" />
            </div>
            <div className="mt-2 text-xl sm:text-2xl font-bold text-foreground">
              {loadingStats ? "…" : stats?.activeContributors ?? 0}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border overflow-x-auto no-scrollbar touch-pan-x whitespace-nowrap">
          <button
            onClick={() => setActiveTab("reports")}
            className={cn(
              "relative flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-colors shrink-0",
              activeTab === "reports"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{fr ? "File des signalements" : "Moderation Queue"}</span>
            {(stats?.pendingReports ?? 0) > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[11px]">
                {stats.pendingReports}
              </Badge>
            )}
          </button>

          <button
            onClick={() => setActiveTab("cohorts")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-colors shrink-0",
              activeTab === "cohorts"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>{fr ? "Espaces de Cohortes" : "Cohort Communities"}</span>
          </button>

          <button
            onClick={() => setActiveTab("posts")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-colors shrink-0",
              activeTab === "posts"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="h-4 w-4 shrink-0" />
            <span>{fr ? "Discussions Mondiales" : "Global Feed Posts"}</span>
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold transition-colors shrink-0",
              activeTab === "audit"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span>{fr ? "Journal d'Audit" : "Moderation Audit Logs"}</span>
          </button>
        </div>

        {/* TAB 1: REPORTS QUEUE */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {fr ? "Filtrer par statut :" : "Filter status:"}
                </span>
                {["PENDING", "ACTION_TAKEN", "DISMISSED", "ALL"].map((st) => (
                  <Button
                    key={st}
                    variant={reportsStatusFilter === st ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setReportsStatusFilter(st);
                      fetchReports(st);
                    }}
                  >
                    {st === "PENDING"
                      ? fr
                        ? "En attente"
                        : "Pending"
                      : st === "ACTION_TAKEN"
                      ? fr
                        ? "Action prise"
                        : "Action Taken"
                      : st === "DISMISSED"
                      ? fr
                        ? "Rejetés"
                        : "Dismissed"
                      : fr
                      ? "Tous"
                      : "All"}
                  </Button>
                ))}
              </div>
            </div>

            {loadingReports ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                {fr ? "Chargement des signalements..." : "Loading reported content..."}
              </div>
            ) : reports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
                <h3 className="text-base font-semibold text-foreground">
                  {fr ? "Aucun signalement dans cette catégorie" : "No reports in this queue"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fr ? "La communauté est propre et respecte les règles." : "The community is currently safe and adhering to standards."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              report.status === "PENDING"
                                ? "destructive"
                                : report.status === "ACTION_TAKEN"
                                ? "default"
                                : "outline"
                            }
                          >
                            {report.status}
                          </Badge>
                          <Badge variant="secondary" className="capitalize">
                            {report.target_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(report.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {fr ? "Motif : " : "Reason: "}
                            <span className="font-bold text-destructive">{report.reason}</span>
                          </div>
                          {report.details && (
                            <p className="mt-1 text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/50">
                              "{report.details}"
                            </p>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {fr ? "Signalé par : " : "Reported by: "}
                          <span className="font-medium text-foreground">{report.reporter_name}</span> (
                          {report.reporter_email}) • Target ID:{" "}
                          <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{report.target_id}</code>
                        </div>

                        {report.resolved_at && (
                          <div className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
                            {fr ? "Résolu le " : "Resolved on "}
                            {new Date(report.resolved_at).toLocaleString()}
                            {report.resolution_notes && ` — Notes: ${report.resolution_notes}`}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {report.status === "PENDING" && (
                        <div className="flex flex-col gap-2 sm:items-end">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs text-muted-foreground hover:text-foreground"
                              disabled={actionInProgress === report.id}
                              onClick={() => handleResolveReport(report.id, "DISMISSED")}
                            >
                              <XCircle className="mr-1.5 h-3.5 w-3.5" />
                              {fr ? "Rejeter" : "Dismiss"}
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              className="text-xs"
                              disabled={actionInProgress === report.id}
                              onClick={() => {
                                if (report.target_type === "post") {
                                  handleModeratePost(report.target_id, "HIDE_POST", `Flagged: ${report.reason}`);
                                }
                                handleResolveReport(report.id, "ACTION_TAKEN");
                              }}
                            >
                              <Shield className="mr-1.5 h-3.5 w-3.5" />
                              {fr ? "Prendre action & Masquer" : "Take Action & Hide"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COHORTS OVERVIEW */}
        {activeTab === "cohorts" && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {fr
                ? "Chaque cohorte possède son espace d'échange hermétique et sécurisé accessible uniquement à ses apprenants inscrits et formateurs affectés."
                : "Each cohort has a fully isolated and private community discussion space accessible strictly to verified enrolled students and assigned instructors."}
            </p>

            {loadingCohorts ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-16 bg-muted rounded"></div>
                      <div className="h-4 w-24 bg-muted rounded"></div>
                    </div>
                    <div className="h-6 w-3/4 bg-muted rounded"></div>
                    <div className="h-4 w-1/2 bg-muted rounded"></div>
                    <div className="flex gap-4 pt-2">
                      <div className="h-4 w-16 bg-muted rounded"></div>
                      <div className="h-4 w-24 bg-muted rounded"></div>
                    </div>
                    <div className="border-t border-border pt-4 flex justify-between">
                      <div className="h-4 w-20 bg-muted rounded"></div>
                      <div className="h-8 w-24 bg-muted rounded"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : cohorts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
                <h3 className="text-base font-semibold text-foreground">
                  {fr ? "Aucune cohorte configurée" : "No cohorts found"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {fr ? "Créez une cohorte dans le panneau Cohortes pour ouvrir un espace de discussion." : "Create a cohort in the Cohorts panel to activate its private community space."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {cohorts.map((cohort) => {
                  const cohortName = typeof cohort.name === "object"
                    ? L(cohort.name)
                    : cohort.name || L({ en: cohort.name_en, fr: cohort.name_fr }) || "Cohort Space";

                  const programTitle = typeof cohort.programTitle === "object"
                    ? L(cohort.programTitle)
                    : cohort.programTitle || cohort.program?.title_en || cohort.program_title_en || cohort.program_title || "ILSI Program";

                  const startDateRaw = cohort.startDate || cohort.start_date;
                  const endDateRaw = cohort.endDate || cohort.end_date;

                  const formatDateSafe = (d?: string | null) => {
                    if (!d) return null;
                    const parsed = new Date(d);
                    return isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString();
                  };

                  const formattedStart = formatDateSafe(startDateRaw);
                  const formattedEnd = formatDateSafe(endDateRaw);
                  const dateString = formattedStart && formattedEnd
                    ? `${formattedStart} — ${formattedEnd}`
                    : formattedStart
                    ? formattedStart
                    : fr
                    ? "Dates flexibles"
                    : "Flexible Dates";

                  const maxCap = cohort.capacity || cohort.maxParticipants || 30;

                  return (
                    <div
                      key={cohort.id}
                      className="flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant={
                              cohort.status === "ACTIVE"
                                ? "default"
                                : cohort.status === "UPCOMING"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {cohort.status}
                          </Badge>
                          <span className="text-xs font-semibold text-primary truncate max-w-[150px]">
                            {programTitle}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-bold text-foreground">
                          {cohortName}
                        </h3>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateString}
                        </p>

                        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            <span>{maxCap} max</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5 text-emerald-600" />
                            <span>{fr ? "Accès sécurisé" : "Protected access"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border pt-4 flex items-center justify-between">
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {fr ? "Espace actif" : "Space active"}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            window.location.href = `/community?cohortId=${cohort.id}`;
                          }}
                        >
                          {fr ? "Voir l'espace" : "Open Space"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GLOBAL POSTS MODERATION */}
        {activeTab === "posts" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={postsSearch}
                  onChange={(e) => setPostsSearch(e.target.value)}
                  placeholder={fr ? "Rechercher dans les publications..." : "Search global posts by text or author..."}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            {loadingPosts ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                {fr ? "Chargement des publications..." : "Loading global posts..."}
              </div>
            ) : posts.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {fr ? "Aucune publication trouvée." : "No posts found."}
              </div>
            ) : (
              <div className="space-y-4">
                {posts
                  .filter((p) =>
                    postsSearch
                      ? p.content.toLowerCase().includes(postsSearch.toLowerCase()) ||
                        p.author?.name?.toLowerCase().includes(postsSearch.toLowerCase()) ||
                        p.title?.toLowerCase().includes(postsSearch.toLowerCase())
                      : true
                  )
                  .map((post) => (
                    <div
                      key={post.id}
                      className={cn(
                        "rounded-xl border bg-card p-5 shadow-sm transition",
                        post.status === "HIDDEN"
                          ? "border-amber-500/30 bg-amber-500/5 opacity-80"
                          : post.status === "FLAGGED"
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-border"
                      )}
                    >
                      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {post.author?.name || "Community Member"}
                            </span>
                            <Badge variant="outline" className="text-[11px]">
                              {post.type}
                            </Badge>
                            {post.pinned && (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <Pin className="h-3 w-3" /> {fr ? "Épinglé" : "Pinned"}
                              </Badge>
                            )}
                            {post.featured && (
                              <Badge className="bg-amber-600 gap-1 text-xs">
                                <Star className="h-3 w-3" /> {fr ? "Mis en avant" : "Featured"}
                              </Badge>
                            )}
                            {post.status !== "ACTIVE" && (
                              <Badge
                                variant={post.status === "HIDDEN" ? "outline" : "destructive"}
                                className="text-xs"
                              >
                                {post.status}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.created_at).toLocaleString()}
                            </span>
                          </div>

                          {post.title && (
                            <h4 className="text-sm font-bold text-foreground">{post.title}</h4>
                          )}
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{post.content}</p>

                          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                            <span>{post.like_count || 0} {fr ? "réactions" : "reactions"}</span>
                            <span>{post.comment_count || 0} {fr ? "commentaires" : "comments"}</span>
                            {post.attachments?.length > 0 && (
                              <span>{post.attachments.length} {fr ? "pièce(s) jointe(s)" : "attachment(s)"}</span>
                            )}
                          </div>
                        </div>

                        {/* Moderation Controls */}
                        <div className="flex flex-wrap items-center gap-1.5 sm:flex-col sm:items-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            disabled={actionInProgress === post.id}
                            onClick={() =>
                              handleModeratePost(post.id, post.pinned ? "UNPIN_POST" : "PIN_POST")
                            }
                          >
                            <Pin className="h-3.5 w-3.5" />
                            {post.pinned ? (fr ? "Désépingler" : "Unpin") : (fr ? "Épingler" : "Pin")}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            disabled={actionInProgress === post.id}
                            onClick={() =>
                              handleModeratePost(post.id, post.featured ? "UNFEATURE_POST" : "FEATURE_POST")
                            }
                          >
                            <Star className="h-3.5 w-3.5 text-amber-500" />
                            {post.featured ? (fr ? "Retirer vedette" : "Unfeature") : (fr ? "Mettre en vedette" : "Feature")}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            disabled={actionInProgress === post.id}
                            onClick={() =>
                              handleModeratePost(post.id, post.status === "HIDDEN" ? "UNHIDE_POST" : "HIDE_POST")
                            }
                          >
                            {post.status === "HIDDEN" ? (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                {fr ? "Rétablir" : "Unhide"}
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3.5 w-3.5" />
                                {fr ? "Masquer" : "Hide"}
                              </>
                            )}
                          </Button>

                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs gap-1"
                            disabled={actionInProgress === post.id}
                            onClick={() => {
                              if (confirm(fr ? "Supprimer définitivement cette publication ?" : "Permanently remove this post?")) {
                                handleModeratePost(post.id, "REMOVE_POST", "Admin removal");
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {fr ? "Supprimer" : "Remove"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: MODERATION AUDIT LOGS */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              {fr
                ? "Historique immuable de toutes les actions de modération effectuées par les administrateurs et formateurs."
                : "Immutable audit log of all moderation and administrative actions performed across community spaces."}
            </p>

            {loadingAudit ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-primary" />
                {fr ? "Chargement des journaux d'audit..." : "Loading audit trail..."}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {fr ? "Aucune action enregistrée pour le moment." : "No moderation actions recorded yet."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/50 text-muted-foreground uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-3">{fr ? "Date" : "Timestamp"}</th>
                      <th className="px-4 py-3">{fr ? "Modérateur" : "Moderator"}</th>
                      <th className="px-4 py-3">{fr ? "Action" : "Action"}</th>
                      <th className="px-4 py-3">{fr ? "Cible" : "Target"}</th>
                      <th className="px-4 py-3">{fr ? "Motif / Détails" : "Reason / Details"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-foreground">{log.moderator_name}</span>
                          <span className="block text-[11px] text-muted-foreground">{log.moderator_email}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="capitalize text-muted-foreground">{log.target_type}</span>:{" "}
                          <code className="text-[10px] bg-muted px-1 py-0.5 rounded">{log.target_id?.slice(0, 8)}…</code>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.reason || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
