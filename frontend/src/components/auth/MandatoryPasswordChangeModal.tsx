import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Lock, ShieldCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/LocaleProvider";

interface Props {
  isOpen: boolean;
  onPasswordChanged: () => void;
}

export function MandatoryPasswordChangeModal({ isOpen, onPasswordChanged }: Props) {
  const { t, locale } = useI18n();
  const fr = locale === "fr";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(
        fr
          ? "Le mot de passe doit contenir au moins 8 caractères."
          : "Password must be at least 8 characters long."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        fr
          ? "Les deux mots de passe ne correspondent pas."
          : "Passwords do not match."
      );
      return;
    }

    try {
      setSubmitting(true);
      await api.changeFirstLoginPassword({
        newPassword,
        currentPassword: currentPassword.trim() || undefined,
      });

      toast.success(
        fr
          ? "Mot de passe modifié avec succès ! Votre compte est activé."
          : "Password updated successfully! Your account is activated."
      );
      onPasswordChanged();
    } catch (err: any) {
      setError(err.message || "Failed to update password. Please try again.");
      toast.error(err.message || "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  };

  const isStrong = newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="panel max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border-primary/30">
        {/* Header with security badge */}
        <div className="text-center space-y-2">
          <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-3">
            <KeyRound className="size-6" />
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            {fr ? "Changement de mot de passe obligatoire" : "Mandatory Password Change"}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {fr
              ? "Vous vous connectez avec un mot de passe temporaire fourni par l'administration. Pour sécuriser votre espace d'apprentissage, vous devez définir votre mot de passe personnel."
              : "You are logged in with a temporary one-time password assigned by the administration. To secure your learning account, please choose a permanent password."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="current-pass" className="text-xs">
              {fr ? "Mot de passe temporaire (optionnel)" : "Temporary OTP Password (Optional)"}
            </Label>
            <div className="relative">
              <Input
                id="current-pass"
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={fr ? "Entrez votre mot de passe temporaire" : "Enter temporary OTP password"}
                className="pr-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pass" className="text-xs font-semibold">
              {fr ? "Nouveau mot de passe personnel *" : "New Permanent Password *"}
            </Label>
            <div className="relative">
              <Input
                id="new-pass"
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={fr ? "Minimum 8 caractères" : "Minimum 8 characters"}
                className="pr-9 text-sm"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {newPassword.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] mt-1">
                <ShieldCheck className={isStrong ? "size-3.5 text-success" : "size-3.5 text-amber-500"} />
                <span className={isStrong ? "text-success font-medium" : "text-amber-500"}>
                  {isStrong
                    ? fr ? "Mot de passe fort" : "Strong password"
                    : fr ? "Au moins 8 caractères, 1 majuscule, 1 chiffre recommandé" : "Min 8 chars, 1 uppercase, 1 number recommended"}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass" className="text-xs font-semibold">
              {fr ? "Confirmer le nouveau mot de passe *" : "Confirm New Password *"}
            </Label>
            <Input
              id="confirm-pass"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={fr ? "Répétez le mot de passe" : "Repeat new password"}
              className="text-sm"
              required
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full mt-2 font-semibold">
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {fr ? "Mise à jour en cours..." : "Updating password..."}
              </>
            ) : (
              <>
                <Lock className="mr-2 size-4" />
                {fr ? "Enregistrer et accéder au tableau de bord" : "Save & Access Dashboard"}
              </>
            )}
          </Button>

          <p className="text-[11px] text-center text-muted-foreground pt-1">
            {fr ? "Étape obligatoire · Ne peut pas être ignorée" : "Mandatory step · Cannot be skipped"}
          </p>
        </form>
      </div>
    </div>
  );
}
