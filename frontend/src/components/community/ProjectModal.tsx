import { useState } from "react";
import { FolderGit2, Globe, Loader2, Plus } from "lucide-react";
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
import { api } from "@/lib/api";

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated: (project: any) => void;
}

export function ProjectModal({ open, onOpenChange, onProjectCreated }: ProjectModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [skillsStr, setSkillsStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in project title and description.");
      return;
    }

    setSubmitting(true);
    const skillsUsed = skillsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const project = await api.createCommunityProject({
        title: title.trim(),
        description: description.trim(),
        projectUrl: projectUrl.trim() || undefined,
        skillsUsed,
      });

      toast.success("Project added to your portfolio!");
      onProjectCreated(project);
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setProjectUrl("");
      setSkillsStr("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <FolderGit2 className="size-5" />
            <DialogTitle className="font-display text-lg">Add Project or Capstone</DialogTitle>
          </div>
          <DialogDescription>
            Showcase a real-world initiative, case study, or leadership project you've worked on.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project Title
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Community Health Worker Network"
              required
              maxLength={255}
              className="h-10 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description & Outcomes
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What challenge did this project address and what results were achieved?"
              rows={3}
              required
              maxLength={5000}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project URL / Repository (optional)
            </Label>
            <Input
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://example.org/project"
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Skills Applied (comma-separated)
            </Label>
            <Input
              value={skillsStr}
              onChange={(e) => setSkillsStr(e.target.value)}
              placeholder="Community Organizing, Monitoring, Budgeting"
              className="h-9 text-xs"
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
            <Button type="submit" disabled={submitting} className="font-semibold bg-primary text-primary-foreground">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Saving Project...
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-1.5" />
                  Add Project
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
