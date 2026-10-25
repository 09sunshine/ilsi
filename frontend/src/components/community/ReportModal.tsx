import { useState } from "react";
import { AlertCircle, Flag, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: "post" | "comment" | "user";
  targetId: string;
  targetTitle?: string | undefined;
}

const REPORT_REASONS = [
  { id: "SPAM", label: "Spam or promotional advertising" },
  { id: "HARASSMENT", label: "Harassment or disrespectful behavior" },
  { id: "INAPPROPRIATE", label: "Inappropriate or offensive content" },
  { id: "MISINFORMATION", label: "Misinformation or harmful advice" },
  { id: "OTHER", label: "Other violation of community guidelines" },
];

export function ReportModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetTitle,
}: ReportModalProps) {
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.reportCommunityContent({
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });
      toast.success("Thank you. Our moderation team has received your report.");
      onOpenChange(false);
      setDetails("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <Flag className="size-5" />
            <DialogTitle className="font-display text-lg">Report Content</DialogTitle>
          </div>
          <DialogDescription>
            Help keep the ILSI community safe, respectful, and constructive.
            {targetTitle ? ` Reporting: "${targetTitle.slice(0, 50)}..."` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reason for reporting
            </Label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                    reason === r.id
                      ? "border-primary bg-primary/5 text-foreground font-medium"
                      : "border-border hover:bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={r.id}
                    checked={reason === r.id}
                    onChange={(e) => setReason(e.target.value)}
                    className="accent-primary"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="report-details" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Additional Details (optional)
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context for our moderation team..."
              rows={3}
              maxLength={1000}
              className="resize-none text-sm"
            />
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
            <Button
              type="submit"
              variant="destructive"
              disabled={submitting}
              className="font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Submitting Report...
                </>
              ) : (
                "Submit Report"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
