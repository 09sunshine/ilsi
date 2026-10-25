import { useState, useEffect } from "react";
import {
  Trophy,
  Crown,
  Medal,
  Award,
  RefreshCw,
  Download,
  X,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Users,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminRankingsModalProps {
  cohort: any;
  onClose: () => void;
}

export function AdminRankingsModal({ cohort, onClose }: AdminRankingsModalProps) {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";

  const [rankingsData, setRankingsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"eligible" | "ineligible" | "history">("eligible");

  async function fetchRankings(snapshotId?: string, modId = selectedModuleId) {
    if (!cohort?.id) return;
    try {
      if (snapshotId) {
        setLoading(true);
        const details = await api.getAdminSnapshotDetails(snapshotId);
        if (details) {
          const eligible = details.entries.filter((e: any) => e.isEligible);
          const ineligible = details.entries.filter((e: any) => !e.isEligible);
          setRankingsData({
            snapshot: details.snapshot,
            eligible,
            ineligible,
            modules: rankingsData?.modules || [],
            historicalSnapshots: rankingsData?.historicalSnapshots || [],
          });
        }
      } else {
        setLoading(true);
        const data = await api.getAdminCohortRankings(cohort.id, modId !== "all" ? modId : undefined);
        setRankingsData(data);
      }
    } catch (err: any) {
      console.warn("[AdminRankings] Failed to fetch cohort rankings:", err);
      toast.error(err?.message || "Failed to load rankings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRankings(undefined, selectedModuleId);
  }, [cohort?.id, selectedModuleId]);

  async function handleRecalculate() {
    if (!cohort?.id) return;
    setRecalculating(true);
    try {
      await api.recalculateAdminCohortRanking(cohort.id);
      toast.success(fr ? "Classement recalculé avec succès" : "Rankings recalculated successfully");
      await fetchRankings(undefined, selectedModuleId);
    } catch (err: any) {
      toast.error(err?.message || "Recalculation failed.");
    } finally {
      setRecalculating(false);
    }
  }

  function handleExportCsv() {
    if (!cohort?.id) return;
    const backendUrl = ((import.meta.env as any).VITE_BACKEND_URL || "http://localhost:4000").replace(/\/+$/, "");
    const q = selectedModuleId !== "all" ? `?moduleId=${encodeURIComponent(selectedModuleId)}` : "";
    window.open(`${backendUrl}/api/admin/cohorts/${cohort.id}/rankings/export${q}`, "_blank");
  }

  const snapshot = rankingsData?.snapshot;
  const eligibleList: any[] = rankingsData?.eligible || [];
  const ineligibleList: any[] = rankingsData?.ineligible || [];
  const historyList: any[] = rankingsData?.historicalSnapshots || [];

  const filteredEligible = eligibleList.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.rank && e.rank.toString() === searchQuery.trim())
  );

  const filteredIneligible = ineligibleList.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMovement = (change: number | null | undefined) => {
    if (change === null || change === undefined) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full border border-sky-200/50">
          <Sparkles className="size-3" />
          {t("leaderboard.movementNew")}
        </span>
      );
    }
    if (change > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50">
          <ArrowUpRight className="size-3.5" />
          +{change}
        </span>
      );
    }
    if (change < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200/50">
          <ArrowDownRight className="size-3.5" />
          {change}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border">
        <Minus className="size-3" />
        0
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-border flex flex-wrap items-center justify-between gap-4 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Trophy className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">
                  {fr ? "Classement Académique" : "Academic Leaderboard"}
                </h2>
                <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">
                  {snapshot?.academicRuleVersion || "v1.0"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {L(cohort.name)} · {typeof cohort.programTitle === "object" ? L(cohort.programTitle) : cohort.programTitle || "Program"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRecalculate}
              disabled={recalculating}
              className="h-8 text-xs gap-1.5 font-medium border-primary/30 hover:bg-primary/10"
            >
              <RefreshCw className={cn("size-3.5", recalculating && "animate-spin")} />
              {recalculating ? t("leaderboard.recalculating") : t("leaderboard.recalculate")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              className="h-8 text-xs gap-1.5 font-medium border-border hover:bg-muted"
            >
              <Download className="size-3.5" />
              {t("leaderboard.exportCsv")}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Snapshot KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/10 border-b border-border text-xs">
          <div className="p-3 rounded-xl bg-card border border-border/80">
            <span className="text-muted-foreground font-medium block">
              {t("leaderboard.eligibleStudents")}
            </span>
            <span className="font-display text-xl font-bold text-foreground mt-1 block">
              {snapshot?.eligibleStudents ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border/80">
            <span className="text-muted-foreground font-medium block">
              {fr ? "Moyenne Cohorte" : "Cohort Average"}
            </span>
            <span className="font-display text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
              {snapshot?.cohortAverage !== undefined ? Number(snapshot.cohortAverage).toFixed(2) : "0.00"}%
            </span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border/80">
            <span className="text-muted-foreground font-medium block">
              {t("leaderboard.cohortSize")}
            </span>
            <span className="font-display text-xl font-bold text-foreground mt-1 block">
              {snapshot?.totalStudents ?? 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border/80">
            <span className="text-muted-foreground font-medium block">
              {t("leaderboard.lastCalculated")}
            </span>
            <span className="text-xs font-semibold text-foreground mt-1 block truncate">
              {snapshot?.calculatedAt
                ? new Date(snapshot.calculatedAt).toLocaleDateString(
                    fr ? "fr-FR" : "en-GB",
                    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                  )
                : "—"}
            </span>
          </div>
        </div>

        {/* Module Scope Filter */}
        {rankingsData?.modules && rankingsData.modules.length > 0 && (
          <div className="px-4 py-2.5 bg-muted/20 border-b border-border flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-semibold text-muted-foreground shrink-0 mr-1">
              {fr ? "Portée :" : "Scope:"}
            </span>
            <button
              onClick={() => {
                setSelectedSnapshotId(null);
                setSelectedModuleId("all");
              }}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0",
                selectedModuleId === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {t("leaderboard.allModules")}
            </button>
            {rankingsData.modules.map((m: any, idx: number) => {
              const modTitle = typeof m.title === "object" ? L(m.title) : m.title;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedSnapshotId(null);
                    setSelectedModuleId(m.id);
                  }}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 max-w-[220px] truncate",
                    selectedModuleId === m.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  )}
                  title={modTitle}
                >
                  Module {idx + 1}: {modTitle}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab Controls & Search */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/50 border border-border">
            <button
              onClick={() => setActiveTab("eligible")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === "eligible"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {fr ? "Apprenants Classés" : "Ranked Learners"} ({eligibleList.length})
            </button>
            <button
              onClick={() => setActiveTab("ineligible")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === "ineligible"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("leaderboard.ineligibleStudents")} ({ineligibleList.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === "history"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("leaderboard.snapshotHistory")} ({historyList.length})
            </button>
          </div>

          {activeTab !== "history" && (
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={fr ? "Rechercher par nom ou rang…" : "Search by name or rank…"}
                className="h-8 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
              />
            </div>
          )}
        </div>

        {/* Modal Body / Tables */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : activeTab === "eligible" ? (
            filteredEligible.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                {searchQuery ? t("admin.noResults") : t("leaderboard.empty")}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm border-collapse min-w-[620px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th scope="col" className="py-2.5 px-3 w-16 text-center">
                        #
                      </th>
                      <th scope="col" className="py-2.5 px-3">
                        {t("common.name")}
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-center">
                        {selectedModuleId !== "all"
                          ? (fr ? "Note du Module" : "Module Score")
                          : t("leaderboard.academicAverage")}
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-center">
                        {t("leaderboard.academicPoints")}
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-center">
                        {fr ? "Leçons Validées" : "Lessons Completed"}
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-right">
                        {fr ? "Évolution" : "Movement"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEligible.map((e, idx) => (
                      <tr
                        key={e.userId}
                        className={cn(
                          "transition-colors hover:bg-muted/30",
                          e.rank === 1 && "bg-amber-500/[0.04]",
                          e.rank === 2 && "bg-slate-400/[0.04]",
                          e.rank === 3 && "bg-amber-700/[0.04]"
                        )}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center">
                            {e.rank === 1 ? (
                              <div className="size-6.5 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                <Crown className="size-3.5 fill-white text-white" />
                              </div>
                            ) : e.rank === 2 ? (
                              <div className="size-6.5 rounded-lg bg-slate-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                2
                              </div>
                            ) : e.rank === 3 ? (
                              <div className="size-6.5 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                3
                              </div>
                            ) : (
                              <span className="font-bold text-xs text-muted-foreground">
                                #{e.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                              {e.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-xs sm:text-sm text-foreground">
                              {e.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-display font-bold text-xs sm:text-sm text-foreground">
                          {e.average.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs font-medium text-muted-foreground">
                          {e.points.toFixed(2)} pts
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs font-semibold text-foreground">
                          {e.completedLessons !== undefined && e.totalLessons !== undefined
                            ? `${e.completedLessons} / ${e.totalLessons}`
                            : `${e.completedModules} / ${e.totalModules}`}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {renderMovement(e.rankChange)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : activeTab === "ineligible" ? (
            filteredIneligible.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                {fr ? "Aucun participant non classé." : "No ineligible participants in this cohort."}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-left text-sm border-collapse min-w-[540px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th scope="col" className="py-2.5 px-3">
                        {t("common.name")}
                      </th>
                      <th scope="col" className="py-2.5 px-3 text-center">
                        {fr ? "Modules Terminés" : "Modules Completed"}
                      </th>
                      <th scope="col" className="py-2.5 px-3">
                        {fr ? "Raison d'inégibilité" : "Ineligibility Reason"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredIneligible.map((ie) => (
                      <tr key={ie.userId} className="hover:bg-muted/30">
                        <td className="py-2.5 px-3 font-semibold text-xs sm:text-sm text-foreground">
                          {ie.name}
                        </td>
                        <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                          {ie.completedModules} / {ie.totalModules}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] font-semibold",
                              ie.ineligibilityReason === "DISQUALIFIED" && "bg-destructive/15 text-destructive border-destructive/30",
                              ie.ineligibilityReason === "DROPPED" && "bg-amber-500/15 text-amber-700 border-amber-500/30",
                              ie.ineligibilityReason === "PAYMENT_PENDING" && "bg-rose-500/15 text-rose-700 border-rose-500/30"
                            )}
                          >
                            {ie.ineligibilityReason === "NO_COMPLETED_MODULES"
                              ? fr ? "Aucun module validé" : "No completed modules"
                              : ie.ineligibilityReason}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* Historical Snapshots Log Tab */
            historyList.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                {fr ? "Aucun historique disponible." : "No snapshot history available."}
              </div>
            ) : (
              <div className="space-y-3">
                {historyList.map((h) => {
                  const isCurrentSnapshot = h.id === snapshot?.id;
                  return (
                    <div
                      key={h.id}
                      className={cn(
                        "p-4 rounded-xl border border-border bg-card flex flex-wrap items-center justify-between gap-3 transition-all",
                        isCurrentSnapshot && "border-primary/60 bg-primary/[0.02] ring-1 ring-primary/20"
                      )}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs sm:text-sm text-foreground">
                            {new Date(h.calculatedAt).toLocaleString(
                              fr ? "fr-FR" : "en-GB",
                              { dateStyle: "medium", timeStyle: "short" }
                            )}
                          </span>
                          {isCurrentSnapshot && (
                            <Badge variant="default" className="text-[10px]">
                              {fr ? "Actuel" : "Current"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {h.eligibleStudents} {fr ? "classés" : "ranked"} · {fr ? "Moyenne :" : "Average:"}{" "}
                          {h.cohortAverage}% · {fr ? "Par :" : "By:"} {h.calculatedBy}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isCurrentSnapshot && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchRankings(h.id)}
                            className="h-7 text-xs"
                          >
                            {fr ? "Charger cet instantané" : "View Snapshot"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
