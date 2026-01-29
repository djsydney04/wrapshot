"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteProject, type Project } from "@/lib/actions/projects";

interface SettingsSectionProps {
  projectId: string;
  project: Project;
}

export function SettingsSection({ projectId, project }: SettingsSectionProps) {
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canDelete = deleteConfirmation === project.name;

  const handleDelete = async () => {
    if (!canDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteProject(projectId);
      router.push("/projects");
    } catch (err) {
      console.error("Error deleting project:", err);
      setError(err instanceof Error ? err.message : "Failed to delete project");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Project Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage project settings and configuration
        </p>
      </div>

      {/* General Settings */}
      <div className="rounded-xl border border-border p-6 space-y-4">
        <h3 className="font-semibold">General</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground">Project Name</Label>
            <p className="font-medium">{project.name}</p>
          </div>
          {project.description && (
            <div>
              <Label className="text-sm text-muted-foreground">Description</Label>
              <p className="text-sm">{project.description}</p>
            </div>
          )}
          <div>
            <Label className="text-sm text-muted-foreground">Status</Label>
            <p className="font-medium">{project.status.replace(/_/g, " ")}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Created</Label>
            <p className="text-sm">{new Date(project.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6 space-y-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
          <h3 className="font-semibold">Danger Zone</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Once you delete a project, there is no going back. This will permanently delete the project and all associated data including scenes, cast, crew, schedules, and budgets.
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Project
        </Button>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the project
              <span className="font-semibold text-foreground"> {project.name} </span>
              and all associated data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-semibold">{project.name}</span> to confirm
              </Label>
              <Input
                id="confirm-delete"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder={project.name}
                className="font-mono"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmation("");
                setError(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
