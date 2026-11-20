import { useState } from "react";
import { toast } from "sonner";
import { UserMinus, AlertTriangle, Loader2, X, ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/LocaleProvider";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cohortId: string;
  cohortName?: string;
  student: {
    userId: string;
    name: string;
    email?: string;
  } | null;
  onRemoved?: () => void;
}

export function RemoveFromCohortModal({
  isOpen,
  onClose,
  cohortId,
  cohortName,
  student,
  onRemoved,
}: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";

  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const res = await api.removeStudentFromCohort(
        cohortId,
        student.userId,
        reason.trim() || undefined
      );

      toast.success(
        res?.message ||
          (fr
            ? `${student.name} a été retiré(e) de la cohorte avec succès.`
            : `${student.name} was successfully removed from the cohort.`)
      );

      if (onRemoved) {
        onRemoved();
      }
      onClose();
    } catch (err: any) {
      toast.error(
        err?.message ||
          (fr
            ? "Échec du retrait du participant de la cohorte."
            : "Failed to remove participant from cohort.")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl text-card-foreground animate-in zoom-in-95 duration-150 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          <X className="size-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive border border-destructive/30">
            <UserMinus className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {fr ? "Retirer de la cohorte" : "Remove from Cohort"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fr
                ? "Disqualifie et masque l'apprenant de cette cohorte sans supprimer son compte."
                : "Disqualifies and hides the learner from this cohort without deleting their account."}
            </p>
          </div>
        </div>

        {/* Important Account Safety Callout */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{fr ? "Compte utilisateur préservé" : "User Account Preserved"}</span>
          </div>
          <p className="text-muted-foreground">
            {fr
              ? "Le compte de cet apprenant reste valide. Il pourra s'inscrire à d'autres formations avec les mêmes identifiants. Il sera uniquement masqué de la liste active, du classement et de l'espace communautaire de cette cohorte."
              : "This student's account remains active. They can register for other courses with the same login credentials. They will only be hidden from this cohort's active list, leaderboards, and community space."}
          </p>
        </div>

        {/* Target Info */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">{fr ? "Participant" : "Participant"}:</span>
            <span className="font-bold text-foreground text-sm">{student.name}</span>
          </div>
          {student.email && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{fr ? "E-mail" : "Email"}:</span>
              <span className="font-mono">{student.email}</span>
            </div>
          )}
          {cohortName && (
            <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
              <span>{fr ? "Cohorte concernée" : "Cohort"}:</span>
              <span className="font-semibold text-foreground">{cohortName}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleRemove} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="disqualification-reason" className="text-xs font-semibold">
              {fr ? "Motif de disqualification / retrait" : "Reason for Disqualification / Removal"}
            </Label>
            <Input
              id="disqualification-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={fr ? "Ex. Échec aux quiz, abandon, mesure administrative..." : "e.g. Failed quiz attempts, dropped out..."}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              {fr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {fr ? "Retrait en cours..." : "Removing..."}
                </>
              ) : (
                <>
                  <UserMinus className="size-4" />
                  {fr ? "Confirmer le retrait" : "Confirm Removal"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
