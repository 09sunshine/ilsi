import { useState, useRef } from "react";
import {
  FileText,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  MessageSquare,
  Paperclip,
  Send,
  Sparkles,
  Trophy,
  X,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/LocaleProvider";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface PostComposerProps {
  scope: "cohort" | "global";
  cohortId?: string | undefined;
  isStaffOrTrainer?: boolean | undefined;
  onPostCreated: (post: any) => void;
}

export function PostComposer({
  scope,
  cohortId,
  isStaffOrTrainer = false,
  onPostCreated,
}: PostComposerProps) {
  const { t, locale } = useI18n();
  const fr = locale === "fr";

  const [type, setType] = useState<"DISCUSSION" | "ANNOUNCEMENT" | "QUESTION" | "ACHIEVEMENT" | "PROJECT">(
    "DISCUSSION"
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachments.length + files.length > 5) {
      toast.error(fr ? "Maximum 5 pièces jointes par publication." : "Maximum 5 attachments per post.");
      return;
    }

    setUploadingFiles(true);
    try {
      const uploaded: any[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        if (file.size > 15 * 1024 * 1024) {
          toast.error(fr ? `Le fichier "${file.name}" dépasse 15 Mo.` : `File "${file.name}" exceeds the 15MB limit.`);
          continue;
        }

        const toastId = toast.loading(fr ? `Téléversement de "${file.name}"...` : `Uploading "${file.name}" to cloud storage...`);
        try {
          const res = await api.uploadCommunityAttachment(file);
          uploaded.push({
            storagePath: res.storagePath,
            fileName: res.fileName,
            fileType: res.fileType,
            mimeType: res.mimeType,
            fileSizeBytes: res.fileSizeBytes,
            url: res.url,
          });
          toast.success(fr ? `Fichier "${file.name}" téléversé.` : `Uploaded "${file.name}"`, { id: toastId });
        } catch (err: any) {
          toast.error(err.message || (fr ? `Échec du téléversement de "${file.name}"` : `Failed to upload "${file.name}"`), { id: toastId });
        }
      }

      if (uploaded.length > 0) {
        setAttachments((prev) => [...prev, ...uploaded]);
      }
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || content.trim().length < 3) {
      toast.error("Please write at least a few words before publishing.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createCommunityPost({
        scope,
        cohortId: scope === "cohort" ? cohortId : undefined,
        type,
        title: title.trim() || undefined,
        content: content.trim(),
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      toast.success(fr ? "Publication partagée avec succès !" : "Post published successfully!");
      setContent("");
      setTitle("");
      setAttachments([]);
      setIsExpanded(false);
      onPostCreated(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish post. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel border border-border/80 bg-card p-4 sm:p-5 shadow-sm transition-all">
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {/* Post Type Selector */}
        <div className="flex items-center gap-1.5 pb-1 border-b border-border/40 overflow-x-auto no-scrollbar touch-pan-x whitespace-nowrap">
          <button
            type="button"
            onClick={() => {
              setType("DISCUSSION");
              setIsExpanded(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              type === "DISCUSSION"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <MessageSquare className="size-3.5 shrink-0" />
            {t("community.filterDiscussions")}
          </button>

          <button
            type="button"
            onClick={() => {
              setType("QUESTION");
              setIsExpanded(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
              type === "QUESTION"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <HelpCircle className="size-3.5 shrink-0" />
            {t("community.filterQuestions")}
          </button>

          {scope === "global" && (
            <button
              type="button"
              onClick={() => {
                setType("ACHIEVEMENT");
                setIsExpanded(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                type === "ACHIEVEMENT"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Trophy className="size-3.5 shrink-0" />
              {t("community.filterAchievements")}
            </button>
          )}

          {isStaffOrTrainer && scope === "cohort" && (
            <button
              type="button"
              onClick={() => {
                setType("ANNOUNCEMENT");
                setIsExpanded(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                type === "ANNOUNCEMENT"
                  ? "bg-hero-lime text-hero-lime-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Megaphone className="size-3.5 shrink-0" />
              {t("community.filterAnnouncements")}
            </button>
          )}
        </div>

        {/* Optional Title input for announcements or prominent discussions */}
        {(isExpanded || type === "ANNOUNCEMENT" || type === "ACHIEVEMENT") && (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === "ANNOUNCEMENT"
                ? fr
                  ? "Titre de l'annonce officielle..."
                  : "Announcement headline..."
                : fr
                  ? "Titre du sujet (optionnel)..."
                  : "Topic subject (optional)..."
            }
            className="h-10 text-sm font-medium bg-background border-border/70"
            maxLength={300}
          />
        )}

        {/* Main Content Textarea */}
        <div className="relative">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder={
              type === "ANNOUNCEMENT"
                ? fr
                  ? "Rédigez l'annonce officielle pour la cohorte..."
                  : "Write the official announcement for the cohort..."
                : t("community.postPlaceholder")
            }
            rows={isExpanded ? 4 : 2}
            className="resize-none text-sm leading-relaxed bg-background border-border/70 placeholder:text-muted-foreground/70"
            maxLength={20000}
            required
          />
        </div>

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-muted/60 text-xs font-medium text-foreground"
              >
                {att.fileType === "IMAGE" ? (
                  <ImageIcon className="size-3.5 text-primary" />
                ) : (
                  <FileText className="size-3.5 text-amber-500" />
                )}
                <span className="max-w-[140px] truncate">{att.fileName}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer Toolbar */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,application/pdf,.doc,.docx,.txt"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingFiles}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs font-medium gap-1.5 border-border/60 hover:bg-muted"
            >
              {uploadingFiles ? (
                <>
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  <span>{fr ? "Téléversement..." : "Uploading..."}</span>
                </>
              ) : (
                <>
                  <Paperclip className="size-3.5 text-muted-foreground" />
                  <span>{fr ? "Joindre fichier / image" : "Attach File / Image"}</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {isExpanded && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting || uploadingFiles}
                onClick={() => {
                  setIsExpanded(false);
                  setContent("");
                  setTitle("");
                  setAttachments([]);
                }}
                className="h-8 text-xs text-muted-foreground"
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
            )}
            <Button
              type="submit"
              disabled={submitting || uploadingFiles || !content.trim()}
              size="sm"
              className="h-8 px-4 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  {t("community.publishing")}
                </>
              ) : uploadingFiles ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  {fr ? "Téléversement..." : "Uploading..."}
                </>
              ) : (
                <>
                  <Send className="size-3.5 mr-1.5" />
                  {t("community.publish")}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
