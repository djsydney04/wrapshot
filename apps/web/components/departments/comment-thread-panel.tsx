"use client";

import * as React from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  createDepartmentComment,
  deleteDepartmentComment,
  getDepartmentComments,
  type DepartmentComment,
} from "@/lib/actions/departments-comments";

interface CommentThreadPanelProps {
  projectId: string;
  entityType: string;
  entityId: string;
  title?: string;
}

export function CommentThreadPanel({
  projectId,
  entityType,
  entityId,
  title = "Notes",
}: CommentThreadPanelProps) {
  const [comments, setComments] = React.useState<DepartmentComment[]>([]);
  const [body, setBody] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const loadComments = React.useCallback(async () => {
    setLoading(true);
    const { data } = await getDepartmentComments(projectId, entityType, entityId);
    setComments(data?.comments || []);
    setLoading(false);
  }, [projectId, entityType, entityId]);

  React.useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const handleCreate = async () => {
    const text = body.trim();
    if (!text) return;

    setSaving(true);
    const { data } = await createDepartmentComment({
      projectId,
      entityType,
      entityId,
      body: text,
    });

    if (data) {
      setBody("");
      await loadComments();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { success } = await deleteDepartmentComment(id, projectId);
    if (success) {
      await loadComments();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <Badge variant="secondary">{comments.length}</Badge>
      </div>

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a note..."
        rows={3}
      />

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={handleCreate}
        disabled={saving || !body.trim()}
      >
        <Send className="mr-1 h-4 w-4" />
        {saving ? "Posting..." : "Post Note"}
      </Button>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading...</p>
      ) : comments.length > 0 ? (
        <div className="space-y-1">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-md border border-border p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    {new Date(comment.createdAt).toLocaleString()}
                  </p>
                  <p className="text-xs">{comment.body}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDelete(comment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No notes yet.</p>
      )}
    </div>
  );
}
