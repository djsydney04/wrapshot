"use client";

import * as React from "react";
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

    setTimeout(() => {
      setIsOpen(false);
      setSubmitted(false);
      setMessage("");
      setFeedbackType("feature");
    }, 2000);
  };

  const feedbackTypes: { value: FeedbackType; label: string }[] = [
    { value: "feature", label: "Feature Request" },
    { value: "bug", label: "Bug Report" },
    { value: "general", label: "General" },
  ];

  const handleOpen = () => {
    setIsOpen(true);
    const ph = posthog ?? posthogLib;
    if (ph && typeof ph.capture === "function") {
      ph.capture("feedback_opened", { source: feedbackSource });
      if (surveyId) {
        ph.capture("survey shown", { $survey_id: surveyId, source: feedbackSource });
      }
    }
  };

  // Variant-specific button styles
  const buttonStyles = {
    sidebar: "w-full justify-start gap-2 font-normal h-8 text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover",
    default: "w-full justify-start gap-3 rounded-lg px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50",
    header: "gap-2 text-muted-foreground hover:text-foreground",
  };

  const iconContainerStyles = {
    sidebar: "",
    default: "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground group-hover:text-foreground",
    header: "",
  };

  if (collapsed) {
    return (
      <SimpleTooltip content="Feedback" side="right">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpen}
          className="w-full text-sidebar-foreground-muted hover:text-sidebar-foreground-active hover:bg-sidebar-hover"
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
            variant="ghost"
            size="sm"
            onClick={handleOpen}
            className={buttonStyles.header}
          >
            <MessageSquarePlus className="h-4 w-4" />
            Feedback
          </Button>
        </SimpleTooltip>

        {/* Modal */}
        {isOpen && <FeedbackModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
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
        <button
          onClick={handleOpen}
          className={cn("group flex items-center transition-all duration-200", buttonStyles.default)}
        >
          <div className={iconContainerStyles.default}>
            <MessageSquarePlus className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-left">Feedback</p>
          </div>
        </button>

        {/* Modal */}
        {isOpen && <FeedbackModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
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
        variant="ghost"
        onClick={handleOpen}
        className={buttonStyles.sidebar}
      >
        <MessageSquarePlus className="h-4 w-4" />
        Feedback
      </Button>

      {/* Modal */}
      {isOpen && <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-lg shadow-soft-lg">
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
                      "px-3 py-2 text-xs rounded-md border transition-colors",
                      feedbackType === type.value
                        ? "bg-muted border-border text-foreground"
                        : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
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
    </div>
  );
}
