"use client";

import * as React from "react";
import { Paperclip, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createDepartmentAttachment,
  deleteDepartmentAttachment,
  getDepartmentAttachments,
  type DepartmentAttachment,
} from "@/lib/actions/departments-attachments";

interface AttachmentPanelProps {
  projectId: string;
  entityType: string;
  entityId: string;
  title?: string;
}

export function AttachmentPanel({
  projectId,
  entityType,
  entityId,
  title = "Attachments",
}: AttachmentPanelProps) {
  const [attachments, setAttachments] = React.useState<DepartmentAttachment[]>([]);
  const [fileUrl, setFileUrl] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const loadAttachments = React.useCallback(async () => {
    setLoading(true);
    const { data } = await getDepartmentAttachments(projectId, entityType, entityId);
    setAttachments(data || []);
    setLoading(false);
  }, [projectId, entityType, entityId]);

  React.useEffect(() => {
    void loadAttachments();
  }, [loadAttachments]);

  const handleCreate = async () => {
    const url = fileUrl.trim();
    if (!url) return;

    setSaving(true);
    const { data } = await createDepartmentAttachment({
      projectId,
      entityType,
      entityId,
      fileUrl: url,
      fileName: fileName.trim() || undefined,
    });

    if (data) {
      setFileUrl("");
      setFileName("");
      await loadAttachments();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { success } = await deleteDepartmentAttachment(id, projectId);
    if (success) {
      await loadAttachments();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Badge variant="secondary">{attachments.length}</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={fileUrl}
          onChange={(event) => setFileUrl(event.target.value)}
          placeholder="https://..."
        />
        <Input
          value={fileName}
          onChange={(event) => setFileName(event.target.value)}
          placeholder="Display name (optional)"
        />
      </div>

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={handleCreate}
        disabled={saving || !fileUrl.trim()}
      >
        <Plus className="mr-1 h-4 w-4" />
        {saving ? "Adding..." : "Add Attachment"}
      </Button>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : attachments.length > 0 ? (
        <div className="space-y-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
            >
              <a
                href={attachment.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 text-xs text-primary hover:underline"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{attachment.fileName || attachment.fileUrl}</span>
              </a>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleDelete(attachment.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      )}
    </div>
  );
}
