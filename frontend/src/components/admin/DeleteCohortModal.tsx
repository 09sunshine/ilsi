import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";

interface Props {
  cohort: any | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteCohortModal({ cohort, isOpen, onClose, onDeleted }: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();

  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !cohort) return null;

  const cohortName = typeof cohort.name === "object" ? L(cohort.name) : cohort.name || cohort.name_en || "Cohort";
  const isConfirmed = confirmText.trim().toUpperCase() === "DELETE";

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);

    try {
      const res = await api.deleteCohort(cohort.id);
      toast.success(
        res?.message ||
          (fr
            ? `La cohorte "${cohortName}" et tous ses fichiers ont été supprimés.`
            : `Cohort "${cohortName}" and all associated files were successfully deleted.`)
      );
      setConfirmText("");
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(
        err?.message ||
          (fr ? "Échec de la suppression de la cohorte." : "Failed to delete cohort.")
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-5 text-card-foreground animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
              {fr ? "Supprimer définitivement la cohorte" : "Delete Cohort Permanently"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fr
                ? "Cette action est irréversible. Toutes les données de la cohorte seront supprimées de la base de données et du stockage Supabase."
                : "This action is irreversible. All cohort data will be permanently removed from the database and Supabase Storage."}
            </p>
          </div>
        </div>

        {/* Target Cohort Badge */}
        <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {fr ? "Cohorte ciblée" : "Target Cohort"}
          </div>
          <div className="text-sm font-bold text-foreground truncate">{cohortName}</div>
          <div className="text-xs text-muted-foreground">
            ID: <span className="font-mono">{cohort.id}</span>
          </div>
        </div>

        {/* Breakdown of items purged */}
        <div className="space-y-2 text-xs text-muted-foreground bg-destructive/5 border border-destructive/15 rounded-xl p-3.5">
          <p className="font-semibold text-destructive">
            {fr ? "Les éléments suivants seront supprimés définitivement :" : "The following will be permanently destroyed:"}
          </p>
          <ul className="space-y-1.5 list-disc list-inside">
            <li>
              {fr
                ? "Tous les modules, leçons, quiz et questions de cours"
                : "All curriculum modules, lessons, quizzes, and questions"}
            </li>
            <li>
              {fr
                ? "Toutes les vidéos de cours et miniatures stockées dans Supabase Storage"
                : "All course videos and thumbnails stored in Supabase Storage"}
            </li>
            <li>
              {fr
                ? "Toutes les inscriptions étudiantes, certificats et progressions associées"
                : "All student enrollments, certificates, and progress logs"}
            </li>
            <li>
              {fr
                ? "Toutes les sessions en direct planifiées et enregistrements"
                : "All scheduled live sessions and recorded sessions"}
            </li>
          </ul>
        </div>

        {/* Type confirmation input */}
        <div className="space-y-2">
          <Label htmlFor="confirm-delete" className="text-xs font-medium text-foreground">
            {fr
              ? "Tapez « DELETE » ci-dessous pour confirmer la suppression :"
              : "Type “DELETE” below to confirm deletion:"}
          </Label>
          <Input
            id="confirm-delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            disabled={isDeleting}
            className="font-mono uppercase tracking-wider border-destructive/30 focus-visible:ring-destructive/50"
          />
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
            disabled={!isConfirmed || isDeleting}
            className="gap-2 font-semibold shadow-md hover:bg-destructive/90"
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
