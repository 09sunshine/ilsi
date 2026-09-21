import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  Trophy,
  BookOpen,
  CalendarClock,
  CreditCard,
  Sparkles,
  Check,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  isDesktopNotificationSupported,
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
  showDesktopNotification,
} from "@/lib/desktopNotifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ILSI" },
      { name: "description", content: "Deadlines, quiz results and live session reminders." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Notifications — ILSI" },
      { property: "og:description", content: "Deadlines, quiz results and live session reminders." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setDesktopPerm(getDesktopNotificationPermission());
  }, []);

  const handleRequestDesktopPermission = async () => {
    const perm = await requestDesktopNotificationPermission();
    setDesktopPerm(perm);
    if (perm === "granted") {
      toast.success(fr ? "Notifications système activées !" : "Desktop notifications enabled!");
      showDesktopNotification({
        title: fr ? "Notifications ILSI activées" : "ILSI Notifications Enabled",
        body: fr
          ? "Vous recevrez des rappels de cours même si l'onglet est réduit."
          : "You will receive cohort reminders even if this tab is minimized.",
      });
    } else if (perm === "denied") {
      toast.error(
        fr
          ? "Autorisation refusée par le navigateur."
          : "Permission denied in browser settings."
      );
    }
  };

  const handleTestDesktopNotification = () => {
    if (desktopPerm !== "granted") {
      void handleRequestDesktopPermission();
      return;
    }
    showDesktopNotification({
      title: fr ? "Test d'alerte ILSI" : "ILSI Alert Test",
      body: fr
        ? "Parfait ! Les rappels de session en direct et quiz apparaîtront ici."
        : "Success! Live session reminders and quiz updates will pop up on your OS.",
    });
    toast.success(fr ? "Alerte de test envoyée" : "Test alert sent to desktop");
  };


  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await api.getNotifications();
      if (Array.isArray(data)) {
        setItems(data);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.warn("Could not fetch notifications:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead();
      toast.success(fr ? "Toutes les notifications sont lues" : "All notifications marked as read");
    } catch (err) {
      console.warn("Could not mark all notifications read:", err);
      void loadNotifications();
    }
  };

  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.warn("Could not mark notification read:", err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.deleteNotification(id);
      toast.success(fr ? "Notification supprimée" : "Notification deleted");
    } catch (err) {
      console.warn("Could not delete notification:", err);
      void loadNotifications();
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === "UNREAD") return items.filter((n) => !n.read);
    return items;
  }, [items, filter]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const getIcon = (type: string) => {
    switch (type) {
      case "QUIZ_PASSED":
        return <Trophy className="size-4 text-emerald-500" />;
      case "QUIZ_FAILED":
        return <Trophy className="size-4 text-amber-500" />;
      case "MODULE_UNLOCKED":
        return <BookOpen className="size-4 text-blue-500" />;
      case "LIVE_SCHEDULED":
      case "LIVE_REMINDER":
        return <CalendarClock className="size-4 text-purple-500" />;
      case "PAYMENT":
        return <CreditCard className="size-4 text-emerald-500" />;
      default:
        return <Sparkles className="size-4 text-primary" />;
    }
  };

  return (
    <AppShell title={t("nav.notifications")}>
      <div className="mx-auto max-w-3xl space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter("ALL")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === "ALL"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {fr ? "Toutes" : "All"} ({items.length})
            </button>
            <button
              onClick={() => setFilter("UNREAD")}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === "UNREAD"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface text-muted-foreground hover:text-foreground"
              )}
            >
              {fr ? "Non lues" : "Unread"} ({unreadCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestDesktopNotification}
              className="gap-1.5 text-xs font-medium border-primary/30 hover:bg-primary/5 text-foreground"
              title={fr ? "Tester l'alerte système" : "Test desktop alert"}
            >
              <BellRing className="size-3.5 text-primary" />
              {fr ? "Tester l'alerte système" : "Test System Alert"}
            </Button>

            {items.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="gap-1.5 text-xs"
              >
                <CheckCheck className="size-4 text-primary" /> {t("notif.markAllRead")}
              </Button>
            )}
          </div>
        </div>

        {/* Desktop notification banner if not yet granted */}
        {desktopPerm !== "granted" && desktopPerm !== "unsupported" && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <BellRing className="size-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {fr ? "Activer les alertes sur votre bureau" : "Enable Native Desktop Alerts"}
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {desktopPerm === "denied"
                    ? fr
                      ? "Les notifications sont bloquées par votre navigateur. Autorisez-les dans les paramètres de la barre d'adresse pour recevoir des alertes."
                      : "Notifications are blocked by your browser settings. Allow notifications in your URL bar to receive alerts when minimized."
                    : fr
                      ? "Recevez des alertes pop-up sur Windows / macOS pour les cours en direct, quiz débloqués et échéances."
                      : "Receive instant system pop-up toasts for upcoming live sessions, cohort announcements, and unlocked modules."}
                </p>
              </div>
            </div>
            {desktopPerm !== "denied" && (
              <Button
                size="sm"
                onClick={handleRequestDesktopPermission}
                className="shrink-0 gap-1.5 text-xs font-semibold shadow-sm"
              >
                <Bell className="size-3.5" />
                {fr ? "Activer" : "Enable Alerts"}
              </Button>
            )}
          </div>
        )}


        {/* List */}
        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <div className="inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-2">{fr ? "Chargement..." : "Loading..."}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-5" />}
            title={filter === "UNREAD" ? (fr ? "Aucune notification non lue" : "No unread notifications") : t("common.empty")}
            description={fr ? "Vos prochaines notifications s'afficheront ici." : "Your upcoming alerts will appear here."}
          />
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((n) => (
              <article
                key={n.id}
                onClick={() => !n.read && api.markNotificationRead(n.id).then(() => setItems(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item)))}
                className={cn(
                  "group flex items-start gap-3.5 rounded-2xl border p-4 transition-all cursor-pointer hover:border-primary/30",
                  !n.read
                    ? "border-primary/30 bg-primary/[0.03] shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                    : "border-border bg-card"
                )}
              >
                {/* Category Icon */}
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl border",
                    !n.read ? "border-primary/20 bg-primary/10" : "border-border bg-surface"
                  )}
                >
                  {getIcon(n.type)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className={cn("text-sm font-semibold", !n.read && "text-foreground")}>
                      {L(n.title)}
                    </h2>
                    {!n.read && (
                      <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
                    )}
                  </div>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {L(n.body)}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-muted-foreground/80">
                    {new Date(n.createdAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-70 group-hover:opacity-100">
                  {!n.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-8 p-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => handleMarkSingleRead(n.id, e)}
                      title={fr ? "Marquer comme lu" : "Mark as read"}
                    >
                      <Check className="size-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="size-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDelete(n.id, e)}
                    title={fr ? "Supprimer" : "Delete"}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
