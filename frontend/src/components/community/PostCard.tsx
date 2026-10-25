import { useState } from "react";
import {
  Bookmark,
  Check,
  Download,
  Edit2,
  FileText,
  Flag,
  Heart,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreVertical,
  Pin,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommentSection } from "./CommentSection";
import { ReportModal } from "./ReportModal";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/i18n/LocaleProvider";

interface PostCardProps {
  post: any;
  currentUserId: string;
  currentUserRole?: string | undefined;
  onPostUpdated?: ((updated: any) => void) | undefined;
  onPostDeleted?: ((postId: string) => void) | undefined;
}

const EMOJI_REACTIONS: { type: string; emoji: string; label: string }[] = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "heart", emoji: "❤️", label: "Love" },
  { type: "clap", emoji: "👏", label: "Applaud" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
  { type: "insightful", emoji: "💡", label: "Insightful" },
  { type: "fire", emoji: "🔥", label: "Inspiring" },
];

export function PostCard({
  post,
  currentUserId,
  currentUserRole,
  onPostUpdated,
  onPostDeleted,
}: PostCardProps) {
  const { t, locale } = useI18n();
  const fr = locale === "fr";

  const [showComments, setShowComments] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [userReaction, setUserReaction] = useState<string | null>(post.user_reaction || null);
  const [reactionsBreakdown, setReactionsBreakdown] = useState<Record<string, number>>(
    post.reactionsBreakdown || {}
  );
  const [likeCount, setLikeCount] = useState<number>(post.like_count || 0);
  const [reacting, setReacting] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);

  const isAuthor = post.author_id === currentUserId;
  const isAdmin = currentUserRole === "SUPER_ADMIN" || currentUserRole === "ADMIN";
  const isTrainer = post.author_is_cohort_trainer;

  const handleReaction = async (reactionType: string) => {
    if (reacting) return;
    setReacting(true);

    const prevReaction = userReaction;
    const prevBreakdown = { ...reactionsBreakdown };
    const prevLikes = likeCount;

    // Optimistic UI calculation: instantaneous feedback
    const isRemoving = prevReaction === reactionType;
    const newReaction = isRemoving ? null : reactionType;
    const newBreakdown = { ...prevBreakdown };

    if (prevReaction) {
      newBreakdown[prevReaction] = Math.max(0, (newBreakdown[prevReaction] || 1) - 1);
    }
    if (!isRemoving) {
      newBreakdown[reactionType] = (newBreakdown[reactionType] || 0) + 1;
    }

    setUserReaction(newReaction);
    setReactionsBreakdown(newBreakdown);
    setLikeCount(isRemoving ? Math.max(0, prevLikes - 1) : (!prevReaction ? prevLikes + 1 : prevLikes));

    try {
      const res = await api.toggleCommunityReaction({
        targetType: "post",
        targetId: post.id,
        reactionType,
      });

      setUserReaction(res.userReaction);
      setReactionsBreakdown(res.reactionsBreakdown);
    } catch (err: any) {
      // Rollback on failure
      setUserReaction(prevReaction);
      setReactionsBreakdown(prevBreakdown);
      setLikeCount(prevLikes);
      toast.error(err.message || "Failed to update reaction.");
    } finally {
      setReacting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(fr ? "Êtes-vous sûr de vouloir supprimer cette publication ?" : "Are you sure you want to delete this post?")) return;
    try {
      await api.deleteCommunityPost(post.id);
      toast.success(fr ? "Publication supprimée." : "Post deleted.");
      onPostDeleted?.(post.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete post.");
    }
  };

  const handleTogglePin = async () => {
    try {
      const action = post.pinned ? "UNPIN_POST" : "PIN_POST";
      await api.moderateCommunityPost(post.id, action);
      toast.success(post.pinned ? "Post unpinned." : "Post pinned to top.");
      onPostUpdated?.({ ...post, pinned: !post.pinned });
    } catch (err: any) {
      toast.error(err.message || "Failed to pin/unpin post.");
    }
  };

  const handleOpenAttachment = async (attachmentId: string) => {
    setOpeningAttachmentId(attachmentId);
    try {
      const res = await api.getAttachmentAccessUrl(attachmentId);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to open attachment.");
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  return (
    <article
      className={`panel border rounded-2xl p-4 sm:p-6 transition-all ${
        post.pinned
          ? "border-primary/40 bg-primary/[0.02] shadow-[var(--shadow-soft)] ring-1 ring-primary/20"
          : "border-border/70 bg-card hover:border-border shadow-xs"
      }`}
    >
      {/* Pinned announcement banner */}
      {post.pinned && (
        <div className="flex items-center gap-1.5 text-xs font-bold text-primary mb-3.5 pb-2.5 border-b border-primary/20">
          <Pin className="size-3.5 fill-current" />
          <span>{t("community.pinned")}</span>
        </div>
      )}

      {/* Post Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm uppercase overflow-hidden shrink-0 border border-primary/20">
            {post.author_image ? (
              <img src={post.author_image} alt={post.author_name} className="size-full object-cover" />
            ) : (
              post.author_name?.charAt(0) || "U"
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground text-sm">{post.author_name}</span>

              {isTrainer && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 py-0 px-2 gap-1 font-semibold">
                  <UserCheck className="size-3" />
                  {t("community.trainerBadge")}
                </Badge>
              )}

              {post.type === "ANNOUNCEMENT" && (
                <Badge className="text-[10px] bg-hero-lime text-hero-lime-foreground border-transparent py-0 px-2 font-bold">
                  {fr ? "Annonce" : "Announcement"}
                </Badge>
              )}

              {post.type === "QUESTION" && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 py-0 px-2">
                  Question
                </Badge>
              )}

              {post.type === "ACHIEVEMENT" && (
                <Badge className="text-[10px] bg-emerald-600 text-white border-transparent py-0 px-2 gap-1">
                  <Trophy className="size-3" />
                  {fr ? "Réussite" : "Achievement"}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {post.author_headline && <span className="truncate max-w-[220px]">{post.author_headline}</span>}
              {post.author_headline && <span>•</span>}
              <time dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString()}</time>
            </div>
          </div>
        </div>

        {/* Options Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl">
            {(isAdmin || (isTrainer && post.scope === "cohort")) && (
              <DropdownMenuItem onClick={handleTogglePin} className="gap-2 text-xs cursor-pointer">
                <Pin className="size-3.5" />
                {post.pinned ? "Unpin post" : "Pin to top"}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => setReportOpen(true)} className="gap-2 text-xs text-muted-foreground cursor-pointer">
              <Flag className="size-3.5 text-muted-foreground" />
              {t("community.report")}
            </DropdownMenuItem>

            {(isAuthor || isAdmin) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="gap-2 text-xs text-destructive cursor-pointer">
                  <Trash2 className="size-3.5" />
                  {t("community.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Post Title & Content */}
      <div className="mt-3.5 space-y-2">
        {post.title && <h3 className="font-display font-semibold text-base text-foreground">{post.title}</h3>}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.content}</p>
      </div>

      {/* Attachments */}
      {post.attachments && post.attachments.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {post.attachments.map((att: any) => (
            <button
              key={att.id}
              type="button"
              onClick={() => handleOpenAttachment(att.id)}
              disabled={openingAttachmentId === att.id}
              className="flex items-center justify-between p-2.5 rounded-xl border border-border/80 bg-muted/40 hover:bg-muted/70 transition-colors text-left text-xs group"
            >
              <div className="flex items-center gap-2 truncate">
                {att.fileType === "IMAGE" ? (
                  <ImageIcon className="size-4 text-primary shrink-0" />
                ) : (
                  <FileText className="size-4 text-amber-500 shrink-0" />
                )}
                <span className="font-medium truncate group-hover:text-primary transition-colors">
                  {att.fileName}
                </span>
              </div>
              <div className="shrink-0 text-muted-foreground ml-2">
                {openingAttachmentId === att.id ? (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                ) : (
                  <Download className="size-3.5 group-hover:translate-y-0.5 transition-transform" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Reactions Bar & Actions */}
      <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3">
        {/* Emoji Reactions Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {EMOJI_REACTIONS.map((emojiObj) => {
            const count = reactionsBreakdown[emojiObj.type] || 0;
            const isSelected = userReaction === emojiObj.type;

            return (
              <button
                key={emojiObj.type}
                type="button"
                onClick={() => handleReaction(emojiObj.type)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-transform active:scale-95 ${
                  isSelected
                    ? "bg-primary/15 text-primary border border-primary/40 font-bold shadow-xs"
                    : "hover:bg-muted border border-border/40 text-muted-foreground"
                }`}
                title={emojiObj.label}
              >
                <span>{emojiObj.emoji}</span>
                {count > 0 && <span className="text-[11px] font-semibold">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Comment toggle button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className="h-8 text-xs gap-1.5 font-medium text-muted-foreground hover:text-foreground"
        >
          <MessageSquare className="size-3.5" />
          <span>
            {post.comment_count || 0} {t("community.comments")}
          </span>
        </Button>
      </div>

      {/* Threaded Comments Section */}
      {showComments && (
        <CommentSection
          postId={post.id}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      )}

      {/* Report Modal */}
      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="post"
        targetId={post.id}
        targetTitle={post.title || post.content}
      />
    </article>
  );
}
