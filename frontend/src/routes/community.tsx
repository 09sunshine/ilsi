import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Bell,
  Briefcase,
  Calendar,
  Compass,
  FileText,
  Filter,
  FolderGit2,
  Github,
  Globe,
  GraduationCap,
  HelpCircle,
  Layers,
  Linkedin,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PostComposer } from "@/components/community/PostComposer";
import { PostCard } from "@/components/community/PostCard";
import { ProfileEditorModal } from "@/components/community/ProfileEditorModal";
import { ProjectModal } from "@/components/community/ProjectModal";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { toast } from "sonner";

export const Route = createFileRoute("/community")({
  validateSearch: (search: Record<string, unknown>): { cohortId?: string | undefined } => {
    return {
      cohortId: (search["cohortId"] as string) || undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "ILSI Community — Private Cohorts & Global Network" },
      {
        name: "description",
        content: "Collaborate with your cohort peers and connect with the global ILSI leadership network.",
      },
    ],
  }),
  component: CommunityPage,
});

type TabKey = "cohort" | "global" | "directory" | "profile" | "myposts";

function CommunityPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";
  const { data: sessionData } = useSession();

  const search = Route.useSearch();
  const initialQueryCohortId =
    search?.cohortId ||
    (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("cohortId") : undefined) ||
    "";

  const currentUserId = sessionData?.user?.id || "";
  const currentUserRole = (sessionData?.user as any)?.role || "PARTICIPANT";

  const [activeTab, setActiveTab] = useState<TabKey>("cohort");
  const [accessibleCohorts, setAccessibleCohorts] = useState<any[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>(initialQueryCohortId);
  const [loadingCohorts, setLoadingCohorts] = useState(true);

  // Feed State
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>(null);

  // Directory State
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState("");

  // Profile & Projects State
  const [myProfile, setMyProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  // Load accessible cohorts for the user
  useEffect(() => {
    async function loadCohorts() {
      try {
        const cohorts = await api.getAccessibleCohorts();
        setAccessibleCohorts(cohorts);

        const targetId =
          search?.cohortId ||
          (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("cohortId") : undefined) ||
          selectedCohortId;

        const matchingCohort = cohorts.find((c) => c.id === targetId);

        if (matchingCohort) {
          setSelectedCohortId(matchingCohort.id);
          setActiveTab("cohort");
        } else if (cohorts.length > 0) {
          setSelectedCohortId(cohorts[0].id);
        } else {
          // If user has no active cohort, default to global community
          setActiveTab("global");
        }
      } catch (err: any) {
        console.warn("Could not load accessible cohorts:", err?.message || err);
      } finally {
        setLoadingCohorts(false);
      }
    }
    void loadCohorts();
  }, [search.cohortId]);

  // Fetch posts when tab, cohort, page, or filters change
  const fetchPosts = async () => {
    if (activeTab === "directory" || activeTab === "profile") return;
    if (activeTab === "cohort" && !selectedCohortId) return;

    setLoadingPosts(true);
    try {
      const scope = activeTab === "cohort" ? "cohort" : "global";
      const authorId = activeTab === "myposts" ? currentUserId : undefined;

      const res = await api.getCommunityPosts({
        scope: activeTab === "cohort" ? "cohort" : "global",
        cohortId: activeTab === "cohort" ? selectedCohortId : undefined,
        type: filterType !== "ALL" ? filterType : undefined,
        search: searchQuery.trim() || undefined,
        authorId,
        page,
        limit: 15,
      });

      const postsList = Array.isArray(res) ? res : ((res as any)?.posts || (res as any)?.data?.posts || []);
      const paginationData = (res as any)?.pagination || {
        page,
        limit: 15,
        totalCount: postsList.length,
        totalPages: Math.max(1, Math.ceil(postsList.length / 15)),
      };

      setPosts(postsList);
      setPagination(paginationData);
    } catch (err: any) {
      toast.error(err.message || "Failed to load community discussions.");
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    void fetchPosts();
  }, [activeTab, selectedCohortId, filterType, page]);

  // Load Directory Members
  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await api.searchCommunityMembers({
        q: memberQuery.trim() || undefined,
        skill: selectedSkill.trim() || undefined,
      });
      setMembers(data);
    } catch (err: any) {
      console.warn("Could not load directory members:", err?.message || err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "directory") {
      void fetchMembers();
    }
  }, [activeTab, selectedSkill]);

  // Load Profile
  const fetchMyProfile = async () => {
    if (!currentUserId) return;
    setLoadingProfile(true);
    try {
      const data = await api.getCommunityProfile(currentUserId);
      setMyProfile(data);
    } catch (err: any) {
      console.warn("Could not load profile:", err?.message || err);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    if (activeTab === "profile" && currentUserId) {
      void fetchMyProfile();
    }
  }, [activeTab, currentUserId]);

  const selectedCohort = accessibleCohorts.find((c) => c.id === selectedCohortId);
  const isTrainer = selectedCohort?.user_role === "INSTRUCTOR" || currentUserRole === "INSTRUCTOR";
  const isAdmin = currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        {/* Community Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-border/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              {t("community.title")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {activeTab === "cohort"
                ? fr
                  ? "Espace d'échange privé réservé aux participants et formateurs de votre cohorte."
                  : "Private discussion space for members and trainers of your active cohort."
                : fr
                  ? "Le réseau mondial des participants et diplômés d'ILSI."
                  : "Connect with leaders, alumni, and participants across all ILSI programs."}
            </p>
          </div>

          {/* Cohort Switcher dropdown (if user has multiple cohorts or is admin) */}
          {activeTab === "cohort" && accessibleCohorts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("common.cohort")}:
              </span>
              <select
                value={selectedCohortId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedCohortId(newId);
                  setPage(1);
                  if (typeof window !== "undefined") {
                    const url = new URL(window.location.href);
                    url.searchParams.set("cohortId", newId);
                    window.history.replaceState({}, "", url.toString());
                  }
                }}
                className="h-9 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              >
                {accessibleCohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {fr ? c.name_fr : c.name_en} ({c.user_role})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-muted/50 border border-border/60 text-xs font-medium overflow-x-auto no-scrollbar touch-pan-x whitespace-nowrap shadow-xs">
          <button
            onClick={() => {
              setActiveTab("cohort");
              setPage(1);
            }}
            disabled={accessibleCohorts.length === 0}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === "cohort"
                ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground disabled:opacity-40"
            }`}
          >
            <Lock className="size-3.5 text-primary shrink-0" />
            <span>{t("community.cohortTab")}</span>
            {selectedCohort && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal ml-0.5 hidden md:inline">
                {fr ? selectedCohort.name_fr : selectedCohort.name_en}
              </Badge>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab("global");
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === "global"
                ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="size-3.5 text-emerald-600 shrink-0" />
            <span>{t("community.globalTab")}</span>
          </button>

          <button
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === "directory"
                ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Compass className="size-3.5 text-amber-500 shrink-0" />
            <span>{fr ? "Annuaire Membres" : "Directory"}</span>
          </button>

          <button
            onClick={() => setActiveTab("myposts")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all shrink-0 ${
              activeTab === "myposts"
                ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="size-3.5 shrink-0" />
            <span>{t("community.myPostsTab")}</span>
          </button>

          <button
            onClick={() => setActiveTab("profile")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all shrink-0 sm:ml-auto ${
              activeTab === "profile"
                ? "bg-card text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="size-3.5 shrink-0" />
            <span>{t("community.myProfileTab")}</span>
          </button>
        </div>

        {/* =========================================================================
            VIEW 1 & 2: FEEDS (Cohort Space, Global Network, or My Posts)
           ========================================================================= */}
        {(activeTab === "cohort" || activeTab === "global" || activeTab === "myposts") && (
          <div className="space-y-6">
            {/* Cohort Space Banner */}
            {activeTab === "cohort" && selectedCohort && (
              <div className="panel p-4 sm:p-5 border-primary/30 bg-primary/[0.03] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <GraduationCap className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-semibold text-base text-foreground">
                        {fr ? selectedCohort.name_fr : selectedCohort.name_en}
                      </h2>
                      <Badge className="text-[10px] bg-primary/15 text-primary border-primary/20 py-0 px-2 font-medium">
                        Private Space
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fr ? selectedCohort.program_title_fr : selectedCohort.program_title_en} •{" "}
                      {new Date(selectedCohort.start_date).toLocaleDateString()} →{" "}
                      {new Date(selectedCohort.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5 self-start sm:self-center">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span>Verified Cohort Access</span>
                </div>
              </div>
            )}

            {/* Post Composer */}
            {activeTab !== "myposts" && (
              <PostComposer
                scope={activeTab === "cohort" ? "cohort" : "global"}
                cohortId={activeTab === "cohort" ? selectedCohortId : undefined}
                isStaffOrTrainer={isTrainer || isAdmin}
                onPostCreated={(newPost) => setPosts([newPost, ...posts])}
              />
            )}

            {/* Search and Filters Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchPosts()}
                  placeholder={t("community.searchPosts")}
                  className="pl-9 h-9 text-xs bg-card"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto pb-1 sm:pb-0 touch-pan-x whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setFilterType("ALL")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                    filterType === "ALL"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("community.filterAll")}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("DISCUSSION")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                    filterType === "DISCUSSION"
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("community.filterDiscussions")}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("QUESTION")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                    filterType === "QUESTION"
                      ? "bg-amber-600 text-white shadow-xs font-semibold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("community.filterQuestions")}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("ANNOUNCEMENT")}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                    filterType === "ANNOUNCEMENT"
                      ? "bg-hero-lime text-hero-lime-foreground shadow-xs font-bold"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {t("community.filterAnnouncements")}
                </button>
              </div>
            </div>

            {/* Posts Stream */}
            {loadingPosts ? (
              <div className="space-y-4 py-8">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="panel p-6 border rounded-2xl animate-pulse space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-muted" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 w-32 bg-muted rounded" />
                        <div className="h-3 w-48 bg-muted rounded" />
                      </div>
                    </div>
                    <div className="h-16 bg-muted/60 rounded" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="panel p-10 text-center border-dashed border-2 rounded-2xl bg-muted/20">
                <MessageSquare className="size-10 text-muted-foreground mx-auto stroke-1" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  {t("community.noPosts")}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground max-w-md mx-auto">
                  {activeTab === "cohort"
                    ? "Start a discussion or ask a question to engage your cohort peers and instructors."
                    : "Share an achievement, leadership learning, or project with the worldwide ILSI network."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                    onPostUpdated={(updated) =>
                      setPosts(posts.map((p) => (p.id === updated.id ? updated : p)))
                    }
                    onPostDeleted={(deletedId) =>
                      setPosts(posts.filter((p) => p.id !== deletedId))
                    }
                  />
                ))}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="h-8 text-xs"
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground font-medium px-2">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= pagination.totalPages}
                      className="h-8 text-xs"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            VIEW 3: MEMBER DIRECTORY & DISCOVERY
           ========================================================================= */}
        {activeTab === "directory" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchMembers()}
                  placeholder={t("community.searchMembers")}
                  className="pl-10 h-10 text-sm bg-card"
                />
              </div>
              <Button onClick={() => fetchMembers()} size="sm" className="h-10 px-5 font-semibold">
                Search
              </Button>
            </div>

            {loadingMembers ? (
              <div className="py-12 text-center">
                <Loader2 className="size-8 animate-spin mx-auto text-primary" />
              </div>
            ) : members.length === 0 ? (
              <div className="panel p-10 text-center border-dashed rounded-2xl bg-muted/20">
                <Users className="size-10 text-muted-foreground mx-auto stroke-1" />
                <p className="mt-3 text-sm text-muted-foreground">
                  No community members found matching your search.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="panel border p-5 rounded-2xl bg-card hover:border-primary/40 transition-colors space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-base uppercase shrink-0 overflow-hidden border">
                        {member.image ? (
                          <img src={member.image} alt={member.name} className="size-full object-cover" />
                        ) : (
                          member.name?.charAt(0) || "U"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-sm text-foreground truncate">{member.name}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.headline || "ILSI Community Member"}
                        </p>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 mt-1">
                          {member.role}
                        </Badge>
                      </div>
                    </div>

                    {member.bio && (
                      <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
                        {member.bio}
                      </p>
                    )}

                    {member.skills && member.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {member.skills.slice(0, 3).map((s: string) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t flex items-center gap-2">
                      {member.linkedin_url && (
                        <a
                          href={member.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <Linkedin className="size-3.5" />
                        </a>
                      )}
                      {member.github_url && (
                        <a
                          href={member.github_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <Github className="size-3.5" />
                        </a>
                      )}
                      {member.portfolio_url && (
                        <a
                          href={member.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <Globe className="size-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            VIEW 4: MY COMMUNITY PROFILE & PROJECTS
           ========================================================================= */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            {loadingProfile ? (
              <div className="py-12 text-center">
                <Loader2 className="size-8 animate-spin mx-auto text-primary" />
              </div>
            ) : myProfile ? (
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="panel border rounded-2xl p-6 bg-card space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="size-16 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xl uppercase overflow-hidden border-2 border-primary/20">
                        {myProfile.image ? (
                          <img src={myProfile.image} alt={myProfile.name} className="size-full object-cover" />
                        ) : (
                          myProfile.name?.charAt(0) || "U"
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-display font-bold text-foreground">
                            {myProfile.name}
                          </h2>
                          <Badge variant="outline" className="text-xs">
                            {myProfile.role}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {myProfile.headline || "Add a professional headline..."}
                        </p>
                      </div>
                    </div>

                    <Button
                      onClick={() => setProfileEditorOpen(true)}
                      size="sm"
                      className="self-start sm:self-center font-semibold gap-1.5"
                    >
                      <Settings className="size-4" />
                      {t("community.editProfile")}
                    </Button>
                  </div>

                  {myProfile.bio && (
                    <div className="pt-2 border-t">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                        About Me
                      </h4>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {myProfile.bio}
                      </p>
                    </div>
                  )}

                  {/* Skills & Interests */}
                  <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t">
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Skills
                      </h4>
                      {myProfile.skills && myProfile.skills.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {myProfile.skills.map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No skills listed yet.</p>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Interests
                      </h4>
                      {myProfile.interests && myProfile.interests.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {myProfile.interests.map((item: string) => (
                            <Badge key={item} variant="outline" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No interests listed yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Programs Attended */}
                  {myProfile.programs && myProfile.programs.length > 0 && (
                    <div className="pt-2 border-t">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Verified ILSI Cohorts & Programs
                      </h4>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {myProfile.programs.map((prog: any) => (
                          <div
                            key={prog.id}
                            className="p-3 rounded-xl border border-border/80 bg-muted/30 text-xs"
                          >
                            <p className="font-semibold text-foreground">
                              {fr ? prog.title_fr : prog.title_en}
                            </p>
                            <p className="text-muted-foreground text-[11px] mt-0.5">
                              {fr ? prog.cohort_name_fr : prog.cohort_name_en}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Capstone Projects & Achievements Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-semibold text-lg text-foreground">
                        {t("community.projectsTitle")}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Highlight initiatives, leadership capstones, or projects you've developed.
                      </p>
                    </div>
                    <Button
                      onClick={() => setProjectModalOpen(true)}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs font-semibold"
                    >
                      <Plus className="size-3.5" />
                      {t("community.addProject")}
                    </Button>
                  </div>

                  {myProfile.projects && myProfile.projects.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {myProfile.projects.map((proj: any) => (
                        <div
                          key={proj.id}
                          className="panel border p-5 rounded-2xl bg-card space-y-2.5 relative group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-sm text-foreground">{proj.title}</h4>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm("Delete this project?")) return;
                                await api.deleteCommunityProject(proj.id);
                                void fetchMyProfile();
                                toast.success("Project removed.");
                              }}
                              className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Plus className="size-3.5 rotate-45" />
                            </button>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                            {proj.description}
                          </p>
                          {proj.skills_used && proj.skills_used.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {proj.skills_used.map((s: string) => (
                                <span
                                  key={s}
                                  className="px-2 py-0.5 rounded bg-muted text-[10px] text-muted-foreground font-medium"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                          {proj.project_url && (
                            <a
                              href={proj.project_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline pt-1"
                            >
                              <Globe className="size-3" />
                              View Project Link
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="panel p-8 text-center border-dashed rounded-2xl bg-muted/20">
                      <FolderGit2 className="size-8 text-muted-foreground mx-auto stroke-1" />
                      <p className="mt-2 text-xs text-muted-foreground">
                        No projects showcased yet. Add a project to inspire other community members!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {myProfile && (
        <ProfileEditorModal
          open={profileEditorOpen}
          onOpenChange={setProfileEditorOpen}
          profile={myProfile}
          onProfileUpdated={(updated) => setMyProfile({ ...myProfile, ...updated })}
        />
      )}

      {/* Add Project Modal */}
      <ProjectModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        onProjectCreated={() => void fetchMyProfile()}
      />
    </AppShell>
  );
}
