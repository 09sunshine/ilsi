import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  FileText,
  CreditCard,
  HeartHandshake,
  MessageSquare,
  Sparkles,
  Trash2,
  Check,
  Filter,
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

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Admin Notifications — ILSI" },
      { name: "description", content: "Platform alerts, admission updates, and incoming payments." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Admin Notifications — ILSI" },
      { property: "og:description", content: "Platform alerts, admission updates, and incoming payments." },
    ],
  }),
  component: AdminNotificationsPage,
});

type FilterCategory = "ALL" | "UNREAD" | "APPLICATION" | "PAYMENT" | "SYSTEM";

function AdminNotificationsPage() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterCategory>("ALL");
  const [desktopPerm, setDesktopPerm] = useState<NotificationPermission | "unsupported">("unsupported");

  useEffect(() => {
    setDesktopPerm(getDesktopNotificationPermission());
  }, []);

  const handleRequestDesktopPermission = async () => {
    const perm = await requestDesktopNotificationPermission();
    setDesktopPerm(perm);
    if (perm === "granted") {
      toast.success(fr ? "Notifications sur le bureau activées !" : "Desktop notifications enabled!");
      showDesktopNotification({
        title: fr ? "Notifications ILSI activées" : "ILSI Notifications Enabled",
        body: fr
          ? "Vous recevrez des alertes instantanées même lorsque cet onglet est réduit."
          : "You will receive instant alerts even when this tab is minimized.",
      });
    } else if (perm === "denied") {
      toast.error(
        fr
          ? "Autorisation refusée. Veuillez l'activer dans les paramètres du navigateur."
          : "Permission denied. Please allow notifications in your browser settings."
      );
    }
  };

  const handleTestDesktopNotification = () => {
    if (desktopPerm !== "granted") {
      void handleRequestDesktopPermission();
      return;
    }
    showDesktopNotification({
      title: fr ? "Test d'alerte système ILSI" : "ILSI System Alert Test",
      body: fr
        ? "Parfait ! Vous recevrez des alertes système pour les nouvelles candidatures et dons."
        : "Success! System notifications will pop up on your OS for new applications and payments.",
    });
    toast.success(fr ? "Alerte système envoyée sur votre écran" : "System alert sent to your desktop");
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
      console.warn("Could not load admin notifications:", err);
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
      toast.success(fr ? "Toutes les notifications sont marquées comme lues" : "All notifications marked as read");
    } catch (err: any) {
      toast.error(err.message || "Failed to mark notifications read");
      void loadNotifications();
    }
  };

  const handleMarkSingleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await api.markNotificationRead(id);
    } catch (err) {
      console.warn("Could not mark single notification read:", err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await api.deleteNotification(id);
      toast.success(fr ? "Notification supprimée" : "Notification deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete notification");
      void loadNotifications();
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === "UNREAD") return !item.read;
      if (filter === "APPLICATION") return item.type === "APPLICATION";
      if (filter === "PAYMENT") return item.type === "PAYMENT";
      if (filter === "SYSTEM") return item.type === "SYSTEM" || item.type === "MODULE_UNLOCKED";
      return true;
    });
  }, [items, filter]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const getIcon = (type: string) => {
    switch (type) {
      case "APPLICATION":
        return <FileText className="size-4 text-blue-500" />;
      case "PAYMENT":
        return <CreditCard className="size-4 text-emerald-500" />;
      case "VOLUNTEER":
        return <HeartHandshake className="size-4 text-amber-500" />;
      case "MESSAGE":
        return <MessageSquare className="size-4 text-indigo-500" />;
      default:
        return <Sparkles className="size-4 text-primary" />;
    }
  };

  return (
    <AppShell variant="admin" title={fr ? "Notifications Administrateur" : "Admin Notifications"}>
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header summary & actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {fr ? "Centre d'alertes & notifications" : "Alerts & Notifications Center"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0
                ? fr
                  ? `Vous avez ${unreadCount} notification(s) non lue(s).`
                  : `You have ${unreadCount} unread notification(s).`
                : fr
                  ? "Toutes les notifications sont à jour."
                  : "All caught up. No unread alerts."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestDesktopNotification}
              className="gap-1.5 text-xs font-medium border-primary/30 hover:bg-primary/5 text-foreground"
              title={fr ? "Tester la notification système" : "Test desktop notification"}
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
                className="gap-1.5 text-xs font-medium"
              >
                <CheckCheck className="size-4 text-primary" />
                {fr ? "Tout marquer comme lu" : "Mark all as read"}
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
                  {fr ? "Activer les notifications système du bureau" : "Enable Native Desktop Notifications"}
                </h4>
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {desktopPerm === "denied"
                    ? fr
                      ? "Les notifications sont bloquées par votre navigateur. Autorisez-les dans les paramètres de la barre d'adresse pour recevoir des alertes même si l'onglet est réduit."
                      : "Notifications are blocked by your browser settings. Allow notifications in your URL bar permissions to receive alerts when the tab is minimized."
                    : fr
                      ? "Recevez des alertes pop-up Windows / macOS dès qu'une nouvelle candidature, un don ou un message arrive, même lorsque l'application est réduite."
                      : "Receive instant Windows / macOS toast alerts as soon as a new application, donation, or message arrives, even with the browser minimized."}
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
                {fr ? "Activer les alertes" : "Enable Alerts"}
              </Button>
            )}
          </div>
        )}


        {/* Filter categories */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-3">
          {[
            { key: "ALL", labelEn: "All", labelFr: "Toutes", count: items.length },
            { key: "UNREAD", labelEn: "Unread", labelFr: "Non lues", count: unreadCount },
            {
              key: "APPLICATION",
              labelEn: "Applications",
              labelFr: "Candidatures",
              count: items.filter((n) => n.type === "APPLICATION").length,
            },
            {
              key: "PAYMENT",
              labelEn: "Payments & Donations",
              labelFr: "Paiements & Dons",
              count: items.filter((n) => n.type === "PAYMENT").length,
            },
            {
              key: "SYSTEM",
              labelEn: "System",
              labelFr: "Système",
              count: items.filter((n) => n.type === "SYSTEM" || n.type === "MODULE_UNLOCKED").length,
            },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key as FilterCategory)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === cat.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-surface text-muted-foreground hover:bg-surface/80 hover:text-foreground"
              )}
            >
              <span>{fr ? cat.labelFr : cat.labelEn}</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.2 text-[10px]",
                  filter === cat.key ? "bg-white/20 text-white" : "bg-black/5 text-muted-foreground"
                )}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>

        {/* Notification list */}
        {loading ? (
          <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
            <div className="inline-block size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p>{fr ? "Chargement des notifications..." : "Loading notifications..."}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-6 text-muted-foreground/60" />}
            title={fr ? "Aucune notification dans cette catégorie" : "No notifications in this category"}
            description={
              fr
                ? "Les nouvelles alertes concernant les candidatures, dons et étudiants apparaîtront ici."
                : "New alerts regarding applications, donations, and student progress will appear here."
            }
          />
        ) : (
          <div className="space-y-2.5">
            {filteredItems.map((n) => (
              <article
                key={n.id}
                onClick={() => !n.read && api.markNotificationRead(n.id).then(() => setItems(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item)))}
                className={cn(
                  "group relative flex items-start gap-4 rounded-2xl border p-4 transition-all hover:border-primary/40 hover:shadow-sm cursor-pointer",
                  !n.read
                    ? "border-primary/30 bg-primary/[0.03] shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
                    : "border-border bg-card"
                )}
              >
                {/* Type Icon Badge */}
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
                    <h3 className={cn("text-sm font-semibold", !n.read && "text-foreground")}>
                      {L(n.title)}
                    </h3>
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
                <div className="flex shrink-0 items-center gap-1 opacity-80 group-hover:opacity-100">
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
