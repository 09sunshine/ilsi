import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { formatPrice } from "@/lib/currency";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments — ILSI admin" },
      { name: "description", content: "Track cohort fees, pending transfers and failed charges in USD & EUR." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Payments — ILSI admin" },
      { property: "og:description", content: "Track cohort fees and pending transfers." },
    ],
  }),
  component: AdminPayments,
});

function AdminPayments() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPayments() {
      try {
        const live = await api.getPayments();
        if (Array.isArray(live)) {
          setRows(live);
        } else {
          setRows([]);
        }
      } catch (err) {
        console.warn("Could not fetch live payments:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, []);

  const totalUsd = rows
    .filter((p) => p.status === "PAID" && (p.currency === "USD" || !p.currency))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const totalEur = rows
    .filter((p) => p.status === "PAID" && p.currency === "EUR")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <AppShell variant="admin" title={t("nav.payments")}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "fr" ? "Recettes en Dollars ($ USD)" : "USD Collected Revenue ($)"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">${totalUsd.toLocaleString()}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {locale === "fr" ? "Recettes en Euros (€ EUR)" : "EUR Collected Revenue (€)"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{totalEur.toLocaleString("fr-FR")} €</p>
          </div>
        </div>

        {loading ? (
          <div className="panel p-12 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-2 text-sm text-muted-foreground">{t("common.loading")}</p>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t("common.empty")} />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{t("nav.payments")}</caption>
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="p-4">
                    {t("apply.firstName")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("nav.payments")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("common.status")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("common.date")}
                  </th>
                  <th scope="col" className="p-4 text-right">
                    {t("admin.confirm")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="p-4 font-medium">{p.participantName}</td>
                    <td className="p-4 font-semibold text-foreground">
                      {formatPrice(p.amount, p.currency, locale)}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          p.status === "PAID"
                            ? "default"
                            : p.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted-foreground">{p.createdAt}</td>
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={p.status === "PAID"}
                        onClick={() => {
                          setRows((prev) =>
                            prev.map((r) => (r.id === p.id ? { ...r, status: "PAID" } : r)),
                          );
                          toast.success(t("common.saved"));
                        }}
                      >
                        {t("admin.confirm")}
                      </Button>
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
