"use client";

import * as React from "react";
import {
  Bot,
  Check,
  Copy,
  Lightbulb,
  Loader2,
  Send,
  User2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ToolConfirmationCard } from "./tool-confirmation-card";
import { ToolResultCard } from "./tool-result-card";
import type { AgentMessageMetadata } from "@/lib/ai/tools/types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: AgentMessageMetadata | null;
}

interface AssistantChatCoreProps {
  projectId: string;
  projectName?: string;
  className?: string;
  compact?: boolean;
}

const QUICK_PROMPTS = [
  "How many scenes do I have?",
  "What locations still need permits?",
  "Summarize unscheduled scenes.",
  "What prep should departments complete before day one?",
];

function formatMessageTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AssistantChatCore({
  projectId,
  projectName,
  className,
  compact,
}: AssistantChatCoreProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null);
  const [resolvedConfirmations, setResolvedConfirmations] = React.useState<
    Record<string, "approved" | "declined">
  >({});
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const fetchHistory = React.useCallback(async () => {
    setLoadingHistory(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/ai/project-chat?projectId=${encodeURIComponent(projectId)}`
      );
      const payload = (await response.json()) as { data?: ChatMessage[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to load chat history");
      setMessages(payload.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chat history");
    } finally {
      setLoadingHistory(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    setQuery("");
    setMessages([]);
    setResolvedConfirmations({});
    void fetchHistory();
  }, [fetchHistory, projectId]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, sending]);

  const handleSend = async (prompt?: string) => {
    const message = (prompt ?? query).trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);
    if (!prompt) setQuery("");

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const response = await fetch("/api/ai/project-chat-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message }),
      });
      const payload = (await response.json()) as {
        data?: ChatMessage;
        error?: string;
        status?: string;
        confirmationId?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Failed to send message");
      }
      setMessages((prev) => [...prev, payload.data!]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleConfirmation = async (
    confirmationId: string,
    approved: boolean
  ) => {
    setSending(true);
    setError(null);
    setResolvedConfirmations((prev) => ({
      ...prev,
      [confirmationId]: approved ? "approved" : "declined",
    }));

    try {
      const response = await fetch("/api/ai/project-chat-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, confirmationId, approved }),
      });
      const payload = (await response.json()) as {
        data?: ChatMessage;
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Failed to process confirmation");
      }
      setMessages((prev) => [...prev, payload.data!]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process confirmation");
    } finally {
      setSending(false);
    }
  };

  const handleCopyMessage = async (message: ChatMessage) => {
    if (message.role !== "assistant") return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      window.setTimeout(() => setCopiedMessageId(null), 1200);
    } catch {
      setError("Could not copy message");
    }
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col",
        !compact && "min-h-[400px]",
        className
      )}
    >
      {/* Messages area */}
      <div
        ref={viewportRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
      >
        {loadingHistory ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div className="space-y-3 pt-4">
            <div className="text-center">
              <Lightbulb className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">
                {projectName ? `Ask about ${projectName}` : "Ask a question"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                I can read and modify your project data.
              </p>
            </div>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => void handleSend(prompt)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isAssistant = message.role === "assistant";
            const meta = message.metadata as AgentMessageMetadata | null;

            return (
              <div key={message.id} className="space-y-2">
                <div
                  className={cn(
                    "flex gap-2",
                    isAssistant ? "justify-start" : "justify-end"
                  )}
                >
                  {isAssistant && (
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  )}

                  <div
                    className={cn(
                      "max-w-[88%] rounded-xl border px-2.5 py-2 text-sm",
                      isAssistant
                        ? "border-border bg-muted/45 text-foreground"
                        : "border-primary/15 bg-primary text-primary-foreground"
                    )}
                  >
                    <p className="whitespace-pre-wrap text-[13px] leading-5">
                      {message.content}
                    </p>
                    <div
                      className={cn(
                        "mt-1.5 flex items-center justify-between gap-2 text-[10px]",
                        isAssistant
                          ? "text-muted-foreground"
                          : "text-primary-foreground/75"
                      )}
                    >
                      <span>{formatMessageTime(message.createdAt)}</span>
                      {isAssistant && (
                        <button
                          type="button"
                          onClick={() => void handleCopyMessage(message)}
                          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 hover:bg-background/70"
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {!isAssistant && (
                    <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                      <User2 className="h-3.5 w-3.5 text-primary" />
                    </span>
                  )}
                </div>

                {/* Confirmation card */}
                {meta?.type === "tool_confirmation_request" &&
                  meta.confirmationId &&
                  meta.actions && (
                    <div className="ml-8">
                      <ToolConfirmationCard
                        confirmationId={meta.confirmationId}
                        actions={meta.actions}
                        onApprove={(id) => void handleConfirmation(id, true)}
                        onDecline={(id) => void handleConfirmation(id, false)}
                        resolved={resolvedConfirmations[meta.confirmationId]}
                        disabled={sending}
                      />
                    </div>
                  )}

                {/* Result card */}
                {meta?.type === "tool_execution_result" && meta.results && (
                  <div className="ml-8">
                    <ToolResultCard results={meta.results} />
                  </div>
                )}
              </div>
            );
          })
        )}

        {sending && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex gap-2">
          <Textarea
            rows={compact ? 2 : 3}
            maxLength={4000}
            placeholder="Ask or instruct..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="text-sm"
          />
          <Button
            className="h-auto min-w-[60px] gap-1"
            size="sm"
            onClick={() => void handleSend()}
            disabled={sending || !query.trim()}
          >
            <Send className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Enter to send</span>
          <span>{query.length}/4000</span>
        </div>
        {error && (
          <p className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
