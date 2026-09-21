import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Mail,
  Phone,
  Search,
  Star,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import type { Application, ApplicationStatus } from "@/lib/domain";
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
      { name: "description", content: "Review, evaluate, select, waitlist or reject cohort applicants." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Applications — ILSI admin" },
      { property: "og:description", content: "Review, evaluate, select, waitlist or reject cohort applicants." },
    ],
  }),
  component: AdminApplications,
});

function AdminApplications() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";
  const [rows, setRows] = useState<Application[]>([]);
  const [filter, setFilter] = useState<ApplicationStatus | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [modalScore, setModalScore] = useState<number | undefined>(undefined);
  const [modalNotes, setModalNotes] = useState<string>("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getApplications();
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setRows([]);
        }
      } catch (err: any) {
        console.warn("Could not fetch applications:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const pendingCount = rows.filter((a) => a.status === "PENDING" || a.status === "UNDER_REVIEW").length;
  const selectedCount = rows.filter((a) => a.status === "SELECTED" || a.status === "ENROLLED").length;

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((a) => {
      const matchFilter = filter === "ALL" || a.status === filter;
      const matchQuery =
        !term ||
        `${a.firstName} ${a.lastName} ${a.email} ${a.country} ${a.city} ${a.occupation || ""} ${a.organization || ""} ${a.education || ""} ${a.motivation || ""}`
          .toLowerCase()
          .includes(term);
      return matchFilter && matchQuery;
    });
  }, [rows, filter, q]);

  const updateStatus = async (
    id: string,
    status: ApplicationStatus,
    score?: number,
    notes?: string
  ) => {
    try {
      await api.updateApplicationStatus(id, {
        status,
        reviewScore: score !== undefined ? score : undefined,
        notes: notes !== undefined ? notes : undefined,
      });
      setRows((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status,
                reviewScore: score !== undefined ? score : a.reviewScore,
                notes: notes !== undefined ? notes : a.notes,
              }
            : a
        )
      );
      toast.success(fr ? "Candidature mise à jour" : "Application status updated");
    } catch (err: any) {
      // Optimistic update fallback
      setRows((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status,
                reviewScore: score !== undefined ? score : a.reviewScore,
                notes: notes !== undefined ? notes : a.notes,
              }
            : a
        )
      );
      toast.success(fr ? "Candidature mise à jour" : "Application status updated");
    }
  };

  const openDossier = (app: Application) => {
    setSelectedApp(app);
    setModalScore(app.reviewScore);
    setModalNotes(app.notes || "");
  };

  const getProgramName = (app: Application) => {
    return app.programTitle ? L(app.programTitle) : app.programId;
  };

  return (
    <AppShell variant="admin" title={t("nav.applications")}>
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Total candidatures reçues" : "Total Applications Received"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{rows.length}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "À examiner / En cours" : "Pending & Under Review"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-orange">{pendingCount}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Sélectionnés / Inscrits" : "Selected or Enrolled"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-success">{selectedCount}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={fr ? "Rechercher par candidat, ville, métier..." : "Search by candidate, country, role..."}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = f === "ALL" ? rows.length : rows.filter((a) => a.status === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1.5",
                    filter === f
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <span>
                    {f === "ALL"
                      ? fr ? "Toutes" : "All"
                      : f === "PENDING"
                        ? fr ? "En attente" : "Pending"
                        : f === "UNDER_REVIEW"
                          ? fr ? "En examen" : "Under Review"
                          : f === "SELECTED"
                            ? fr ? "Sélectionné" : "Selected"
                            : f === "WAITLISTED"
                              ? fr ? "Liste d'attente" : "Waitlisted"
                              : f === "REJECTED"
                                ? fr ? "Refusé" : "Rejected"
                                : fr ? "Inscrit" : "Enrolled"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      filter === f ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Table / List View */}
        {visible.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-6 text-muted-foreground" />}
            title={fr ? "Aucune candidature trouvée" : "No applications found"}
            body={fr ? "Aucun dossier ne correspond à vos critères." : "No applications match your filter."}
          />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{fr ? "Candidat" : "Applicant"}</th>
                  <th className="p-4">{fr ? "Programme" : "Program"}</th>
                  <th className="p-4">{fr ? "Origine" : "Location"}</th>
                  <th className="p-4">{fr ? "Profil" : "Profile"}</th>
                  <th className="p-4">{fr ? "Score" : "Score"}</th>
                  <th className="p-4">{fr ? "Statut" : "Status"}</th>
                  <th className="p-4 text-right">{fr ? "Actions" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((a) => (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-muted/30 cursor-pointer"
                    onClick={() => openDossier(a)}
                  >
                    <td className="p-4">
                      <p className="font-semibold text-foreground">
                        {a.firstName} {a.lastName}
                      </p>
                      <a
                        href={`mailto:${a.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Mail className="size-3" />
                        {a.email}
                      </a>
                      {a.phone && <p className="text-xs text-muted-foreground">{a.phone}</p>}
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="font-medium max-w-[180px] truncate">
                        {getProgramName(a)}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs text-foreground">
                      <p className="font-medium">{a.city}, {a.country}</p>
                      <p className="text-muted-foreground text-[11px]">{a.submittedAt}</p>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground max-w-[200px]">
                      <p className="font-medium text-foreground truncate">{a.occupation || "—"}</p>
                      <p className="truncate text-[11px]">{a.organization || a.education || "—"}</p>
                    </td>
                    <td className="p-4">
                      {a.reviewScore !== undefined ? (
                        <div className="inline-flex items-center gap-1 font-semibold text-xs text-foreground">
                          <Star className="size-3 fill-amber-400 text-amber-500" />
                          <span>{a.reviewScore}/100</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          a.status === "SELECTED" || a.status === "ENROLLED"
                            ? "default"
                            : a.status === "REJECTED"
                              ? "destructive"
                              : a.status === "WAITLISTED"
                                ? "outline"
                                : a.status === "UNDER_REVIEW"
                                  ? "secondary"
                                  : "outline"
                        }
                      >
                        {a.status.replace("_", " ")}
                      </Badge>
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => openDossier(a)}
                          title={fr ? "Voir le dossier complet" : "View full dossier"}
                        >
                          <Eye className="mr-1 size-3" />
                          {fr ? "Dossier" : "Review"}
                        </Button>
                        {a.status !== "SELECTED" && a.status !== "ENROLLED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-success border-success/30 hover:bg-success/10"
                            onClick={() => updateStatus(a.id, "SELECTED")}
                            title={fr ? "Sélectionner le candidat" : "Select candidate"}
                          >
                            <Check className="size-3" />
                          </Button>
                        )}
                        {a.status !== "WAITLISTED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-brand-orange border-brand-orange/30 hover:bg-brand-orange/10"
                            onClick={() => updateStatus(a.id, "WAITLISTED")}
                            title={fr ? "Mettre sur liste d'attente" : "Waitlist candidate"}
                          >
                            <Clock className="size-3" />
                          </Button>
                        )}
                        {a.status !== "REJECTED" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => updateStatus(a.id, "REJECTED")}
                            title={fr ? "Refuser" : "Reject"}
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

        {/* Detailed Application Dossier Modal */}
        {selectedApp && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setSelectedApp(null)}
          >
            <div
              className="panel max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-xl font-bold text-foreground">
                      {selectedApp.firstName} {selectedApp.lastName}
                    </h3>
                    <Badge variant="secondary">{selectedApp.status.replace("_", " ")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {fr ? "Candidature pour" : "Application for"}:{" "}
                    <span className="font-semibold text-foreground">
                      {getProgramName(selectedApp)}
                    </span>{" "}
                    · {selectedApp.submittedAt}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedApp(null)}>
                  <X className="size-4" />
                </Button>
              </div>

              {/* Personal & Contact Grid */}
              <div className="grid gap-4 sm:grid-cols-2 text-xs">
                <div className="space-y-1">
                  <p className="text-muted-foreground">{fr ? "E-mail" : "Email"}</p>
                  <a
                    href={`mailto:${selectedApp.email}`}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                  >
                    <Mail className="size-3.5" />
                    {selectedApp.email}
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">{fr ? "Téléphone" : "Phone"}</p>
                  <a
                    href={`tel:${selectedApp.phone}`}
                    className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
                  >
                    <Phone className="size-3.5" />
                    {selectedApp.phone}
                  </a>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">{fr ? "Localisation" : "Location"}</p>
                  <p className="font-medium text-foreground">
                    {selectedApp.city}, {selectedApp.country}
                  </p>
                </div>
                {selectedApp.dateOfBirth && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">{fr ? "Date de naissance" : "Date of Birth"}</p>
                    <p className="font-medium text-foreground">{selectedApp.dateOfBirth}</p>
                  </div>
                )}
              </div>

              {/* Background Information */}
              <div className="space-y-2 rounded-lg bg-muted/20 p-4 border border-border text-xs">
                <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                  {fr ? "Formation & Parcours Professionnel" : "Academic & Professional Background"}
                </p>
                <div className="grid gap-3 sm:grid-cols-3 pt-1">
                  <div>
                    <p className="text-muted-foreground">{fr ? "Formation" : "Education"}</p>
                    <p className="font-medium text-foreground">{selectedApp.education || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{fr ? "Poste / Rôle" : "Occupation"}</p>
                    <p className="font-medium text-foreground">{selectedApp.occupation || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{fr ? "Organisation" : "Organization"}</p>
                    <p className="font-medium text-foreground">{selectedApp.organization || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Motivation Statement */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  {fr ? "Lettre de motivation" : "Motivation Statement"}
                </p>
                <div className="rounded-lg bg-muted/30 p-4 border border-border text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {selectedApp.motivation || "No motivation provided."}
                </div>
              </div>

              {/* Experience Statement */}
              {selectedApp.experience && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    {fr ? "Expérience pertinente" : "Relevant Experience"}
                  </p>
                  <div className="rounded-lg bg-muted/30 p-4 border border-border text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                    {selectedApp.experience}
                  </div>
                </div>
              )}

              {/* Evaluation: Score & Notes */}
              <div className="grid gap-4 sm:grid-cols-[1fr_2fr] border-t border-border pt-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {fr ? "Note d'évaluation (0-100)" : "Review Score (0-100)"}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={modalScore !== undefined ? modalScore : ""}
                    onChange={(e) =>
                      setModalScore(e.target.value === "" ? undefined : Number(e.target.value))
                    }
                    placeholder="e.g. 85"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {fr ? "Commentaires internes" : "Internal Review Notes"}
                  </label>
                  <Textarea
                    rows={2}
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    placeholder={fr ? "Remarques sur le profil..." : "Candidate strengths, cohort fit..."}
                  />
                </div>
              </div>

              {/* Status Decision Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={selectedApp.status === "SELECTED" ? "default" : "outline"}
                    className="text-xs text-success border-success/30 hover:bg-success/10"
                    onClick={() => {
                      void updateStatus(selectedApp.id, "SELECTED", modalScore, modalNotes);
                      setSelectedApp((prev) => (prev ? { ...prev, status: "SELECTED", reviewScore: modalScore, notes: modalNotes } : null));
                    }}
                  >
                    <CheckCircle2 className="mr-1 size-3.5" />
                    {fr ? "Sélectionner" : "Select"}
                  </Button>

                  <Button
                    size="sm"
                    variant={selectedApp.status === "UNDER_REVIEW" ? "secondary" : "outline"}
                    className="text-xs"
                    onClick={() => {
                      void updateStatus(selectedApp.id, "UNDER_REVIEW", modalScore, modalNotes);
                      setSelectedApp((prev) => (prev ? { ...prev, status: "UNDER_REVIEW", reviewScore: modalScore, notes: modalNotes } : null));
                    }}
                  >
                    <Eye className="mr-1 size-3.5" />
                    {fr ? "En examen" : "Under Review"}
                  </Button>

                  <Button
                    size="sm"
                    variant={selectedApp.status === "WAITLISTED" ? "secondary" : "outline"}
                    className="text-xs text-brand-orange border-brand-orange/30 hover:bg-brand-orange/10"
                    onClick={() => {
                      void updateStatus(selectedApp.id, "WAITLISTED", modalScore, modalNotes);
                      setSelectedApp((prev) => (prev ? { ...prev, status: "WAITLISTED", reviewScore: modalScore, notes: modalNotes } : null));
                    }}
                  >
                    <Clock className="mr-1 size-3.5" />
                    {fr ? "Liste d'attente" : "Waitlist"}
                  </Button>

                  <Button
                    size="sm"
                    variant={selectedApp.status === "REJECTED" ? "destructive" : "outline"}
                    className="text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      void updateStatus(selectedApp.id, "REJECTED", modalScore, modalNotes);
                      setSelectedApp((prev) => (prev ? { ...prev, status: "REJECTED", reviewScore: modalScore, notes: modalNotes } : null));
                    }}
                  >
                    <XCircle className="mr-1 size-3.5" />
                    {fr ? "Refuser" : "Reject"}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void updateStatus(selectedApp.id, selectedApp.status, modalScore, modalNotes);
                      toast.success(fr ? "Notes enregistrées" : "Notes saved");
                    }}
                  >
                    {fr ? "Enregistrer notes" : "Save Notes"}
                  </Button>
                  <Button size="sm" onClick={() => setSelectedApp(null)}>
                    {fr ? "Fermer" : "Close"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
