"use client";

import * as React from "react";
import {
  Bot,
  Check,
  Copy,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  User2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AIIndicator } from "@/components/ai/ai-indicator";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ProjectAssistantChatProps {
  projectId: string;
  projectName?: string;
  className?: string;
}

const QUICK_PROMPTS = [
  "Build me a practical 7-day shooting plan from current scenes.",
  "What are the highest schedule risks this week?",
  "Which locations still need permit follow-up?",
  "Summarize unscheduled scenes and propose next steps.",
  "What prep should each department complete before day one?",
];

function formatMessageTime(createdAt: string): string {
  return new Date(createdAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ProjectAssistantChat({
  projectId,
  projectName,
  className,
}: ProjectAssistantChatProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);

  const fetchHistory = React.useCallback(async () => {
    setLoadingHistory(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ai/project-chat?projectId=${encodeURIComponent(projectId)}`
      );
      const payload = (await response.json()) as { data?: ChatMessage[]; error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load chat history");
      }

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
    if (!prompt) {
      setQuery("");
    }

    const optimisticUserMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);

    try {
      const response = await fetch("/api/ai/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message }),
      });

      const payload = (await response.json()) as { data?: ChatMessage; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Failed to send message");
      }

      setMessages((prev) => [...prev, payload.data!]);
      if (prompt) {
        setQuery("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleClearConversation = async () => {
    if (clearing || sending) return;
    const shouldClear = window.confirm(
      "Clear this conversation history for the selected project?"
    );
    if (!shouldClear) return;

    setClearing(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/ai/project-chat?projectId=${encodeURIComponent(projectId)}`,
        { method: "DELETE" }
      );
      const payload = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to clear conversation");
      }

      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear conversation");
    } finally {
      setClearing(false);
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
        "flex h-full min-h-[680px] flex-col rounded-2xl border border-border bg-card/95",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Wrapshot Assistant</h2>
            <AIIndicator variant="pill" size="sm" label="Project Context" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {projectName
              ? `Advising on ${projectName}`
              : "Project-aware planning for schedule, permits, scenes, and risks"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void fetchHistory()}
            disabled={loadingHistory || sending || clearing}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => void handleClearConversation()}
            disabled={loadingHistory || sending || clearing}
          >
            {clearing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            New Thread
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_310px]">
        <div className="flex min-h-0 flex-col">
          <div ref={viewportRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {loadingHistory ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                <Lightbulb className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Start with a production question</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ask for plans, risk checks, next actions, or department prep.
                </p>
              </div>
            ) : (
              messages.map((message) => {
                const isAssistant = message.role === "assistant";
                return (
                  <div
                    key={message.id}
                    className={cn("flex gap-3", isAssistant ? "justify-start" : "justify-end")}
                  >
                    {isAssistant && (
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                      </span>
                    )}

                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl border px-3 py-2.5 text-sm",
                        isAssistant
                          ? "border-border bg-muted/45 text-foreground"
                          : "border-primary/15 bg-primary text-primary-foreground"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                      <div
                        className={cn(
                          "mt-2 flex items-center justify-between gap-2 text-[11px]",
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
                              <>
                                <Check className="h-3 w-3" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copy
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {!isAssistant && (
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-primary/20 bg-primary/10">
                        <User2 className="h-4 w-4 text-primary" />
                      </span>
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

          <div className="border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <Textarea
                rows={3}
                maxLength={4000}
                placeholder="Ask a project-aware question..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                className="h-auto min-w-[98px] gap-1.5"
                onClick={() => void handleSend()}
                disabled={sending || !query.trim()}
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Press Enter to send, Shift+Enter for newline.</span>
              <span>{query.length}/4000</span>
            </div>
            {error && (
              <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>

        <aside className="border-t border-border px-4 py-4 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">
            Quick Prompts
          </p>
          <div className="mt-3 space-y-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setQuery(prompt)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-border bg-muted/30 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.11em] text-muted-foreground">
              Context Scope
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Scenes, schedule, locations, permits, cast, crew, and recent script context from
              the selected project.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
