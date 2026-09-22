import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  Video,
  FileText,
  HelpCircle,
  UploadCloud,
  ExternalLink,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Layers,
  FileCheck,
  AlertCircle,
  Clock,
  Settings,
  Paperclip,
  Check,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cn, resolveMediaUrl } from "@/lib/utils";
import { LessonVideoPlayer } from "@/components/learning/LessonVideoPlayer";

interface Props {
  cohort: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

type LessonTab = "video" | "chapters" | "resources" | "quiz";

export function EditCurriculumModal({ cohort, isOpen, onClose, onUpdated }: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";
  const L = useLocalized();

  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
  const [activeLessonTab, setActiveLessonTab] = useState<Record<string, LessonTab>>({});

  // Module modal / inline state
  const [isAddModuleOpen, setIsAddModuleOpen] = useState(false);
  const [newModuleTitleEn, setNewModuleTitleEn] = useState("");
  const [newModuleTitleFr, setNewModuleTitleFr] = useState("");
  const [editingModule, setEditingModule] = useState<any | null>(null);

  // Lesson modal / inline state
  const [isAddLessonOpen, setIsAddLessonOpen] = useState(false);
  const [newLessonTitleEn, setNewLessonTitleEn] = useState("");
  const [newLessonTitleFr, setNewLessonTitleFr] = useState("");
  const [newLessonDuration, setNewLessonDuration] = useState(15);
  const [newLessonStartDate, setNewLessonStartDate] = useState("");
  const [newLessonEndDate, setNewLessonEndDate] = useState("");
  const [editingLesson, setEditingLesson] = useState<any | null>(null);

  // Video management state
  const [videoLinkInputs, setVideoLinkInputs] = useState<Record<string, string>>({});
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingVideoId, setSavingVideoId] = useState<string | null>(null);

  // Lesson text / body state
  const [bodyInputsEn, setBodyInputsEn] = useState<Record<string, string>>({});
  const [bodyInputsFr, setBodyInputsFr] = useState<Record<string, string>>({});
  const [savingBodyId, setSavingBodyId] = useState<string | null>(null);

  // Chapter state
  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [targetChapterLessonId, setTargetChapterLessonId] = useState<string | null>(null);
  const [chapterTitleEn, setChapterTitleEn] = useState("");
  const [chapterTitleFr, setChapterTitleFr] = useState("");
  const [chapterDuration, setChapterDuration] = useState(5);
  const [chapterVideoUrl, setChapterVideoUrl] = useState("");

  // Resource / Document state
  const [isUploadingResource, setIsUploadingResource] = useState<string | null>(null);
  const [newResourceNameEn, setNewResourceNameEn] = useState("");
  const [newResourceNameFr, setNewResourceNameFr] = useState("");
  const [newResourceUrl, setNewResourceUrl] = useState("");

  // Quiz state
  const [isAddQuizOpen, setIsAddQuizOpen] = useState(false);
  const [targetQuizLessonId, setTargetQuizLessonId] = useState<string | null>(null);
  const [quizTitleEn, setQuizTitleEn] = useState("");
  const [quizTitleFr, setQuizTitleFr] = useState("");
  const [quizPassingScore, setQuizPassingScore] = useState(70);
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(3);

  // Question state
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [targetQuestionQuizId, setTargetQuestionQuizId] = useState<string | null>(null);
  const [questionTextEn, setQuestionTextEn] = useState("");
  const [questionTextFr, setQuestionTextFr] = useState("");
  const [questionExplanationEn, setQuestionExplanationEn] = useState("");
  const [questionExplanationFr, setQuestionExplanationFr] = useState("");
  const [questionPoints, setQuestionPoints] = useState(1);
  const [questionOptions, setQuestionOptions] = useState<
    Array<{ textEn: string; textFr: string; isCorrect: boolean }>
  >([
    { textEn: "", textFr: "", isCorrect: true },
    { textEn: "", textFr: "", isCorrect: false },
  ]);

  const fetchCurriculum = async () => {
    if (!cohort?.id) return;
    setLoading(true);
    try {
      const res = await api.getCohortCurriculum(cohort.id);
      const mods = Array.isArray(res) ? res : [];
      setModules(mods);

      if (mods.length > 0) {
        if (!selectedModuleId || !mods.some((m) => m.id === selectedModuleId)) {
          setSelectedModuleId(mods[0].id);
        }
      } else {
        setSelectedModuleId(null);
      }

      // Populate input caches
      const vLinks: Record<string, string> = {};
      const bEn: Record<string, string> = {};
      const bFr: Record<string, string> = {};

      for (const m of mods) {
        for (const l of m.lessons || []) {
          vLinks[l.id] = l.videoUrl || "";
          bEn[l.id] = typeof l.body === "object" ? l.body?.en || "" : l.bodyEn || "";
          bFr[l.id] = typeof l.body === "object" ? l.body?.fr || "" : l.bodyFr || "";
        }
      }
      setVideoLinkInputs(vLinks);
      setBodyInputsEn(bEn);
      setBodyInputsFr(bFr);
    } catch (err: any) {
      console.error("Failed to fetch curriculum:", err);
      toast.error(fr ? "Erreur lors du chargement du curriculum." : "Failed to load cohort curriculum.");
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

  // ----------------------------------------------------
  // MODULE HANDLERS
  // ----------------------------------------------------
  const handleAddModule = async () => {
    if (!newModuleTitleEn.trim()) {
      toast.error(fr ? "Veuillez entrer le titre en anglais." : "English title is required.");
      return;
    }
    try {
      await api.addCohortModule(cohort.id, {
        titleEn: newModuleTitleEn.trim(),
        titleFr: newModuleTitleFr.trim() || newModuleTitleEn.trim(),
        orderIndex: modules.length + 1,
      });
      toast.success(fr ? "Module ajouté avec succès !" : "Module added successfully!");
      setNewModuleTitleEn("");
      setNewModuleTitleFr("");
      setIsAddModuleOpen(false);
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add module");
    }
  };

  const handleUpdateModule = async () => {
    if (!editingModule) return;
    try {
      await api.updateModule(editingModule.id, {
        titleEn: editingModule.titleEn,
        titleFr: editingModule.titleFr,
      });
      toast.success(fr ? "Module mis à jour !" : "Module updated!");
      setEditingModule(null);
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update module");
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (
      !confirm(
        fr
          ? "Êtes-vous sûr de vouloir supprimer ce module ? Les leçons associées seront archivées si des participants ont déjà progressé."
          : "Are you sure you want to delete this module? Any lessons with student progress will be safely archived."
      )
    )
      return;
    try {
      await api.deleteModule(moduleId);
      toast.success(fr ? "Module supprimé." : "Module deleted.");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete module");
    }
  };

  const handleReorderModule = async (modIdx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? modIdx - 1 : modIdx + 1;
    if (targetIdx < 0 || targetIdx >= modules.length) return;

    const newMods = [...modules];
    const [moved] = newMods.splice(modIdx, 1);
    newMods.splice(targetIdx, 0, moved);

    const orders = newMods.map((m, idx) => ({ id: m.id, orderIndex: idx + 1 }));
    try {
      await api.reorderModules(orders);
      setModules(newMods);
      toast.success(fr ? "Ordre des modules mis à jour." : "Module order updated.");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder modules");
    }
  };

  // ----------------------------------------------------
  // LESSON HANDLERS
  // ----------------------------------------------------
  const handleAddLesson = async () => {
    if (!activeModule) return;
    if (!newLessonTitleEn.trim()) {
      toast.error(fr ? "Veuillez entrer le titre de la leçon." : "English lesson title is required.");
      return;
    }
    try {
      await api.createLesson(activeModule.id, {
        titleEn: newLessonTitleEn.trim(),
        titleFr: newLessonTitleFr.trim() || newLessonTitleEn.trim(),
        durationMinutes: Number(newLessonDuration) || 15,
        orderIndex: (activeModule.lessons?.length || 0) + 1,
        type: "VIDEO",
        startDate: newLessonStartDate ? new Date(newLessonStartDate).toISOString() : undefined,
        endDate: newLessonEndDate ? new Date(newLessonEndDate).toISOString() : undefined,
        startAt: newLessonStartDate ? new Date(newLessonStartDate).toISOString() : undefined,
        endAt: newLessonEndDate ? new Date(newLessonEndDate).toISOString() : undefined,
      });
      toast.success(fr ? "Leçon ajoutée au module !" : "Lesson created!");
      setNewLessonTitleEn("");
      setNewLessonTitleFr("");
      setNewLessonDuration(15);
      setNewLessonStartDate("");
      setNewLessonEndDate("");
      setIsAddLessonOpen(false);
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add lesson");
    }
  };

  const handleUpdateLesson = async () => {
    if (!editingLesson) return;
    try {
      await api.updateLesson(editingLesson.id, {
        titleEn: editingLesson.titleEn,
        titleFr: editingLesson.titleFr,
        durationMinutes: Number(editingLesson.durationMinutes) || 15,
        startDate: editingLesson.startDate ? new Date(editingLesson.startDate).toISOString() : null,
        endDate: editingLesson.endDate ? new Date(editingLesson.endDate).toISOString() : null,
        startAt: editingLesson.startDate ? new Date(editingLesson.startDate).toISOString() : null,
        endAt: editingLesson.endDate ? new Date(editingLesson.endDate).toISOString() : null,
      });
      toast.success(fr ? "Leçon mise à jour !" : "Lesson updated!");
      setEditingLesson(null);
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update lesson");
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (
      !confirm(
        fr
          ? "Supprimer cette leçon ? Si des participants ont déjà progressé, elle sera archivée en toute sécurité."
          : "Delete this lesson? If student progress exists, it will be safely archived without breaking records."
      )
    )
      return;
    try {
      await api.deleteLesson(lessonId);
      toast.success(fr ? "Leçon supprimée." : "Lesson deleted.");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lesson");
    }
  };

  const handleReorderLesson = async (moduleId: string, lessonIdx: number, direction: "up" | "down") => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod || !mod.lessons) return;
    const targetIdx = direction === "up" ? lessonIdx - 1 : lessonIdx + 1;
    if (targetIdx < 0 || targetIdx >= mod.lessons.length) return;

    const newLessons = [...mod.lessons];
    const [moved] = newLessons.splice(lessonIdx, 1);
    newLessons.splice(targetIdx, 0, moved);

    const orders = newLessons.map((l, idx) => ({ id: l.id, orderIndex: idx + 1 }));
    try {
      await api.reorderLessons(orders);
      setModules((prev) =>
        prev.map((m) => (m.id === moduleId ? { ...m, lessons: newLessons } : m))
      );
      toast.success(fr ? "Ordre des leçons mis à jour." : "Lesson order updated.");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder lessons");
    }
  };

  // ----------------------------------------------------
  // VIDEO & BODY HANDLERS
  // ----------------------------------------------------
  const handleUploadVideo = async (e: React.ChangeEvent<HTMLInputElement>, lessonId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLessonId(lessonId);
      setUploadProgress(0);
      toast.info(fr ? `Téléversement de ${file.name}...` : `Uploading ${file.name}...`);

      const res = await api.uploadVideo(file, (percent) => setUploadProgress(percent));
      const targetUrl = res.url || res.storagePath;
      await api.updateLessonVideo(lessonId, { videoUrl: targetUrl });

      setVideoLinkInputs((prev) => ({ ...prev, [lessonId]: targetUrl }));
      toast.success(fr ? "Vidéo sauvegardée avec succès !" : "Video uploaded and linked successfully!");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Video upload failed");
    } finally {
      setUploadingLessonId(null);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleSaveVideoUrl = async (lessonId: string) => {
    const url = videoLinkInputs[lessonId] || "";
    setSavingVideoId(lessonId);
    try {
      await api.updateLessonVideo(lessonId, { videoUrl: url });
      toast.success(fr ? "Lien vidéo mis à jour !" : "Video URL saved successfully!");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to save video URL");
    } finally {
      setSavingVideoId(null);
    }
  };

  const handleRemoveVideo = async (lessonId: string) => {
    if (!confirm(fr ? "Supprimer la vidéo de cette leçon ?" : "Remove video from this lesson?")) return;
    setSavingVideoId(lessonId);
    try {
      await api.updateLessonVideo(lessonId, { videoUrl: "" });
      setVideoLinkInputs((prev) => ({ ...prev, [lessonId]: "" }));
      toast.success(fr ? "Vidéo retirée." : "Video removed.");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove video");
    } finally {
      setSavingVideoId(null);
    }
  };

  const handleSaveLessonBody = async (lessonId: string) => {
    setSavingBodyId(lessonId);
    try {
      await api.updateLesson(lessonId, {
        bodyEn: bodyInputsEn[lessonId] || "",
        bodyFr: bodyInputsFr[lessonId] || "",
      });
      toast.success(fr ? "Texte de cours enregistré !" : "Lesson notes saved!");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to save lesson body");
    } finally {
      setSavingBodyId(null);
    }
  };

  // ----------------------------------------------------
  // CHAPTER HANDLERS
  // ----------------------------------------------------
  const handleAddChapter = async () => {
    if (!targetChapterLessonId || !chapterTitleEn.trim()) {
      toast.error(fr ? "Titre du chapitre requis." : "Chapter title required.");
      return;
    }
    try {
      await api.createChapter(targetChapterLessonId, {
        titleEn: chapterTitleEn.trim(),
        titleFr: chapterTitleFr.trim() || chapterTitleEn.trim(),
        durationMinutes: Number(chapterDuration) || 5,
        videoUrl: chapterVideoUrl.trim() || undefined,
      });
      toast.success(fr ? "Chapitre ajouté !" : "Chapter added!");
      setChapterTitleEn("");
      setChapterTitleFr("");
      setChapterVideoUrl("");
      setIsAddChapterOpen(false);
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add chapter");
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!confirm(fr ? "Supprimer ce chapitre ?" : "Delete this chapter?")) return;
    try {
      await api.deleteChapter(chapterId);
      toast.success(fr ? "Chapitre supprimé." : "Chapter deleted.");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete chapter");
    }
  };

  // ----------------------------------------------------
  // RESOURCE HANDLERS
  // ----------------------------------------------------
  const handleUploadResourceFile = async (e: React.ChangeEvent<HTMLInputElement>, lessonId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploadingResource(lessonId);
      toast.info(fr ? `Téléversement de ${file.name}...` : `Uploading ${file.name}...`);
      const res = await api.uploadFile(file);

      await api.addResource({
        lesson_id: lessonId,
        name_en: file.name,
        name_fr: file.name,
        type: file.type.includes("pdf") ? "PDF" : "DOCUMENT",
        url: res.url,
        storage_path: res.url,
        size_kb: res.sizeKb || Math.round(file.size / 1024),
        downloadable: true,
      });

      toast.success(fr ? "Document attaché avec succès !" : "Resource file attached!");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setIsUploadingResource(null);
      e.target.value = "";
    }
  };

  const handleAddResourceUrl = async (lessonId: string) => {
    if (!newResourceNameEn.trim() || !newResourceUrl.trim()) {
      toast.error(fr ? "Nom et URL requis." : "Document name and URL required.");
      return;
    }
    try {
      await api.addResource({
        lesson_id: lessonId,
        name_en: newResourceNameEn.trim(),
        name_fr: newResourceNameFr.trim() || newResourceNameEn.trim(),
        type: "LINK",
        url: newResourceUrl.trim(),
        size_kb: 0,
        downloadable: true,
      });
      toast.success(fr ? "Lien de ressource ajouté !" : "Resource link added!");
      setNewResourceNameEn("");
      setNewResourceNameFr("");
      setNewResourceUrl("");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add resource");
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm(fr ? "Supprimer cette ressource ?" : "Delete this resource?")) return;
    try {
      await api.deleteResource(resourceId);
      toast.success(fr ? "Ressource supprimée." : "Resource deleted.");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete resource");
    }
  };

  // ----------------------------------------------------
  // QUIZ & QUESTION HANDLERS
  // ----------------------------------------------------
  const handleCreateQuiz = async () => {
    if (!targetQuizLessonId || !quizTitleEn.trim()) {
      toast.error(fr ? "Titre du quiz requis." : "Quiz title is required.");
      return;
    }
    try {
      await api.createQuiz({
        lesson_id: targetQuizLessonId,
        title_en: quizTitleEn.trim(),
        title_fr: quizTitleFr.trim() || quizTitleEn.trim(),
        passing_score: Number(quizPassingScore) || 70,
        max_attempts: Number(quizMaxAttempts) || 3,
      });
      toast.success(fr ? "Quiz créé !" : "Quiz created!");
      setQuizTitleEn("");
      setQuizTitleFr("");
      setIsAddQuizOpen(false);
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to create quiz");
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (
      !confirm(
        fr
          ? "Supprimer ce quiz ? S'il possède des tentatives étudiantes, il sera archivé plutôt qu'effacé."
          : "Delete this quiz? If student attempts exist, it will be safely archived."
      )
    )
      return;
    try {
      await api.deleteQuiz(quizId);
      toast.success(fr ? "Quiz supprimé/archivé." : "Quiz deleted/archived.");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete quiz");
    }
  };

  const handleAddQuestion = async () => {
    if (!targetQuestionQuizId || !questionTextEn.trim()) {
      toast.error(fr ? "Énoncé de question requis." : "Question text is required.");
      return;
    }
    const validOptions = questionOptions.filter((o) => o.textEn.trim());
    if (validOptions.length < 2) {
      toast.error(fr ? "Au moins 2 options sont requises." : "At least 2 options are required.");
      return;
    }
    if (!validOptions.some((o) => o.isCorrect)) {
      toast.error(fr ? "Veuillez désigner au moins une bonne réponse." : "Please mark at least one correct option.");
      return;
    }

    try {
      await api.addQuizQuestion(targetQuestionQuizId, {
        question_en: questionTextEn.trim(),
        question_fr: questionTextFr.trim() || questionTextEn.trim(),
        explanation_en: questionExplanationEn.trim() || null,
        explanation_fr: questionExplanationFr.trim() || null,
        points: Number(questionPoints) || 1,
        options: validOptions.map((o, idx) => ({
          option_en: o.textEn.trim(),
          option_fr: o.textFr.trim() || o.textEn.trim(),
          is_correct: o.isCorrect,
          order_index: idx + 1,
        })),
      });
      toast.success(fr ? "Question ajoutée au quiz !" : "Question added to quiz!");
      setQuestionTextEn("");
      setQuestionTextFr("");
      setQuestionExplanationEn("");
      setQuestionExplanationFr("");
      setQuestionOptions([
        { textEn: "", textFr: "", isCorrect: true },
        { textEn: "", textFr: "", isCorrect: false },
      ]);
      setIsAddQuestionOpen(false);
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to add question");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm(fr ? "Supprimer cette question ?" : "Delete this question?")) return;
    try {
      await api.deleteQuizQuestion(questionId);
      toast.success(fr ? "Question supprimée." : "Question deleted.");
      await fetchCurriculum();
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete question");
    }
  };

  const setTab = (lessonId: string, tab: LessonTab) => {
    setActiveLessonTab((prev) => ({ ...prev, [lessonId]: tab }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative flex flex-col w-full max-w-6xl max-h-[92vh] rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <BookOpen className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-lg font-bold text-foreground">
                  {fr ? "Éditer le Curriculum de la Cohorte" : "Edit Cohort Curriculum & Content"}
                </h1>
                <Badge variant="outline" className="text-xs bg-background">
                  {cohort.status || "ACTIVE"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-semibold text-foreground">{L(cohort.name)}</span>
                {cohort.programTitle && ` • ${typeof cohort.programTitle === "object" ? L(cohort.programTitle) : cohort.programTitle}`}
                {" • "}
                {modules.length} {fr ? "modules au total" : "modules total"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={fetchCurriculum}
              disabled={loading}
              className="gap-1.5 text-xs h-8"
            >
              <Clock className={cn("size-3.5", loading && "animate-spin")} />
              {fr ? "Actualiser" : "Refresh"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="rounded-full size-8 hover:bg-muted"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex flex-1 overflow-hidden min-h-[540px]">
          {/* LEFT SIDEBAR: MODULE LIST */}
          <div className="w-80 border-r border-border bg-muted/10 flex flex-col shrink-0">
            <div className="p-3 border-b border-border/80 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5" />
                {fr ? "Modules du cours" : "Course Modules"}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsAddModuleOpen(true)}
                className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
              >
                <Plus className="size-3.5" />
                {fr ? "Nouveau" : "Add"}
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {loading && modules.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground text-xs gap-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  {fr ? "Chargement des modules..." : "Loading modules..."}
                </div>
              ) : modules.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <p>{fr ? "Aucun module configuré." : "No modules created yet."}</p>
                  <Button
                    size="sm"
                    onClick={() => setIsAddModuleOpen(true)}
                    className="mt-3 gap-1.5 text-xs"
                  >
                    <Plus className="size-3.5" />
                    {fr ? "Ajouter un module" : "Add First Module"}
                  </Button>
                </div>
              ) : (
                modules.map((m, idx) => {
                  const isSelected = m.id === selectedModuleId;
                  const lessonCount = m.lessons?.length || 0;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedModuleId(m.id)}
                      className={cn(
                        "group relative flex items-start justify-between rounded-xl p-3 text-left transition-all cursor-pointer border",
                        isSelected
                          ? "bg-primary/10 border-primary/40 text-foreground font-medium shadow-xs"
                          : "bg-background/80 border-border/60 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                          <span className="font-semibold text-primary">#{idx + 1}</span>
                          <span>•</span>
                          <span>
                            {lessonCount} {fr ? "leçon(s)" : "lesson(s)"}
                          </span>
                        </div>
                        <p className="text-sm font-semibold truncate leading-tight">
                          {typeof m.title === "object" ? L(m.title) : m.titleEn || m.title}
                        </p>
                      </div>

                      {/* Reorder and action controls on hover / active */}
                      <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReorderModule(idx, "up");
                          }}
                          className="size-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Move module up"
                        >
                          <ArrowUp className="size-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={idx === modules.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReorderModule(idx, "down");
                          }}
                          className="size-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Move module down"
                        >
                          <ArrowDown className="size-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingModule({
                              id: m.id,
                              titleEn: typeof m.title === "object" ? m.title.en : m.titleEn || m.title,
                              titleFr: typeof m.title === "object" ? m.title.fr : m.titleFr || m.title,
                            });
                          }}
                          className="size-6 p-0 text-muted-foreground hover:text-primary"
                          title="Edit module name"
                        >
                          <Edit3 className="size-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(m.id);
                          }}
                          className="size-6 p-0 text-muted-foreground hover:text-destructive"
                          title="Delete module"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Add Module button */}
            <div className="p-3 border-t border-border bg-card">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddModuleOpen(true)}
                className="w-full gap-2 text-xs font-semibold border-dashed hover:border-primary/50"
              >
                <Plus className="size-3.5 text-primary" />
                {fr ? "Ajouter un nouveau module" : "Add New Module"}
              </Button>
            </div>
          </div>

          {/* RIGHT MAIN PANEL: ACTIVE MODULE LESSONS & CONTENT */}
          <div className="flex-1 flex flex-col bg-background overflow-y-auto">
            {activeModule ? (
              <div className="p-6 space-y-6">
                {/* Active Module Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-muted/20 border border-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
                        Module{" "}
                        {modules.findIndex((m) => m.id === activeModule.id) + 1}
                      </span>
                      <h2 className="text-base font-bold text-foreground">
                        {typeof activeModule.title === "object"
                          ? L(activeModule.title)
                          : activeModule.titleEn || activeModule.title}
                      </h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fr
                        ? "Gérez les leçons, téléversez les vidéos privées, ajoutez des quiz et documents pédagogiques."
                        : "Progressively build lessons, upload high-definition videos, attach quizzes, and upload lesson PDFs."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => setIsAddLessonOpen(true)}
                      className="gap-1.5 text-xs font-semibold shadow-xs"
                    >
                      <Plus className="size-3.5" />
                      {fr ? "Ajouter une leçon" : "Add Lesson"}
                    </Button>
                  </div>
                </div>

                {/* Lessons List */}
                <div className="space-y-4">
                  {!activeModule.lessons || activeModule.lessons.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-12 text-center bg-muted/5">
                      <FileText className="size-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        {fr ? "Aucune leçon dans ce module." : "No lessons in this module yet."}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {fr
                          ? "Créez vos leçons dès maintenant. Vous pourrez continuer d'ajouter ou perfectionner les vidéos et quiz à tout moment."
                          : "Create lessons now to enroll students. You can continuously upload videos, documents, and quizzes as the cohort progresses."}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setIsAddLessonOpen(true)}
                        className="mt-4 gap-2 text-xs"
                      >
                        <Plus className="size-3.5" />
                        {fr ? "Créer la première leçon" : "Create First Lesson"}
                      </Button>
                    </div>
                  ) : (
                    activeModule.lessons.map((lesson: any, lIdx: number) => {
                      const isExpanded = expandedLessonId === lesson.id;
                      const tab = activeLessonTab[lesson.id] || "video";
                      const hasVideo = !!lesson.videoUrl;
                      const chapterCount = lesson.chapters?.length || 0;
                      const resourceCount = lesson.resources?.length || 0;
                      const hasQuiz = !!lesson.quiz;

                      return (
                        <div
                          key={lesson.id}
                          className="rounded-xl border border-border bg-card shadow-xs overflow-hidden transition-all"
                        >
                          {/* Lesson Summary Bar */}
                          <div
                            onClick={() =>
                              setExpandedLessonId(isExpanded ? null : lesson.id)
                            }
                            className={cn(
                              "flex flex-wrap items-center justify-between p-4 cursor-pointer select-none transition-colors",
                              isExpanded ? "bg-muted/40 border-b border-border" : "hover:bg-muted/20"
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex size-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground shrink-0">
                                {modules.findIndex((m) => m.id === activeModule.id) + 1}.{lIdx + 1}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-sm text-foreground truncate">
                                    {typeof lesson.title === "object"
                                      ? L(lesson.title)
                                      : lesson.titleEn || lesson.title}
                                  </h3>
                                  {hasVideo ? (
                                    <Badge
                                      variant="default"
                                      className="text-[10px] h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    >
                                      <Video className="size-2.5 mr-1" />
                                      {fr ? "Vidéo prête" : "Video Ready"}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] h-4 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                    >
                                      {fr ? "Pas de vidéo" : "No Video"}
                                    </Badge>
                                  )}
                                  {hasQuiz && (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] h-4 gap-1"
                                    >
                                      <HelpCircle className="size-2.5" />
                                      Quiz ({lesson.quiz.questions?.length || 0})
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground mt-0.5">
                                  <span>{lesson.durationMinutes || 15} mins</span>
                                  <span>•</span>
                                  <span>
                                    {chapterCount} {fr ? "chapitre(s)" : "chapter(s)"}
                                  </span>
                                  <span>•</span>
                                  <span>
                                    {resourceCount} {fr ? "ressource(s)" : "resource(s)"}
                                  </span>
                                  {(lesson.startAt || lesson.startDate || lesson.endAt || lesson.endDate) && (
                                    <>
                                      <span>•</span>
                                      <span className="inline-flex items-center gap-1 font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[11px]">
                                        <Calendar className="size-3" />
                                        {lesson.startAt || lesson.startDate
                                          ? new Date(lesson.startAt || lesson.startDate).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric" })
                                          : "..."}
                                        {" → "}
                                        {lesson.endAt || lesson.endDate
                                          ? new Date(lesson.endAt || lesson.endDate).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric" })
                                          : "..."}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={lIdx === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReorderLesson(activeModule.id, lIdx, "up");
                                }}
                                className="size-7 text-muted-foreground hover:text-foreground"
                                title="Move up"
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={lIdx === activeModule.lessons.length - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReorderLesson(activeModule.id, lIdx, "down");
                                }}
                                className="size-7 text-muted-foreground hover:text-foreground"
                                title="Move down"
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLesson({
                                    id: lesson.id,
                                    titleEn:
                                      typeof lesson.title === "object"
                                        ? lesson.title.en
                                        : lesson.titleEn || lesson.title,
                                    titleFr:
                                      typeof lesson.title === "object"
                                        ? lesson.title.fr
                                        : lesson.titleFr || lesson.title,
                                    durationMinutes: lesson.durationMinutes || 15,
                                    startDate: lesson.startDate || lesson.startAt
                                      ? new Date(lesson.startDate || lesson.startAt).toISOString().slice(0, 16)
                                      : "",
                                    endDate: lesson.endDate || lesson.endAt
                                      ? new Date(lesson.endDate || lesson.endAt).toISOString().slice(0, 16)
                                      : "",
                                  });
                                }}
                                className="size-7 text-muted-foreground hover:text-primary"
                                title="Edit lesson details"
                              >
                                <Edit3 className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteLesson(lesson.id);
                                }}
                                className="size-7 text-muted-foreground hover:text-destructive"
                                title="Delete lesson"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                              <div className="ml-1 pl-1 border-l border-border">
                                {isExpanded ? (
                                  <ChevronUp className="size-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="size-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Lesson Drawer */}
                          {isExpanded && (
                            <div className="p-5 space-y-5 bg-background">
                              {/* Sub-tabs: Video & Body, Chapters, Documents, Quiz */}
                              <div className="flex items-center gap-2 border-b border-border pb-2">
                                <Button
                                  size="sm"
                                  variant={tab === "video" ? "default" : "ghost"}
                                  onClick={() => setTab(lesson.id, "video")}
                                  className="h-8 text-xs gap-1.5"
                                >
                                  <Video className="size-3.5" />
                                  {fr ? "Vidéo & Contenu" : "Video & Notes"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={tab === "chapters" ? "default" : "ghost"}
                                  onClick={() => setTab(lesson.id, "chapters")}
                                  className="h-8 text-xs gap-1.5"
                                >
                                  <Clock className="size-3.5" />
                                  {fr ? `Chapitres (${chapterCount})` : `Chapters (${chapterCount})`}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={tab === "resources" ? "default" : "ghost"}
                                  onClick={() => setTab(lesson.id, "resources")}
                                  className="h-8 text-xs gap-1.5"
                                >
                                  <Paperclip className="size-3.5" />
                                  {fr ? `Documents (${resourceCount})` : `PDFs & Docs (${resourceCount})`}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={tab === "quiz" ? "default" : "ghost"}
                                  onClick={() => setTab(lesson.id, "quiz")}
                                  className="h-8 text-xs gap-1.5"
                                >
                                  <HelpCircle className="size-3.5" />
                                  {fr
                                    ? `Quiz ${hasQuiz ? `(${lesson.quiz.questions?.length || 0})` : ""}`
                                    : `Quiz & Questions ${hasQuiz ? `(${lesson.quiz.questions?.length || 0})` : ""}`}
                                </Button>
                              </div>

                              {/* TAB 1: VIDEO & LESSON NOTES */}
                              {tab === "video" && (
                                <div className="grid gap-6 md:grid-cols-2">
                                  {/* Left: Video Player & Source */}
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <Video className="size-3.5 text-primary" />
                                        {fr ? "Vidéo de la leçon" : "Lesson Video"}
                                      </label>
                                      {lesson.videoUrl && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleRemoveVideo(lesson.id)}
                                          disabled={savingVideoId === lesson.id}
                                          className="h-6 text-[11px] text-destructive hover:bg-destructive/10"
                                        >
                                          {fr ? "Supprimer la vidéo" : "Remove Video"}
                                        </Button>
                                      )}
                                    </div>

                                    {/* Video Player Preview */}
                                    <div className="rounded-xl overflow-hidden border border-border bg-black/90 aspect-video flex items-center justify-center">
                                      {lesson.videoUrl ? (
                                        <LessonVideoPlayer
                                          url={lesson.videoUrl}
                                          title={lesson.titleEn || "Lesson Video"}
                                          className="w-full h-full"
                                        />
                                      ) : (
                                        <div className="text-center p-4">
                                          <Video className="size-8 mx-auto text-muted-foreground/50 mb-2" />
                                          <p className="text-xs text-muted-foreground font-medium">
                                            {fr ? "Aucune vidéo attachée." : "No video uploaded yet."}
                                          </p>
                                          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                                            {fr
                                              ? "Téléversez un fichier vidéo ou collez un lien ci-dessous."
                                              : "Upload an MP4 or paste a video link below."}
                                          </p>
                                        </div>
                                      )}
                                    </div>

                                    {/* Upload / Link inputs */}
                                    <div className="space-y-2 pt-1">
                                      <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                          <Input
                                            placeholder={
                                              fr
                                                ? "Coller une URL vidéo (Supabase, YouTube, Vimeo...)"
                                                : "Paste video URL (Supabase, YouTube, Vimeo...)"
                                            }
                                            value={videoLinkInputs[lesson.id] || ""}
                                            onChange={(e) =>
                                              setVideoLinkInputs((prev) => ({
                                                ...prev,
                                                [lesson.id]: e.target.value,
                                              }))
                                            }
                                            className="text-xs h-8 pr-16"
                                          />
                                          <Button
                                            size="sm"
                                            onClick={() => handleSaveVideoUrl(lesson.id)}
                                            disabled={savingVideoId === lesson.id}
                                            className="absolute right-1 top-1 h-6 px-2 text-[11px]"
                                          >
                                            {savingVideoId === lesson.id ? (
                                              <Loader2 className="size-3 animate-spin" />
                                            ) : (
                                              <Check className="size-3" />
                                            )}
                                          </Button>
                                        </div>

                                        <label className="cursor-pointer">
                                          <input
                                            type="file"
                                            accept="video/*,.mp4,.mov,.webm"
                                            onChange={(e) => handleUploadVideo(e, lesson.id)}
                                            className="hidden"
                                            disabled={uploadingLessonId === lesson.id}
                                          />
                                          <div
                                            className={cn(
                                              "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold shadow-xs transition-colors",
                                              uploadingLessonId === lesson.id
                                                ? "bg-muted text-muted-foreground border-border cursor-not-allowed"
                                                : "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                                            )}
                                          >
                                            {uploadingLessonId === lesson.id ? (
                                              <>
                                                <Loader2 className="size-3 animate-spin" />
                                                <span>{uploadProgress}%</span>
                                              </>
                                            ) : (
                                              <>
                                                <UploadCloud className="size-3.5" />
                                                <span>{fr ? "Téléverser MP4" : "Upload MP4"}</span>
                                              </>
                                            )}
                                          </div>
                                        </label>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Notes / Transcriptions (EN & FR) */}
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                        <FileText className="size-3.5 text-primary" />
                                        {fr ? "Notes & Transcription du cours" : "Lesson Notes & Body Text"}
                                      </label>
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveLessonBody(lesson.id)}
                                        disabled={savingBodyId === lesson.id}
                                        className="h-6 text-xs gap-1"
                                      >
                                        {savingBodyId === lesson.id ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <Check className="size-3" />
                                        )}
                                        {fr ? "Enregistrer" : "Save Notes"}
                                      </Button>
                                    </div>

                                    <div className="space-y-2">
                                      <div>
                                        <span className="text-[11px] font-medium text-muted-foreground">
                                          English Notes / Body
                                        </span>
                                        <textarea
                                          rows={4}
                                          value={bodyInputsEn[lesson.id] || ""}
                                          onChange={(e) =>
                                            setBodyInputsEn((prev) => ({
                                              ...prev,
                                              [lesson.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Detailed curriculum notes, instructions or transcript (English)..."
                                          className="w-full text-xs rounded-lg border border-border bg-background p-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                      </div>

                                      <div>
                                        <span className="text-[11px] font-medium text-muted-foreground">
                                          Notes / Contenu en Français
                                        </span>
                                        <textarea
                                          rows={4}
                                          value={bodyInputsFr[lesson.id] || ""}
                                          onChange={(e) =>
                                            setBodyInputsFr((prev) => ({
                                              ...prev,
                                              [lesson.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Notes pédagogiques, transcriptions ou instructions (Français)..."
                                          className="w-full text-xs rounded-lg border border-border bg-background p-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* TAB 2: CHAPTERS */}
                              {tab === "chapters" && (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">
                                      {fr
                                        ? "Divisez cette leçon en chapitres ou parties horodatées pour vos apprenants."
                                        : "Organize this lesson into sub-chapters or timestamped parts for better student navigation."}
                                    </p>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setTargetChapterLessonId(lesson.id);
                                        setIsAddChapterOpen(true);
                                      }}
                                      className="gap-1 text-xs h-7"
                                    >
                                      <Plus className="size-3" />
                                      {fr ? "Ajouter un chapitre" : "Add Chapter"}
                                    </Button>
                                  </div>

                                  {!lesson.chapters || lesson.chapters.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                      <Clock className="size-6 mx-auto mb-1 text-muted-foreground/60" />
                                      {fr
                                        ? "Aucun chapitre défini pour cette leçon."
                                        : "No chapters created for this lesson yet."}
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-border border rounded-xl overflow-hidden bg-muted/5">
                                      {lesson.chapters.map((chap: any, cIdx: number) => (
                                        <div
                                          key={chap.id}
                                          className="flex items-center justify-between p-3 text-xs hover:bg-muted/30"
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="font-semibold text-primary">
                                              #{cIdx + 1}
                                            </span>
                                            <div>
                                              <p className="font-medium text-foreground truncate">
                                                {chap.titleEn}
                                                {chap.titleFr && chap.titleFr !== chap.titleEn && (
                                                  <span className="text-muted-foreground ml-1.5">
                                                    ({chap.titleFr})
                                                  </span>
                                                )}
                                              </p>
                                              <p className="text-[11px] text-muted-foreground">
                                                {chap.durationMinutes} mins
                                                {chap.videoUrl && " • Video linked"}
                                              </p>
                                            </div>
                                          </div>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => handleDeleteChapter(chap.id)}
                                            className="size-6 text-muted-foreground hover:text-destructive"
                                          >
                                            <Trash2 className="size-3" />
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* TAB 3: DOCUMENTS & PDFS */}
                              {tab === "resources" && (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs text-muted-foreground">
                                      {fr
                                        ? "Attachez des supports PDF, diapositives, documents Word ou liens utiles."
                                        : "Attach downloadable PDFs, worksheets, slides, or external reference links."}
                                    </p>
                                    <label className="cursor-pointer">
                                      <input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip"
                                        onChange={(e) => handleUploadResourceFile(e, lesson.id)}
                                        className="hidden"
                                        disabled={isUploadingResource === lesson.id}
                                      />
                                      <div className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg border border-primary bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 shadow-xs cursor-pointer">
                                        {isUploadingResource === lesson.id ? (
                                          <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                          <UploadCloud className="size-3" />
                                        )}
                                        <span>{fr ? "Téléverser un PDF/Fichier" : "Upload PDF/File"}</span>
                                      </div>
                                    </label>
                                  </div>

                                  {/* Resources list */}
                                  {!lesson.resources || lesson.resources.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                      <Paperclip className="size-6 mx-auto mb-1 text-muted-foreground/60" />
                                      {fr
                                        ? "Aucun document joint à cette leçon."
                                        : "No documents attached to this lesson."}
                                    </div>
                                  ) : (
                                    <div className="divide-y divide-border border rounded-xl overflow-hidden bg-muted/5">
                                      {lesson.resources.map((res: any) => (
                                        <div
                                          key={res.id}
                                          className="flex items-center justify-between p-3 text-xs hover:bg-muted/30"
                                        >
                                          <div className="flex items-center gap-2.5 min-w-0">
                                            <FileCheck className="size-4 text-primary shrink-0" />
                                            <div>
                                              <p className="font-medium text-foreground truncate">
                                                {res.nameEn}
                                              </p>
                                              <p className="text-[11px] text-muted-foreground">
                                                {res.type} • {res.sizeKb} KB
                                              </p>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {res.url && (
                                              <a
                                                href={resolveMediaUrl(res.url)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center size-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                                                title="View document"
                                              >
                                                <ExternalLink className="size-3.5" />
                                              </a>
                                            )}
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => handleDeleteResource(res.id)}
                                              className="size-7 text-muted-foreground hover:text-destructive"
                                            >
                                              <Trash2 className="size-3.5" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Direct URL attachment */}
                                  <div className="pt-2 border-t border-border flex items-center gap-2">
                                    <Input
                                      placeholder="Document title (English)..."
                                      value={newResourceNameEn}
                                      onChange={(e) => setNewResourceNameEn(e.target.value)}
                                      className="text-xs h-8 max-w-xs"
                                    />
                                    <Input
                                      placeholder="https://example.com/document.pdf"
                                      value={newResourceUrl}
                                      onChange={(e) => setNewResourceUrl(e.target.value)}
                                      className="text-xs h-8 flex-1"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleAddResourceUrl(lesson.id)}
                                      className="h-8 text-xs gap-1"
                                    >
                                      <Plus className="size-3" />
                                      {fr ? "Ajouter lien" : "Add Link"}
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* TAB 4: QUIZ & QUESTIONS */}
                              {tab === "quiz" && (
                                <div className="space-y-4">
                                  {!lesson.quiz ? (
                                    <div className="rounded-xl border border-dashed border-border p-8 text-center bg-muted/5">
                                      <HelpCircle className="size-8 mx-auto text-muted-foreground/60 mb-2" />
                                      <p className="text-sm font-semibold text-foreground">
                                        {fr
                                          ? "Aucun quiz rattaché à cette leçon."
                                          : "No quiz attached to this lesson."}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                                        {fr
                                          ? "Les quiz permettent de valider la compréhension des participants avant de passer à la suite."
                                          : "Create an interactive quiz to evaluate students on this lesson's key concepts."}
                                      </p>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setTargetQuizLessonId(lesson.id);
                                          setQuizTitleEn(`${lesson.titleEn || "Lesson"} Quiz`);
                                          setQuizTitleFr(
                                            `${lesson.titleFr || lesson.titleEn || "Leçon"} - Quiz`
                                          );
                                          setIsAddQuizOpen(true);
                                        }}
                                        className="mt-4 gap-1.5 text-xs font-semibold"
                                      >
                                        <Plus className="size-3.5" />
                                        {fr ? "Créer un Quiz pour cette leçon" : "Create Quiz"}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-4">
                                      {/* Quiz Info Header */}
                                      <div className="flex flex-wrap items-center justify-between p-4 rounded-xl border border-border bg-muted/20">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-foreground">
                                              {lesson.quiz.titleEn}
                                            </h4>
                                            <Badge variant="outline" className="text-[11px] bg-background">
                                              {fr ? "Seuil:" : "Pass score:"} {lesson.quiz.passingScore}%
                                            </Badge>
                                            <Badge variant="outline" className="text-[11px] bg-background">
                                              {fr ? "Tentatives max:" : "Max attempts:"}{" "}
                                              {lesson.quiz.maxAttempts || 3}
                                            </Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground mt-0.5">
                                            {lesson.quiz.questions?.length || 0}{" "}
                                            {fr ? "question(s) active(s)" : "active question(s)"}
                                          </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setTargetQuestionQuizId(lesson.quiz.id);
                                              setIsAddQuestionOpen(true);
                                            }}
                                            className="h-7 text-xs gap-1 font-semibold"
                                          >
                                            <Plus className="size-3" />
                                            {fr ? "Ajouter une question" : "Add Question"}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDeleteQuiz(lesson.quiz.id)}
                                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                          >
                                            <Trash2 className="size-3 mr-1" />
                                            {fr ? "Supprimer le quiz" : "Delete Quiz"}
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Questions List */}
                                      {!lesson.quiz.questions || lesson.quiz.questions.length === 0 ? (
                                        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                                          {fr
                                            ? "Ce quiz n'a pas encore de questions. Cliquez sur 'Ajouter une question'."
                                            : "This quiz doesn't have any questions yet. Click 'Add Question' above."}
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          {lesson.quiz.questions.map((q: any, qIdx: number) => (
                                            <div
                                              key={q.id}
                                              className="p-3.5 rounded-xl border border-border bg-card shadow-2xs space-y-2"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2">
                                                  <span className="size-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                    Q{qIdx + 1}
                                                  </span>
                                                  <div>
                                                    <p className="text-xs font-semibold text-foreground">
                                                      {q.questionEn}
                                                    </p>
                                                    {q.questionFr && q.questionFr !== q.questionEn && (
                                                      <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        {q.questionFr}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  onClick={() => handleDeleteQuestion(q.id)}
                                                  className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                                                >
                                                  <Trash2 className="size-3" />
                                                </Button>
                                              </div>

                                              {/* Options */}
                                              <div className="grid gap-1.5 sm:grid-cols-2 pl-7 pt-1">
                                                {q.options?.map((opt: any, optIdx: number) => (
                                                  <div
                                                    key={opt.id || optIdx}
                                                    className={cn(
                                                      "flex items-center gap-2 p-2 rounded-lg text-xs border",
                                                      opt.isCorrect
                                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-medium"
                                                        : "bg-muted/30 border-border text-muted-foreground"
                                                    )}
                                                  >
                                                    {opt.isCorrect ? (
                                                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                    ) : (
                                                      <div className="size-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                                                    )}
                                                    <span className="truncate">{opt.optionEn}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Layers className="size-10 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {fr ? "Sélectionnez ou créez un module" : "Select or create a module"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DIALOG: ADD MODULE */}
      {/* ======================================================== */}
      {isAddModuleOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-display text-base font-bold text-foreground">
              {fr ? "Ajouter un nouveau module" : "Add New Module"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre en anglais *" : "English Title *"}
                </label>
                <Input
                  placeholder="e.g. Module 2: Advanced Clinical Concepts"
                  value={newModuleTitleEn}
                  onChange={(e) => setNewModuleTitleEn(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre en français" : "French Title"}
                </label>
                <Input
                  placeholder="e.g. Module 2 : Notions cliniques avancées"
                  value={newModuleTitleFr}
                  onChange={(e) => setNewModuleTitleFr(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddModuleOpen(false)}
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleAddModule}>
                {fr ? "Créer le module" : "Create Module"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: EDIT MODULE */}
      {/* ======================================================== */}
      {editingModule && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-display text-base font-bold text-foreground">
              {fr ? "Renommer le module" : "Edit Module"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre en anglais" : "English Title"}
                </label>
                <Input
                  value={editingModule.titleEn || ""}
                  onChange={(e) =>
                    setEditingModule((prev: any) => ({
                      ...prev,
                      titleEn: e.target.value,
                    }))
                  }
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre en français" : "French Title"}
                </label>
                <Input
                  value={editingModule.titleFr || ""}
                  onChange={(e) =>
                    setEditingModule((prev: any) => ({
                      ...prev,
                      titleFr: e.target.value,
                    }))
                  }
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingModule(null)}
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleUpdateModule}>
                {fr ? "Enregistrer" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: ADD LESSON */}
      {/* ======================================================== */}
      {isAddLessonOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-display text-base font-bold text-foreground">
              {fr ? "Ajouter une leçon au module" : "Add New Lesson"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre de la leçon (Anglais) *" : "Lesson Title (English) *"}
                </label>
                <Input
                  placeholder="e.g. Introduction & Methodology"
                  value={newLessonTitleEn}
                  onChange={(e) => setNewLessonTitleEn(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre de la leçon (Français)" : "Lesson Title (French)"}
                </label>
                <Input
                  placeholder="e.g. Introduction et méthodologie"
                  value={newLessonTitleFr}
                  onChange={(e) => setNewLessonTitleFr(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Durée estimée (minutes)" : "Estimated Duration (minutes)"}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={newLessonDuration}
                  onChange={(e) => setNewLessonDuration(Number(e.target.value))}
                  className="mt-1 text-xs"
                />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Calendar className="size-3.5 text-primary" />
                  <span>{fr ? "Période d'accès de la leçon (Sécurisé)" : "Lesson Access Window (Server-Enforced)"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {fr
                    ? "Les étudiants pourront accéder à cette leçon UNIQUEMENT entre ces deux dates."
                    : "Participants can access this lesson ONLY within this duration window."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">
                      {fr ? "Date de début" : "Start Date (Available From)"}
                    </label>
                    <Input
                      type="datetime-local"
                      value={newLessonStartDate}
                      onChange={(e) => setNewLessonStartDate(e.target.value)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">
                      {fr ? "Date de fin" : "End Date (Access Closes)"}
                    </label>
                    <Input
                      type="datetime-local"
                      value={newLessonEndDate}
                      onChange={(e) => setNewLessonEndDate(e.target.value)}
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddLessonOpen(false)}
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleAddLesson}>
                {fr ? "Créer la leçon" : "Create Lesson"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: EDIT LESSON */}
      {/* ======================================================== */}
      {editingLesson && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-display text-base font-bold text-foreground">
              {fr ? "Modifier les détails de la leçon" : "Edit Lesson Details"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre en anglais" : "English Title"}
                </label>
                <Input
                  value={editingLesson.titleEn || ""}
                  onChange={(e) =>
                    setEditingLesson((prev: any) => ({
                      ...prev,
                      titleEn: e.target.value,
                    }))
                  }
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre en français" : "French Title"}
                </label>
                <Input
                  value={editingLesson.titleFr || ""}
                  onChange={(e) =>
                    setEditingLesson((prev: any) => ({
                      ...prev,
                      titleFr: e.target.value,
                    }))
                  }
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Durée (minutes)" : "Duration (minutes)"}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={editingLesson.durationMinutes || 15}
                  onChange={(e) =>
                    setEditingLesson((prev: any) => ({
                      ...prev,
                      durationMinutes: Number(e.target.value),
                    }))
                  }
                  className="mt-1 text-xs"
                />
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Calendar className="size-3.5 text-primary" />
                  <span>{fr ? "Période d'accès de la leçon (Sécurisé)" : "Lesson Access Window (Server-Enforced)"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {fr
                    ? "Les étudiants pourront accéder à cette leçon UNIQUEMENT entre ces deux dates."
                    : "Participants can access this lesson ONLY within this duration window."}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">
                      {fr ? "Date de début" : "Start Date (Available From)"}
                    </label>
                    <Input
                      type="datetime-local"
                      value={editingLesson.startDate || ""}
                      onChange={(e) =>
                        setEditingLesson((prev: any) => ({
                          ...prev,
                          startDate: e.target.value,
                        }))
                      }
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground">
                      {fr ? "Date de fin" : "End Date (Access Closes)"}
                    </label>
                    <Input
                      type="datetime-local"
                      value={editingLesson.endDate || ""}
                      onChange={(e) =>
                        setEditingLesson((prev: any) => ({
                          ...prev,
                          endDate: e.target.value,
                        }))
                      }
                      className="mt-1 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingLesson(null)}
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleUpdateLesson}>
                {fr ? "Enregistrer" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: ADD CHAPTER */}
      {/* ======================================================== */}
      {isAddChapterOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-display text-base font-bold text-foreground">
              {fr ? "Ajouter un chapitre" : "Add Chapter"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre (Anglais) *" : "Chapter Title (English) *"}
                </label>
                <Input
                  placeholder="e.g. Part 1: Initial Setup"
                  value={chapterTitleEn}
                  onChange={(e) => setChapterTitleEn(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre (Français)" : "Chapter Title (French)"}
                </label>
                <Input
                  placeholder="e.g. Partie 1 : Configuration initiale"
                  value={chapterTitleFr}
                  onChange={(e) => setChapterTitleFr(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Durée (minutes)" : "Duration (minutes)"}
                </label>
                <Input
                  type="number"
                  min={1}
                  value={chapterDuration}
                  onChange={(e) => setChapterDuration(Number(e.target.value))}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "URL spécifique (optionnel)" : "Chapter Video URL (optional)"}
                </label>
                <Input
                  placeholder="https://..."
                  value={chapterVideoUrl}
                  onChange={(e) => setChapterVideoUrl(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddChapterOpen(false)}
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleAddChapter}>
                {fr ? "Ajouter le chapitre" : "Add Chapter"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: CREATE QUIZ */}
      {/* ======================================================== */}
      {isAddQuizOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="font-display text-base font-bold text-foreground">
              {fr ? "Créer un Quiz pour cette leçon" : "Create Lesson Quiz"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre du Quiz (Anglais) *" : "Quiz Title (English) *"}
                </label>
                <Input
                  value={quizTitleEn}
                  onChange={(e) => setQuizTitleEn(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Titre du Quiz (Français)" : "Quiz Title (French)"}
                </label>
                <Input
                  value={quizTitleFr}
                  onChange={(e) => setQuizTitleFr(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    {fr ? "Seuil de réussite (%)" : "Passing Score (%)"}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={quizPassingScore}
                    onChange={(e) => setQuizPassingScore(Number(e.target.value))}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">
                    {fr ? "Tentatives permises" : "Max Attempts"}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={quizMaxAttempts}
                    onChange={(e) => setQuizMaxAttempts(Number(e.target.value))}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddQuizOpen(false)}
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleCreateQuiz}>
                {fr ? "Créer le Quiz" : "Create Quiz"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DIALOG: ADD QUESTION */}
      {/* ======================================================== */}
      {isAddQuestionOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-base font-bold text-foreground">
              {fr ? "Ajouter une question au Quiz" : "Add Question to Quiz"}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Énoncé de la question (Anglais) *" : "Question Text (English) *"}
                </label>
                <textarea
                  rows={2}
                  value={questionTextEn}
                  onChange={(e) => setQuestionTextEn(e.target.value)}
                  placeholder="What is the primary indicator of...?"
                  className="w-full mt-1 text-xs rounded-lg border border-border bg-background p-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Énoncé de la question (Français)" : "Question Text (French)"}
                </label>
                <textarea
                  rows={2}
                  value={questionTextFr}
                  onChange={(e) => setQuestionTextFr(e.target.value)}
                  placeholder="Quel est l'indicateur principal de...?"
                  className="w-full mt-1 text-xs rounded-lg border border-border bg-background p-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Options */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    {fr ? "Options de réponse (Cochez la bonne)" : "Answer Options (Check correct)"}
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setQuestionOptions((prev) => [
                        ...prev,
                        { textEn: "", textFr: "", isCorrect: false },
                      ])
                    }
                    className="h-6 text-[11px] gap-1 text-primary hover:bg-primary/10"
                  >
                    <Plus className="size-3" />
                    {fr ? "Ajouter option" : "Add Option"}
                  </Button>
                </div>

                <div className="space-y-2">
                  {questionOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border text-xs",
                        opt.isCorrect
                          ? "bg-emerald-500/5 border-emerald-500/30"
                          : "bg-background border-border"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setQuestionOptions((prev) =>
                            prev.map((o, i) => ({
                              ...o,
                              isCorrect: i === idx,
                            }))
                          )
                        }
                        className={cn(
                          "size-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                          opt.isCorrect
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "border-muted-foreground/40 hover:border-primary"
                        )}
                        title="Mark as correct answer"
                      >
                        {opt.isCorrect && <Check className="size-2.5 stroke-3" />}
                      </button>

                      <Input
                        placeholder={`Option ${idx + 1} (English)`}
                        value={opt.textEn}
                        onChange={(e) =>
                          setQuestionOptions((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, textEn: e.target.value } : o
                            )
                          )
                        }
                        className="text-xs h-7 flex-1"
                      />

                      <Input
                        placeholder={`Option ${idx + 1} (Français)`}
                        value={opt.textFr}
                        onChange={(e) =>
                          setQuestionOptions((prev) =>
                            prev.map((o, i) =>
                              i === idx ? { ...o, textFr: e.target.value } : o
                            )
                          )
                        }
                        className="text-xs h-7 flex-1"
                      />

                      {questionOptions.length > 2 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setQuestionOptions((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="size-6 text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Explanation */}
              <div>
                <label className="text-xs font-semibold text-foreground">
                  {fr ? "Explication / Feedback (optionnel)" : "Explanation / Feedback (optional)"}
                </label>
                <textarea
                  rows={2}
                  value={questionExplanationEn}
                  onChange={(e) => setQuestionExplanationEn(e.target.value)}
                  placeholder="Explaining why the correct option is right..."
                  className="w-full mt-1 text-xs rounded-lg border border-border bg-background p-2.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddQuestionOpen(false)}
              >
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleAddQuestion}>
                {fr ? "Enregistrer la question" : "Save Question"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
