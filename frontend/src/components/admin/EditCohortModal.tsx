import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  Edit3,
  Globe,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/LocaleProvider";
import { resolveMediaUrl } from "@/lib/utils";
import {
  convertUsdToEur,
  convertEurToUsd,
  translateText,
} from "@/lib/translation";

interface Props {
  cohort: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditCohortModal({ cohort, isOpen, onClose, onUpdated }: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";

  const [nameEn, setNameEn] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [capacity, setCapacity] = useState(30);
  const [passingScore, setPassingScore] = useState(70);
  const [feeAmount, setFeeAmount] = useState(180);
  const [feeCurrency, setFeeCurrency] = useState("USD");
  const [feeEur, setFeeEur] = useState(165);
  const [status, setStatus] = useState("ACTIVE");
  const [timezone, setTimezone] = useState("UTC");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [translating, setTranslating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cohort) {
      setNameEn(cohort.name?.en || cohort.name_en || "");
      setNameFr(cohort.name?.fr || cohort.name_fr || "");
      setStartDate(cohort.startDate || "");
      setEndDate(cohort.endDate || "");
      setCapacity(cohort.capacity || 30);
      setPassingScore(cohort.passingScore || 70);
      const fee = Number(cohort.feeAmount || 0);
      setFeeAmount(fee);
      setFeeCurrency(cohort.feeCurrency || "USD");
      setFeeEur(convertUsdToEur(fee));
      setStatus(cohort.status || "ACTIVE");
      setTimezone(cohort.timezone || "UTC");
      setDescriptionEn(cohort.description?.en || cohort.description_en || "");
      setDescriptionFr(cohort.description?.fr || cohort.description_fr || "");
      setThumbnailUrl(cohort.thumbnailUrl || cohort.thumbnail_url || "");
    }
  }, [cohort]);

  if (!isOpen || !cohort) return null;

  // Currency synchronization
  const handleUsdChange = (val: number) => {
    setFeeAmount(val);
    setFeeEur(convertUsdToEur(val));
  };

  const handleEurChange = (val: number) => {
    setFeeEur(val);
    setFeeAmount(convertEurToUsd(val));
  };

  // Translation helpers
  const handleTranslateToFr = async () => {
    if (!nameEn && !descriptionEn) return;
    setTranslating(true);
    try {
      if (nameEn) {
        const tr = await translateText(nameEn, "en", "fr");
        setNameFr(tr);
      }
      if (descriptionEn) {
        const trDesc = await translateText(descriptionEn, "en", "fr");
        setDescriptionFr(trDesc);
      }
      toast.success(fr ? "Traduction en français terminée !" : "Translated to French!");
    } catch {
      toast.error("Auto-translation failed.");
    } finally {
      setTranslating(false);
    }
  };

  const handleTranslateToEn = async () => {
    if (!nameFr && !descriptionFr) return;
    setTranslating(true);
    try {
      if (nameFr) {
        const tr = await translateText(nameFr, "fr", "en");
        setNameEn(tr);
      }
      if (descriptionFr) {
        const trDesc = await translateText(descriptionFr, "fr", "en");
        setDescriptionEn(trDesc);
      }
      toast.success("Translated to English!");
    } catch {
      toast.error("Auto-translation failed.");
    } finally {
      setTranslating(false);
    }
  };

  // Handle Thumbnail Upload from Local PC
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      toast.error(
        fr
          ? "Format d'image non supporté. Veuillez choisir un fichier JPG, JPEG, PNG, WEBP ou SVG."
          : "Unsupported image format. Please select a JPG, JPEG, PNG, WEBP, or SVG image."
      );
      e.target.value = "";
      return;
    }

    try {
      setUploadingThumbnail(true);
      toast.info(fr ? `Téléversement de la miniature ${file.name}...` : `Uploading thumbnail ${file.name}...`);
      const res = await api.uploadFile(file);
      setThumbnailUrl(res.url);
      toast.success(fr ? "Miniature téléversée avec succès !" : "Thumbnail uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload thumbnail.");
    } finally {
      setUploadingThumbnail(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn || !startDate || !endDate) {
      toast.error(fr ? "Veuillez remplir les champs obligatoires." : "Please fill in all required fields.");
      return;
    }

    try {
      setSubmitting(true);
      await api.updateCohort(cohort.id, {
        nameEn,
        nameFr: nameFr || nameEn,
        startDate,
        endDate,
        capacity,
        maxParticipants: capacity,
        passingScore,
        feeAmount,
        feeCurrency,
        status,
        timezone,
        descriptionEn,
        descriptionFr,
        thumbnailUrl: thumbnailUrl || null,
      });

      toast.success(fr ? "Cohorte mise à jour avec succès !" : "Cohort updated successfully!");
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update cohort.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="panel max-w-2xl w-full max-h-[92vh] flex flex-col p-4 sm:p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Edit3 className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base sm:text-lg font-bold text-foreground truncate">
                {fr ? "Modifier les Détails de la Cohorte" : "Edit Cohort Parameters"}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                ID: {cohort.id} · {nameEn || "Cohort"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X className="size-4" />
          </Button>
        </div>

        {/* Translation Bar */}
        <div className="flex items-center justify-between bg-muted/40 px-3 py-2 rounded-lg my-3 border border-border/60 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Globe className="size-3.5 text-primary" />
            {fr ? "Synchronisation Bilingue & Devises" : "Bilingual & Currency Auto-Sync"}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTranslateToFr}
              disabled={translating}
              className="h-6 text-[11px] px-2 gap-1"
            >
              <Sparkles className="size-3 text-amber-500" />
              {fr ? "Traduire en FR" : "Translate to FR"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTranslateToEn}
              disabled={translating}
              className="h-6 text-[11px] px-2 gap-1"
            >
              <Sparkles className="size-3 text-amber-500" />
              {fr ? "Traduire en EN" : "Translate to EN"}
            </Button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 py-2 text-xs">
          {/* Names */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{fr ? "Nom de la Cohorte (Anglais) *" : "Cohort Name (English) *"}</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. October 2026 Cohort"
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{fr ? "Nom de la Cohorte (Français) *" : "Cohort Name (French) *"}</Label>
              <Input
                value={nameFr}
                onChange={(e) => setNameFr(e.target.value)}
                placeholder="e.g. Cohorte Octobre 2026"
                required
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                <Calendar className="size-3 text-primary" />
                <span>{fr ? "Date de début *" : "Start Date *"}</span>
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                <Calendar className="size-3 text-primary" />
                <span>{fr ? "Date de fin *" : "End Date *"}</span>
              </Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Capacity & Passing Score & Status */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{fr ? "Capacité maximale" : "Max Capacity"}</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{fr ? "Note de passage (%)" : "Passing Threshold (%)"}</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(Number(e.target.value))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>{fr ? "Statut de la Cohorte" : "Cohort Status"}</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="ACTIVE">{fr ? "ACTIVE (En cours)" : "ACTIVE"}</option>
                <option value="APPLICATION_OPEN">{fr ? "CANDIDATURES OUVERTES" : "APPLICATION OPEN"}</option>
                <option value="APPLICATION_CLOSED">{fr ? "CANDIDATURES FERMÉES" : "APPLICATION CLOSED"}</option>
                <option value="UPCOMING">{fr ? "À VENIR" : "UPCOMING"}</option>
                <option value="COMPLETED">{fr ? "TERMINÉE" : "COMPLETED"}</option>
                <option value="DRAFT">{fr ? "BROUILLON" : "DRAFT"}</option>
              </select>
            </div>
          </div>

          {/* Pricing USD / EUR Sync */}
          <div className="p-3 bg-muted/20 rounded-lg border border-border space-y-2">
            <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
              {fr ? "Frais d'inscription Bidevises" : "Dual Currency Enrollment Fee"}
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>{fr ? "Frais en Dollars ($ USD)" : "Fee in Dollars ($ USD)"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={feeAmount}
                  onChange={(e) => handleUsdChange(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>{fr ? "Frais équivalents en Euros (€ EUR)" : "Equivalent Fee (€ EUR)"}</Label>
                <Input
                  type="number"
                  min={0}
                  value={feeEur}
                  onChange={(e) => handleEurChange(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Descriptions */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{fr ? "Description (Anglais)" : "Description (English)"}</Label>
              <Textarea
                rows={2}
                value={descriptionEn}
                onChange={(e) => setDescriptionEn(e.target.value)}
                placeholder="Specific cohort guidelines or announcements..."
              />
            </div>
            <div className="space-y-1">
              <Label>{fr ? "Description (Français)" : "Description (French)"}</Label>
              <Textarea
                rows={2}
                value={descriptionFr}
                onChange={(e) => setDescriptionFr(e.target.value)}
                placeholder="Directives spécifiques à la cohorte..."
              />
            </div>
          </div>

          {/* Thumbnail Image Upload */}
          <div className="p-3 bg-muted/20 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-primary" />
                <span>{fr ? "Miniature de la Cohorte" : "Cohort Thumbnail Image"}</span>
              </span>
              {thumbnailUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setThumbnailUrl("")}
                  className="h-6 text-[11px] text-destructive hover:bg-destructive/10 px-2"
                >
                  <Trash2 className="size-3 mr-1" />
                  {fr ? "Supprimer" : "Remove"}
                </Button>
              )}
            </div>

            {thumbnailUrl ? (
              <div className="flex items-center gap-3 p-2.5 bg-card rounded-lg border border-border">
                <img
                  src={resolveMediaUrl(thumbnailUrl)}
                  alt="Cohort thumbnail"
                  className="h-16 w-24 object-cover rounded-md border border-border shadow-sm shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                    {fr ? "Miniature configurée" : "Configured Thumbnail"}
                  </Badge>
                  <div className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                    {thumbnailUrl}
                  </div>
                  <label className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer">
                    <UploadCloud className="size-3" />
                    <span>{fr ? "Changer" : "Replace"}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      onChange={handleThumbnailUpload}
                      disabled={uploadingThumbnail}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition rounded-lg p-4 cursor-pointer text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={handleThumbnailUpload}
                  disabled={uploadingThumbnail}
                />
                {uploadingThumbnail ? (
                  <div className="flex items-center gap-2 text-primary text-xs">
                    <Loader2 className="size-4 animate-spin" />
                    <span>{fr ? "Téléversement..." : "Uploading image..."}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <UploadCloud className="size-4 text-primary" />
                    <span>{fr ? "Téléverser une image (JPG, PNG, WEBP)" : "Upload image (JPG, PNG, WEBP)"}</span>
                  </div>
                )}
              </label>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>
              {fr ? "Annuler" : "Cancel"}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  {fr ? "Enregistrement..." : "Updating..."}
                </>
              ) : (
                <>
                  <Check className="mr-2 size-3.5" />
                  {fr ? "Enregistrer les Modifications" : "Save Changes"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
