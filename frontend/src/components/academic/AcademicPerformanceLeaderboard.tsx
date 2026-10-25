import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import {
  Trophy,
  Medal,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronRight,
  Crown,
  ArrowRight,
} from "lucide-react";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface AcademicPerformanceLeaderboardProps {
  cohortId?: string | undefined;
  className?: string | undefined;
  compact?: boolean | undefined;
}

export function AcademicPerformanceLeaderboard({
  cohortId,
  className,
  compact = false,
}: AcademicPerformanceLeaderboardProps) {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";

  const [summary, setSummary] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    setError(null);
    try {
      const [sumRes, leadRes] = await Promise.all([
        api.getStudentRankingSummary(cohortId),
        api.getStudentCohortLeaderboard(cohortId, 1, 50),
      ]);
      setSummary(sumRes);
      setLeaderboard(leadRes);
    } catch (err: any) {
      console.warn("[Leaderboard] Error fetching academic ranking:", err);
      setError(err?.message || "Could not load ranking data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [cohortId]);

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel p-5 space-y-3">
              <Skeleton className="h-4 w-28 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-3 w-36 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="panel p-6 space-y-4">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-lg" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className={cn("panel p-8 text-center space-y-4", className)}>
        <div className="mx-auto size-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
          <Trophy className="size-6" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-base">
            {t("leaderboard.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            {error || t("leaderboard.empty")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData(true)}
          className="rounded-xl gap-2 text-xs"
        >
          <RefreshCw className="size-3.5" />
          {t("common.retry")}
        </Button>
      </div>
    );
  }

  const student = summary.studentEntry;
  const isEligible = student?.isEligible;
  const rank = student?.rank;
  const average = student?.average ?? 0;
  const points = student?.points ?? 0;
  const completedModules = student?.completedModules ?? 0;
  const totalModules = student?.totalModules ?? summary.totalModules ?? 0;
  const rankChange = student?.rankChange;
  const medal = student?.medal;

  const entries: any[] = leaderboard?.entries || [];

  const renderMovement = (change: number | null | undefined) => {
    if (change === null || change === undefined) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full border border-sky-200/50 dark:border-sky-800/40">
          <Sparkles className="size-3" />
          {t("leaderboard.movementNew")}
        </span>
      );
    }
    if (change > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/50 dark:border-emerald-800/40">
          <ArrowUpRight className="size-3.5" />
          {fr ? `+${change} pl.` : `Up ${change}`}
        </span>
      );
    }
    if (change < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full border border-rose-200/50 dark:border-rose-800/40">
          <ArrowDownRight className="size-3.5" />
          {fr ? `${change} pl.` : `Down ${Math.abs(change)}`}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full border border-border">
        <Minus className="size-3" />
        {t("leaderboard.movementSame")}
      </span>
    );
  };

  const renderMedalBadge = (m: string | null, r: number | null) => {
    if (m === "GOLD" || r === 1) {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/10 border border-amber-500/40 text-amber-600 dark:text-amber-400 font-bold text-xs shadow-xs">
          <Crown className="size-3.5 fill-amber-500 text-amber-600 dark:text-amber-400" />
          <span>#1 {fr ? "Or" : "Gold"}</span>
        </div>
      );
    }
    if (m === "SILVER" || r === 2) {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-slate-400/20 via-slate-300/20 to-slate-400/10 border border-slate-400/40 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-xs">
          <Medal className="size-3.5 text-slate-500 dark:text-slate-300" />
          <span>#2 {fr ? "Argent" : "Silver"}</span>
        </div>
      );
    }
    if (m === "BRONZE" || r === 3) {
      return (
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-700/20 via-orange-600/20 to-amber-700/10 border border-amber-700/40 text-amber-800 dark:text-amber-500 font-bold text-xs shadow-xs">
          <Award className="size-3.5 text-amber-700 dark:text-amber-500" />
          <span>#3 {fr ? "Bronze" : "Bronze"}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Your Rank Card */}
        <div className="panel p-5 relative overflow-hidden bg-card border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("leaderboard.yourRank")}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                {isEligible && rank ? (
                  <>
                    <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                      #{rank}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      / {summary.eligibleStudents} {fr ? "classés" : "ranked"}
                    </span>
                  </>
                ) : (
                  <span className="font-display text-xl font-bold text-muted-foreground">
                    —
                  </span>
                )}
              </div>
            </div>
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Trophy className="size-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
            {isEligible && rank ? (
              medal ? (
                renderMedalBadge(medal, rank)
              ) : (
                <span className="text-muted-foreground">
                  {fr ? "Top compétiteurs" : "Cohort standing"}
                </span>
              )
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                {t("leaderboard.notYetEligible")}
              </span>
            )}
            {isEligible && renderMovement(rankChange)}
          </div>
        </div>

        {/* Academic Average Card */}
        <div className="panel p-5 relative overflow-hidden bg-card border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("leaderboard.academicAverage")}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {isEligible ? `${average.toFixed(2)}%` : "0.00%"}
                </span>
              </div>
            </div>
            <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Award className="size-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedModules} / {totalModules} {t("leaderboard.modulesCompleted")}
            </span>
            <span className="font-medium text-foreground">
              {fr ? "Moy. cohorte:" : "Cohort avg:"} {summary.cohortAverage.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Academic Points Card */}
        <div className="panel p-5 relative overflow-hidden bg-card border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("leaderboard.academicPoints")}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {isEligible ? points.toFixed(2) : "0.00"}
                </span>
                <span className="text-xs text-muted-foreground font-medium">pts</span>
              </div>
            </div>
            <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Sparkles className="size-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center text-xs text-muted-foreground truncate">
            <span title={t("leaderboard.pointsExplanation")} className="truncate">
              {t("leaderboard.pointsExplanation")}
            </span>
          </div>
        </div>

        {/* Cohort Composition Card */}
        <div className="panel p-5 relative overflow-hidden bg-card border-border shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("leaderboard.cohortSize")}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {summary.totalStudents}
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {fr ? "inscrits" : "enrolled"}
                </span>
              </div>
            </div>
            <div className="size-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <Users className="size-5" />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {summary.eligibleStudents} {t("leaderboard.eligibleStudents")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="h-6 px-2 text-xs gap-1 hover:text-foreground"
              title={t("leaderboard.lastCalculated")}
            >
              <RefreshCw className={cn("size-3", refreshing && "animate-spin")} />
              {refreshing ? t("leaderboard.recalculating") : t("common.retry")}
            </Button>
          </div>
        </div>
      </div>

      {/* Ineligible Explanation Notice (if not yet ranked) */}
      {!isEligible && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800/50 bg-amber-50/80 dark:bg-amber-950/20 p-4 flex items-start gap-3.5">
          <Info className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {t("leaderboard.notYetEligible")}
            </p>
            <p className="text-amber-800 dark:text-amber-300">
              {student?.ineligibilityReason === "NO_COMPLETED_MODULES"
                ? t("leaderboard.completeOneModule")
                : student?.ineligibilityReason === "DISQUALIFIED"
                ? t("leaderboard.disqualifiedReason")
                : student?.ineligibilityReason === "DROPPED"
                ? t("leaderboard.droppedReason")
                : student?.ineligibilityReason === "PAYMENT_PENDING"
                ? t("leaderboard.unpaidReason")
                : t("leaderboard.completeOneModule")}
            </p>
          </div>
        </div>
      )}

      {/* Compact Mode: Top 3 Podium Preview Card with button to full leaderboard */}
      {compact ? (
        <div className="panel p-5 sm:p-6 border-border bg-card space-y-4 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-base sm:text-lg text-foreground flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" />
                {t("leaderboard.topThree")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fr
                  ? "Les 3 meilleurs apprenants au classement académique de votre cohorte."
                  : "Current top 3 academic performers in your cohort."}
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 rounded-xl gap-1.5 text-xs font-semibold hover:border-primary hover:text-primary transition-all"
            >
              <Link to="/leaderboard" search={{ cohortId }}>
                {fr ? "Voir le classement complet" : "View Full Leaderboard"} <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>

          {(summary.topPerformers?.length || entries.slice(0, 3).length) === 0 ? (
            <p className="text-xs text-muted-foreground py-3">{t("leaderboard.empty")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {(summary.topPerformers || entries.slice(0, 3)).map((p: any) => {
                const isCurrent = p.isCurrentStudent;
                return (
                  <div
                    key={p.userId}
                    className={cn(
                      "p-4 rounded-xl border relative transition-all flex flex-col justify-between",
                      p.rank === 1
                        ? "border-amber-500/40 bg-gradient-to-b from-amber-500/[0.08] to-transparent shadow-xs"
                        : p.rank === 2
                        ? "border-slate-400/40 bg-gradient-to-b from-slate-400/[0.08] to-transparent"
                        : "border-amber-700/40 bg-gradient-to-b from-amber-700/[0.08] to-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "size-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden",
                            p.rank === 1 ? "bg-amber-500" : p.rank === 2 ? "bg-slate-500" : "bg-amber-700"
                          )}
                        >
                          {p.avatarUrl ? (
                            <img src={p.avatarUrl} alt={p.name} className="size-full object-cover" />
                          ) : (
                            p.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs sm:text-sm text-foreground block truncate">
                            {p.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {Number(p.points).toFixed(2)} pts
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {p.rank === 1 ? (
                          <div className="size-6.5 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            <Crown className="size-3.5 fill-white text-white" />
                          </div>
                        ) : p.rank === 2 ? (
                          <div className="size-6.5 rounded-lg bg-slate-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            2
                          </div>
                        ) : (
                          <div className="size-6.5 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            3
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
                      <span className="font-display font-bold text-foreground">
                        {Number(p.average).toFixed(2)}%
                      </span>
                      {isCurrent && (
                        <Badge variant="default" className="text-[9px] h-4 px-1.5 uppercase font-bold">
                          {t("leaderboard.you")}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Student standing footnote if not in top 3 */}
          {isEligible && rank && rank > 3 && (
            <div className="mt-2 pt-3 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {fr ? "Votre position actuelle :" : "Your current standing:"}
                </span>
                <Badge variant="outline" className="font-bold text-primary">
                  #{rank}
                </Badge>
                <span>{average.toFixed(2)}%</span>
                <span>
                  ({completedModules}/{totalModules}{" "}
                  {fr ? "modules validés" : "modules completed"})
                </span>
              </div>
              <div>{renderMovement(rankChange)}</div>
            </div>
          )}
        </div>
      ) : (
        /* Full Cohort Leaderboard Table Section (Shown on /leaderboard) */
        <div className="panel overflow-hidden border-border bg-card">
          <div className="p-5 sm:p-6 border-b border-border flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-semibold text-base sm:text-lg text-foreground flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" />
                {t("leaderboard.title")}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("leaderboard.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {t("leaderboard.lastCalculated")}:{" "}
                {summary.calculatedAt
                  ? new Date(summary.calculatedAt).toLocaleDateString(
                      fr ? "fr-FR" : "en-GB",
                      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
                    )
                  : "—"}
              </span>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground text-sm">
              {t("leaderboard.empty")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse min-w-[620px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <th scope="col" className="py-3 px-4 w-20 text-center">
                      #
                    </th>
                    <th scope="col" className="py-3 px-4">
                      {t("common.name")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-center">
                      {t("leaderboard.academicAverage")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-center">
                      {t("leaderboard.academicPoints")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-center">
                      {t("leaderboard.modulesCompleted")}
                    </th>
                    <th scope="col" className="py-3 px-4 text-right">
                      {fr ? "Évolution" : "Movement"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((item, idx) => {
                    const isCurrent = item.isCurrentStudent;
                    const isTie = idx > 0 && entries[idx - 1].rank === item.rank;

                    return (
                      <tr
                        key={item.userId}
                        className={cn(
                          "transition-colors hover:bg-muted/40",
                          isCurrent && "bg-primary/5 font-medium relative",
                          item.rank === 1 && "bg-amber-500/[0.04]",
                          item.rank === 2 && "bg-slate-400/[0.04]",
                          item.rank === 3 && "bg-amber-700/[0.04]"
                        )}
                      >
                        {/* Rank Column */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {item.rank === 1 ? (
                              <div className="size-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-xs font-bold text-xs">
                                <Crown className="size-3.5 fill-white text-white" />
                              </div>
                            ) : item.rank === 2 ? (
                              <div className="size-7 rounded-xl bg-gradient-to-br from-slate-300 to-slate-500 text-white flex items-center justify-center shadow-xs font-bold text-xs">
                                2
                              </div>
                            ) : item.rank === 3 ? (
                              <div className="size-7 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 text-white flex items-center justify-center shadow-xs font-bold text-xs">
                                3
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground">
                                #{item.rank}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Name & Avatar Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "size-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden",
                                item.rank === 1
                                  ? "bg-amber-500"
                                  : item.rank === 2
                                  ? "bg-slate-500"
                                  : item.rank === 3
                                  ? "bg-amber-700"
                                  : "bg-primary"
                              )}
                            >
                              {item.avatarUrl ? (
                                <img
                                  src={item.avatarUrl}
                                  alt={item.name}
                                  className="size-full object-cover"
                                />
                              ) : (
                                item.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-semibold text-xs sm:text-sm text-foreground",
                                  isCurrent && "text-primary font-bold"
                                )}
                              >
                                {item.name}
                              </span>
                              {isCurrent && (
                                <Badge
                                  variant="default"
                                  className="text-[10px] h-4.5 px-1.5 font-bold uppercase tracking-wider"
                                >
                                  {t("leaderboard.you")}
                                </Badge>
                              )}
                              {isTie && (
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  ({t("leaderboard.tie")})
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Average Column */}
                        <td className="py-3.5 px-4 text-center font-display font-bold text-xs sm:text-sm text-foreground">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-lg",
                              item.rank === 1 && "bg-amber-500/10 text-amber-700 dark:text-amber-400 font-extrabold",
                              item.rank === 2 && "bg-slate-400/10 text-slate-700 dark:text-slate-300 font-bold",
                              item.rank === 3 && "bg-amber-700/10 text-amber-800 dark:text-amber-500 font-bold"
                            )}
                          >
                            {item.average.toFixed(2)}%
                          </span>
                        </td>

                        {/* Points Column */}
                        <td className="py-3.5 px-4 text-center text-xs sm:text-sm font-semibold text-muted-foreground">
                          {item.points.toFixed(2)}{" "}
                          <span className="text-[10px] text-muted-foreground/70">pts</span>
                        </td>

                        {/* Modules Completed */}
                        <td className="py-3.5 px-4 text-center text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <CheckCircle2 className="size-3.5 text-emerald-500" />
                            {item.completedModules} / {item.totalModules}
                          </span>
                        </td>

                        {/* Movement */}
                        <td className="py-3.5 px-4 text-right">
                          {renderMovement(item.rankChange)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RankingServiceMedal(rank: number | null): "GOLD" | "SILVER" | "BRONZE" | null {
  if (rank === 1) return "GOLD";
  if (rank === 2) return "SILVER";
  if (rank === 3) return "BRONZE";
  return null;
}
