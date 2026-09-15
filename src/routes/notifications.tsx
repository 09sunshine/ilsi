import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { notifications as seed } from "@/data/demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ILSI" },
      { name: "description", content: "Deadlines, quiz results and live session reminders." },
      { property: "og:title", content: "Notifications — ILSI" },
      { property: "og:description", content: "Deadlines, quiz results and live session reminders." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const [items, setItems] = useState(seed);

  return (
    <AppShell title={t("nav.notifications")}>
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setItems((prev) => prev.map((n) => ({ ...n, read: true })))}
          >
            <CheckCheck className="size-4" /> {t("notif.markAllRead")}
          </Button>
        </div>
        {items.length === 0 ? (
          <EmptyState icon={<Bell className="size-5" />} title={t("common.empty")} />
        ) : (
          items.map((n) => (
            <article
              key={n.id}
              className={cn("panel p-4", !n.read && "border-primary/30 bg-primary/[0.03]")}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.read ? "bg-border" : "bg-primary",
                  )}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{L(n.title)}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{L(n.body)}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </AppShell>
  );
}
