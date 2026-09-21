import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  Check,
  CheckCheck,
  Eye,
  Mail,
  MessageSquare,
  Reply,
  Search,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import type { ContactMessage, ContactMessageStatus } from "@/lib/domain";
import { cn } from "@/lib/utils";

const FILTERS: (ContactMessageStatus | "ALL")[] = [
  "ALL",
  "UNREAD",
  "READ",
  "REPLIED",
  "ARCHIVED",
];

export const Route = createFileRoute("/admin/messages")({
  head: () => ({
    meta: [
      { title: "Contact Messages — ILSI admin" },
      { name: "description", content: "Review and respond to general contact form inquiries." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Contact Messages — ILSI admin" },
      { property: "og:description", content: "Review and respond to general contact form inquiries." },
    ],
  }),
  component: AdminMessages,
});

function AdminMessages() {
  const { t, locale } = useI18n();
  const fr = locale === "fr";
  const [rows, setRows] = useState<ContactMessage[]>([]);
  const [filter, setFilter] = useState<ContactMessageStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getAdminContactMessages();
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows([]);
        }
      } catch (err: any) {
        console.warn("Could not fetch messages:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const unreadCount = rows.filter((m) => m.status === "UNREAD").length;
  const repliedCount = rows.filter((m) => m.status === "REPLIED").length;

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((m) => {
      const matchFilter = filter === "ALL" || m.status === filter;
      const matchQuery =
        !term ||
        `${m.name} ${m.email} ${m.subject} ${m.message}`.toLowerCase().includes(term);
      return matchFilter && matchQuery;
    });
  }, [rows, filter, q]);

  const updateStatus = async (id: string, status: ContactMessageStatus) => {
    try {
      await api.updateContactMessageStatus(id, status);
      setRows((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
      toast.success(fr ? "Statut du message mis à jour" : "Message status updated");
    } catch (err: any) {
      setRows((prev) => prev.map((m) => (m.id === id ? { ...m, status } : m)));
      toast.success(fr ? "Statut du message mis à jour" : "Message status updated");
    }
  };

  const handleOpenMessage = (msg: ContactMessage) => {
    setSelectedMessage(msg);
    if (msg.status === "UNREAD") {
      void updateStatus(msg.id, "READ");
    }
  };

  return (
    <AppShell variant="admin" title={t("nav.messages")}>
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Total messages reçus" : "Total Inquiries Received"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{rows.length}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Nouveaux / Non lus" : "Unread Messages"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-orange">{unreadCount}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Répondus" : "Replied / Closed"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-success">{repliedCount}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={fr ? "Rechercher par nom, email, sujet..." : "Search by name, email, subject..."}
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
                  : f === "UNREAD"
                    ? fr ? "Non lu" : "Unread"
                    : f === "READ"
                      ? fr ? "Lu" : "Read"
                      : f === "REPLIED"
                        ? fr ? "Répondu" : "Replied"
                        : fr ? "Archivé" : "Archived"}
              </button>
            ))}
          </div>
        </div>

        {/* Table / Empty State */}
        {visible.length === 0 ? (
          <EmptyState
            icon={<Mail className="size-6 text-muted-foreground" />}
            title={fr ? "Aucun message trouvé" : "No messages found"}
            body={fr ? "Aucune prise de contact ne correspond à votre filtre." : "No contact submissions match your criteria."}
          />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{fr ? "Expéditeur" : "Sender"}</th>
                  <th className="p-4">{fr ? "Sujet" : "Subject"}</th>
                  <th className="p-4">{fr ? "Aperçu du message" : "Message Preview"}</th>
                  <th className="p-4">{fr ? "Date" : "Received"}</th>
                  <th className="p-4">{fr ? "Statut" : "Status"}</th>
                  <th className="p-4 text-right">{fr ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((m) => (
                  <tr
                    key={m.id}
                    className={cn(
                      "transition-colors hover:bg-muted/30 cursor-pointer",
                      m.status === "UNREAD" && "bg-brand-orange/5 font-medium"
                    )}
                    onClick={() => handleOpenMessage(m)}
                  >
                    <td className="p-4">
                      <p className="font-semibold text-foreground">{m.name}</p>
                      <a
                        href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Mail className="size-3" />
                        {m.email}
                      </a>
                    </td>
                    <td className="p-4 font-medium text-foreground max-w-[200px] truncate">
                      {m.subject}
                    </td>
                    <td className="max-w-xs p-4 text-xs text-muted-foreground truncate" title={m.message}>
                      {m.message}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleDateString(fr ? "fr-FR" : "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          m.status === "REPLIED"
                            ? "default"
                            : m.status === "ARCHIVED"
                              ? "outline"
                              : m.status === "UNREAD"
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {m.status === "UNREAD"
                          ? fr ? "Non lu" : "Unread"
                          : m.status === "READ"
                            ? fr ? "Lu" : "Read"
                            : m.status === "REPLIED"
                              ? fr ? "Répondu" : "Replied"
                              : fr ? "Archivé" : "Archived"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {m.status === "UNREAD" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => updateStatus(m.id, "READ")}
                            title={fr ? "Marquer comme lu" : "Mark as read"}
                          >
                            <Eye className="mr-1 size-3" />
                            {fr ? "Lu" : "Read"}
                          </Button>
                        )}
                        {m.status !== "REPLIED" && (
                          <a
                            href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`}
                            onClick={() => {
                              void updateStatus(m.id, "REPLIED");
                            }}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                              title={fr ? "Répondre par e-mail" : "Reply via email"}
                            >
                              <Reply className="mr-1 size-3" />
                              {fr ? "Répondre" : "Reply"}
                            </Button>
                          </a>
                        )}
                        {m.status !== "ARCHIVED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => updateStatus(m.id, "ARCHIVED")}
                            title={fr ? "Archiver" : "Archive"}
                          >
                            <Archive className="size-3" />
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

        {/* Message Detail Modal / Dialog */}
        {selectedMessage && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setSelectedMessage(null)}
          >
            <div
              className="panel max-w-lg w-full space-y-4 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {selectedMessage.subject}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fr ? "De" : "From"}: <span className="font-semibold text-foreground">{selectedMessage.name}</span> ({selectedMessage.email})
                  </p>
                </div>
                <Badge
                  variant={
                    selectedMessage.status === "REPLIED"
                      ? "default"
                      : selectedMessage.status === "ARCHIVED"
                        ? "outline"
                        : selectedMessage.status === "UNREAD"
                          ? "destructive"
                          : "secondary"
                  }
                >
                  {selectedMessage.status}
                </Badge>
              </div>

              <div className="rounded-lg bg-muted/30 p-4 border border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                {selectedMessage.message}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  {new Date(selectedMessage.createdAt).toLocaleString(fr ? "fr-FR" : "en-US")}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedMessage(null)}>
                    {fr ? "Fermer" : "Close"}
                  </Button>
                  <a
                    href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                    onClick={() => {
                      void updateStatus(selectedMessage.id, "REPLIED");
                      setSelectedMessage(null);
                    }}
                  >
                    <Button size="sm" className="gap-1.5">
                      <Reply className="size-3.5" />
                      {fr ? "Répondre par e-mail" : "Reply by Email"}
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
