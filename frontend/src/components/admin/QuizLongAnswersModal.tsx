import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  User,
  Check,
  Loader2,
  X,
  BookOpen,
  Filter,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Award,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useI18n, useLocalized } from "@/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import { formatLocalizedDateTime } from "@/lib/timezone";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialCohortId?: string | null;
  initialQuizId?: string | null;
  quizTitle?: string | null;
}

export function QuizLongAnswersModal({
  isOpen,
  onClose,
  initialCohortId,
  initialQuizId,
  quizTitle,
}: Props) {
  const { locale } = useI18n();
  const fr = locale === "fr";

  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "GRADED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);

  // Grading form state for selected submission
  const [manualScore, setManualScore] = useState<string>("");
  const [manualRating, setManualRating] = useState<string>("");
  const [manualFeedback, setManualFeedback] = useState<string>("");
  const [savingGrade, setSavingGrade] = useState(false);

  const fetchSubmissions = async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await api.getQuizLongAnswers({
        cohortId: initialCohortId || undefined,
        quizId: initialQuizId || undefined,
        status: filterStatus === "ALL" ? undefined : filterStatus,
        search: searchQuery || undefined,
      });
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setSubmissions(list);
      if (selectedSubmission) {
        const updated = list.find((s: any) => s.answerId === selectedSubmission.answerId);
        if (updated) {
          setSelectedSubmission(updated);
          setManualScore(updated.manualScore !== null && updated.manualScore !== undefined ? String(updated.manualScore) : "");
          setManualRating(updated.manualRating || "");
          setManualFeedback(updated.manualFeedback || "");
        }
      }
    } catch (err: any) {
      toast.error(err.message || (fr ? "Échec du chargement des réponses" : "Failed to load responses"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSubmissions();
    } else {
      setSelectedSubmission(null);
    }
  }, [isOpen, filterStatus, initialCohortId, initialQuizId]);

  const handleSelectSubmission = (sub: any) => {
    setSelectedSubmission(sub);
    setManualScore(sub.manualScore !== null && sub.manualScore !== undefined ? String(sub.manualScore) : "");
    setManualRating(sub.manualRating || "");
    setManualFeedback(sub.manualFeedback || "");
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;
    setSavingGrade(true);
    try {
      await api.gradeQuizAnswer(selectedSubmission.answerId, {
        manualScore: manualScore ? Number(manualScore) : null,
        manualRating: manualRating.trim() || null,
        manualFeedback: manualFeedback.trim() || null,
      });

      toast.success(
        fr
          ? "Évaluation et commentaire enregistrés avec succès !"
          : "Evaluation and feedback saved successfully!"
      );
      await fetchSubmissions();
    } catch (err: any) {
      toast.error(err.message || (fr ? "Erreur lors de l'enregistrement" : "Failed to save grade"));
    } finally {
      setSavingGrade(false);
    }
  };

  const pendingCount = submissions.filter((s) => s.status === "PENDING").length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden bg-card border-border">
        {/* Header */}
        <div className="p-5 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                <FileText className="size-4" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {fr ? "Évaluation des réponses rédigées" : "Long Answer Submissions & Evaluation"}
              </DialogTitle>
              {pendingCount > 0 && (
                <Badge variant="destructive" className="text-[10px] font-bold">
                  {pendingCount} {fr ? "en attente" : "pending"}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {quizTitle
                ? `${fr ? "Quiz :" : "Quiz:"} ${quizTitle}`
                : fr
                ? "Consultez les réponses développées des participants et attribuez des appréciations ou notes manuelles."
                : "Review detailed student answers and assign qualitative feedback and manual ratings."}
            </DialogDescription>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-border p-0.5 bg-background text-xs">
              <button
                type="button"
                onClick={() => setFilterStatus("ALL")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                  filterStatus === "ALL" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fr ? "Toutes" : "All"} ({submissions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("PENDING")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                  filterStatus === "PENDING" ? "bg-amber-500 text-white font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fr ? "À corriger" : "Pending"}
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("GRADED")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                  filterStatus === "GRADED" ? "bg-emerald-600 text-white font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {fr ? "Évaluées" : "Graded"}
              </button>
            </div>

            <Button size="sm" variant="outline" onClick={fetchSubmissions} disabled={loading} className="h-8 gap-1.5 text-xs">
              <Loader2 className={cn("size-3.5", loading && "animate-spin")} />
              {fr ? "Actualiser" : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Content Body: Split View (List on left, Grading detail on right) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Submissions List */}
          <div className="md:col-span-5 border-r border-border flex flex-col h-full overflow-hidden bg-background">
            <div className="p-3 border-b border-border bg-muted/10 shrink-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchSubmissions()}
                  placeholder={fr ? "Rechercher élève, texte..." : "Search student, answer..."}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {loading && submissions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                  <span>{fr ? "Chargement des copies..." : "Loading submissions..."}</span>
                </div>
              ) : submissions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold">{fr ? "Aucune réponse trouvée" : "No responses found"}</p>
                  <p className="text-[11px] opacity-75">
                    {fr
                      ? "Les participants n'ont pas encore soumis de réponse rédigée pour ce filtre."
                      : "No students have submitted long-form answers matching this filter."}
                  </p>
                </div>
              ) : (
                submissions.map((sub: any) => {
                  const isSelected = selectedSubmission?.answerId === sub.answerId;
                  const isGraded = sub.status === "GRADED";
                  return (
                    <button
                      key={sub.answerId}
                      type="button"
                      onClick={() => handleSelectSubmission(sub)}
                      className={cn(
                        "w-full text-left p-3.5 transition-all flex flex-col gap-1.5 cursor-pointer",
                        isSelected
                          ? "bg-primary/10 border-l-4 border-l-primary"
                          : "hover:bg-muted/40 border-l-4 border-l-transparent"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-foreground truncate">
                          {sub.userName || sub.userEmail}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] px-1.5 py-0 h-4 shrink-0 font-semibold",
                            isGraded
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          )}
                        >
                          {isGraded ? (fr ? "Évalué" : "Graded") : (fr ? "En attente" : "Pending")}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-muted-foreground font-medium line-clamp-1">
                        {sub.promptEn || sub.promptFr || (fr ? "Question rédigée" : "Written question")}
                      </p>

                      <p className="text-[11px] text-foreground/80 line-clamp-2 italic bg-muted/30 p-1.5 rounded">
                        "{sub.givenAnswer || "—"}"
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                        <span>
                          {sub.submittedAt ? formatLocalizedDateTime(sub.submittedAt) : "—"}
                        </span>
                        {isGraded && sub.manualRating && (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {sub.manualRating}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Submission Details & Grading Panel */}
          <div className="md:col-span-7 flex flex-col h-full overflow-y-auto bg-card">
            {selectedSubmission ? (
              <form onSubmit={handleSaveGrade} className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Top Meta */}
                  <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">
                          {selectedSubmission.userName}
                        </h3>
                        <span className="text-xs text-muted-foreground">({selectedSubmission.userEmail})</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{selectedSubmission.cohortName || "ILSI Cohort"}</span>
                        <span>•</span>
                        <span>
                          {fr ? "Quiz :" : "Quiz:"} {selectedSubmission.quizTitleFr || selectedSubmission.quizTitleEn}
                        </span>
                        {selectedSubmission.attemptNumber && (
                          <>
                            <span>•</span>
                            <span>
                              {fr ? "Tentative #" : "Attempt #"}{selectedSubmission.attemptNumber}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <Badge
                      className={cn(
                        "text-xs px-2 py-0.5 font-semibold",
                        selectedSubmission.status === "GRADED"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      )}
                    >
                      {selectedSubmission.status === "GRADED"
                        ? fr ? "Évalué" : "Evaluated"
                        : fr ? "En attente d'évaluation" : "Awaiting Evaluation"}
                    </Badge>
                  </div>

                  {/* Question Prompt */}
                  <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                      {fr ? "Énoncé de la question :" : "Question Prompt:"}
                    </span>
                    <p className="text-xs font-semibold text-foreground leading-relaxed">
                      {selectedSubmission.promptEn}
                    </p>
                    {selectedSubmission.promptFr && selectedSubmission.promptFr !== selectedSubmission.promptEn && (
                      <p className="text-[11px] text-muted-foreground">
                        {selectedSubmission.promptFr}
                      </p>
                    )}
                  </div>

                  {/* Student Answer Box */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <MessageSquare className="size-3.5 text-blue-500" />
                        <span>{fr ? "Réponse rédigée du participant :" : "Student Written Response:"}</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        {(selectedSubmission.givenAnswer || "").length} {fr ? "caractères" : "characters"}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-muted/20 text-xs text-foreground font-normal leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto select-text shadow-inner">
                      {selectedSubmission.givenAnswer || (fr ? "Aucune réponse saisie." : "No answer provided.")}
                    </div>
                  </div>

                  {/* Grading & Feedback Form */}
                  <div className="pt-2 border-t border-border space-y-3.5">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Award className="size-3.5 text-amber-500" />
                      <span>{fr ? "Notation & Appréciation du formateur" : "Grading & Instructor Appreciation"}</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          {fr ? "Appréciation / Mention :" : "Rating / Assessment:"}
                        </label>
                        <select
                          value={manualRating}
                          onChange={(e) => setManualRating(e.target.value)}
                          className="w-full h-8 text-xs bg-background border border-input rounded-md px-2 font-medium text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="">{fr ? "-- Sélectionner une mention --" : "-- Select Rating --"}</option>
                          <option value="Excellent">{fr ? "🌟 Excellent (Très satisfaisant)" : "🌟 Excellent (Exemplary)"}</option>
                          <option value="Très Bien">{fr ? "✅ Très Bien (Bien assimilé)" : "✅ Very Good (Proficient)"}</option>
                          <option value="Satisfaisant">{fr ? "👍 Satisfaisant (Acceptable)" : "👍 Satisfactory (Pass)"}</option>
                          <option value="À approfondir">{fr ? "⚠️ À approfondir (Incomplet)" : "⚠️ Needs Improvement"}</option>
                          <option value="Non validé">{fr ? "❌ Non validé (Hors sujet)" : "❌ Unsatisfactory"}</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          {fr ? "Note chiffrée (optionnelle, ex: 10) :" : "Numeric Score (optional, e.g. 10):"}
                        </label>
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          value={manualScore}
                          onChange={(e) => setManualScore(e.target.value)}
                          placeholder={fr ? "ex. 8.5" : "e.g. 8.5"}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        {fr
                          ? "Commentaire personnalisé adressé au participant :"
                          : "Personalized Trainer Feedback to Student:"}
                      </label>
                      <Textarea
                        rows={3}
                        value={manualFeedback}
                        onChange={(e) => setManualFeedback(e.target.value)}
                        placeholder={
                          fr
                            ? "Ajoutez vos retours constructifs, points forts et axes d'amélioration..."
                            : "Provide constructive feedback, praise strong points, or suggest improvements..."
                        }
                        className="text-xs leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-[11px] text-muted-foreground italic">
                    {fr
                      ? "Le participant pourra consulter votre commentaire dans son corrigé."
                      : "The student will see your feedback in their quiz review."}
                  </span>

                  <Button type="submit" disabled={savingGrade} size="sm" className="gap-1.5">
                    {savingGrade ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    {fr ? "Enregistrer l'évaluation" : "Save Evaluation"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-2">
                <FileText className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground">
                  {fr ? "Sélectionnez une réponse" : "Select a submission"}
                </p>
                <p className="text-xs max-w-sm">
                  {fr
                    ? "Cliquez sur une copie dans la liste de gauche pour lire la réponse complète et lui attribuer une note ou une appréciation."
                    : "Click any submission from the left panel to read the full student response and grade it."}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
