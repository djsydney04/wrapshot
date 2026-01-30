"use client";

import * as React from "react";
import { Plus, FileText, Download, Eye, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "@/components/ui/file-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useProjectStore } from "@/lib/stores/project-store";
import { SCRIPT_COLORS, type Script } from "@/lib/mock-data";

interface ScriptSectionProps {
  projectId: string;
  scripts: Script[];
}

export function ScriptSection({ projectId, scripts }: ScriptSectionProps) {
  const [showUpload, setShowUpload] = React.useState(false);
  const [uploadData, setUploadData] = React.useState({
    fileUrl: null as string | null,
    fileName: "",
    color: "WHITE" as Script["color"],
  });
  const [loading, setLoading] = React.useState(false);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  const { addScript, deleteScript } = useProjectStore();

  const sortedScripts = React.useMemo(() => {
    return [...scripts].sort((a, b) => b.version - a.version);
  }, [scripts]);

  const nextVersion = scripts.length > 0 ? Math.max(...scripts.map((s) => s.version)) + 1 : 1;

  const handleUpload = () => {
    if (!uploadData.fileUrl || !uploadData.fileName) return;

    setLoading(true);
    addScript({
      projectId,
      version: nextVersion,
      color: uploadData.color,
      fileUrl: uploadData.fileUrl,
      fileName: uploadData.fileName,
      uploadedAt: new Date().toISOString(),
    });

    setLoading(false);
    setShowUpload(false);
    setUploadData({ fileUrl: null, fileName: "", color: "WHITE" });
    forceUpdate();
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this script version?")) {
      deleteScript(id);
      forceUpdate();
    }
  };

  const colorOptions = Object.entries(SCRIPT_COLORS).map(([value, { label }]) => ({
    value,
    label,
  }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {scripts.length} version{scripts.length !== 1 ? "s" : ""} uploaded
        </div>
        <Button size="sm" onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4 mr-1" />
          Upload New Version
        </Button>
      </div>

      {/* Script List */}
      {sortedScripts.length > 0 ? (
        <div className="space-y-3">
          {sortedScripts.map((script) => {
            const colorInfo = SCRIPT_COLORS[script.color];
            const isLatest = script.version === sortedScripts[0]?.version;

            return (
              <div
                key={script.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
              >
                {/* Color indicator */}
                <div
                  className="w-2 h-full min-h-[60px] rounded-full flex-shrink-0"
                  style={{ backgroundColor: colorInfo.color }}
                />

                {/* File icon */}
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{script.fileName}</p>
                    {isLatest && (
                      <Badge variant="default" className="text-[10px]">CURRENT</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span>Version {script.version}</span>
                    <span>·</span>
                    <span
                      className="flex items-center gap-1"
                      style={{ color: colorInfo.color }}
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: colorInfo.color }}
                      />
                      {colorInfo.label.split(" ")[0]}
                    </span>
                    <span>·</span>
                    <span>
                      {new Date(script.uploadedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={script.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button variant="ghost" size="icon-sm" asChild>
                    <a href={script.fileUrl} download>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(script.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium mb-1">No script uploaded</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upload your script to keep track of revisions
          </p>
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Upload Script
          </Button>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent onClose={() => setShowUpload(false)}>
          <DialogHeader>
            <DialogTitle>Upload Script</DialogTitle>
            <DialogDescription>
              Upload a new version of your script (PDF, FDX, DOC, or JSON)
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Script File
              </label>
              <FileUpload
                value={uploadData.fileUrl}
                onChange={(url, fileName) =>
                  setUploadData({ ...uploadData, fileUrl: url, fileName: fileName || "" })
                }
                bucket="scripts"
                folder={projectId}
                accept=".pdf,.fdx,.doc,.docx,.json"
                placeholder="Drop your script file here (PDF, FDX, DOC, JSON)"
                fileName={uploadData.fileName}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Revision Color
              </label>
              <Select
                value={uploadData.color}
                onChange={(e) =>
                  setUploadData({ ...uploadData, color: e.target.value as Script["color"] })
                }
                options={colorOptions}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Industry standard color coding for script revisions
              </p>
            </div>

            {nextVersion > 1 && (
              <p className="text-sm text-muted-foreground">
                This will be uploaded as <strong>Version {nextVersion}</strong>
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpload(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!uploadData.fileUrl || loading}
            >
              {loading ? "Uploading..." : "Upload Script"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
