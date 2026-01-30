"use client";

import * as React from "react";
import { Upload, X, FileText, Loader2, Download, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { createClient } from "@/lib/supabase/client";

export interface FileUploadProps {
  value?: string | null;
  onChange: (url: string | null, fileName?: string) => void;
  bucket: "scripts" | "project-assets";
  folder?: string;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showPreview?: boolean;
  fileName?: string;
}

export function FileUpload({
  value,
  onChange,
  bucket,
  folder = "",
  accept = "application/pdf",
  maxSizeMB = 50,
  className,
  placeholder = "Drop a file or click to upload",
  disabled = false,
  showPreview = true,
  fileName,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(fileName || null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files[0];
    if (file) await uploadFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const uploadFile = async (file: File) => {
    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const baseName = file.name.replace(`.${fileExt}`, "").replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `${baseName}-${Date.now()}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get URL (public for public buckets, signed for private)
      let fileUrl: string;
      if (bucket === "scripts") {
        // Private bucket - get signed URL
        const { data, error: urlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7 days

        if (urlError) throw urlError;
        fileUrl = data.signedUrl;
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath);
        fileUrl = publicUrl;
      }

      setUploadedFileName(file.name);
      onChange(fileUrl, file.name);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload file. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setUploadedFileName(null);
    onChange(null);
  };

  const getFileTypeLabel = () => {
    if (accept.includes("pdf")) return "PDF";
    if (accept.includes("video")) return "Video";
    return "File";
  };

  return (
    <div className={cn("relative", className)}>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {uploadedFileName || "Uploaded file"}
            </p>
            <p className="text-xs text-muted-foreground">{getFileTypeLabel()}</p>
          </div>
          <div className="flex items-center gap-1">
            {showPreview && accept.includes("pdf") && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                asChild
              >
                <a href={value} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              asChild
            >
              <a href={value} download>
                <Download className="h-4 w-4" />
              </a>
            </Button>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={handleRemove}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer p-4",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
        >
          <div className="flex items-center justify-center">
            {isUploading ? (
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            ) : isDragging ? (
              <Upload className="h-6 w-6 text-primary" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
