import { useState } from "react";
import { toast } from "sonner";
import { Award, Plus, Loader2, X, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  cohortId: string;
  student: {
    userId: string;
    name: string;
    currentPoints?: number;
    currentRank?: number | null;
  } | null;
  onPointsAdded?: (newTotal: number, newRank?: number | null) => void;
}

export function AddBonusPointsModal({
  isOpen,
  onClose,
  cohortId,
  student,
  onPointsAdded,
}: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";

  const [pointsInput, setPointsInput] = useState<string>("50");
  const [reason, setReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !student) return null;

  const currentPoints = Number(student.currentPoints) || 0;
  const numPoints = parseFloat(pointsInput) || 0;
  const projectedTotal = currentPoints + numPoints;

  const handleQuickAdd = (amount: number) => {
    setPointsInput(String(amount));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numPoints || isNaN(numPoints)) {
      toast.error(fr ? "Veuillez saisir un nombre de points valide." : "Please enter a valid points value.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.addStudentPoints(cohortId, student.userId, {
        points: numPoints,
        reason: reason.trim() || undefined,
      });

      const newTotal = res.newTotalPoints ?? projectedTotal;
      const newRank = res.newRank ?? null;

      toast.success(
        fr
          ? `+${numPoints} points attribués à ${student.name} ! Nouveau total : ${newTotal.toFixed(2)} pts`
          : `+${numPoints} points awarded to ${student.name}! New total: ${newTotal.toFixed(2)} pts`
      );

      if (onPointsAdded) {
        onPointsAdded(newTotal, newRank);
      }
      onClose();
    } catch (err: any) {
      toast.error(err?.message || (fr ? "Échec de l'attribution des points." : "Failed to add bonus points."));
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
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl text-card-foreground animate-in zoom-in-95 duration-150 space-y-5"
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
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Award className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              {fr ? "Attribuer des points manuels" : "Award Manual Points"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {fr
                ? "Ces points seront ajoutés au total du participant et le classement sera recalculé instantanément."
                : "These points will be added to the student's total and leaderboard ranking will be recalculated immediately."}
            </p>
          </div>
        </div>

        {/* Target Student Info Card */}
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{fr ? "Apprenant ciblé" : "Target Student"}:</span>
            <span className="font-bold text-foreground text-sm">{student.name}</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
            <span className="text-muted-foreground">{fr ? "Points actuels" : "Current Points"}:</span>
            <span className="font-semibold text-foreground font-mono">
              {currentPoints.toFixed(2)} pts
              {student.currentRank !== undefined && student.currentRank !== null && (
                <span className="ml-1 text-[11px] text-muted-foreground">
                  (Rang #{student.currentRank})
                </span>
              )}
            </span>
          </div>
          {numPoints > 0 && (
            <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              <span className="flex items-center gap-1">
                <TrendingUp className="size-3.5" />
                {fr ? "Nouveau total estimé" : "Projected New Total"}:
              </span>
              <span className="font-mono text-sm">{projectedTotal.toFixed(2)} pts</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick preset buttons */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {fr ? "Préréglages rapides" : "Quick Presets"}
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 25, 50, 100].map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => handleQuickAdd(preset)}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    pointsInput === String(preset)
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  +{preset}
                </button>
              ))}
            </div>
          </div>

          {/* Points Input */}
          <div className="space-y-1.5">
            <Label htmlFor="bonus-points-input" className="text-xs font-semibold">
              {fr ? "Points à ajouter" : "Points to Add"}
            </Label>
            <div className="relative">
              <Input
                id="bonus-points-input"
                type="number"
                step="any"
                value={pointsInput}
                onChange={(e) => setPointsInput(e.target.value)}
                placeholder="Ex. 50"
                required
                className="font-mono text-base font-semibold"
                disabled={isSubmitting}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                pts
              </span>
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <Label htmlFor="bonus-points-reason" className="text-xs font-semibold">
              {fr ? "Motif / Justification (facultatif)" : "Reason / Justification (optional)"}
            </Label>
            <Input
              id="bonus-points-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={fr ? "Ex. Participation active, devoir bonus..." : "e.g. Active participation, extra credit..."}
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
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
              disabled={isSubmitting || !numPoints}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {fr ? "Recalcul en cours..." : "Recalculating..."}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  {fr ? "Ajouter & Recalculer" : "Award & Recalculate"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
