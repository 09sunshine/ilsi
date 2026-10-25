import { useState, useEffect } from "react";
import { CornerDownRight, Loader2, MessageSquare, MoreHorizontal, Send, Trash2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useI18n } from "@/i18n/LocaleProvider";

interface CommentSectionProps {
  postId: string;
  currentUserId: string;
  currentUserRole?: string | undefined;
}

export function CommentSection({ postId, currentUserId, currentUserRole }: CommentSectionProps) {
  const { t, locale } = useI18n();
  const fr = locale === "fr";

  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const fetchComments = async () => {
    try {
      const data = await api.getPostComments(postId);
      setComments(data);
    } catch (err: any) {
      console.warn("Could not load comments:", err?.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchComments();
  }, [postId]);

  const handleAddComment = async (e: React.FormEvent, parentCommentId?: string) => {
    e.preventDefault();
    const content = parentCommentId ? replyContent.trim() : newComment.trim();
    if (!content) return;

    setSubmitting(true);
    try {
      await api.createPostComment(postId, {
        content,
        parentCommentId: parentCommentId || undefined,
      });

      if (parentCommentId) {
        setReplyContent("");
        setReplyingTo(null);
      } else {
        setNewComment("");
      }
      await fetchComments();
      toast.success(fr ? "Commentaire ajouté !" : "Comment added!");
    } catch (err: any) {
      toast.error(err.message || "Failed to add comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm(fr ? "Supprimer ce commentaire ?" : "Delete this comment?")) return;
    try {
      await api.deletePostComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success(fr ? "Commentaire supprimé." : "Comment deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete comment.");
    }
  };

  const handleReaction = async (commentId: string) => {
    try {
      const res = await api.toggleCommunityReaction({
        targetType: "comment",
        targetId: commentId,
        reactionType: "like",
      });

      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) {
            return {
              ...c,
              user_reaction: res.userReaction,
              like_count:
                res.action === "ADDED"
                  ? (c.like_count || 0) + 1
                  : res.action === "REMOVED"
                  ? Math.max(0, (c.like_count || 1) - 1)
                  : c.like_count,
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to react to comment.");
    }
  };

  // Group top-level comments and replies
  const rootComments = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = comments.reduce((acc: Record<string, any[]>, c) => {
    if (c.parent_comment_id) {
      const list = acc[c.parent_comment_id] ?? [];
      list.push(c);
      acc[c.parent_comment_id] = list;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-4 pt-3 border-t border-border/60">
      {/* Top-level comment input */}
      <form onSubmit={(e) => handleAddComment(e)} className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={fr ? "Écrire un commentaire..." : "Write a constructive reply..."}
          rows={1}
          className="min-h-[38px] h-9 text-xs py-2 resize-none bg-background border-border/70 placeholder:text-muted-foreground/60"
        />
        <Button
          type="submit"
          size="sm"
          disabled={submitting || !newComment.trim()}
          className="h-9 px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs shrink-0"
        >
          {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
        </Button>
      </form>

      {/* Comments List */}
      {loading ? (
        <div className="py-4 text-center">
          <Loader2 className="size-5 animate-spin mx-auto text-primary" />
        </div>
      ) : rootComments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2 text-center">
          {fr ? "Aucun commentaire pour l'instant. Soyez le premier à répondre !" : "No comments yet. Share your thoughts!"}
        </p>
      ) : (
        <div className="space-y-3 pt-1">
          {rootComments.map((comment) => {
            const replies = repliesByParent[comment.id] || [];
            const canDelete =
              comment.author_id === currentUserId ||
              currentUserRole === "SUPER_ADMIN" ||
              currentUserRole === "ADMIN";

            return (
              <div key={comment.id} className="space-y-2">
                <div className="group rounded-xl bg-muted/40 p-3 text-xs border border-border/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] uppercase overflow-hidden shrink-0">
                        {comment.author_image ? (
                          <img
                            src={comment.author_image}
                            alt={comment.author_name}
                            className="size-full object-cover"
                          />
                        ) : (
                          comment.author_name?.charAt(0) || "U"
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-foreground">{comment.author_name}</span>
                        {comment.author_headline && (
                          <span className="text-[10px] text-muted-foreground ml-1.5 hidden sm:inline">
                            • {comment.author_headline}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                          title="Delete comment"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {comment.content}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-border/30 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => handleReaction(comment.id)}
                      className={`inline-flex items-center gap-1 hover:text-rose-600 transition-colors ${
                        comment.user_reaction ? "text-rose-600 font-semibold" : ""
                      }`}
                    >
                      <Heart className={`size-3 ${comment.user_reaction ? "fill-current" : ""}`} />
                      <span>{comment.like_count || 0}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setReplyingTo(replyingTo === comment.id ? null : comment.id)
                      }
                      className="hover:text-foreground font-medium transition-colors"
                    >
                      {t("community.reply")}
                    </button>
                  </div>
                </div>

                {/* Inline Reply Form */}
                {replyingTo === comment.id && (
                  <form
                    onSubmit={(e) => handleAddComment(e, comment.id)}
                    className="ml-6 flex gap-2 pl-2 border-l-2 border-primary/30"
                  >
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={fr ? `Répondre à ${comment.author_name}...` : `Reply to ${comment.author_name}...`}
                      rows={1}
                      className="min-h-[34px] h-8 text-xs py-1.5 resize-none bg-background border-border"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      size="sm"
                      disabled={submitting || !replyContent.trim()}
                      className="h-8 px-3 text-xs bg-primary text-primary-foreground"
                    >
                      {submitting ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
                    </Button>
                  </form>
                )}

                {/* Nested Replies */}
                {replies.length > 0 && (
                  <div className="ml-6 space-y-2 pl-2 border-l-2 border-border/40">
                    {replies.map((reply) => {
                      const canDeleteReply =
                        reply.author_id === currentUserId ||
                        currentUserRole === "SUPER_ADMIN" ||
                        currentUserRole === "ADMIN";

                      return (
                        <div
                          key={reply.id}
                          className="group rounded-xl bg-muted/25 p-2.5 text-xs border border-border/30"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <div className="size-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[9px] uppercase overflow-hidden shrink-0">
                                {reply.author_image ? (
                                  <img
                                    src={reply.author_image}
                                    alt={reply.author_name}
                                    className="size-full object-cover"
                                  />
                                ) : (
                                  reply.author_name?.charAt(0) || "U"
                                )}
                              </div>
                              <span className="font-semibold text-foreground text-[11px]">
                                {reply.author_name}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                              <span>{new Date(reply.created_at).toLocaleDateString()}</span>
                              {canDeleteReply && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteComment(reply.id)}
                                  className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                >
                                  <Trash2 className="size-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="mt-1.5 text-foreground/90 leading-relaxed whitespace-pre-wrap text-[11px]">
                            {reply.content}
                          </p>

                          <div className="mt-1.5 pt-1.5 border-t border-border/20 flex items-center gap-3 text-[10px] text-muted-foreground">
                            <button
                              type="button"
                              onClick={() => handleReaction(reply.id)}
                              className={`inline-flex items-center gap-1 hover:text-rose-600 transition-colors ${
                                reply.user_reaction ? "text-rose-600 font-semibold" : ""
                              }`}
                            >
                              <Heart className={`size-2.5 ${reply.user_reaction ? "fill-current" : ""}`} />
                              <span>{reply.like_count || 0}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
