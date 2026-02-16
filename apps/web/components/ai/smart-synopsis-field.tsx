"use client";

import * as React from "react";
import { Sparkles, RefreshCw, Loader2, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAIStore } from "@/lib/stores/ai-store";

interface SmartSynopsisFieldProps {
  sceneId: string;
  projectId: string;
  sceneNumber?: string;
  location?: string;
  dayNight?: string;
  scriptText?: string;
  initialSynopsis?: string;
  onChange?: (synopsis: string) => void;
  className?: string;
}

export function SmartSynopsisField({
  sceneId,
  projectId,
  sceneNumber,
  location,
  dayNight,
  scriptText,
  initialSynopsis = "",
  onChange,
  className,
}: SmartSynopsisFieldProps) {
  const [synopsis, setSynopsis] = React.useState(initialSynopsis);
  const [isEditing, setIsEditing] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isAiGenerated, setIsAiGenerated] = React.useState(false);
  const [streamingText, setStreamingText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const hasContent = synopsis.trim().length > 0 || streamingText.length > 0;

  // Generate synopsis using streaming
  const generateSynopsis = async () => {
    if (!scriptText) {
      setError("No script text available for synopsis generation");
      return;
    }

    setIsGenerating(true);
    setStreamingText("");
    setError(null);

    try {
      const response = await fetch("/api/ai/synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId,
          projectId,
          sceneNumber,
          location,
          dayNight,
          scriptText,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate synopsis");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) {
                fullText += data.text;
                setStreamingText(fullText);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      }

      setSynopsis(fullText);
      setStreamingText("");
      setIsAiGenerated(true);
      onChange?.(fullText);
    } catch (err) {
      console.error("Synopsis generation error:", err);
      setError("Failed to generate synopsis. Please try again.");
      setStreamingText("");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle manual editing
  const handleEdit = () => {
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSave = () => {
    setIsEditing(false);
    onChange?.(synopsis);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSynopsis(initialSynopsis);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSynopsis(e.target.value);
    setIsAiGenerated(false);
  };

  // Empty state - show generate button
  if (!hasContent && !isGenerating) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Synopsis
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={generateSynopsis}
          disabled={!scriptText}
          className="w-full justify-center gap-2 border-dashed"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Generate Synopsis
        </Button>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }

  // Loading state with animated gradient
  if (isGenerating) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Synopsis</span>
          <div className="flex items-center gap-1 text-xs text-primary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating...
          </div>
        </div>
        <div className="relative rounded-md border border-border p-3 min-h-[80px] overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
          {/* Streaming text */}
          <p className="relative text-sm whitespace-pre-wrap">
            {streamingText || (
              <span className="text-muted-foreground">
                Analyzing scene...
                <span className="animate-pulse">|</span>
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Generated/Editing state
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Synopsis</span>
          {isAiGenerated && !isEditing && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              <Sparkles className="h-2.5 w-2.5" />
              Wrapshot Intelligence
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleSave}
                className="h-6 w-6"
              >
                <Check className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCancel}
                className="h-6 w-6"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleEdit}
                className="h-6 w-6"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={generateSynopsis}
                disabled={!scriptText}
                className="h-6 w-6"
                title="Regenerate synopsis"
              >
                <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={synopsis}
          onChange={handleChange}
          className="text-sm min-h-[80px] resize-none"
          placeholder="Enter scene synopsis..."
        />
      ) : (
        <div
          className={cn(
            "rounded-md border border-border p-3 min-h-[60px] text-sm cursor-pointer",
            "hover:bg-muted/30 transition-colors"
          )}
          onClick={handleEdit}
        >
          <p className="whitespace-pre-wrap">{synopsis}</p>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
