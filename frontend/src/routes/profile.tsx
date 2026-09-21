import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Award, Download } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — ILSI" },
      { name: "description", content: "Manage your details, language and certificate." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Your profile — ILSI" },
      { property: "og:description", content: "Manage your details, language and certificate." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useI18n();
  const L = useLocalized();

  const [profile, setProfile] = useState<any>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.getProfile();
        if (res) {
          setProfile(res);
          setFirstName(res.firstName || res.name || "");
          setLastName(res.lastName || "");
          setPhone(res.phone || "");
          setEmail(res.email || "");
        }
      } catch (err) {
        console.warn("Could not fetch profile:", err);
      }
    }
    loadProfile();
  }, []);

  return (
    <AppShell title={t("nav.profile")}>
      <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <form
          className="panel space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await api.updateProfile({ firstName, lastName, phone });
              toast.success(t("profile.saved"));
            } catch (err: any) {
              toast.error(err.message || "Failed to update profile");
            } finally {
              setSaving(false);
            }
          }}
        >
          <h2 className="font-display text-lg font-semibold">{t("profile.details")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">{t("apply.firstName")}</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">{t("apply.lastName")}</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("apply.email")}</Label>
            <Input id="email" value={email} readOnly disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">{t("apply.phone")}</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

        <aside className="space-y-4">
          <div className="panel p-5">
            <h2 className="font-display text-base font-semibold">
              {profile?.programTitle ? L(profile.programTitle) : "Leadership Program"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.cohortName ? L(profile.cohortName) : "Active Cohort"}
            </p>
            <p className="mt-3 text-3xl font-semibold">{profile?.progress?.overallPercent ?? 0}%</p>
            <p className="text-xs text-muted-foreground">{t("dash.overallProgress")}</p>
          </div>
          <div className="panel p-5">
            <div className="flex items-center gap-2">
              <Award className="size-5 text-primary" />
              <h2 className="font-display text-base font-semibold">{t("dash.certificate")}</h2>
            </div>
            <Badge variant="secondary" className="mt-3">
              {(profile?.progress?.overallPercent ?? 0) >= 100
                ? t("dash.certEarned")
                : t("dash.certPending")}
            </Badge>
            <Button
              disabled={(profile?.progress?.overallPercent ?? 0) < 100}
              size="sm"
              variant="outline"
              className="mt-4 w-full"
            >
              <Download className="size-4" /> {t("dash.downloadCert")}
            </Button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
