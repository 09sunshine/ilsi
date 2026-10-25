import { useState, useEffect } from "react";
import { Globe, Linkedin, Github, Briefcase, Loader2, Save, User } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/LocaleProvider";

interface ProfileEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: any;
  onProfileUpdated: (updated: any) => void;
}

export function ProfileEditorModal({
  open,
  onOpenChange,
  profile,
  onProfileUpdated,
}: ProfileEditorModalProps) {
  const { t, locale } = useI18n();
  const fr = locale === "fr";

  const [headline, setHeadline] = useState(profile?.headline || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [skillsStr, setSkillsStr] = useState((profile?.skills || []).join(", "));
  const [interestsStr, setInterestsStr] = useState((profile?.interests || []).join(", "));
  const [portfolioUrl, setPortfolioUrl] = useState(profile?.portfolioUrl || "");
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedinUrl || "");
  const [githubUrl, setGithubUrl] = useState(profile?.githubUrl || "");
  const [websiteUrl, setWebsiteUrl] = useState(profile?.websiteUrl || "");
  const [isProfilePublic, setIsProfilePublic] = useState(profile?.isProfilePublic ?? true);
  const [showEnrolledPrograms, setShowEnrolledPrograms] = useState(profile?.showEnrolledPrograms ?? true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setHeadline(profile.headline || "");
      setBio(profile.bio || "");
      setSkillsStr((profile.skills || []).join(", "));
      setInterestsStr((profile.interests || []).join(", "));
      setPortfolioUrl(profile.portfolioUrl || "");
      setLinkedinUrl(profile.linkedinUrl || "");
      setGithubUrl(profile.githubUrl || "");
      setWebsiteUrl(profile.websiteUrl || "");
      setIsProfilePublic(profile.isProfilePublic ?? true);
      setShowEnrolledPrograms(profile.showEnrolledPrograms ?? true);
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const skills = skillsStr
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    const interests = interestsStr
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);

    try {
      const updated = await api.updateCommunityProfile({
        headline: headline.trim() || null,
        bio: bio.trim() || null,
        skills,
        interests,
        portfolioUrl: portfolioUrl.trim() || null,
        linkedinUrl: linkedinUrl.trim() || null,
        githubUrl: githubUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        isProfilePublic,
        showEnrolledPrograms,
      });

      toast.success(fr ? "Profil communautaire mis à jour !" : "Community profile updated!");
      onProfileUpdated(updated);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <User className="size-5" />
            <DialogTitle className="font-display text-xl">{t("community.editProfile")}</DialogTitle>
          </div>
          <DialogDescription>
            {fr
              ? "Personnalisez votre présence sur le réseau communautaire ILSI. Vos coordonnées privées ne sont jamais partagées."
              : "Customize how you appear on the ILSI social network. Private contact details are never exposed."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Headline */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Headline / Title
            </Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Health Systems Lead | Cohort 2026 Alum"
              maxLength={255}
              className="h-10 text-sm"
            />
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Bio / Summary
            </Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Briefly describe your experience, leadership mission, or current focus..."
              rows={3}
              maxLength={3000}
              className="resize-none text-sm"
            />
          </div>

          {/* Skills & Interests */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Skills (comma-separated)
              </Label>
              <Input
                value={skillsStr}
                onChange={(e) => setSkillsStr(e.target.value)}
                placeholder="Strategy, Operations, M&E"
                className="h-10 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Interests (comma-separated)
              </Label>
              <Input
                value={interestsStr}
                onChange={(e) => setInterestsStr(e.target.value)}
                placeholder="Youth Leadership, EdTech"
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* Professional Links */}
          <div className="space-y-2.5 pt-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Professional Links
            </Label>
            <div className="grid gap-2">
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="relative">
                <Github className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username"
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://yourportfolio.org"
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Privacy & Visibility Settings */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-3 pt-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Privacy & Visibility
            </span>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">
                  {isProfilePublic ? t("community.publicProfile") : t("community.privateProfile")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isProfilePublic
                    ? "Visible in the global ILSI directory."
                    : "Hidden from member searches and directory."}
                </p>
              </div>
              <Switch checked={isProfilePublic} onCheckedChange={setIsProfilePublic} />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
              <div>
                <p className="text-xs font-medium text-foreground">Show Completed Programs</p>
                <p className="text-[11px] text-muted-foreground">
                  Display verified cohorts and programs you have attended.
                </p>
              </div>
              <Switch checked={showEnrolledPrograms} onCheckedChange={setShowEnrolledPrograms} />
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="font-semibold bg-primary text-primary-foreground">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving Profile...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
