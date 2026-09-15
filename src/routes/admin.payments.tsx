import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { payments as seed } from "@/data/demo";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({
    meta: [
      { title: "Payments — ILSI admin" },
      { name: "description", content: "Track cohort fees, pending transfers and failed charges." },
      { property: "og:title", content: "Payments — ILSI admin" },
      { property: "og:description", content: "Track cohort fees and pending transfers." },
    ],
  }),
  component: AdminPayments,
});

function AdminPayments() {
  const { t } = useI18n();
  const [rows, setRows] = useState(seed);
  const total = rows
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <AppShell variant="admin" title={t("nav.payments")}>
      <div className="space-y-4">
        <div className="panel p-5">
          <p className="text-xs text-muted-foreground">{t("nav.payments")}</p>
          <p className="mt-1 text-2xl font-semibold">${total.toLocaleString()}</p>
        </div>

        {rows.length === 0 ? (
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
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="p-4 font-medium">{p.participantName}</td>
                    <td className="p-4">
                      {p.currency} {p.amount}
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
