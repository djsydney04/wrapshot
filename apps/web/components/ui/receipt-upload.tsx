"use client";

import * as React from "react";
import { Upload, X, FileText, Loader2, Eye, Sparkles, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { createClient } from "@/lib/supabase/client";

export interface ParsedReceiptData {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  description: string | null;
  lineItems: Array<{ description: string; amount: number }>;
  confidence: number;
}

export interface ReceiptUploadProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  onParsedData?: (data: ParsedReceiptData) => void;
  budgetId: string;
  transactionId?: string;
  autoParseOnUpload?: boolean;
  className?: string;
  disabled?: boolean;
}

export function ReceiptUpload({
  value,
  onChange,
  onParsedData,
  budgetId,
  transactionId,
  autoParseOnUpload = true,
  className,
  disabled = false,
}: ReceiptUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isParsing, setIsParsing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [parseConfidence, setParseConfidence] = React.useState<number | null>(null);
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const maxSizeMB = 10;
  const accept = "image/png,image/jpeg,image/webp,application/pdf";

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

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload an image (PNG, JPEG, WebP) or PDF");
      return;
    }

    setError(null);
    setIsUploading(true);
    setParseConfidence(null);

    try {
      const supabase = createClient();
      const fileExt = file.name.split(".").pop();
      const baseName = file.name.replace(`.${fileExt}`, "").replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `${baseName}-${Date.now()}.${fileExt}`;

      // Path format: {budgetId}/{transactionId or 'pending'}/{filename}
      const folder = transactionId || "pending";
      const filePath = `${budgetId}/${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get signed URL (private bucket - 7 day expiry)
      const { data, error: urlError } = await supabase.storage
        .from("receipts")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);

      if (urlError) throw urlError;

      const fileUrl = data.signedUrl;
      setUploadedFileName(file.name);
      onChange(fileUrl);

      // Auto-parse if enabled and we have an image (not PDF)
      if (autoParseOnUpload && onParsedData && file.type.startsWith("image/")) {
        await parseReceipt(fileUrl);
      } else if (autoParseOnUpload && onParsedData && file.type === "application/pdf") {
        // For PDFs, we'll need to convert to base64 or use a different approach
        // For now, skip auto-parse for PDFs
        setError("PDF parsing available via manual re-parse");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Failed to upload receipt. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const parseReceipt = async (url?: string) => {
    const receiptUrl = url || value;
    if (!receiptUrl || !onParsedData) return;

    setIsParsing(true);
    setError(null);

    try {
      const response = await fetch("/api/receipts/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: receiptUrl }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse receipt");
      }

      const data: ParsedReceiptData = await response.json();
      setParseConfidence(data.confidence);
      onParsedData(data);
    } catch (err) {
      console.error("Parse error:", err);
      setError("Failed to parse receipt. Try manual entry.");
    } finally {
      setIsParsing(false);
    }
  };

  const handleRemove = () => {
    setUploadedFileName(null);
    setParseConfidence(null);
    onChange(null);
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return { label: "High", color: "text-emerald-600" };
    if (confidence >= 0.5) return { label: "Medium", color: "text-amber-600" };
    return { label: "Low", color: "text-red-600" };
  };

  const getFileTypeLabel = () => {
    if (uploadedFileName?.endsWith(".pdf")) return "PDF";
    return "Image";
  };

  return (
    <div className={cn("relative", className)}>
      {value ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {uploadedFileName || "Receipt uploaded"}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{getFileTypeLabel()}</span>
                {parseConfidence !== null && (
                  <>
                    <span>•</span>
                    <span className={cn("flex items-center gap-1", getConfidenceLabel(parseConfidence).color)}>
                      {parseConfidence >= 0.8 ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : parseConfidence >= 0.5 ? (
                        <Sparkles className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {getConfidenceLabel(parseConfidence).label} confidence
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
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
              {onParsedData && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => parseReceipt()}
                  disabled={isParsing}
                  title="Re-parse receipt"
                >
                  {isParsing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              )}
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

          {isParsing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing receipt with Wrapshot Intelligence...</span>
            </div>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-colors cursor-pointer p-6",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        >
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            {isUploading ? (
              <>
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading...</p>
              </>
            ) : isDragging ? (
              <>
                <Upload className="h-8 w-8 text-primary" />
                <p className="text-sm text-primary">Drop receipt here</p>
              </>
            ) : (
              <>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">Upload Receipt</p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPEG, WebP, or PDF up to {maxSizeMB}MB
                  </p>
                </div>
                {onParsedData && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Wrapshot Intelligence will auto-extract details
                  </p>
                )}
              </>
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
        <p className="mt-2 text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}
