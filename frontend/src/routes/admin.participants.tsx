import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Participant } from "@/lib/domain";

export const Route = createFileRoute("/admin/participants")({
  head: () => ({
    meta: [
      { title: "Participants — ILSI admin" },
      { name: "description", content: "Search, review, and manually register enrolled cohort participants." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Participants — ILSI admin" },
      { property: "og:description", content: "Manage and register enrolled participants." },
    ],
  }),
  component: AdminParticipants,
});

function generateOTP(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let pass = "ILSI_";
  for (let i = 0; i < 6; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass + "!";
}

function AdminParticipants() {
  const { t, locale } = useI18n();
  const L = useLocalized();
  const fr = locale === "fr";

  const [rows, setRows] = useState<Participant[]>([]);
  const [cohortsList, setCohortsList] = useState<any[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // Registration Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCohortId, setRegCohortId] = useState("");
  const [regPassword, setRegPassword] = useState(generateOTP());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Created Modal
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    name: string;
    tempPass: string;
  } | null>(null);

  const fetchCohorts = async () => {
    try {
      setLoadingCohorts(true);
      const res = await api.getCohorts();
      if (res && Array.isArray(res)) {
        setCohortsList(res);
        if (res.length > 0) {
          setRegCohortId((prev) => (prev && res.some((c) => c.id === prev) ? prev : res[0].id));
        }
      } else {
        setCohortsList([]);
      }
    } catch (err: any) {
      console.warn("Could not fetch cohorts:", err);
      setCohortsList([]);
    } finally {
      setLoadingCohorts(false);
    }
  };

  const openRegisterModal = () => {
    setIsRegisterOpen(true);
    void fetchCohorts();
  };

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [parts, cohs] = await Promise.allSettled([
          api.getParticipants(),
          api.getCohorts(),
        ]);

        if (parts.status === "fulfilled" && Array.isArray(parts.value)) {
          setRows(parts.value);
        } else {
          setRows([]);
        }

        if (cohs.status === "fulfilled" && Array.isArray(cohs.value)) {
          setCohortsList(cohs.value);
          if (cohs.value[0]?.id) {
            setRegCohortId(cohs.value[0].id);
          }
        } else {
          setCohortsList([]);
        }
      } catch (err: any) {
        console.warn("Could not fetch participants:", err);
        setRows([]);
        setCohortsList([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((p) =>
      `${p.firstName} ${p.lastName} ${p.email} ${p.country || ""}`.toLowerCase().includes(term)
    );
  }, [rows, q]);

  const paidCount = rows.filter((p) => p.paymentStatus === "PAID").length;
  const otpCount = rows.filter((p) => p.firstLogin).length;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regFirstName || !regLastName) {
      toast.error(fr ? "Veuillez remplir tous les champs obligatoires." : "Please fill in all required fields.");
      return;
    }

    const cohortIdToUse = regCohortId || cohortsList[0]?.id;
    if (!cohortIdToUse) {
      toast.error(fr ? "Veuillez sélectionner ou créer une cohorte au préalable." : "Please select or create a cohort first.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createParticipant({
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        email: regEmail.trim().toLowerCase(),
        cohortId: cohortIdToUse,
        temporaryPassword: regPassword,
      });

      const selectedCohort = cohortsList.find((c) => c.id === cohortIdToUse);

      const newParticipant: Participant = {
        id: res.data?.id || `usr-${Date.now()}`,
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        email: regEmail.trim().toLowerCase(),
        country: "Pending",
        city: "Pending",
        role: "PARTICIPANT",
        programId: res.data?.programId || selectedCohort?.programId || "prg-young-leaders",
        cohortId: cohortIdToUse,
        cohortName: res.data?.cohortName || (selectedCohort ? selectedCohort.name : { en: "Assigned Cohort", fr: "Cohorte assignée" }),
        paymentStatus: "PAID",
        certification: "IN_PROGRESS",
        suspended: false,
        firstLogin: true,
        locale: "en",
        joinedAt: new Date().toISOString().split("T")[0]!,
      };

      setRows((prev) => [newParticipant, ...prev]);

      setCreatedCredentials({
        email: regEmail.trim().toLowerCase(),
        name: `${regFirstName.trim()} ${regLastName.trim()}`,
        tempPass: regPassword,
      });

      setIsRegisterOpen(false);
      setRegFirstName("");
      setRegLastName("");
      setRegEmail("");
      setRegPassword(generateOTP());

      toast.success(
        fr
          ? "Participant enregistré avec mot de passe temporaire !"
          : "Participant registered with temporary OTP password!"
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to register participant.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyCredentials = () => {
    if (!createdCredentials) return;
    const text = `ILSI Participant Account:\nEmail: ${createdCredentials.email}\nTemporary Password: ${createdCredentials.tempPass}\n\nPlease log in at ${window.location.origin}/login to set your permanent password.`;
    void navigator.clipboard.writeText(text);
    toast.success(fr ? "Identifiants copiés dans le presse-papiers !" : "Login credentials copied to clipboard!");
  };

  return (
    <AppShell variant="admin" title={t("nav.participants")}>
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Total Participants" : "Total Participants"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold">{rows.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {rows.reduce((sum, p) => sum + ((p as any).cohorts?.length || (p as any).cohortId ? 1 : 0), 0)}{" "}
              {fr ? "inscriptions totales" : "total enrollments"}
            </p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "Inscriptions réglées (PAID)" : "Active / Paid Students"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-success">{paidCount}</p>
          </div>
          <div className="panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {fr ? "En attente 1re connexion (OTP)" : "Pending First Login (OTP)"}
            </p>
            <p className="mt-1 font-display text-2xl font-bold text-brand-orange">{otpCount}</p>
          </div>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={fr ? "Rechercher un participant..." : "Search by name, email, country..."}
              className="pl-9"
            />
          </div>

          <Button onClick={openRegisterModal} className="gap-2">
            <UserPlus className="size-4" />
            {fr ? "Inscrire un participant" : "Register Participant"}
          </Button>
        </div>

        {/* Table / List */}
        {visible.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6 text-muted-foreground" />}
            title={fr ? "Aucun participant trouvé" : "No participants found"}
            body={fr ? "Aucun participant ne correspond à votre recherche." : "No participants match your search criteria."}
          />
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">{fr ? "Participant" : "Participant"}</th>
                  <th className="p-4">{fr ? "E-mail / Identifiant" : "Email / ID"}</th>
                  <th className="p-4">{fr ? "Cohortes" : "Cohorts"}</th>
                  <th className="p-4">{fr ? "Localisation" : "Location"}</th>
                  <th className="p-4">{fr ? "Statut Paiement" : "Payment"}</th>
                  <th className="p-4">{fr ? "Progression" : "Certification"}</th>
                  <th className="p-4">{fr ? "Accès" : "Access State"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((p) => {
                  // Support both old (single cohort) and new (multi-cohort) shape
                  const allCohorts: Array<{ cohortId: string; name: { en: string; fr: string }; paymentStatus: string }> =
                    (p as any).cohorts?.length
                      ? (p as any).cohorts
                      : (p as any).cohortName
                        ? [{ cohortId: (p as any).cohortId, name: (p as any).cohortName, paymentStatus: p.paymentStatus }]
                        : [];

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/30">
                      <td className="p-4 font-semibold text-foreground">
                        {p.firstName} {p.lastName}
                      </td>
                      <td className="p-4">
                        <a
                          href={`mailto:${p.email}`}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Mail className="size-3" />
                          {p.email}
                        </a>
                      </td>
                      <td className="p-4">
                        {allCohorts.length === 0 ? (
                          <span className="text-[11px] italic text-muted-foreground">
                            {fr ? "Non assigné" : "Unassigned"}
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {allCohorts.map((c, idx) => (
                              <div key={c.cohortId || idx} className="flex items-center gap-1.5">
                                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                  {idx + 1}
                                </span>
                                <Badge variant="outline" className="text-[11px] font-normal">
                                  {L(c.name)}
                                </Badge>
                                {c.paymentStatus === "PAID" && (
                                  <span className="rounded bg-success/10 px-1 py-0.5 text-[9px] font-semibold text-success">
                                    PAID
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">
                        {p.city && p.country ? `${p.city}, ${p.country}` : p.country || "—"}
                      </td>
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
                      <td className="p-4">
                        {p.firstLogin ? (
                          <Badge variant="outline" className="border-amber-500/30 text-amber-500">
                            {fr ? "OTP Non activé" : "First Login Pending"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-success/30 text-success">
                            {fr ? "Actif" : "Active"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal: Register New Participant */}
        {isRegisterOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setIsRegisterOpen(false)}
          >
            <div
              className="panel max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="size-5 text-primary" />
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {fr ? "Inscrire un nouveau participant" : "Register New Participant"}
                  </h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsRegisterOpen(false)}>
                  <X className="size-4" />
                </Button>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-first">{fr ? "Prénom *" : "First Name *"}</Label>
                    <Input
                      id="reg-first"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      placeholder="e.g. Samuel"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-last">{fr ? "Nom *" : "Last Name *"}</Label>
                    <Input
                      id="reg-last"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder="e.g. Diallo"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">{fr ? "E-mail (Identifiant de connexion) *" : "Email / Username (Login ID) *"}</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="learner@example.com"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reg-cohort">{fr ? "Cohorte d'affectation *" : "Assigned Cohort *"}</Label>
                    <button
                      type="button"
                      onClick={fetchCohorts}
                      disabled={loadingCohorts}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                      title={fr ? "Actualiser la liste des cohortes" : "Refresh cohorts list"}
                    >
                      <RefreshCw className={cn("size-3", loadingCohorts && "animate-spin")} />
                      <span>{fr ? "Actualiser" : "Refresh"}</span>
                    </button>
                  </div>
                  <select
                    id="reg-cohort"
                    value={regCohortId}
                    onChange={(e) => setRegCohortId(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs font-medium"
                    required
                  >
                    {cohortsList.length === 0 ? (
                      <option value="" disabled>
                        {loadingCohorts
                          ? fr ? "Chargement des cohortes..." : "Loading cohorts..."
                          : fr ? "Aucune cohorte disponible — veuillez en créer une" : "No cohorts available — please create one"}
                      </option>
                    ) : (
                      cohortsList.map((c) => {
                        const progTitle = typeof c.programTitle === "object" ? L(c.programTitle) : c.programTitle || "";
                        const cohortName = typeof c.name === "object" ? L(c.name) : c.name || c.nameEn || c.id;
                        const displayLabel = progTitle && progTitle !== cohortName
                          ? `${progTitle} — ${cohortName}`
                          : cohortName;
                        const details = `${c.status || "ACTIVE"}${c.capacity ? ` · ${c.enrolled || 0}/${c.capacity}` : ""}`;
                        return (
                          <option key={c.id} value={c.id}>
                            {displayLabel} ({details})
                          </option>
                        );
                      })
                    )}
                  </select>
                  {cohortsList.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {fr
                        ? "Le participant aura accès immédiat au contenu, quiz et directs de cette cohorte."
                        : "Participant will be enrolled with immediate full access to this cohort's lessons, quizzes & live sessions."}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="reg-pass" className="flex items-center gap-1.5">
                      <KeyRound className="size-3.5 text-primary" />
                      <span>{fr ? "Mot de passe temporaire (OTP) *" : "Temporary One-Time Password (OTP) *"}</span>
                    </Label>
                    <button
                      type="button"
                      onClick={() => setRegPassword(generateOTP())}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="size-3" />
                      {fr ? "Régénérer" : "Generate new"}
                    </button>
                  </div>
                  <Input
                    id="reg-pass"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    className="font-mono text-sm bg-muted/40"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {fr
                      ? "Le participant sera obligé de changer ce mot de passe dès sa première connexion."
                      : "The participant will be prompted with a mandatory dialog to set their private password upon first login."}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                    {fr ? "Annuler" : "Cancel"}
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (fr ? "Inscription..." : "Registering...") : fr ? "Créer l'accès" : "Create Participant"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Created Participant Credentials Card */}
        {createdCredentials && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setCreatedCredentials(null)}
          >
            <div
              className="panel max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 border-success/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-success/10 flex items-center justify-center text-success">
                  <Check className="size-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {fr ? "Compte Participant Créé" : "Participant Account Created"}
                  </h3>
                  <p className="text-xs text-muted-foreground">{createdCredentials.name}</p>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-4 space-y-2 border border-border text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-semibold text-foreground">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">OTP Password:</span>
                  <span className="font-bold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded">
                    {createdCredentials.tempPass}
                  </span>
                </div>
                <div className="pt-1 text-[11px] font-sans text-muted-foreground">
                  {fr
                    ? "Statut : Première connexion requise avec changement de mot de passe obligatoire."
                    : "Status: First-login mandatory password change will trigger automatically."}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button onClick={copyCredentials} variant="outline" className="gap-1.5 text-xs flex-1">
                  <Copy className="size-3.5" />
                  {fr ? "Copier les identifiants" : "Copy Credentials"}
                </Button>
                <Button onClick={() => setCreatedCredentials(null)} size="sm">
                  {fr ? "Terminer" : "Done"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
