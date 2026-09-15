import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n } from "@/i18n/LocaleProvider";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ILSI admin" },
      { name: "description", content: "Default passing score, notifications and platform language." },
      { property: "og:title", content: "Settings — ILSI admin" },
      { property: "og:description", content: "Default passing score and notification rules." },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const { t } = useI18n();
  const [passing, setPassing] = useState("70");
  const [attempts, setAttempts] = useState("3");
  const [emailOnUnlock, setEmailOnUnlock] = useState(true);
  const [emailOnDeadline, setEmailOnDeadline] = useState(true);
  const [saving, setSaving] = useState(false);

  return (
    <AppShell variant="admin" title={t("nav.settings")}>
      <form
        className="panel mx-auto max-w-2xl space-y-6 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          setSaving(true);
          window.setTimeout(() => {
            setSaving(false);
            toast.success(t("common.saved"));
          }, 500);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="passing">{t("quiz.passing")} (%)</Label>
            <Input
              id="passing"
              type="number"
              min={0}
              max={100}
              value={passing}
              onChange={(e) => setPassing(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="attempts">{t("quiz.attempts")}</Label>
            <Input
              id="attempts"
              type="number"
              min={1}
              max={10}
              value={attempts}
              onChange={(e) => setAttempts(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <Label htmlFor="unlock" className="font-normal">
              {t("notif.unlockEmail")}
            </Label>
            <Switch id="unlock" checked={emailOnUnlock} onCheckedChange={setEmailOnUnlock} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <Label htmlFor="deadline" className="font-normal">
              {t("notif.deadlineEmail")}
            </Label>
            <Switch id="deadline" checked={emailOnDeadline} onCheckedChange={setEmailOnDeadline} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t("profile.language")}</Label>
          <div>
            <LanguageToggle />
          </div>
        </div>

        <Button type="submit" disabled={saving}>
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </AppShell>
  );
}
