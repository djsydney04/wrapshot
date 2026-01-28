"use client";

import * as React from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { createClient } from "@/lib/supabase/client";

export interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  bucket: "scene-photos" | "profile-photos" | "project-assets";
  folder?: string;
  className?: string;
  aspectRatio?: "square" | "video" | "wide";
  placeholder?: string;
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  bucket,
  folder = "",
  className,
  aspectRatio = "video",
  placeholder = "Drop an image or click to upload",
  disabled = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const aspectClasses = {
    square: "aspect-square",
    video: "aspect-video",
    wide: "aspect-[21/9]",
  };

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
    // Reset input so same file can be selected again
    if (inputRef.current) inputRef.current.value = "";
  };

  const uploadFile = async (file: File) => {
    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setError("Please upload a PNG, JPEG, WebP, or GIF image");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onChange(publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!value) return;

    try {
      // Extract file path from URL
      const url = new URL(value);
      const pathParts = url.pathname.split(`/storage/v1/object/public/${bucket}/`);
      if (pathParts.length > 1) {
        const filePath = decodeURIComponent(pathParts[1]);
        const supabase = createClient();
        await supabase.storage.from(bucket).remove([filePath]);
      }
    } catch (err) {
      console.error("Error removing file:", err);
    }

    onChange(null);
  };

  return (
    <div className={cn("relative", className)}>
      {value ? (
        <div className={cn("relative rounded-lg overflow-hidden border border-border", aspectClasses[aspectRatio])}>
          <img
            src={value}
            alt="Uploaded"
            className="w-full h-full object-cover"
          />
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              className="absolute top-2 right-2 shadow-lg"
              onClick={handleRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer",
            aspectClasses[aspectRatio],
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
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : (
              <>
                {isDragging ? (
                  <Upload className="h-8 w-8 text-primary" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                )}
                <p className="text-sm text-muted-foreground text-center">
                  {placeholder}
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, WebP up to 10MB
                </p>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
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

export interface MultiImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  bucket: "scene-photos" | "profile-photos" | "project-assets";
  folder?: string;
  maxImages?: number;
  className?: string;
  disabled?: boolean;
}

export function MultiImageUpload({
  value = [],
  onChange,
  bucket,
  folder = "",
  maxImages = 10,
  className,
  disabled = false,
}: MultiImageUploadProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check max images
    if (value.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const supabase = createClient();
      const newUrls: string[] = [];

      for (const file of files) {
        // Validate file type
        const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
        if (!validTypes.includes(file.type)) continue;
        if (file.size > 10 * 1024 * 1024) continue;

        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = folder ? `${folder}/${fileName}` : fileName;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(filePath);
          newUrls.push(publicUrl);
        }
      }

      onChange([...value, ...newUrls]);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload images");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const newUrls = [...value];
    newUrls.splice(index, 1);
    onChange(newUrls);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Image Grid */}
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {value.map((url, index) => (
            <div
              key={url}
              className="relative aspect-square rounded-lg overflow-hidden border border-border group"
            >
              <img
                src={url}
                alt={`Image ${index + 1}`}
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  onClick={() => handleRemove(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {value.length < maxImages && !disabled && (
        <div
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-4 cursor-pointer hover:border-muted-foreground/50 transition-colors",
            isUploading && "pointer-events-none opacity-50"
          )}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="text-sm text-muted-foreground">
            {isUploading ? "Uploading..." : `Add images (${value.length}/${maxImages})`}
          </span>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={disabled || isUploading}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
