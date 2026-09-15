import { createFileRoute, Link } from "@tanstack/react-router";
import { CreditCard, FileText, Radio, TrendingUp, Users } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { applications, cohorts, liveSessions, participants, payments } from "@/data/demo";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin overview — ILSI" },
      { name: "description", content: "Cohort health, applications and payments at a glance." },
      { property: "og:title", content: "Admin overview — ILSI" },
      { property: "og:description", content: "Cohort health, applications and payments." },
    ],
  }),
  component: AdminOverview,
});

function AdminOverview() {
  const { t } = useI18n();
  const L = useLocalized();

  const pendingApps = applications.filter(
    (a) => a.status === "PENDING" || a.status === "UNDER_REVIEW",
  ).length;
  const activeCohorts = cohorts.filter((c) => c.status === "ACTIVE").length;
  const pendingPay = payments.filter((p) => p.status === "PENDING").length;
  const upcoming = liveSessions.filter((s) => s.status === "SCHEDULED").length;

  const stats = [
    { label: t("admin.totalParticipants"), value: participants.length, icon: Users },
    { label: t("admin.activeCohorts"), value: activeCohorts, icon: TrendingUp },
    { label: t("admin.pendingApplications"), value: pendingApps, icon: FileText },
    { label: t("admin.pendingPayments"), value: pendingPay, icon: CreditCard },
    { label: t("admin.upcomingSessions"), value: upcoming, icon: Radio },
  ];

  return (
    <AppShell variant="admin" title={t("admin.title")}>
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="panel p-4">
              <s.icon className="size-4 text-muted-foreground" />
              <p className="mt-3 text-2xl font-semibold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">
                {t("admin.recentApplications")}
              </h2>
              <Link to="/admin/applications" className="text-sm text-primary hover:underline">
                {t("admin.viewDetail")}
              </Link>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {applications.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {a.firstName} {a.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.country} · {a.submittedAt}
                    </p>
                  </div>
                  <Badge variant="secondary">{a.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="font-display text-base font-semibold">{t("admin.cohortProgress")}</h2>
            <ul className="mt-4 space-y-4">
              {cohorts.map((c) => {
                const fill = Math.round((c.enrolled / c.capacity) * 100);
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{L(c.name)}</span>
                      <span className="text-muted-foreground">
                        {c.enrolled}/{c.capacity}
                      </span>
                    </div>
                    <Progress value={fill} className="mt-1.5 h-1.5" />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
