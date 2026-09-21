import { useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Calendar,
  Check,
  Download,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  ImageIcon,
  Layers,
  Loader2,
  Plus,
  Radio,
  Sparkles,
  Trash2,
  UploadCloud,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useI18n } from "@/i18n/LocaleProvider";
import { cn, resolveMediaUrl } from "@/lib/utils";
import {
  convertUsdToEur,
  convertEurToUsd,
  translateText,
} from "@/lib/translation";
import { LessonVideoPlayer } from "@/components/learning/LessonVideoPlayer";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: () => void;
}

interface QuestionDraft {
  orderIndex: number;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK";
  promptEn: string;
  promptFr: string;
  points: number;
  correctText?: string;
  options: Array<{
    orderIndex: number;
    labelEn: string;
    labelFr: string;
    correct: boolean;
  }>;
}

interface QuizDraft {
  titleEn: string;
  titleFr: string;
  passingScore: number;
  timeLimitMinutes?: number;
  questions: QuestionDraft[];
}

interface LiveSessionDraft {
  titleEn: string;
  titleFr: string;
  startsAt: string;
  endsAt: string;
  meetUrl: string;
  instructorName: string;
}

interface LessonDraft {
  orderIndex: number;
  titleEn: string;
  titleFr: string;
  type: "VIDEO" | "TEXT" | "CASE_STUDY" | "INTERACTIVE_ACTIVITY";
  videoUrl: string;
  videoFileName?: string;
  videoMode?: "upload" | "link";
  durationMinutes: number;
  bodyEn: string;
  bodyFr: string;
  resources: Array<{
    nameEn: string;
    nameFr: string;
    type: string;
    url: string;
    sizeKb: number;
  }>;
  quiz?: QuizDraft;
  liveSession?: LiveSessionDraft;
}

interface ModuleDraft {
  orderIndex: number;
  titleEn: string;
  titleFr: string;
  descriptionEn: string;
  descriptionFr: string;
  estimatedHours: number;
  requiredCompletion: number;
  passingScore: number;
  lessons: LessonDraft[];
  quiz?: QuizDraft;
  liveSession?: LiveSessionDraft;
}

function generateMeetUrl(): string {
  // Generates an instant, zero-auth Jitsi Meet room — guaranteed to work without Google Calendar OAuth.
  // Admins can still paste a real Google Meet URL (from meet.google.com/new) into the field below.
  const roomId = Math.random().toString(36).substring(2, 10);
  return `https://meet.jit.si/ilsi-live-${roomId}`;
}

export function CreateCourseModal({ isOpen, onClose, onCourseCreated }: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";

  // Navigation Tab inside modal
  const [activeTab, setActiveTab] = useState<"general" | "modules">("general");

  // Step 1: Course Info
  const [titleEn, setTitleEn] = useState("");
  const [titleFr, setTitleFr] = useState("");
  const [slug, setSlug] = useState("");
  const [taglineEn, setTaglineEn] = useState("");
  const [taglineFr, setTaglineFr] = useState("");
  const [descEn, setDescEn] = useState("");
  const [descFr, setDescFr] = useState("");
  const [durationWeeks, setDurationWeeks] = useState(12);
  const [priceUsd, setPriceUsd] = useState(180);
  const [priceEur, setPriceEur] = useState(165);

  // Initial Cohort
  const [cohortNameEn, setCohortNameEn] = useState("First Cohort");
  const [cohortNameFr, setCohortNameFr] = useState("Première Cohorte");
  const [cohortStartDate, setCohortStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [cohortEndDate, setCohortEndDate] = useState(() => new Date(Date.now() + 12 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [cohortCapacity, setCohortCapacity] = useState(30);

  // Thumbnail
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // Translation indicator
  const [translatingCourse, setTranslatingCourse] = useState(false);

  // Step 2: Modules list
  const [modules, setModules] = useState<ModuleDraft[]>([
    {
      orderIndex: 1,
      titleEn: "Self-Leadership & Values",
      titleFr: "Leadership Personnel & Valeurs",
      descriptionEn: "Foundational personal leadership and core ethics.",
      descriptionFr: "Bases du leadership personnel et éthique.",
      estimatedHours: 8,
      requiredCompletion: 80,
      passingScore: 70,
      lessons: [
        {
          orderIndex: 1,
          titleEn: "Introduction to Grounded Leadership",
          titleFr: "Introduction au leadership ancré",
          type: "VIDEO",
          videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
          durationMinutes: 20,
          bodyEn: "Core principles of self-awareness and integrity.",
          bodyFr: "Principes fondamentaux de conscience de soi et d'intégrité.",
          resources: [],
          quiz: {
            titleEn: "Lesson 1 Checkpoint",
            titleFr: "Point de contrôle - Leçon 1",
            passingScore: 70,
            questions: [
              {
                orderIndex: 1,
                type: "MULTIPLE_CHOICE",
                promptEn: "What forms the foundation of authentic leadership?",
                promptFr: "Quel est le fondement du leadership authentique ?",
                points: 1,
                options: [
                  { orderIndex: 1, labelEn: "Personal integrity and self-awareness", labelFr: "Intégrité personnelle et conscience de soi", correct: true },
                  { orderIndex: 2, labelEn: "Hierarchical authority", labelFr: "Autorité hiérarchique", correct: false },
                ],
              },
            ],
          },
          liveSession: {
            titleEn: "Lesson 1 Live Q&A and Case Debrief",
            titleFr: "Session Q&R en direct - Leçon 1",
            startsAt: "2026-10-08T17:00:00Z",
            endsAt: "2026-10-08T18:00:00Z",
            meetUrl: generateMeetUrl(),
            instructorName: "ILSI Faculty Lead",
          },
        },
      ],
    },
  ]);

  const [selectedModuleIdx, setSelectedModuleIdx] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<{ modIdx: number; lesIdx: number } | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState<{ modIdx: number; lesIdx: number; progress: number } | null>(null);

  if (!isOpen) return null;

  // Currency Handlers
  const handlePriceUsdChange = (val: number) => {
    setPriceUsd(val);
    setPriceEur(convertUsdToEur(val));
  };

  const handlePriceEurChange = (val: number) => {
    setPriceEur(val);
    setPriceUsd(convertEurToUsd(val));
  };

  // Auto-translate entire course form: general info, modules, lessons, quizzes & live sessions
  const handleAutoTranslateCourse = async (toLang: "en" | "fr") => {
    setTranslatingCourse(true);
    const fromLang = toLang === "fr" ? "en" : "fr";
    try {
      toast.info(
        fr
          ? "Traduction automatique de tout le curriculum (Général, Modules, Quiz, Directs)..."
          : "Auto-translating entire course curriculum (General Info, Modules, Quizzes, Live Sessions)..."
      );

      const translateField = async (val?: string) => {
        if (!val || !val.trim()) return val || "";
        return await translateText(val, fromLang, toLang);
      };

      // 1. General course info
      if (toLang === "fr") {
        if (titleEn) setTitleFr(await translateField(titleEn));
        if (taglineEn) setTaglineFr(await translateField(taglineEn));
        if (descEn) setDescFr(await translateField(descEn));
        if (cohortNameEn) setCohortNameFr(await translateField(cohortNameEn));
      } else {
        if (titleFr) setTitleEn(await translateField(titleFr));
        if (taglineFr) setTaglineEn(await translateField(taglineFr));
        if (descFr) setDescEn(await translateField(descFr));
        if (cohortNameFr) setCohortNameEn(await translateField(cohortNameFr));
      }

      // 2. All modules, lessons, quizzes, questions, options, resources, and live sessions
      const updatedModules = await Promise.all(
        modules.map(async (mod) => {
          const m = { ...mod };
          if (toLang === "fr") {
            if (m.titleEn) m.titleFr = await translateField(m.titleEn);
            if (m.descriptionEn) m.descriptionFr = await translateField(m.descriptionEn);
          } else {
            if (m.titleFr) m.titleEn = await translateField(m.titleFr);
            if (m.descriptionFr) m.descriptionEn = await translateField(m.descriptionFr);
          }

          if (m.liveSession) {
            const ls = { ...m.liveSession };
            if (toLang === "fr") {
              if (ls.titleEn) ls.titleFr = await translateField(ls.titleEn);
            } else {
              if (ls.titleFr) ls.titleEn = await translateField(ls.titleFr);
            }
            m.liveSession = ls;
          }

          if (m.quiz) {
            const qz = { ...m.quiz };
            if (toLang === "fr") {
              if (qz.titleEn) qz.titleFr = await translateField(qz.titleEn);
            } else {
              if (qz.titleFr) qz.titleEn = await translateField(qz.titleFr);
            }
            if (qz.questions && Array.isArray(qz.questions)) {
              qz.questions = await Promise.all(
                qz.questions.map(async (q) => {
                  const qItem = { ...q };
                  if (toLang === "fr") {
                    if (qItem.promptEn) qItem.promptFr = await translateField(qItem.promptEn);
                  } else {
                    if (qItem.promptFr) qItem.promptEn = await translateField(qItem.promptFr);
                  }
                  if (qItem.options && Array.isArray(qItem.options)) {
                    qItem.options = await Promise.all(
                      qItem.options.map(async (opt) => {
                        const optItem = { ...opt };
                        if (toLang === "fr") {
                          if (optItem.labelEn) optItem.labelFr = await translateField(optItem.labelEn);
                        } else {
                          if (optItem.labelFr) optItem.labelEn = await translateField(optItem.labelFr);
                        }
                        return optItem;
                      })
                    );
                  }
                  return qItem;
                })
              );
            }
            m.quiz = qz;
          }

          if (m.lessons && Array.isArray(m.lessons)) {
            m.lessons = await Promise.all(
              m.lessons.map(async (les) => {
                const l = { ...les };
                if (toLang === "fr") {
                  if (l.titleEn) l.titleFr = await translateField(l.titleEn);
                  if (l.bodyEn) l.bodyFr = await translateField(l.bodyEn);
                } else {
                  if (l.titleFr) l.titleEn = await translateField(l.titleFr);
                  if (l.bodyFr) l.bodyEn = await translateField(l.bodyFr);
                }

                if (l.resources && Array.isArray(l.resources)) {
                  l.resources = await Promise.all(
                    l.resources.map(async (res) => {
                      const r = { ...res };
                      if (toLang === "fr") {
                        if (r.nameEn) r.nameFr = await translateField(r.nameEn);
                      } else {
                        if (r.nameFr) r.nameEn = await translateField(r.nameFr);
                      }
                      return r;
                    })
                  );
                }

                if (l.liveSession) {
                  const lls = { ...l.liveSession };
                  if (toLang === "fr") {
                    if (lls.titleEn) lls.titleFr = await translateField(lls.titleEn);
                  } else {
                    if (lls.titleFr) lls.titleEn = await translateField(lls.titleFr);
                  }
                  l.liveSession = lls;
                }

                if (l.quiz) {
                  const lqz = { ...l.quiz };
                  if (toLang === "fr") {
                    if (lqz.titleEn) lqz.titleFr = await translateField(lqz.titleEn);
                  } else {
                    if (lqz.titleFr) lqz.titleEn = await translateField(lqz.titleFr);
                  }
                  if (lqz.questions && Array.isArray(lqz.questions)) {
                    lqz.questions = await Promise.all(
                      lqz.questions.map(async (q) => {
                        const qItem = { ...q };
                        if (toLang === "fr") {
                          if (qItem.promptEn) qItem.promptFr = await translateField(qItem.promptEn);
                        } else {
                          if (qItem.promptFr) qItem.promptEn = await translateField(qItem.promptFr);
                        }
                        if (qItem.options && Array.isArray(qItem.options)) {
                          qItem.options = await Promise.all(
                            qItem.options.map(async (opt) => {
                              const optItem = { ...opt };
                              if (toLang === "fr") {
                                if (optItem.labelEn) optItem.labelFr = await translateField(optItem.labelEn);
                              } else {
                                if (optItem.labelFr) optItem.labelEn = await translateField(optItem.labelFr);
                              }
                              return optItem;
                            })
                          );
                        }
                        return qItem;
                      })
                    );
                  }
                  l.quiz = lqz;
                }

                return l;
              })
            );
          }

          return m;
        })
      );

      setModules(updatedModules);

      toast.success(
        toLang === "fr"
          ? "Traduction complète en français appliquée à tout le cursus (modules, leçons, quiz, directs) !"
          : "Full curriculum translated to English successfully (modules, lessons, quizzes, lives)!"
      );
    } catch (err: any) {
      console.error("Auto-translation error:", err);
      toast.error("Auto-translation failed. Please check internet connection.");
    } finally {
      setTranslatingCourse(false);
    }
  };

  // Add Module
  const addModule = () => {
    const nextIdx = modules.length + 1;
    const newMod: ModuleDraft = {
      orderIndex: nextIdx,
      titleEn: `Module ${nextIdx} — Topic`,
      titleFr: `Module ${nextIdx} — Thème`,
      descriptionEn: "",
      descriptionFr: "",
      estimatedHours: 10,
      requiredCompletion: 80,
      passingScore: 70,
      lessons: [
        {
          orderIndex: 1,
          titleEn: "Lesson 1",
          titleFr: "Leçon 1",
          type: "VIDEO",
          videoUrl: "",
          durationMinutes: 20,
          bodyEn: "",
          bodyFr: "",
          resources: [],
        },
      ],
    };
    setModules([...modules, newMod]);
    setSelectedModuleIdx(modules.length);
  };

  // Add Lesson
  const addLesson = (modIdx: number) => {
    const mod = modules[modIdx];
    if (!mod) return;
    const nextLessonIdx = mod.lessons.length + 1;
    const newLesson: LessonDraft = {
      orderIndex: nextLessonIdx,
      titleEn: `Lesson ${nextLessonIdx}`,
      titleFr: `Leçon ${nextLessonIdx}`,
      type: "VIDEO",
      videoUrl: "",
      durationMinutes: 20,
      bodyEn: "",
      bodyFr: "",
      resources: [],
    };
    const updated = [...modules];
    updated[modIdx] = { ...mod, orderIndex: mod.orderIndex ?? modIdx + 1, lessons: [...mod.lessons, newLesson] };
    setModules(updated);
  };

  // Handle Real File Upload
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    modIdx: number,
    lesIdx: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = [".pdf", ".ppt", ".pptx", ".doc", ".docx"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext)) {
      toast.error(
        fr
          ? "Format non supporté. Veuillez choisir un fichier PDF, PPT, PPTX, DOC ou DOCX."
          : "Unsupported format. Please upload a PDF, PPT, PPTX, DOC, or DOCX file."
      );
      e.target.value = "";
      return;
    }

    try {
      setUploadingTarget({ modIdx, lesIdx });
      toast.info(fr ? `Téléversement de ${file.name}...` : `Uploading ${file.name}...`);
      const res = await api.uploadFile(file);

      const updated = [...modules];
      const lesson = updated[modIdx]?.lessons[lesIdx];
      if (!lesson) return;
      lesson.resources.push({
        nameEn: file.name,
        nameFr: file.name,
        type: ext.replace(".", "").toUpperCase(),
        url: res.url,
        sizeKb: res.sizeKb || Math.round(file.size / 1024),
      });
      setModules(updated);
      toast.success(fr ? `Fichier ${file.name} ajouté !` : `${file.name} uploaded successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file");
    } finally {
      setUploadingTarget(null);
      e.target.value = "";
    }
  };

  // Handle Video Upload from Local PC to Supabase Storage
  const handleVideoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    modIdx: number,
    lesIdx: number
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExts = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!allowedExts.includes(ext) && !file.type.startsWith("video/")) {
      toast.error(
        fr
          ? "Format vidéo non supporté. Formats acceptés : MP4, MOV, WEBM, MKV, AVI, M4V."
          : "Unsupported video format. Allowed formats: MP4, MOV, WEBM, MKV, AVI, M4V."
      );
      e.target.value = "";
      return;
    }

    if (file.size > 500 * 1024 * 1024) {
      toast.error(
        fr
          ? "Le fichier vidéo dépasse la limite de 500 Mo."
          : "Video file exceeds 500MB size limit."
      );
      e.target.value = "";
      return;
    }

    try {
      setUploadingVideo({ modIdx, lesIdx, progress: 0 });
      toast.info(
        fr
          ? `Téléversement de la vidéo ${file.name} vers Supabase Storage...`
          : `Uploading ${file.name} to Supabase Storage...`
      );

      const res = await api.uploadVideo(file, (percent) => {
        setUploadingVideo({ modIdx, lesIdx, progress: percent });
      });

      const updated = [...modules];
      const lesson = updated[modIdx]?.lessons[lesIdx];
      if (!lesson) return;
      lesson.videoUrl = res.url || res.storagePath;
      lesson.videoFileName = res.fileName;
      lesson.videoMode = "upload";
      setModules(updated);

      toast.success(
        fr
          ? `Vidéo ${file.name} sauvegardée dans Supabase Storage avec succès !`
          : `Video ${file.name} uploaded to Supabase Storage successfully!`
      );
    } catch (err: any) {
      console.error("Video upload error:", err);
      toast.error(err.message || "Failed to upload video to Supabase Storage");
    } finally {
      setUploadingVideo(null);
      e.target.value = "";
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

  // Remove Resource
  const removeResource = (modIdx: number, lesIdx: number, resIdx: number) => {
    const updated = [...modules];
    const lesson = updated[modIdx]?.lessons[lesIdx];
    if (lesson) {
      lesson.resources.splice(resIdx, 1);
      setModules(updated);
    }
  };

  // Toggle Lesson Quiz
  const toggleLessonQuiz = (modIdx: number, lesIdx: number) => {
    const updated = [...modules];
    const lesson = updated[modIdx]?.lessons[lesIdx];
    if (!lesson) return;
    if (lesson.quiz) {
      delete lesson.quiz;
    } else {
      lesson.quiz = {
        titleEn: `${lesson.titleEn} Quiz`,
        titleFr: `Quiz - ${lesson.titleFr}`,
        passingScore: 70,
        questions: [
          {
            orderIndex: 1,
            type: "MULTIPLE_CHOICE",
            promptEn: "Key concept question for this lesson...",
            promptFr: "Question sur le concept clé de cette leçon...",
            points: 1,
            options: [
              { orderIndex: 1, labelEn: "Option A (Correct)", labelFr: "Option A (Correcte)", correct: true },
              { orderIndex: 2, labelEn: "Option B", labelFr: "Option B", correct: false },
            ],
          },
        ],
      };
    }
    setModules(updated);
  };

  // Change Question Type (MCQ, TRUE/FALSE, FILL IN THE BLANK)
  const changeQuestionType = (
    modIdx: number,
    lesIdx: number,
    qIdx: number,
    newType: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK"
  ) => {
    const updated = [...modules];
    const question = updated[modIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
    if (!question) return;

    question.type = newType;
    if (newType === "TRUE_FALSE") {
      question.options = [
        { orderIndex: 1, labelEn: "True", labelFr: "Vrai", correct: true },
        { orderIndex: 2, labelEn: "False", labelFr: "Faux", correct: false },
      ];
    } else if (newType === "FILL_BLANK") {
      question.correctText = question.correctText || "";
      question.options = [
        { orderIndex: 1, labelEn: question.correctText || "Expected answer", labelFr: question.correctText || "Réponse attendue", correct: true },
      ];
    } else if (newType === "MULTIPLE_CHOICE") {
      if (!question.options || question.options.length < 2) {
        question.options = [
          { orderIndex: 1, labelEn: "Option A (Correct)", labelFr: "Option A (Correcte)", correct: true },
          { orderIndex: 2, labelEn: "Option B", labelFr: "Option B", correct: false },
        ];
      }
    }
    setModules(updated);
  };

  // Add Question to Lesson Quiz
  const addQuestionToLessonQuiz = (modIdx: number, lesIdx: number) => {
    const updated = [...modules];
    const quiz = updated[modIdx]?.lessons[lesIdx]?.quiz;
    if (!quiz) return;
    const nextQIdx = quiz.questions.length + 1;
    quiz.questions.push({
      orderIndex: nextQIdx,
      type: "MULTIPLE_CHOICE",
      promptEn: `Question ${nextQIdx}`,
      promptFr: `Question ${nextQIdx}`,
      points: 1,
      options: [
        { orderIndex: 1, labelEn: "Option A", labelFr: "Option A", correct: true },
        { orderIndex: 2, labelEn: "Option B", labelFr: "Option B", correct: false },
      ],
    });
    setModules(updated);
  };

  // Remove Question from Lesson Quiz
  const removeQuestionFromLessonQuiz = (modIdx: number, lesIdx: number, qIdx: number) => {
    const updated = [...modules];
    const quiz = updated[modIdx]?.lessons[lesIdx]?.quiz;
    if (!quiz || quiz.questions.length <= 1) {
      toast.warning(fr ? "Un quiz doit contenir au moins une question." : "A quiz must have at least one question.");
      return;
    }
    quiz.questions.splice(qIdx, 1);
    quiz.questions.forEach((q, idx) => {
      q.orderIndex = idx + 1;
    });
    setModules(updated);
  };

  // Add Option to Question
  const addOptionToQuestion = (modIdx: number, lesIdx: number, qIdx: number) => {
    const updated = [...modules];
    const question = updated[modIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
    if (!question) return;
    const nextOptIdx = question.options.length + 1;
    question.options.push({
      orderIndex: nextOptIdx,
      labelEn: `Option ${String.fromCharCode(64 + nextOptIdx)}`,
      labelFr: `Option ${String.fromCharCode(64 + nextOptIdx)}`,
      correct: false,
    });
    setModules(updated);
  };

  // Remove Option from Question
  const removeOptionFromQuestion = (modIdx: number, lesIdx: number, qIdx: number, optIdx: number) => {
    const updated = [...modules];
    const question = updated[modIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
    if (!question || question.options.length <= 2) {
      toast.warning(fr ? "Une question à choix multiples doit avoir au moins 2 options." : "Multiple choice question must have at least 2 options.");
      return;
    }
    question.options.splice(optIdx, 1);
    question.options.forEach((opt, idx) => {
      opt.orderIndex = idx + 1;
    });
    setModules(updated);
  };

  // Toggle Lesson Live Session
  const toggleLessonLive = (modIdx: number, lesIdx: number) => {
    const updated = [...modules];
    const lesson = updated[modIdx]?.lessons[lesIdx];
    if (!lesson) return;
    if (lesson.liveSession) {
      delete lesson.liveSession;
    } else {
      lesson.liveSession = {
        titleEn: `Live Debrief: ${lesson.titleEn}`,
        titleFr: `Débrief en Direct: ${lesson.titleFr}`,
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString().slice(0, 16),
        meetUrl: generateMeetUrl(),
        instructorName: "ILSI Faculty Lead",
      };
    }
    setModules(updated);
  };

  const handleTitleChange = (val: string) => {
    setTitleEn(val);
    if (!slug) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
    if (!cohortNameEn || cohortNameEn === "First Cohort" || cohortNameEn.includes("— Cohort 1")) {
      setCohortNameEn(val ? `${val} — Cohort 1` : "Cohort 1");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleEn || !titleFr || !slug || !descEn || !descFr) {
      toast.error(
        fr
          ? "Veuillez remplir les informations obligatoires du cours."
          : "Please fill in all required course information."
      );
      setActiveTab("general");
      return;
    }

    try {
      setSubmitting(true);
      const sanitizedModules = modules.map((m, mIdx) => ({
        ...m,
        orderIndex: m.orderIndex || mIdx + 1,
        liveSession: m.liveSession
          ? {
              ...m.liveSession,
              startsAt: m.liveSession.startsAt ? new Date(m.liveSession.startsAt).toISOString() : undefined,
              endsAt: m.liveSession.endsAt ? new Date(m.liveSession.endsAt).toISOString() : undefined,
            }
          : undefined,
        lessons: m.lessons.map((l, lIdx) => ({
          ...l,
          orderIndex: l.orderIndex || lIdx + 1,
          liveSession: l.liveSession
            ? {
                ...l.liveSession,
                startsAt: l.liveSession.startsAt ? new Date(l.liveSession.startsAt).toISOString() : undefined,
                endsAt: l.liveSession.endsAt ? new Date(l.liveSession.endsAt).toISOString() : undefined,
              }
            : undefined,
        })),
      }));

      await api.createFullCourse({
        slug,
        titleEn,
        titleFr,
        taglineEn,
        taglineFr,
        descriptionEn: descEn,
        descriptionFr: descFr,
        durationWeeks,
        price: priceUsd,
        priceEur,
        currency: "USD",
        thumbnailUrl: thumbnailUrl || undefined,
        cohort: {
          nameEn: cohortNameEn,
          nameFr: cohortNameFr,
          startDate: cohortStartDate,
          endDate: cohortEndDate,
          capacity: cohortCapacity,
          passingScore: 70,
          thumbnailUrl: thumbnailUrl || undefined,
        },
        modules: sanitizedModules,
      });

      toast.success(
        fr
          ? "Cours créé avec succès avec toutes ses leçons, fichiers téléchargeables, quiz et sessions en direct !"
          : "Full course curriculum, lessons, uploaded files, quizzes, and live sessions created successfully!"
      );
      onCourseCreated();
      onClose();
    } catch (err: any) {
      console.error("[CreateCourseModal] Save error:", err);
      const detailMsg =
        err.details && Array.isArray(err.details)
          ? err.details.map((d: any) => `${d.path}: ${d.message}`).join("; ")
          : err.message;
      toast.error(detailMsg || "Failed to create course curriculum.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentMod = modules[selectedModuleIdx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-3 backdrop-blur-md overflow-hidden"
      onClick={onClose}
    >
      <div
        className="panel w-[98vw] max-w-[1650px] h-[97vh] max-h-[97vh] flex flex-col p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <BookOpen className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-display text-base sm:text-lg font-bold text-foreground truncate">
                {fr ? "Créateur de Formation / Cours Complet" : "Course & Curriculum Builder"}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1 sm:line-clamp-none">
                {fr
                  ? "Création du programme, leçons, vrais fichiers (PDF/PPT/DOC), quiz par leçon et sessions Google Meet."
                  : "Create full curriculum with real file uploads, per-lesson quizzes, and automated Google Meet sessions."}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
            <X className="size-4" />
          </Button>
        </div>

        {/* Navigation Tabs & Bilingual Auto-Sync Bar (Available across all tabs) */}
        <div className="flex items-center justify-between border-b border-border py-2 text-xs font-semibold gap-2 flex-wrap shrink-0">
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={cn(
                "px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
                activeTab === "general"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Layers className="size-3.5" />
              <span>{fr ? "1. Informations Générales & Prix" : "1. General Information & Pricing"}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("modules")}
              className={cn(
                "px-3.5 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
                activeTab === "modules"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <BookOpen className="size-3.5" />
              <span>
                {fr
                  ? `2. Modules, Fichiers, Quiz & Lives (${modules.length})`
                  : `2. Modules, Uploads, Quiz & Live (${modules.length})`}
              </span>
            </button>
          </div>

          {/* Bilingual Full Course Auto-Sync Buttons - Always visible across all tabs */}
          <div className="flex items-center gap-2 bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/20 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Globe className="size-3.5 text-primary" />
              <span className="hidden md:inline">{fr ? "Traduction Automatique :" : "Auto-Translate All Tabs:"}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAutoTranslateCourse("fr")}
              disabled={translatingCourse}
              className="h-6 text-[11px] px-2.5 gap-1.5"
              title={fr ? "Traduire automatiquement tous les onglets en Français" : "Auto-translate everything (modules, quiz, lives) to French"}
            >
              <Sparkles className="size-3 text-amber-500" />
              {translatingCourse ? "..." : fr ? "Traduire tout vers le FR" : "Auto-fill FR from EN (All Tabs)"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAutoTranslateCourse("en")}
              disabled={translatingCourse}
              className="h-6 text-[11px] px-2.5 gap-1.5"
              title={fr ? "Traduire automatiquement tous les onglets en Anglais" : "Auto-translate everything (modules, quiz, lives) to English"}
            >
              <Sparkles className="size-3 text-amber-500" />
              {translatingCourse ? "..." : fr ? "Traduire tout vers l'EN" : "Auto-fill EN from FR (All Tabs)"}
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto py-3 pr-1 space-y-5">
          {activeTab === "general" && (
            <div className="space-y-5 text-xs">
              {/* Title & Slug */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="titleEn">{fr ? "Titre (Anglais) *" : "Course Title (English) *"}</Label>
                  <Input
                    id="titleEn"
                    value={titleEn}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onBlur={async () => {
                      if (titleEn && !titleFr) {
                        setTitleFr(await translateText(titleEn, "en", "fr"));
                      }
                    }}
                    placeholder="e.g. Executive Communication Mastery"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="titleFr">{fr ? "Titre (Français) *" : "Course Title (French) *"}</Label>
                  <Input
                    id="titleFr"
                    value={titleFr}
                    onChange={(e) => setTitleFr(e.target.value)}
                    onBlur={async () => {
                      if (titleFr && !titleEn) {
                        setTitleEn(await translateText(titleFr, "fr", "en"));
                      }
                    }}
                    placeholder="e.g. Maîtrise de la Communication Exécutive"
                    required
                  />
                </div>
              </div>

              {/* Slug & Duration */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="slug">{fr ? "Identifiant URL (Slug) *" : "URL Slug *"}</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="executive-communication"
                    required
                    className="font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="duration">{fr ? "Durée (semaines)" : "Duration (Weeks)"}</Label>
                  <Input
                    id="duration"
                    type="number"
                    min={1}
                    max={52}
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Dual Currency Pricing ($ and €) with real-time sync */}
              <div className="rounded-lg bg-muted/20 p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
                    {fr ? "Tarification Bidevise (USD ↔ EUR)" : "Dual-Currency Pricing Sync (USD ↔ EUR)"}
                  </p>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    1 USD ≈ 0.92 EUR
                  </Badge>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="priceUsd">{fr ? "Prix en Dollars ($ USD) *" : "Price in Dollars ($ USD) *"}</Label>
                    <Input
                      id="priceUsd"
                      type="number"
                      min={0}
                      value={priceUsd}
                      onChange={(e) => handlePriceUsdChange(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="priceEur">{fr ? "Prix en Euros (€ EUR) *" : "Price in Euros (€ EUR) *"}</Label>
                    <Input
                      id="priceEur"
                      type="number"
                      min={0}
                      value={priceEur}
                      onChange={(e) => handlePriceEurChange(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {/* Taglines */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="taglineEn">{fr ? "Slogan court (Anglais)" : "Short Tagline (English)"}</Label>
                  <Input
                    id="taglineEn"
                    value={taglineEn}
                    onChange={(e) => setTaglineEn(e.target.value)}
                    onBlur={async () => {
                      if (taglineEn && !taglineFr) {
                        setTaglineFr(await translateText(taglineEn, "en", "fr"));
                      }
                    }}
                    placeholder="Speak clearly under pressure"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="taglineFr">{fr ? "Slogan court (Français)" : "Short Tagline (French)"}</Label>
                  <Input
                    id="taglineFr"
                    value={taglineFr}
                    onChange={(e) => setTaglineFr(e.target.value)}
                    onBlur={async () => {
                      if (taglineFr && !taglineEn) {
                        setTaglineEn(await translateText(taglineFr, "fr", "en"));
                      }
                    }}
                    placeholder="S'exprimer clairement sous pression"
                  />
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="descEn">{fr ? "Description complète (Anglais) *" : "Full Description (English) *"}</Label>
                  <Textarea
                    id="descEn"
                    rows={3}
                    value={descEn}
                    onChange={(e) => setDescEn(e.target.value)}
                    onBlur={async () => {
                      if (descEn && !descFr) {
                        setDescFr(await translateText(descEn, "en", "fr"));
                      }
                    }}
                    placeholder="A structured programme covering..."
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="descFr">{fr ? "Description complète (Français) *" : "Full Description (French) *"}</Label>
                  <Textarea
                    id="descFr"
                    rows={3}
                    value={descFr}
                    onChange={(e) => setDescFr(e.target.value)}
                    onBlur={async () => {
                      if (descFr && !descEn) {
                        setDescEn(await translateText(descFr, "fr", "en"));
                      }
                    }}
                    placeholder="Un programme structuré couvrant..."
                    required
                  />
                </div>
              </div>

              {/* Course & Cohort Thumbnail Upload */}
              <div className="rounded-lg bg-muted/20 p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-primary" />
                      <span>{fr ? "Image Miniature de la Formation / Cohorte" : "Course & Cohort Thumbnail Image"}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {fr
                        ? "Téléversez une image (JPG, JPEG, PNG, WEBP) depuis votre PC. Elle apparaîtra sur la page d'accueil, le catalogue et toutes les pages du cours."
                        : "Upload an image (JPG, JPEG, PNG, WEBP) from your PC. It will be used on the landing page course card and across every cohort page."}
                    </p>
                  </div>
                  {thumbnailUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setThumbnailUrl("")}
                      className="h-7 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      {fr ? "Supprimer" : "Remove"}
                    </Button>
                  )}
                </div>

                {thumbnailUrl ? (
                  <div className="relative flex items-center gap-4 p-3 bg-card rounded-lg border border-border">
                    <img
                      src={resolveMediaUrl(thumbnailUrl)}
                      alt="Thumbnail preview"
                      className="h-24 w-36 object-cover rounded-md border border-border shadow-sm shrink-0"
                    />
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                          {fr ? "Miniature active" : "Active Thumbnail"}
                        </Badge>
                        <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[240px]">
                          {thumbnailUrl}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {fr
                          ? "Cette miniature sera visible sur les cartes de cours et partout où la formation est présentée."
                          : "This thumbnail will be visible on the landing page course card and all course/cohort pages."}
                      </p>
                      <label className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline cursor-pointer">
                        <UploadCloud className="size-3.5" />
                        <span>{fr ? "Remplacer l'image" : "Replace image"}</span>
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
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition rounded-lg p-6 cursor-pointer text-center">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      onChange={handleThumbnailUpload}
                      disabled={uploadingThumbnail}
                    />
                    {uploadingThumbnail ? (
                      <div className="flex flex-col items-center gap-2 text-primary">
                        <Loader2 className="size-6 animate-spin" />
                        <span className="text-xs font-medium">
                          {fr ? "Téléversement de l'image en cours..." : "Uploading image from PC..."}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UploadCloud className="size-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {fr ? "Cliquez pour téléverser une miniature depuis votre PC" : "Click to upload a thumbnail from local PC"}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            JPG, JPEG, PNG, WEBP, SVG (Max 10MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                )}
              </div>

              {/* Initial Cohort Setup */}
              <div className="rounded-lg bg-muted/20 p-4 border border-border space-y-3">
                <p className="font-semibold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" />
                  <span>{fr ? "Première Cohorte Initiale" : "First Cohort Initial Schedule"}</span>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="cohNameEn">{fr ? "Nom de la Cohorte (Anglais) *" : "Cohort Name (English) *"}</Label>
                    <Input
                      id="cohNameEn"
                      value={cohortNameEn}
                      onChange={(e) => setCohortNameEn(e.target.value)}
                      onBlur={async () => {
                        if (cohortNameEn && !cohortNameFr) {
                          setCohortNameFr(await translateText(cohortNameEn, "en", "fr"));
                        }
                      }}
                      placeholder="e.g. Executive Strategy — Fall 2026 Batch"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cohNameFr">{fr ? "Nom de la Cohorte (Français) *" : "Cohort Name (French) *"}</Label>
                    <Input
                      id="cohNameFr"
                      value={cohortNameFr}
                      onChange={(e) => setCohortNameFr(e.target.value)}
                      onBlur={async () => {
                        if (cohortNameFr && !cohortNameEn) {
                          setCohortNameEn(await translateText(cohortNameFr, "fr", "en"));
                        }
                      }}
                      placeholder="e.g. Stratégie Exécutive — Promotion Automne 2026"
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="cohStart">{fr ? "Date de début" : "Start Date"}</Label>
                    <Input
                      id="cohStart"
                      type="date"
                      value={cohortStartDate}
                      onChange={(e) => setCohortStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cohEnd">{fr ? "Date de fin" : "End Date"}</Label>
                    <Input
                      id="cohEnd"
                      type="date"
                      value={cohortEndDate}
                      onChange={(e) => setCohortEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cohCap">{fr ? "Capacité (élèves)" : "Capacity (Learners)"}</Label>
                    <Input
                      id="cohCap"
                      type="number"
                      min={5}
                      max={300}
                      value={cohortCapacity}
                      onChange={(e) => setCohortCapacity(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "modules" && (
            <div className="grid gap-6 md:grid-cols-[220px_1fr]">
              {/* Module List Sidebar */}
              <div className="space-y-2 border-r border-border pr-3">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {fr ? "Modules" : "Modules"}
                  </span>
                  <Button type="button" size="sm" variant="outline" onClick={addModule} className="h-7 text-xs px-2">
                    <Plus className="size-3 mr-1" />
                    {fr ? "Ajouter" : "Add"}
                  </Button>
                </div>

                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {modules.map((m, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedModuleIdx(idx)}
                      className={cn(
                        "w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between",
                        selectedModuleIdx === idx
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span className="truncate">
                        {m.orderIndex}. {m.titleEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Module Detail Editor */}
              {currentMod && (
                <div className="space-y-6 text-xs">
                  <div className="flex items-center justify-between border-b border-border pb-2">
                    <Badge variant="outline">Module #{currentMod.orderIndex}</Badge>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {currentMod.lessons.length} {fr ? "Leçon(s)" : "Lesson(s)"}
                      </span>
                    </div>
                  </div>

                  {/* Module Titles */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>{fr ? "Titre Module (Anglais) *" : "Module Title (English) *"}</Label>
                      <Input
                        value={currentMod.titleEn}
                        onChange={(e) => {
                          const updated = [...modules];
                          const m = updated[selectedModuleIdx];
                          if (m) {
                            m.titleEn = e.target.value;
                            setModules(updated);
                          }
                        }}
                        onBlur={async () => {
                          if (currentMod.titleEn && !currentMod.titleFr) {
                            const tr = await translateText(currentMod.titleEn, "en", "fr");
                            const updated = [...modules];
                            const m = updated[selectedModuleIdx];
                            if (m) {
                              m.titleFr = tr;
                              setModules(updated);
                            }
                          }
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{fr ? "Titre Module (Français) *" : "Module Title (French) *"}</Label>
                      <Input
                        value={currentMod.titleFr}
                        onChange={(e) => {
                          const updated = [...modules];
                          const m = updated[selectedModuleIdx];
                          if (m) {
                            m.titleFr = e.target.value;
                            setModules(updated);
                          }
                        }}
                        onBlur={async () => {
                          if (currentMod.titleFr && !currentMod.titleEn) {
                            const tr = await translateText(currentMod.titleFr, "fr", "en");
                            const updated = [...modules];
                            const m = updated[selectedModuleIdx];
                            if (m) {
                              m.titleEn = tr;
                              setModules(updated);
                            }
                          }
                        }}
                        required
                      />
                    </div>
                  </div>

                  {/* Module Lessons */}
                  <div className="rounded-lg bg-muted/20 p-4 border border-border space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-foreground uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <Video className="size-3.5 text-primary" />
                        <span>{fr ? "Leçons, Vidéos & Fichiers Réels" : "Lessons, Video Streams & Uploaded Files"}</span>
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addLesson(selectedModuleIdx)}
                        className="h-7 text-xs"
                      >
                        <Plus className="size-3 mr-1" />
                        {fr ? "Ajouter une leçon" : "Add Lesson"}
                      </Button>
                    </div>

                    <div className="space-y-5">
                      {currentMod.lessons.map((les, lesIdx) => (
                        <div key={lesIdx} className="panel p-4 space-y-4 bg-card border-border/90 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">
                                {les.orderIndex}
                              </span>
                              {fr ? `Leçon ${les.orderIndex}` : `Lesson ${les.orderIndex}`}
                            </span>
                            <Badge variant="secondary" className="text-[10px]">
                              {les.type}
                            </Badge>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label className="text-[11px]">{fr ? "Titre (EN)" : "Title (EN)"}</Label>
                              <Input
                                value={les.titleEn}
                                onChange={(e) => {
                                  const updated = [...modules];
                                  const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                  if (l) {
                                    l.titleEn = e.target.value;
                                    setModules(updated);
                                  }
                                }}
                                onBlur={async () => {
                                  if (les.titleEn && !les.titleFr) {
                                    const tr = await translateText(les.titleEn, "en", "fr");
                                    const updated = [...modules];
                                    const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                    if (l) {
                                      l.titleFr = tr;
                                      setModules(updated);
                                    }
                                  }
                                }}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px]">{fr ? "Titre (FR)" : "Title (FR)"}</Label>
                              <Input
                                value={les.titleFr}
                                onChange={(e) => {
                                  const updated = [...modules];
                                  const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                  if (l) {
                                    l.titleFr = e.target.value;
                                    setModules(updated);
                                  }
                                }}
                                onBlur={async () => {
                                  if (les.titleFr && !les.titleEn) {
                                    const tr = await translateText(les.titleFr, "fr", "en");
                                    const updated = [...modules];
                                    const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                    if (l) {
                                      l.titleEn = tr;
                                      setModules(updated);
                                    }
                                  }
                                }}
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          {/* Video Section: Supabase Upload or External Link */}
                          <div className="rounded-lg border border-border/80 bg-muted/20 p-3 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <Video className="size-3.5 text-primary" />
                                <span className="text-[11px] font-semibold text-foreground">
                                  {fr ? "Vidéo de la Leçon (1 vidéo par leçon)" : "Lesson Video (1 Video per Lesson)"}
                                </span>
                                {les.videoUrl ? (
                                  <Badge variant="outline" className="text-[9px] text-emerald-600 bg-emerald-500/10 border-emerald-500/30 font-medium">
                                    {les.videoFileName || (les.videoUrl.includes("supabase") || !les.videoUrl.includes("http"))
                                      ? "Supabase Storage"
                                      : "Video Link"}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[9px]">
                                    {fr ? "Aucune vidéo" : "No video yet"}
                                  </Badge>
                                )}
                              </div>

                              {/* Mode Switcher Tabs */}
                              <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded border border-border text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...modules];
                                    const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                    if (l) {
                                      l.videoMode = "upload";
                                      setModules(updated);
                                    }
                                  }}
                                  className={cn(
                                    "px-2 py-1 rounded transition-colors flex items-center gap-1",
                                    (les.videoMode ?? "upload") === "upload"
                                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <UploadCloud className="size-3" />
                                  <span>{fr ? "Téléverser (PC)" : "Upload from PC"}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = [...modules];
                                    const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                    if (l) {
                                      l.videoMode = "link";
                                      setModules(updated);
                                    }
                                  }}
                                  className={cn(
                                    "px-2 py-1 rounded transition-colors flex items-center gap-1",
                                    les.videoMode === "link"
                                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                                      : "text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <ExternalLink className="size-3" />
                                  <span>{fr ? "Lien externe" : "Attach Link"}</span>
                                </button>
                              </div>
                            </div>

                            {/* Mode A: Upload Video from Local PC to Supabase Storage */}
                            {(les.videoMode ?? "upload") === "upload" && (
                              <div className="space-y-2">
                                {les.videoUrl ? (
                                  <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="size-7 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                          <Video className="size-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium truncate text-foreground">
                                            {les.videoFileName || les.videoUrl.split("/").pop() || "Attached Video"}
                                          </p>
                                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                                            {fr ? "Stocké sur Supabase Storage" : "Saved in Supabase Storage"}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border text-[10px] text-foreground hover:bg-muted font-medium transition">
                                          <UploadCloud className="size-3 text-primary" />
                                          <span>{fr ? "Remplacer" : "Replace"}</span>
                                          <input
                                            type="file"
                                            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv,.avi,.m4v"
                                            className="hidden"
                                            disabled={uploadingVideo !== null}
                                            onChange={(e) => handleVideoUpload(e, selectedModuleIdx, lesIdx)}
                                          />
                                        </label>
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const updated = [...modules];
                                            const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                            if (l) {
                                              l.videoUrl = "";
                                              delete l.videoFileName;
                                              setModules(updated);
                                            }
                                          }}
                                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                          title="Remove video"
                                        >
                                          <Trash2 className="size-3.5" />
                                        </Button>
                                      </div>
                                    </div>

                                    {/* Inline Mini Preview */}
                                    <div className="rounded-md border border-border/70 overflow-hidden bg-black/95">
                                      <LessonVideoPlayer url={les.videoUrl} className="max-h-52" />
                                    </div>
                                  </div>
                                ) : (
                                  <label
                                    className={cn(
                                      "flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-5 cursor-pointer transition-colors text-center",
                                      uploadingVideo?.modIdx === selectedModuleIdx && uploadingVideo?.lesIdx === lesIdx
                                        ? "bg-primary/10 border-primary cursor-wait"
                                        : "border-border hover:border-primary/50 hover:bg-primary/5"
                                    )}
                                  >
                                    <input
                                      type="file"
                                      accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv,.avi,.m4v"
                                      className="hidden"
                                      disabled={uploadingVideo !== null}
                                      onChange={(e) => handleVideoUpload(e, selectedModuleIdx, lesIdx)}
                                    />
                                    {uploadingVideo?.modIdx === selectedModuleIdx && uploadingVideo?.lesIdx === lesIdx ? (
                                      <div className="flex flex-col items-center gap-2 w-full max-w-xs text-primary">
                                        <Loader2 className="size-6 animate-spin" />
                                        <span className="text-xs font-semibold">
                                          {fr ? `Téléversement vers Supabase... ${uploadingVideo.progress}%` : `Uploading to Supabase Storage... ${uploadingVideo.progress}%`}
                                        </span>
                                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                          <div
                                            className="bg-primary h-full transition-all duration-150"
                                            style={{ width: `${uploadingVideo.progress}%` }}
                                          />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                          <UploadCloud className="size-4" />
                                        </div>
                                        <p className="text-xs font-semibold text-foreground">
                                          {fr ? "Cliquez pour téléverser la vidéo depuis votre PC" : "Click to upload video from local PC"}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          MP4, MOV, WEBM, MKV (Max 500MB) — {fr ? "Sauvegardé sur Supabase Storage" : "Saved directly to Supabase Storage"}
                                        </p>
                                      </div>
                                    )}
                                  </label>
                                )}
                              </div>
                            )}

                            {/* Mode B: Attach Video Link */}
                            {les.videoMode === "link" && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={les.videoUrl}
                                    onChange={(e) => {
                                      const updated = [...modules];
                                      const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                      if (l) {
                                        l.videoUrl = e.target.value;
                                        setModules(updated);
                                      }
                                    }}
                                    placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/... or https://.../video.mp4"
                                    className="h-8 text-xs font-mono"
                                  />
                                  {les.videoUrl && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const updated = [...modules];
                                        const l = updated[selectedModuleIdx]?.lessons[lesIdx];
                                        if (l) {
                                          l.videoUrl = "";
                                          delete l.videoFileName;
                                          setModules(updated);
                                        }
                                      }}
                                      className="h-8 text-xs text-muted-foreground hover:text-destructive shrink-0"
                                    >
                                      <Trash2 className="size-3.5 mr-1" />
                                      {fr ? "Effacer" : "Clear"}
                                    </Button>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {fr
                                    ? "Compatible YouTube, Vimeo, Loom et liens MP4 directs. Sera affiché dans le dashboard étudiant."
                                    : "Compatible with YouTube, Vimeo, Loom, and direct MP4 URLs. Renders seamlessly in student dashboard."}
                                </p>

                                {/* Live Link Preview */}
                                {les.videoUrl && (
                                  <div className="rounded-md border border-border/70 overflow-hidden bg-black/95 mt-2">
                                    <LessonVideoPlayer url={les.videoUrl} className="max-h-52" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* REAL FILE UPLOADER (PDF, PPT, PPTX, DOC, DOCX) */}
                          <div className="border-t border-border pt-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                                <Download className="size-3 text-primary" />
                                {fr
                                  ? "Fichiers à Télécharger (PDF, PPT, PPTX, DOC, DOCX)"
                                  : "Downloadable Files (PDF, PPT, PPTX, DOC, DOCX)"}
                              </span>
                            </div>

                            {/* Drop & Upload Trigger */}
                            <label
                              className={cn(
                                "flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors text-xs",
                                uploadingTarget?.modIdx === selectedModuleIdx && uploadingTarget?.lesIdx === lesIdx
                                  ? "bg-primary/10 border-primary cursor-wait"
                                  : "border-border hover:border-primary/50 hover:bg-muted/40"
                              )}
                            >
                              <input
                                type="file"
                                accept=".pdf,.ppt,.pptx,.doc,.docx"
                                className="hidden"
                                disabled={uploadingTarget !== null}
                                onChange={(e) => handleFileUpload(e, selectedModuleIdx, lesIdx)}
                              />
                              {uploadingTarget?.modIdx === selectedModuleIdx && uploadingTarget?.lesIdx === lesIdx ? (
                                <span className="flex items-center gap-1.5 text-primary font-medium">
                                  <Loader2 className="size-4 animate-spin" />
                                  {fr ? "Téléversement en cours..." : "Uploading file..."}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                  <UploadCloud className="size-4 text-primary" />
                                  {fr
                                    ? "Glissez ou cliquez pour déposer un fichier depuis votre PC (.pdf, .ppt, .docx)"
                                    : "Drop or click to upload file from your PC (.pdf, .ppt, .docx)"}
                                </span>
                              )}
                            </label>

                            {/* Attached Files List */}
                            {les.resources.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                {les.resources.map((res, resIdx) => (
                                  <div
                                    key={resIdx}
                                    className="flex items-center justify-between gap-2 bg-muted/40 px-2.5 py-1.5 rounded border border-border/70"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText className="size-3.5 text-primary shrink-0" />
                                      <span className="font-medium truncate text-[11px] text-foreground">
                                        {res.nameEn}
                                      </span>
                                      <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                        {res.type} · {res.sizeKb} KB
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <a
                                        href={res.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline flex items-center gap-0.5 text-[10px]"
                                      >
                                        <ExternalLink className="size-3" />
                                        {fr ? "Voir" : "View"}
                                      </a>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeResource(selectedModuleIdx, lesIdx, resIdx)}
                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                      >
                                        <X className="size-3" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* PER-LESSON QUIZ BUILDER */}
                          <div className="border-t border-border pt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                <HelpCircle className="size-3.5 text-amber-500" />
                                <span>{fr ? "Quiz de cette Leçon" : "Per-Lesson Quiz (Assessment)"}</span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant={les.quiz ? "destructive" : "outline"}
                                onClick={() => toggleLessonQuiz(selectedModuleIdx, lesIdx)}
                                className="h-6 text-[11px] px-2"
                              >
                                {les.quiz
                                  ? fr
                                    ? "Supprimer le Quiz"
                                    : "Remove Quiz"
                                  : fr
                                  ? "+ Activer le Quiz de Leçon"
                                  : "+ Add Lesson Quiz"}
                              </Button>
                            </div>

                            {les.quiz && (
                              <div className="bg-amber-500/5 border border-amber-500/20 p-3 rounded-lg space-y-3">
                                <div className="grid gap-2.5 sm:grid-cols-3">
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">{fr ? "Titre Quiz (EN)" : "Quiz Title (EN)"}</Label>
                                    <Input
                                      value={les.quiz.titleEn}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const quiz = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz;
                                        if (quiz) quiz.titleEn = e.target.value;
                                        setModules(updated);
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">{fr ? "Titre Quiz (FR)" : "Quiz Title (FR)"}</Label>
                                    <Input
                                      value={les.quiz.titleFr}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const quiz = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz;
                                        if (quiz) quiz.titleFr = e.target.value;
                                        setModules(updated);
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px]">{fr ? "Score requis (%)" : "Pass Score (%)"}</Label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={100}
                                      value={les.quiz.passingScore}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const quiz = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz;
                                        if (quiz) quiz.passingScore = Number(e.target.value);
                                        setModules(updated);
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                </div>

                                {/* Questions List */}
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                      {fr ? `Questions d'Évaluation (${les.quiz.questions.length})` : `Assessment Questions (${les.quiz.questions.length})`}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addQuestionToLessonQuiz(selectedModuleIdx, lesIdx)}
                                      className="h-6 text-[11px] text-primary border-primary/30 hover:bg-primary/5"
                                    >
                                      <Plus className="size-3 mr-1" />
                                      {fr ? "Ajouter une question" : "Add Question"}
                                    </Button>
                                  </div>

                                  {les.quiz.questions.map((q, qIdx) => (
                                    <div key={qIdx} className="bg-background/95 p-3 rounded-lg border border-border/80 space-y-2.5 shadow-sm">
                                      {/* Question Top Bar: Index, Type Selector, Points, Delete */}
                                      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="secondary" className="text-[10px] font-bold">
                                            Q{q.orderIndex}
                                          </Badge>
                                          {/* Type Dropdown */}
                                          <div className="flex items-center gap-1.5">
                                            <Label className="text-[10px] text-muted-foreground">{fr ? "Type :" : "Type:"}</Label>
                                            <select
                                              value={q.type || "MULTIPLE_CHOICE"}
                                              onChange={(e) =>
                                                changeQuestionType(
                                                  selectedModuleIdx,
                                                  lesIdx,
                                                  qIdx,
                                                  e.target.value as "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK"
                                                )
                                              }
                                              className="h-6 text-[11px] bg-background border border-input rounded px-1.5 font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                            >
                                              <option value="MULTIPLE_CHOICE">
                                                {fr ? "🔘 Choix Multiple (QCM)" : "🔘 Multiple Choice (MCQ)"}
                                              </option>
                                              <option value="TRUE_FALSE">
                                                {fr ? "⚖️ Vrai ou Faux" : "⚖️ True / False"}
                                              </option>
                                              <option value="FILL_BLANK">
                                                {fr ? "✏️ Texte à trous" : "✏️ Fill in the Blank"}
                                              </option>
                                            </select>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <div className="flex items-center gap-1">
                                            <Label className="text-[10px] text-muted-foreground">{fr ? "Points :" : "Points:"}</Label>
                                            <input
                                              type="number"
                                              min={1}
                                              max={50}
                                              value={q.points}
                                              onChange={(e) => {
                                                const updated = [...modules];
                                                const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                                if (question) question.points = Math.max(1, Number(e.target.value) || 1);
                                                setModules(updated);
                                              }}
                                              className="h-6 w-12 text-[11px] bg-background border border-input rounded px-1 text-center font-mono"
                                            />
                                          </div>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeQuestionFromLessonQuiz(selectedModuleIdx, lesIdx, qIdx)}
                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            title={fr ? "Supprimer cette question" : "Delete this question"}
                                          >
                                            <Trash2 className="size-3 text-destructive" />
                                          </Button>
                                        </div>
                                      </div>

                                      {/* Prompt EN & FR */}
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">{fr ? "Énoncé de question (Anglais)" : "Question Prompt (English)"}</Label>
                                          <Input
                                            value={q.promptEn}
                                            onChange={(e) => {
                                              const updated = [...modules];
                                              const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                              if (question) question.promptEn = e.target.value;
                                              setModules(updated);
                                            }}
                                            placeholder="Question prompt (English)"
                                            className="h-7 text-xs"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">{fr ? "Énoncé de question (Français)" : "Question Prompt (French)"}</Label>
                                          <Input
                                            value={q.promptFr}
                                            onChange={(e) => {
                                              const updated = [...modules];
                                              const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                              if (question) question.promptFr = e.target.value;
                                              setModules(updated);
                                            }}
                                            placeholder="Intitulé de question (Français)"
                                            className="h-7 text-xs"
                                          />
                                        </div>
                                      </div>

                                      {/* Answer Options according to Type */}
                                      {/* TYPE 1: MULTIPLE CHOICE */}
                                      {(!q.type || q.type === "MULTIPLE_CHOICE") && (
                                        <div className="space-y-1.5 pt-1">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-semibold text-muted-foreground">
                                              {fr ? "Choix de réponse (Cochez la/les réponse(s) correcte(s))" : "Answer Choices (Check the correct option(s))"}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => addOptionToQuestion(selectedModuleIdx, lesIdx, qIdx)}
                                              className="text-[10px] text-primary hover:underline font-semibold"
                                            >
                                              + {fr ? "Ajouter un choix" : "Add Option Choice"}
                                            </button>
                                          </div>
                                          <div className="space-y-1.5">
                                            {q.options.map((opt, optIdx) => (
                                              <div key={optIdx} className="flex items-center gap-2">
                                                <input
                                                  type="checkbox"
                                                  checked={opt.correct}
                                                  onChange={(e) => {
                                                    const updated = [...modules];
                                                    const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                                    if (question?.options[optIdx]) {
                                                      question.options[optIdx].correct = e.target.checked;
                                                      setModules(updated);
                                                    }
                                                  }}
                                                  title={fr ? "Marquer comme bonne réponse" : "Mark as correct option"}
                                                  className="rounded text-primary focus:ring-primary size-4 shrink-0 cursor-pointer"
                                                />
                                                <Input
                                                  value={opt.labelEn}
                                                  onChange={(e) => {
                                                    const updated = [...modules];
                                                    const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                                    if (question?.options[optIdx]) {
                                                      question.options[optIdx].labelEn = e.target.value;
                                                      setModules(updated);
                                                    }
                                                  }}
                                                  placeholder={`Option ${opt.orderIndex} (EN)`}
                                                  className="h-7 text-xs flex-1"
                                                />
                                                <Input
                                                  value={opt.labelFr}
                                                  onChange={(e) => {
                                                    const updated = [...modules];
                                                    const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                                    if (question?.options[optIdx]) {
                                                      question.options[optIdx].labelFr = e.target.value;
                                                      setModules(updated);
                                                    }
                                                  }}
                                                  placeholder={`Option ${opt.orderIndex} (FR)`}
                                                  className="h-7 text-xs flex-1"
                                                />
                                                {q.options.length > 2 && (
                                                  <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeOptionFromQuestion(selectedModuleIdx, lesIdx, qIdx, optIdx)}
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                                    title={fr ? "Supprimer cette option" : "Remove this option"}
                                                  >
                                                    <Trash2 className="size-3 text-destructive" />
                                                  </Button>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}

                                      {/* TYPE 2: TRUE / FALSE */}
                                      {q.type === "TRUE_FALSE" && (
                                        <div className="space-y-1.5 pt-1 bg-muted/20 p-2.5 rounded-lg border border-border/50">
                                          <Label className="text-[10px] font-semibold text-muted-foreground block">
                                            {fr ? "Sélectionnez la réponse correcte :" : "Select the Correct Answer:"}
                                          </Label>
                                          <div className="grid grid-cols-2 gap-3">
                                            <label
                                              className={cn(
                                                "flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-all",
                                                q.options[0]?.correct
                                                  ? "border-primary bg-primary/10 font-semibold text-primary"
                                                  : "border-border bg-background hover:bg-muted"
                                              )}
                                            >
                                              <input
                                                type="radio"
                                                name={`tf-${lesIdx}-${qIdx}`}
                                                checked={q.options[0]?.correct === true}
                                                onChange={() => {
                                                  const updated = [...modules];
                                                  const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                                  if (question) {
                                                    question.options = [
                                                      { orderIndex: 1, labelEn: "True", labelFr: "Vrai", correct: true },
                                                      { orderIndex: 2, labelEn: "False", labelFr: "Faux", correct: false },
                                                    ];
                                                    setModules(updated);
                                                  }
                                                }}
                                                className="size-4 text-primary"
                                              />
                                              <span className="text-xs font-medium">✅ {fr ? "Vrai (True)" : "True (Vrai)"}</span>
                                            </label>

                                            <label
                                              className={cn(
                                                "flex items-center gap-2.5 p-2 rounded-md border cursor-pointer transition-all",
                                                q.options[1]?.correct
                                                  ? "border-destructive bg-destructive/10 font-semibold text-destructive"
                                                  : "border-border bg-background hover:bg-muted"
                                              )}
                                            >
                                              <input
                                                type="radio"
                                                name={`tf-${lesIdx}-${qIdx}`}
                                                checked={q.options[1]?.correct === true}
                                                onChange={() => {
                                                  const updated = [...modules];
                                                  const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                                  if (question) {
                                                    question.options = [
                                                      { orderIndex: 1, labelEn: "True", labelFr: "Vrai", correct: false },
                                                      { orderIndex: 2, labelEn: "False", labelFr: "Faux", correct: true },
                                                    ];
                                                    setModules(updated);
                                                  }
                                                }}
                                                className="size-4 text-primary"
                                              />
                                              <span className="text-xs font-medium">❌ {fr ? "Faux (False)" : "False (Faux)"}</span>
                                            </label>
                                          </div>
                                        </div>
                                      )}

                                      {/* TYPE 3: FILL IN THE BLANK */}
                                      {q.type === "FILL_BLANK" && (
                                        <div className="space-y-1.5 pt-1 bg-muted/20 p-2.5 rounded-lg border border-border/50">
                                          <Label className="text-[10px] font-semibold text-muted-foreground block">
                                            {fr ? "Mot-clé ou réponse exacte attendue (insensible à la casse) :" : "Expected Exact Answer / Keyword (Case-insensitive):"}
                                          </Label>
                                          <Input
                                            value={q.correctText || ""}
                                            onChange={(e) => {
                                              const updated = [...modules];
                                              const question = updated[selectedModuleIdx]?.lessons[lesIdx]?.quiz?.questions[qIdx];
                                              if (question) {
                                                question.correctText = e.target.value;
                                                question.options = [
                                                  { orderIndex: 1, labelEn: e.target.value || "Answer", labelFr: e.target.value || "Réponse", correct: true },
                                                ];
                                                setModules(updated);
                                              }
                                            }}
                                            placeholder={fr ? "ex. Photosynthèse" : "e.g. Photosynthesis"}
                                            className="h-7 text-xs font-mono"
                                          />
                                          <p className="text-[10px] text-muted-foreground italic">
                                            {fr
                                              ? "L'élève devra saisir ce mot ou expression pour obtenir les points lors du test."
                                              : "The student will need to type this word or phrase to receive points."}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* PER-LESSON AUTOMATED LIVE SESSION */}
                          <div className="border-t border-border pt-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                                <Radio className="size-3.5 text-blue-500" />
                                <span>{fr ? "Session en Direct Automatisée (Google Meet)" : "Automated Live Session (Google Meet)"}</span>
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant={les.liveSession ? "destructive" : "outline"}
                                onClick={() => toggleLessonLive(selectedModuleIdx, lesIdx)}
                                className="h-6 text-[11px] px-2"
                              >
                                {les.liveSession
                                  ? fr
                                    ? "Supprimer le Live"
                                    : "Remove Live"
                                  : fr
                                  ? "+ Automatiser le Live de Leçon"
                                  : "+ Automate Live Session"}
                              </Button>
                            </div>

                            {les.liveSession && (
                              <div className="bg-blue-500/5 border border-blue-500/20 p-3 rounded-lg space-y-2.5">
                                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  <div>
                                    <Label className="text-[10px]">{fr ? "Titre Live (EN)" : "Live Debrief Title (EN)"}</Label>
                                    <Input
                                      value={les.liveSession.titleEn}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const session = updated[selectedModuleIdx]?.lessons[lesIdx]?.liveSession;
                                        if (session) session.titleEn = e.target.value;
                                        setModules(updated);
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px]">{fr ? "Titre Live (FR)" : "Live Debrief Title (FR)"}</Label>
                                    <Input
                                      value={les.liveSession.titleFr}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const session = updated[selectedModuleIdx]?.lessons[lesIdx]?.liveSession;
                                        if (session) session.titleFr = e.target.value;
                                        setModules(updated);
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px]">Video Meeting Link (paste real Google Meet/Zoom, or use auto-generated Jitsi room)</Label>
                                    <div className="flex items-center gap-1">
                                      <Input
                                        value={les.liveSession.meetUrl}
                                        onChange={(e) => {
                                          const updated = [...modules];
                                          const session = updated[selectedModuleIdx]?.lessons[lesIdx]?.liveSession;
                                          if (session) session.meetUrl = e.target.value;
                                          setModules(updated);
                                        }}
                                        className="h-7 text-xs font-mono"
                                      />
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          const updated = [...modules];
                                          const session = updated[selectedModuleIdx]?.lessons[lesIdx]?.liveSession;
                                          if (session) session.meetUrl = generateMeetUrl();
                                          setModules(updated);
                                          toast.success("New Jitsi Meet room generated! Or paste your own Google Meet / Zoom link.");
                                        }}
                                        className="h-7 px-2 text-[10px]"
                                      >
                                        ↻
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        asChild
                                        className="h-7 px-2 text-[10px]"
                                        title={fr ? "Ouvrir Google Meet pour créer un lien" : "Open Google Meet to create/verify room"}
                                      >
                                        <a href="https://meet.google.com/new" target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="size-3" />
                                        </a>
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-3">
                                  <div>
                                    <Label className="text-[10px]">{fr ? "Début" : "Starts At"}</Label>
                                    <Input
                                      type="datetime-local"
                                      value={les.liveSession.startsAt}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const session = updated[selectedModuleIdx]?.lessons[lesIdx]?.liveSession;
                                        if (session) session.startsAt = e.target.value;
                                        setModules(updated);
                                      }}
                                      className="h-7 text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px]">{fr ? "Fin" : "Ends At"}</Label>
                                    <Input
                                      type="datetime-local"
                                      value={les.liveSession.endsAt}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const session = updated[selectedModuleIdx]?.lessons[lesIdx]?.liveSession;
                                        if (session) session.endsAt = e.target.value;
                                        setModules(updated);
                                      }}
                                      className="h-7 text-[11px]"
                                    />
                                  </div>
                                  <div>
                                    <Label className="text-[10px]">{fr ? "Formateur" : "Instructor"}</Label>
                                    <Input
                                      value={les.liveSession.instructorName}
                                      onChange={(e) => {
                                        const updated = [...modules];
                                        const session = updated[selectedModuleIdx]?.lessons[lesIdx]?.liveSession;
                                        if (session) session.instructorName = e.target.value;
                                        setModules(updated);
                                      }}
                                      className="h-7 text-xs"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Footer Save & Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              {activeTab === "general" ? (
                <Button type="button" onClick={() => setActiveTab("modules")} variant="outline">
                  {fr ? "Suivant : Configurer les Modules →" : "Next: Configure Modules →"}
                </Button>
              ) : (
                <Button type="button" onClick={() => setActiveTab("general")} variant="outline">
                  {fr ? "← Retour aux Informations" : "← Back to General Info"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {fr ? "Création en cours..." : "Creating in Database..."}
                  </>
                ) : (
                  <>
                    <Check className="mr-2 size-4" />
                    {fr ? "Publier le Cours Complet" : "Save & Publish Full Course"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
