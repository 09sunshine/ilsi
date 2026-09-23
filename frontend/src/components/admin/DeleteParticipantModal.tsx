import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import type { Participant } from "@/lib/domain";

interface Props {
  participant: Participant | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function DeleteParticipantModal({ participant, isOpen, onClose, onDeleted }: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();

  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !participant) return null;

  const fullName = `${participant.firstName} ${participant.lastName}`.trim() || participant.email;

  // Cohort names formatting
  const cohortsList: Array<{ name: { en: string; fr: string } | string }> =
    (participant as any).cohorts?.length
      ? (participant as any).cohorts
      : (participant as any).cohortName
        ? [{ name: (participant as any).cohortName }]
        : [];

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const res = await api.deleteParticipant(participant.id);
      toast.success(
        res?.message ||
          (fr
            ? `Le participant "${fullName}" a été supprimé de la base de données.`
            : `Participant "${fullName}" was successfully deleted from database.`)
      );
      onDeleted(participant.id);
      onClose();
    } catch (err: any) {
      toast.error(
        err?.message ||
          (fr
            ? "Échec de la suppression du participant."
            : "Failed to delete participant.")
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5 text-card-foreground animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
          aria-label={fr ? "Fermer" : "Close"}
        >
          <X className="size-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {fr ? "Supprimer le participant" : "Delete Participant"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fr
                ? "Cette action est irréversible. Le compte et toutes les données associées seront supprimés de la base de données."
                : "This action is irreversible. The account and all associated records will be permanently removed from the database."}
            </p>
          </div>
        </div>

        {/* Target Participant Badge */}
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5 space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {fr ? "Participant ciblé" : "Target Participant"}
          </div>
          <div className="text-sm font-bold text-foreground truncate">{fullName}</div>
          <div className="text-xs text-muted-foreground flex flex-col gap-0.5">
            <div>
              <span className="font-medium text-foreground">{fr ? "Email :" : "Email:"}</span> {participant.email}
            </div>
            {cohortsList.length > 0 && (
              <div>
                <span className="font-medium text-foreground">{fr ? "Cohorte(s) :" : "Cohort(s):"}</span>{" "}
                {cohortsList
                  .map((c) => (typeof c.name === "object" ? L(c.name) : String(c.name)))
                  .join(", ")}
              </div>
            )}
            {participant.country && (
              <div>
                <span className="font-medium text-foreground">{fr ? "Pays :" : "Country:"}</span> {participant.country}
              </div>
            )}
          </div>
        </div>

        {/* Breakdown of items purged */}
        <div className="space-y-2 text-xs text-muted-foreground bg-destructive/5 border border-destructive/15 rounded-xl p-3.5">
          <p className="font-semibold text-destructive">
            {fr
              ? "Les éléments suivants seront supprimés définitivement de la base de données :"
              : "The following will be permanently purged from the database:"}
          </p>
          <ul className="list-disc pl-4 space-y-1 text-foreground/80">
            <li>{fr ? "Compte utilisateur et sessions d'authentification" : "User account and authentication sessions"}</li>
            <li>{fr ? "Inscriptions aux cohortes et accès aux cours" : "Cohort enrollments and course access"}</li>
            <li>{fr ? "Progression des leçons et tentatives de quiz" : "Lesson progress and quiz attempts"}</li>
            <li>{fr ? "Certificats et historiques d'activité" : "Certificates and activity logs"}</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            {fr ? "Annuler" : "Cancel"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {fr ? "Suppression en cours..." : "Deleting..."}
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                {fr ? "Supprimer définitivement" : "Delete Permanently"}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
