import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { participants } from "@/data/demo";

export const Route = createFileRoute("/admin/participants")({
  head: () => ({
    meta: [
      { title: "Participants — ILSI admin" },
      { name: "description", content: "Search and review every enrolled participant." },
      { property: "og:title", content: "Participants — ILSI admin" },
      { property: "og:description", content: "Search and review every enrolled participant." },
    ],
  }),
  component: AdminParticipants,
});

function AdminParticipants() {
  const { t } = useI18n();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return participants;
    return participants.filter((p) =>
      `${p.firstName} ${p.lastName} ${p.email} ${p.country}`.toLowerCase().includes(term),
    );
  }, [q]);

  return (
    <AppShell variant="admin" title={t("nav.participants")}>
      <div className="space-y-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("admin.search")}
          aria-label={t("admin.search")}
          className="max-w-sm"
        />
        {rows.length === 0 ? (
          <EmptyState title={t("admin.noResults")} />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">{t("nav.participants")}</caption>
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="p-4">
                    {t("apply.firstName")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("apply.email")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("apply.country")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("nav.payments")}
                  </th>
                  <th scope="col" className="p-4">
                    {t("common.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="p-4 font-medium">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="p-4 text-muted-foreground">{p.email}</td>
                    <td className="p-4 text-muted-foreground">{p.country}</td>
                    <td className="p-4">
                      <Badge variant={p.paymentStatus === "PAID" ? "default" : "secondary"}>
                        {p.paymentStatus}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={p.suspended ? "destructive" : "secondary"}>
                        {p.certification.replace("_", " ")}
                      </Badge>
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
