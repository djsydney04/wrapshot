"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { MessageSquarePlus, X, Send, Loader2, CheckCircle } from "lucide-react";
import posthogLib from "posthog-js";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/components/ui/button";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FeedbackButtonProps {
  collapsed?: boolean;
  variant?: "sidebar" | "default" | "header";
  source?: "sidebar" | "top_bar" | "settings_sidebar" | "settings_header";
}

type FeedbackType = "feature" | "bug" | "general";

export function FeedbackButton({
  collapsed = false,
  variant = "sidebar",
  source,
}: FeedbackButtonProps) {
  const posthog = usePostHog();
  const [isOpen, setIsOpen] = React.useState(false);
  const [feedbackType, setFeedbackType] = React.useState<FeedbackType>("feature");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const surveyId =
    process.env.NEXT_PUBLIC_POSTHOG_FEEDBACK_SURVEY_ID ||
    process.env.NEXT_PUBLIC_POSTHOG_SURVEY_ID;
  const feedbackSource = source || (variant === "header" ? "top_bar" : "sidebar");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);

    // Use the hook client first, fall back to the module-level singleton
    const ph = posthog ?? posthogLib;

    if (ph && typeof ph.capture === "function") {
      // Primary event — always shows up in PostHog Events
      ph.capture("feedback_submitted", {
        feedback_type: feedbackType,
        message: message.trim(),
        source: feedbackSource,
      });

      // Also send as survey response if survey ID is configured
      if (surveyId) {
        ph.capture("survey sent", {
          $survey_id: surveyId,
          $survey_response: message.trim(),
          $survey_response_1: feedbackType,
          feedback_type: feedbackType,
          message: message.trim(),
          source: feedbackSource,
        });
      }

      // Flush immediately so the event isn't lost on navigation
      (ph as unknown as { flush?: () => void }).flush?.();
    } else {
      console.warn("[Feedback] PostHog not available — feedback not recorded");
    }

    setIsSubmitting(false);
    setSubmitted(true);

    // Auto-close after showing the thank-you message
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setSubmitted(false);
      setMessage("");
      setFeedbackType("feature");
      closeTimerRef.current = null;
    }, 2000);
  };

  const feedbackTypes: { value: FeedbackType; label: string }[] = [
    { value: "feature", label: "Feature Request" },
    { value: "bug", label: "Bug Report" },
    { value: "general", label: "General" },
  ];

  const handleClose = React.useCallback(() => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    setIsOpen(false);
    setMessage("");
    setFeedbackType("feature");
    setSubmitted(false);
  }, []);

  const handleOpen = () => {
    // Cancel any pending auto-close from a previous submission
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    // Reset form state on every open so stale data never shows
    setMessage("");
    setFeedbackType("feature");
    setSubmitted(false);
    setIsOpen(true);
    const ph = posthog ?? posthogLib;
    if (ph && typeof ph.capture === "function") {
      ph.capture("feedback_opened", { source: feedbackSource });
      if (surveyId) {
        ph.capture("survey shown", { $survey_id: surveyId, source: feedbackSource });
      }
    }
  };

  if (collapsed) {
    return (
      <SimpleTooltip content="Feedback" side="right">
        <Button
          variant="skeuo-outline"
          size="icon"
          onClick={handleOpen}
          className="w-full"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </SimpleTooltip>
    );
  }

  // Header variant - just icon with tooltip
  if (variant === "header") {
    return (
      <>
        <SimpleTooltip content="Send feedback">
          <Button
            variant="skeuo-outline"
            size="sm"
            onClick={handleOpen}
            className="gap-2"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Feedback
          </Button>
        </SimpleTooltip>

        {/* Modal */}
        {isOpen && <FeedbackModal
          isOpen={isOpen}
          onClose={handleClose}
          submitted={submitted}
          feedbackTypes={feedbackTypes}
          feedbackType={feedbackType}
          setFeedbackType={setFeedbackType}
          message={message}
          setMessage={setMessage}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
        />}
      </>
    );
  }

  // Default variant - settings sidebar style
  if (variant === "default") {
    return (
      <>
        <Button
          variant="skeuo-outline"
          size="sm"
          onClick={handleOpen}
          className="w-full justify-start gap-2.5"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-left">Feedback</p>
          </div>
        </Button>

        {/* Modal */}
        {isOpen && <FeedbackModal
          isOpen={isOpen}
          onClose={handleClose}
          submitted={submitted}
          feedbackTypes={feedbackTypes}
          feedbackType={feedbackType}
          setFeedbackType={setFeedbackType}
          message={message}
          setMessage={setMessage}
          isSubmitting={isSubmitting}
          handleSubmit={handleSubmit}
        />}
      </>
    );
  }

  // Sidebar variant (default)
  return (
    <>
      <Button
        variant="skeuo-outline"
        size="sm"
        onClick={handleOpen}
        className="h-8 w-full justify-start gap-2"
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </Button>

      {/* Modal */}
      {isOpen && <FeedbackModal
        isOpen={isOpen}
        onClose={handleClose}
        submitted={submitted}
        feedbackTypes={feedbackTypes}
        feedbackType={feedbackType}
        setFeedbackType={setFeedbackType}
        message={message}
        setMessage={setMessage}
        isSubmitting={isSubmitting}
        handleSubmit={handleSubmit}
      />}
    </>
  );
}

// Extracted modal component for reuse
interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  submitted: boolean;
  feedbackTypes: { value: FeedbackType; label: string }[];
  feedbackType: FeedbackType;
  setFeedbackType: (type: FeedbackType) => void;
  message: string;
  setMessage: (message: string) => void;
  isSubmitting: boolean;
  handleSubmit: (e: React.FormEvent) => void;
}

function FeedbackModal({
  isOpen,
  onClose,
  submitted,
  feedbackTypes,
  feedbackType,
  setFeedbackType,
  message,
  setMessage,
  isSubmitting,
  handleSubmit,
}: FeedbackModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="surface-pop relative mx-4 w-full max-w-md rounded-lg border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Send Feedback</h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[hsl(var(--feedback-success-bg))] flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-[hsl(var(--feedback-success-fg))]" />
            </div>
            <h3 className="text-lg font-medium mb-1">Thank you!</h3>
            <p className="text-sm text-muted-foreground">Your feedback has been submitted.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {feedbackTypes.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFeedbackType(type.value)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs transition-colors",
                      feedbackType === type.value
                        ? "skeuo-pressed border-border text-foreground"
                        : "skeuo-chip border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  feedbackType === "feature"
                    ? "Describe the feature you'd like to see..."
                    : feedbackType === "bug"
                      ? "What went wrong? Please include steps to reproduce..."
                      : "Share your thoughts with us..."
                }
                className="w-full h-28 px-3 py-2 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                required
                autoFocus
              />
            </div>

            <Button
              variant="skeuo"
              type="submit"
              disabled={!message.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
