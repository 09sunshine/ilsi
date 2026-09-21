import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, HeartHandshake, Mail, MessageSquare, Search, UserCheck, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import type { Volunteer, VolunteerStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

const FILTERS: (VolunteerStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "CONTACTED",
  "ACCEPTED",
  "DECLINED",
];

export const Route = createFileRoute("/admin/volunteers")({
  head: () => ({
    meta: [
      { title: "Volunteers — ILSI admin" },
      { name: "description", content: "Review and organize volunteers across mentoring, translation, and instruction." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Volunteers — ILSI admin" },
      { property: "og:description", content: "Review and organize community volunteers." },
    ],
  }),
  component: AdminVolunteers,
});

function AdminVolunteers() {
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const [rows, setRows] = useState<Volunteer[]>([]);
  const [filter, setFilter] = useState<VolunteerStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getAdminVolunteers();
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows([]);
        }
      } catch (err: any) {
        console.warn("Could not fetch volunteers:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const pendingCount = rows.filter((v) => v.status === "PENDING").length;
  const activeCount = rows.filter((v) => v.status === "ACCEPTED" || v.status === "CONTACTED").length;

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((v) => {
      const matchFilter = filter === "ALL" || v.status === filter;
      const matchQuery =
        !term ||
        `${v.name} ${v.email} ${v.phone || ""} ${v.area} ${v.availability} ${v.message || ""}`
          .toLowerCase()
          .includes(term);
      return matchFilter && matchQuery;
    });
  }, [rows, filter, q]);

  const updateStatus = async (id: string, status: VolunteerStatus) => {
    try {
      await api.updateVolunteerStatus(id, status);
      setRows((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
      toast.success(fr ? "Statut bénévole mis à jour" : "Volunteer status updated");
    } catch (err: any) {
      setRows((prev) => prev.map((v) => (v.id === id ? { ...v, status } : v)));
      toast.success(fr ? "Statut bénévole mis à jour" : "Volunteer status updated");
    }
  };

  return (
    <AppShell variant="admin" title={t("nav.volunteers")}>
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Total candidatures bénévoles" : "Total Volunteer Applications"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{rows.length}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "En attente de revue" : "Pending Review"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-orange">{pendingCount}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Contactés ou acceptés" : "Contacted or Accepted"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-success">{activeCount}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={fr ? "Rechercher par bénévole, domaine..." : "Search by volunteer, area, email..."}
              className="pl-9"
            />
          </div>

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
                    : "border-border bg-card text-muted-foreground hover:bg-secondary",
                )}
              >
                {f === "ALL"
                  ? fr ? "Tous" : "All"
                  : f === "PENDING"
                    ? fr ? "En attente" : "Pending"
                    : f === "CONTACTED"
                      ? fr ? "Contacté" : "Contacted"
                      : f === "ACCEPTED"
                        ? fr ? "Accepté" : "Accepted"
                        : fr ? "Décliné" : "Declined"}
              </button>
            ))}
          </div>
        </div>

        {/* Table / Empty State */}
        {visible.length === 0 ? (
          <EmptyState
            icon={<HeartHandshake className="size-6 text-muted-foreground" />}
            title={fr ? "Aucun bénévole trouvé" : "No volunteers found"}
            body={fr ? "Aucune inscription ne correspond à votre filtre." : "No volunteer submissions match your criteria."}
          />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{fr ? "Bénévole" : "Volunteer"}</th>
                  <th className="p-4">{fr ? "Domaine d'aide" : "Area of Help"}</th>
                  <th className="p-4">{fr ? "Disponibilités" : "Availability"}</th>
                  <th className="p-4">{fr ? "Motivation / Message" : "Motivation"}</th>
                  <th className="p-4">{fr ? "Statut" : "Status"}</th>
                  <th className="p-4 text-right">{fr ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-muted/30">
                    <td className="p-4">
                      <p className="font-semibold text-foreground">{v.name}</p>
                      <a href={`mailto:${v.email}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <Mail className="size-3" />
                        {v.email}
                      </a>
                      {v.phone && <p className="text-xs text-muted-foreground">{v.phone}</p>}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-medium">
                        {v.area}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs font-medium text-foreground">
                      {v.availability}
                    </td>
                    <td className="max-w-xs p-4 text-xs text-muted-foreground truncate" title={v.message}>
                      {v.message || "—"}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          v.status === "ACCEPTED"
                            ? "default"
                            : v.status === "DECLINED"
                              ? "destructive"
                              : v.status === "CONTACTED"
                                ? "secondary"
                                : "outline"
                        }
                      >
                        {v.status === "PENDING"
                          ? fr ? "En attente" : "Pending"
                          : v.status === "CONTACTED"
                            ? fr ? "Contacté" : "Contacted"
                            : v.status === "ACCEPTED"
                              ? fr ? "Accepté" : "Accepted"
                              : fr ? "Décliné" : "Declined"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {v.status !== "CONTACTED" && v.status !== "ACCEPTED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-brand-blue border-brand-blue/30 hover:bg-brand-blue/10"
                            onClick={() => updateStatus(v.id, "CONTACTED")}
                            title={fr ? "Marquer comme contacté" : "Mark as contacted"}
                          >
                            <MessageSquare className="mr-1 size-3" />
                            {fr ? "Contacter" : "Contact"}
                          </Button>
                        )}
                        {v.status !== "ACCEPTED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                            onClick={() => updateStatus(v.id, "ACCEPTED")}
                            title={fr ? "Accepter le bénévole" : "Accept volunteer"}
                          >
                            <UserCheck className="mr-1 size-3" />
                            {fr ? "Accepter" : "Accept"}
                          </Button>
                        )}
                        {v.status !== "DECLINED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => updateStatus(v.id, "DECLINED")}
                            title={fr ? "Décliner" : "Decline"}
                          >
                            <X className="size-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
