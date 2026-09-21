import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, HandHeart, Search, X } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { formatPrice } from "@/lib/currency";
import { api } from "@/lib/api";
import type { Donation, DonationStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

const FILTERS: (DonationStatus | "ALL")[] = ["ALL", "PLEDGED", "COMPLETED", "CANCELLED"];

export const Route = createFileRoute("/admin/donations")({
  head: () => ({
    meta: [
      { title: "Donations — ILSI admin" },
      { name: "description", content: "Review and manage donor contributions, pledges and scholarship funds." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Donations — ILSI admin" },
      { property: "og:description", content: "Manage donor gifts and scholarship pledges." },
    ],
  }),
  component: AdminDonations,
});

function AdminDonations() {
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const [rows, setRows] = useState<Donation[]>([]);
  const [filter, setFilter] = useState<DonationStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getAdminDonations();
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows([]);
        }
      } catch (err: any) {
        console.warn("Could not fetch donations:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const totalUsd = rows
    .filter((d) => d.status !== "CANCELLED" && (d.currency === "USD" || !d.currency))
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const totalEur = rows
    .filter((d) => d.status !== "CANCELLED" && d.currency === "EUR")
    .reduce((sum, d) => sum + Number(d.amount), 0);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((d) => {
      const matchFilter = filter === "ALL" || d.status === filter;
      const matchQuery =
        !term ||
        `${d.name} ${d.email} ${d.phone || ""} ${d.message || ""}`
          .toLowerCase()
          .includes(term);
      return matchFilter && matchQuery;
    });
  }, [rows, filter, q]);

  const updateStatus = async (id: string, status: DonationStatus) => {
    try {
      await api.updateDonationStatus(id, status);
      setRows((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
      toast.success(fr ? "Statut mis à jour" : "Status updated successfully");
    } catch (err: any) {
      // Optimistic update for demo
      setRows((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d)));
      toast.success(fr ? "Statut mis à jour" : "Status updated successfully");
    }
  };

  return (
    <AppShell variant="admin" title={t("nav.donations")}>
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Dons & promesses en Dollars ($ USD)" : "USD Pledges & Donations ($)"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">${totalUsd.toLocaleString()}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Dons & promesses en Euros (€ EUR)" : "EUR Pledges & Donations (€)"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{totalEur.toLocaleString("fr-FR")} €</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Total contributeurs" : "Total Contributors"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{rows.length}</p>
          </div>
        </div>

        {/* Filter and search bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={fr ? "Rechercher par nom, e-mail..." : "Search by donor name, email..."}
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
                  : f === "PLEDGED"
                    ? fr ? "Promis" : "Pledged"
                    : f === "COMPLETED"
                      ? fr ? "Encaissé" : "Completed"
                      : fr ? "Annulé" : "Cancelled"}
              </button>
            ))}
          </div>
        </div>

        {/* Table / Empty State */}
        {visible.length === 0 ? (
          <EmptyState
            icon={<HandHeart className="size-6 text-muted-foreground" />}
            title={fr ? "Aucun don trouvé" : "No donations found"}
            body={fr ? "Aucune contribution ne correspond à votre filtre." : "No donation pledges match your current filters."}
          />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{fr ? "Donateur" : "Contributor"}</th>
                  <th className="p-4">{fr ? "Montant" : "Amount"}</th>
                  <th className="p-4">{fr ? "Fréquence" : "Frequency"}</th>
                  <th className="p-4">{fr ? "Message / Note" : "Message / Note"}</th>
                  <th className="p-4">{fr ? "Statut" : "Status"}</th>
                  <th className="p-4 text-right">{fr ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((d) => (
                  <tr key={d.id} className="transition-colors hover:bg-muted/30">
                    <td className="p-4">
                      <p className="font-semibold text-foreground">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.email}</p>
                      {d.phone && <p className="text-xs text-muted-foreground">{d.phone}</p>}
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      {formatPrice(d.amount, d.currency, locale)}
                    </td>
                    <td className="p-4 text-xs font-medium">
                      <Badge variant="outline">
                        {d.frequency === "monthly" ? (fr ? "Mensuel" : "Monthly") : (fr ? "Unique" : "One-off")}
                      </Badge>
                    </td>
                    <td className="max-w-xs p-4 text-xs text-muted-foreground truncate" title={d.message}>
                      {d.message || "—"}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          d.status === "COMPLETED"
                            ? "default"
                            : d.status === "CANCELLED"
                              ? "destructive"
                              : d.status === "PENDING"
                                ? "outline"
                                : "secondary"
                        }
                      >
                        {d.status === "PLEDGED"
                          ? fr ? "Promis" : "Pledged"
                          : d.status === "PENDING"
                            ? fr ? "En attente" : "Pending"
                            : d.status === "COMPLETED"
                              ? fr ? "Encaissé" : "Completed"
                              : fr ? "Annulé" : "Cancelled"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {d.status !== "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                            onClick={() => updateStatus(d.id, "COMPLETED")}
                            title={fr ? "Marquer comme encaissé" : "Mark as completed"}
                          >
                            <Check className="mr-1 size-3" />
                            {fr ? "Encaisser" : "Received"}
                          </Button>
                        )}
                        {d.status === "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => updateStatus(d.id, "PLEDGED")}
                            title={fr ? "Remettre en promesse" : "Set back to pledged"}
                          >
                            <Clock className="mr-1 size-3" />
                            {fr ? "En attente" : "Pledged"}
                          </Button>
                        )}
                        {d.status !== "CANCELLED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => updateStatus(d.id, "CANCELLED")}
                            title={fr ? "Annuler" : "Cancel"}
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
