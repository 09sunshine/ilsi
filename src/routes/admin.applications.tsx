import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { applications as seed } from "@/data/demo";
import type { ApplicationStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

const FILTERS: (ApplicationStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "UNDER_REVIEW",
  "SELECTED",
  "WAITLISTED",
  "REJECTED",
  "ENROLLED",
];

export const Route = createFileRoute("/admin/applications")({
  head: () => ({
    meta: [
      { title: "Applications — ILSI admin" },
      { name: "description", content: "Review, select, waitlist or reject cohort applicants." },
      { property: "og:title", content: "Applications — ILSI admin" },
      { property: "og:description", content: "Review, select, waitlist or reject applicants." },
    ],
  }),
  component: AdminApplications,
});

function AdminApplications() {
  const { t } = useI18n();
  const [rows, setRows] = useState(seed);
  const [filter, setFilter] = useState<ApplicationStatus | "ALL">("ALL");
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter(
      (a) =>
        (filter === "ALL" || a.status === filter) &&
        (!term || `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(term)),
    );
  }, [rows, filter, q]);

  const setStatus = (id: string, status: ApplicationStatus) => {
    setRows((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    toast.success(t("common.saved"));
  };

  return (
    <AppShell variant="admin" title={t("nav.applications")}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.search")}
            aria-label={t("admin.search")}
            className="max-w-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filter === f
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                {f === "ALL" ? t("admin.all") : f.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState title={t("admin.noResults")} />
        ) : (
          <ul className="space-y-3">
            {visible.map((a) => (
              <li key={a.id} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.email} · {a.country} · {a.submittedAt}
                    {a.reviewScore !== undefined ? ` · ${a.reviewScore}/100` : ""}
                  </p>
                </div>
                <Badge variant="secondary" className="self-start">
                  {a.status.replace("_", " ")}
                </Badge>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setStatus(a.id, "SELECTED")}>
                    {t("admin.approve")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(a.id, "WAITLISTED")}>
                    {t("admin.waitlist")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setStatus(a.id, "REJECTED")}
                    className="text-destructive"
                  >
                    {t("admin.reject")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
