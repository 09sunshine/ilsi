import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Video,
  UploadCloud,
  ExternalLink,
  Trash2,
  Loader2,
  X,
  PlayCircle,
  CheckCircle2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import { LessonVideoPlayer } from "@/components/learning/LessonVideoPlayer";

interface Props {
  cohort: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ManageCurriculumVideosModal({ cohort, isOpen, onClose, onUpdated }: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();

  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const [savingLessonId, setSavingLessonId] = useState<string | null>(null);

  const fetchCurriculum = async () => {
    if (!cohort?.id) return;
    setLoading(true);
    try {
      const res = await api.getCohortCurriculum(cohort.id);
      const mods = Array.isArray(res) ? res : [];
      setModules(mods);
      if (mods.length > 0 && !selectedModuleId) {
        setSelectedModuleId(mods[0].id);
        if (mods[0].lessons?.length > 0) {
          setSelectedLessonId(mods[0].lessons[0].id);
        }
      }
      // Populate link inputs
      const links: Record<string, string> = {};
      for (const m of mods) {
        for (const l of m.lessons || []) {
          links[l.id] = l.videoUrl || "";
        }
      }
      setLinkInputs(links);
    } catch (err: any) {
      console.error("Failed to fetch curriculum:", err);
      toast.error("Could not load cohort curriculum");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && cohort?.id) {
      fetchCurriculum();
    }
  }, [isOpen, cohort?.id]);

  if (!isOpen || !cohort) return null;

  const activeModule = modules.find((m) => m.id === selectedModuleId) || modules[0];
  const activeLesson = activeModule?.lessons?.find((l: any) => l.id === selectedLessonId) || activeModule?.lessons?.[0];

  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>, lessonId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext) && !file.type.startsWith("video/")) {
      toast.error(fr ? "Format vidéo non supporté." : "Unsupported video format.");
      e.target.value = "";
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error(fr ? "Le fichier dépasse la limite de 500 Mo." : "File exceeds 500MB size limit.");
      e.target.value = "";
      return;
    }

    try {
      setUploadingLessonId(lessonId);
      setUploadProgress(0);
      toast.info(fr ? `Téléversement de ${file.name} vers Supabase...` : `Uploading ${file.name} to Supabase...`);

      const res = await api.uploadVideo(file, (percent) => setUploadProgress(percent));
      await api.updateLessonVideo(lessonId, { videoUrl: res.url || res.storagePath });

      // Update local state
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons?.map((l: any) =>
            l.id === lessonId ? { ...l, videoUrl: res.url || res.storagePath, videoFileName: res.fileName } : l
          ),
        }))
      );
      setLinkInputs((prev) => ({ ...prev, [lessonId]: res.url || res.storagePath }));

      toast.success(fr ? "Vidéo sauvegardée dans Supabase Storage !" : "Video saved to Supabase Storage!");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error("Video upload error:", err);
      toast.error(err.message || "Failed to upload video");
    } finally {
      setUploadingLessonId(null);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleSaveVideoLink = async (lessonId: string) => {
    const videoUrl = linkInputs[lessonId] || "";
    setSavingLessonId(lessonId);
    try {
      await api.updateLessonVideo(lessonId, { videoUrl });
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons?.map((l: any) => (l.id === lessonId ? { ...l, videoUrl } : l)),
        }))
      );
      toast.success(fr ? "Lien vidéo mis à jour !" : "Video link updated successfully!");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update video link");
    } finally {
      setSavingLessonId(null);
    }
  };

  const handleRemoveVideo = async (lessonId: string) => {
    if (!confirm("Remove video from this lesson?")) return;
    setSavingLessonId(lessonId);
    try {
      await api.updateLessonVideo(lessonId, { videoUrl: "" });
      setModules((prev) =>
        prev.map((m) => ({
          ...m,
          lessons: m.lessons?.map((l: any) => (l.id === lessonId ? { ...l, videoUrl: "" } : l)),
        }))
      );
      setLinkInputs((prev) => ({ ...prev, [lessonId]: "" }));
      toast.success("Video removed");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove video");
    } finally {
      setSavingLessonId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-5xl max-h-[92vh] flex flex-col p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Video className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold">
                {fr ? "Gestion des Vidéos de Cours" : "Lesson Video Management"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {typeof cohort.name === "object" ? L(cohort.name) : cohort.name || "Cohort"} — {fr ? "Uploader vers Supabase ou lier une vidéo pour chaque leçon" : "Upload to Supabase Storage or link a video for each lesson"}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : modules.length === 0 ? (
          <div className="flex h-72 flex-col items-center justify-center text-center p-6">
            <BookOpen className="size-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-semibold">No modules or lessons found</p>
            <p className="text-xs text-muted-foreground mt-1">This cohort does not have curriculum lessons configured.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-4 flex-1 min-h-0 pt-3 overflow-hidden">
            {/* Sidebar Modules & Lessons */}
            <div className="border-r border-border pr-2 overflow-y-auto space-y-3">
              {modules.map((m) => (
                <div key={m.id} className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2">
                    {m.orderIndex}. {L(m.title)}
                  </p>
                  <div className="space-y-0.5">
                    {m.lessons?.map((l: any) => {
                      const isSelected = selectedLessonId === l.id;
                      const hasVideo = !!l.videoUrl;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => {
                            setSelectedModuleId(m.id);
                            setSelectedLessonId(l.id);
                          }}
                          className={cn(
                            "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between gap-1.5",
                            isSelected
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <PlayCircle className="size-3 shrink-0" />
                            <span>{l.orderIndex}. {L(l.title)}</span>
                          </span>
                          {hasVideo ? (
                            <CheckCircle2 className={cn("size-3 shrink-0", isSelected ? "text-primary-foreground" : "text-emerald-500")} />
                          ) : (
                            <span className="size-1.5 rounded-full bg-amber-500 shrink-0" title="No video" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Lesson Detail & Video Editor */}
            {activeLesson ? (
              <div className="overflow-y-auto pl-1 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <Badge variant="outline" className="text-[10px]">
                      Module {activeModule?.orderIndex} · Lesson {activeLesson.orderIndex}
                    </Badge>
                    <h3 className="font-display text-sm font-semibold text-foreground mt-1">
                      {L(activeLesson.title)}
                    </h3>
                  </div>
                  {activeLesson.videoUrl ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/30">
                      Video Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] text-amber-600 bg-amber-500/10">
                      Missing Video
                    </Badge>
                  )}
                </div>

                {/* Video Player Preview */}
                <div className="space-y-1.5">
                  <p className="font-medium text-[11px] text-muted-foreground">Video Preview (Student View):</p>
                  <LessonVideoPlayer url={activeLesson.videoUrl} title={L(activeLesson.title)} className="max-h-64" />
                </div>

                {/* Upload or Link Controls */}
                <div className="grid gap-3 sm:grid-cols-2 pt-2">
                  {/* Upload from Local PC */}
                  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <UploadCloud className="size-3.5 text-primary" />
                      <span>{fr ? "Téléverser depuis le PC (Supabase)" : "Upload from PC (Supabase Storage)"}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      MP4, MOV, WEBM (Max 500MB). Saves directly to your Supabase Storage bucket.
                    </p>

                    <label className="inline-flex items-center justify-center gap-1.5 w-full py-2 px-3 border border-border hover:border-primary/50 hover:bg-primary/5 rounded-md cursor-pointer transition text-xs font-medium">
                      <UploadCloud className="size-3.5 text-primary" />
                      <span>
                        {uploadingLessonId === activeLesson.id
                          ? `Uploading... ${uploadProgress}%`
                          : fr
                          ? "Choisir un fichier vidéo..."
                          : "Choose Video File..."}
                      </span>
                      <input
                        type="file"
                        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv,.avi,.m4v"
                        className="hidden"
                        disabled={uploadingLessonId !== null}
                        onChange={(e) => handleUploadVideo(e, activeLesson.id)}
                      />
                    </label>

                    {uploadingLessonId === activeLesson.id && (
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden mt-1">
                        <div className="bg-primary h-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                  </div>

                  {/* Attach Video Link */}
                  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                      <ExternalLink className="size-3.5 text-primary" />
                      <span>{fr ? "Lien vidéo externe" : "Attach External Video Link"}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      YouTube, Vimeo, Loom, or direct MP4 URL.
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={linkInputs[activeLesson.id] ?? ""}
                        onChange={(e) => setLinkInputs({ ...linkInputs, [activeLesson.id]: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="h-8 text-xs font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveVideoLink(activeLesson.id)}
                        disabled={savingLessonId === activeLesson.id}
                        className="h-8 text-xs px-2.5 shrink-0"
                      >
                        {savingLessonId === activeLesson.id ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
                      </Button>
                    </div>
                    {activeLesson.videoUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveVideo(activeLesson.id)}
                        className="h-6 text-[10px] text-destructive hover:bg-destructive/10 w-full"
                      >
                        <Trash2 className="size-3 mr-1" />
                        Remove video
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
