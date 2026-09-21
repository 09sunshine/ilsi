import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { ArrowRight, CalendarDays, Clock, Search } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import {
  CompletionBar,
  KpiCard,
  SectionHeading,
  SparkBars,
  SparkLine,
  SparkPlain,
  StatusPill,
  panelCard,
} from "@/components/app/dash";
import { Button } from "@/components/ui/button";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — ILSI" },
      { name: "description", content: "Cohort health, applications and payments at a glance." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin overview — ILSI" },
      { property: "og:description", content: "Cohort health, applications and payments." },
    ],
  }),
  component: AdminOverview,
});

const selectCls =
  "h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-muted-foreground outline-none focus:ring-2 focus:ring-ring/40";

function AdminOverview() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";

  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [liveParticipants, setLiveParticipants] = useState<any[] | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [dash, parts] = await Promise.allSettled([
          api.getAdminDashboard(),
          api.getParticipants(),
        ]);
        if (dash.status === "fulfilled" && dash.value) {
          setDashboardStats(dash.value);
        }
        if (parts.status === "fulfilled" && Array.isArray(parts.value)) {
          setLiveParticipants(parts.value);
        }
      } catch (err) {
        console.warn("Could not fetch admin overview data:", err);
      }
    }
    loadData();
  }, []);

  const pendingApps = dashboardStats?.kpis?.pendingApplications ?? 0;
  const activeCohorts = dashboardStats?.kpis?.activeCohorts ?? 0;
  const pendingPay = dashboardStats?.kpis?.pendingPayments ?? 0;
  const revenueUsd = dashboardStats?.kpis?.revenueUsd ?? 0;
  const revenueEur = dashboardStats?.kpis?.revenueEur ?? 0;
  const upcomingSessions = dashboardStats?.upcomingSessions ?? [];
  const cohorts: any[] = dashboardStats?.cohorts ?? [];

  const [query, setQuery] = useState("");
  const [cohortFilter, setCohortFilter] = useState("ALL");

  const sourceParticipants = liveParticipants ?? [];
  const rows = sourceParticipants.map((p: any) => {
    const pName = `${p.firstName || ""} ${p.lastName || ""}`.trim() || p.email || "Participant";
    return {
      participant: p,
      name: pName,
      program: p.programTitle || p.program || { en: "Program", fr: "Programme" },
      cohort: { name: p.cohortName || { en: "Cohort", fr: "Cohorte" }, enrolled: p.enrolledCount ?? 1, capacity: p.capacity ?? 30 },
      fill: p.completionRate ?? 50,
    };
  });

  const filtered = useMemo(
    () =>
      rows.filter(
        (r: any) =>
          (cohortFilter === "ALL" || r.participant.cohortId === cohortFilter) &&
          r.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [rows, cohortFilter, query],
  );

  const fmtDate = (d?: string) => {
    if (!d) return "";
    const parsed = new Date(d);
    return isNaN(parsed.getTime())
      ? d
      : parsed.toLocaleDateString(fr ? "fr-FR" : "en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  const payTone = (s: string) => (s === "PAID" ? "success" : s === "PENDING" ? "warning" : "danger");

  return (
    <AppShell variant="admin" title={t("admin.title")}>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Greeting header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              {fr ? "Bonjour, équipe ILSI" : "Hi, ILSI team"} <span aria-hidden>👋</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fr
                ? `${pendingApps} candidatures et ${pendingPay} paiements attendent une action aujourd'hui.`
                : `${pendingApps} applications and ${pendingPay} payments need action today.`}
            </p>
          </div>
          {dashboardStats?.cohorts?.[0] && (
            <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
              {fmtDate(dashboardStats.cohorts[0].startDate)} – {fmtDate(dashboardStats.cohorts[0].endDate)}
              <CalendarDays className="size-3.5" />
            </span>
          )}
        </div>

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("admin.totalParticipants")}
            action={
              <Link to="/admin/participants" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${dashboardStats?.kpis?.totalStudents ?? sourceParticipants.length}`}
            delta={`${dashboardStats?.kpis?.activeStudents ?? 0} ${fr ? "actifs" : "active"}`}
            chart={
              <SparkBars
                data={
                  dashboardStats?.trends?.participants?.length
                    ? dashboardStats.trends.participants
                    : [dashboardStats?.kpis?.totalStudents ?? sourceParticipants.length]
                }
                color="var(--chart-1)"
              />
            }
          />
          <KpiCard
            label={t("admin.activeCohorts")}
            action={
              <Link to="/admin/cohorts" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${activeCohorts}`}
            delta={`${dashboardStats?.cohorts?.length ?? 0} ${fr ? "au total" : "total"}`}
            chart={
              <SparkLine
                data={
                  dashboardStats?.trends?.activeCohorts?.length
                    ? dashboardStats.trends.activeCohorts
                    : [activeCohorts]
                }
                color="var(--brand-blue)"
              />
            }
          />
          <KpiCard
            label={t("admin.pendingApplications")}
            action={
              <Link to="/admin/applications" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={`${pendingApps}`}
            delta={`${dashboardStats?.kpis?.totalApplications ?? 0} ${fr ? "reçues" : "submitted"}`}
            positive={pendingApps === 0}
            chart={
              <SparkPlain
                data={
                  dashboardStats?.trends?.applications?.length
                    ? dashboardStats.trends.applications
                    : [pendingApps]
                }
                color="var(--brand-orange)"
              />
            }
          />
          <KpiCard
            label={fr ? "Revenus encaissés (USD / EUR)" : "Collected revenue (USD / EUR)"}
            action={
              <Link to="/admin/payments" className="text-[11px] font-semibold text-primary hover:underline">
                {fr ? "Détails" : "View details"}
              </Link>
            }
            value={
              fr
                ? `${revenueEur.toLocaleString("fr-FR")} € · $${revenueUsd.toLocaleString()}`
                : `$${revenueUsd.toLocaleString()} · ${revenueEur.toLocaleString("fr-FR")} €`
            }
            delta={`${pendingPay} ${fr ? "en attente" : "pending"}`}
            chart={
              <SparkBars
                data={
                  dashboardStats?.trends?.revenue?.length
                    ? dashboardStats.trends.revenue
                    : [(revenueUsd + revenueEur)]
                }
                color="var(--brand-orange)"
              />
            }
          />
        </div>

        {/* Upcoming sessions */}
        <section className="space-y-3">
          <SectionHeading
            title={fr ? "Sessions live à venir" : "Upcoming live sessions"}
            right={
              <span className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground">
                {upcomingSessions.length} {fr ? "programmées" : "scheduled"}
                <Clock className="size-3.5" />
              </span>
            }
          />
          <div className="grid gap-4 md:grid-cols-3">
            {upcomingSessions.slice(0, 3).map((s: any, i: number) => {
              const highlight = i === 0;
              return (
                <article
                  key={s.id}
                  className={cn(
                    "rounded-2xl border p-4",
                    highlight ? "border-transparent bg-primary text-primary-foreground" : "border-border bg-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-[0.12em]",
                        highlight ? "opacity-80" : "text-muted-foreground",
                      )}
                    >
                      {fr ? "Session live" : "Live session"}
                    </span>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-semibold",
                        highlight ? "bg-primary-foreground/15" : "bg-surface text-muted-foreground",
                      )}
                    >
                      60 {fr ? "min" : "mins"}
                    </span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 font-display text-sm font-semibold">{L(s.title)}</h3>
                  <p className={cn("mt-1 text-[11px]", highlight ? "opacity-80" : "text-muted-foreground")}>
                    {fmtDate(s.date)} · {s.startTime}–{s.endTime} · {s.instructor}
                  </p>
                  <Link
                    to="/admin/cohorts"
                    className={cn(
                      "mt-4 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold",
                      highlight
                        ? "bg-primary-foreground text-primary"
                        : "border border-border text-foreground hover:bg-surface",
                    )}
                  >
                    {fr ? "Gérer" : "Manage"} <ArrowRight className="size-3" />
                  </Link>
                </article>
              );
            })}
          </div>
        </section>

        {/* Participants table */}
        <section className="space-y-3">
          <SectionHeading
            title={t("admin.totalParticipants")}
            right={
              <Button asChild size="sm" className="rounded-xl">
                <Link to="/admin/applications">
                  {t("admin.recentApplications")} <ArrowRight className="size-4" />
                </Link>
              </Button>
            }
          />

          <div className={cn(panelCard, "overflow-hidden")}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border p-4">
              <select
                className={selectCls}
                value={cohortFilter}
                onChange={(e) => setCohortFilter(e.target.value)}
                aria-label={t("nav.cohorts")}
              >
                <option value="ALL">{fr ? "Toutes les cohortes" : "All cohorts"}</option>
                {cohorts.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {L(c.name)}
                  </option>
                ))}
              </select>
              <div className="relative ml-auto w-full sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={fr ? "Rechercher…" : "Search…"}
                  aria-label={fr ? "Rechercher un participant" : "Search participants"}
                  className="h-9 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-xs outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">
                {fr ? "Aucun participant ne correspond." : "No participants match your search."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 font-medium">{fr ? "Participant" : "Participant"}</th>
                      <th className="px-4 py-3 font-medium">{fr ? "Programme" : "Program"}</th>
                      <th className="px-4 py-3 font-medium">{t("nav.cohorts")}</th>
                      <th className="px-4 py-3 font-medium">{fr ? "Paiement" : "Payment"}</th>
                      <th className="px-4 py-3 font-medium">{fr ? "Remplissage" : "Cohort fill"}</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r: any) => (
                      <tr key={r.participant.id} className="border-b border-border/70 last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-orange/10 text-[11px] font-bold text-brand-orange ring-1 ring-brand-orange/15">
                              {r.participant.firstName?.[0] || r.name?.[0] || "P"}
                              {r.participant.lastName?.[0] || ""}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {r.participant.country || ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.program ? L(r.program) : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {r.cohort ? L(r.cohort.name) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            tone={payTone(r.participant.paymentStatus) as "success" | "warning" | "danger"}
                          >
                            {r.participant.paymentStatus}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <CompletionBar value={r.fill} />
                            <span className="text-xs font-semibold text-muted-foreground">{r.fill}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to="/admin/participants"
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface"
                          >
                            {t("admin.viewDetail")} <ArrowRight className="size-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                {fr
                  ? `Affichage 1-${filtered.length} sur ${rows.length} participants`
                  : `Showing 1-${filtered.length} of ${rows.length} participants`}
              </span>
              <Link to="/admin/participants" className="font-semibold text-primary hover:underline">
                {fr ? "Voir tout" : "View all"}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
