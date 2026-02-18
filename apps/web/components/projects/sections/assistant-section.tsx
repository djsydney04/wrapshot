"use client";

import * as React from "react";
import { Loader2, Send, Lightbulb } from "lucide-react";
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

interface AssistantSectionProps {
  projectId: string;
}

export function AssistantSection({ projectId }: AssistantSectionProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
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
    void fetchHistory();
  }, [fetchHistory]);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages, sending]);

  const handleSend = async () => {
    const message = query.trim();
    if (!message || sending) return;

    setSending(true);
    setError(null);

    const optimisticUserMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMessage]);
    setQuery("");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    "Build me a 7-day shooting plan from current scenes.",
    "Which locations still need permit follow-up?",
    "What schedule risks should we fix this week?",
    "Summarize unscheduled scenes and propose next steps.",
  ];

  return (
    <div className="h-full min-h-[620px] rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Smart Assistant</h2>
            <AIIndicator variant="pill" size="sm" label="Project Context" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Private chat history for your account on this project.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchHistory()}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_320px] h-[calc(100%-65px)]">
        <div className="flex min-h-0 flex-col">
          <div ref={viewportRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {loadingHistory ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading chat history...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <Lightbulb className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-medium">Start your project conversation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask about schedule, permits, scenes, cast, or production risks.
                </p>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "assistant"
                      ? "bg-muted text-foreground"
                      : "ml-auto bg-primary text-primary-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={cn(
                      "mt-1 text-[10px]",
                      message.role === "assistant"
                        ? "text-muted-foreground"
                        : "text-primary-foreground/70"
                    )}
                  >
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}

            {sending && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking...
              </div>
            )}
          </div>

          <div className="border-t border-border px-4 py-3">
            <div className="flex gap-2">
              <Textarea
                rows={3}
                placeholder="Ask a project question..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <Button
                className="h-auto min-w-[90px]"
                onClick={() => void handleSend()}
                disabled={sending || !query.trim()}
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Tip: Press Cmd/Ctrl + Enter to send.
            </p>
            {error && (
              <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        </div>

        <aside className="border-t border-border px-4 py-4 md:border-l md:border-t-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Quick Prompts
          </p>
          <div className="mt-3 space-y-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => setQuery(prompt)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs hover:bg-muted/40"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="mt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Scope
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Answers use scenes, schedule, locations, permits, cast, crew, elements, and recent
              script context for this project.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
