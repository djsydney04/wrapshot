"use client";

import * as React from "react";
import { X, Send, Loader2, CheckCircle, MessageSquarePlus } from "lucide-react";
import posthogLib from "posthog-js";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SURVEY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const SURVEY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STORAGE_KEY = "timed-survey-last-shown-at";
const SESSION_START_KEY = "session-start-time";

type FeedbackType = "feature" | "bug" | "general";

export function TimedSurvey() {
  const posthog = usePostHog();
  const [isOpen, setIsOpen] = React.useState(false);
  const [feedbackType, setFeedbackType] = React.useState<FeedbackType>("general");
  const [message, setMessage] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  const surveyId = process.env.NEXT_PUBLIC_POSTHOG_EVERYUSER_SURVEY_ID;
  const ph = posthog ?? posthogLib;

  React.useEffect(() => {
    // Check cooldown to avoid showing too frequently in the same browser.
    const lastShownRaw = localStorage.getItem(STORAGE_KEY);
    const lastShown = lastShownRaw ? parseInt(lastShownRaw, 10) : 0;
    if (lastShown && Number.isFinite(lastShown) && Date.now() - lastShown < SURVEY_COOLDOWN_MS) {
      return;
    }

    // Get or set session start time
    let sessionStart = localStorage.getItem(SESSION_START_KEY);
    if (!sessionStart) {
      sessionStart = Date.now().toString();
      localStorage.setItem(SESSION_START_KEY, sessionStart);
    }

    const startTime = parseInt(sessionStart, 10);
    const elapsed = Date.now() - startTime;
    const remaining = SURVEY_DELAY_MS - elapsed;

    if (remaining <= 0) {
      // Already past 5 minutes, show immediately
      setIsOpen(true);
      localStorage.setItem(STORAGE_KEY, Date.now().toString());
    } else {
      // Set timeout for remaining time
      const timeout = setTimeout(() => {
        setIsOpen(true);
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
      }, remaining);

      return () => clearTimeout(timeout);
    }
  }, []);

  React.useEffect(() => {
    if (!isOpen || !ph || typeof ph.capture !== "function") return;

    ph.capture("feedback_opened", {
      source: "timed_prompt",
      feedback_type: "general",
    });

    if (surveyId) {
      ph.capture("survey shown", {
        $survey_id: surveyId,
        survey_type: "timed_prompt",
      });
    }
  }, [isOpen, ph, surveyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);

    if (ph && typeof ph.capture === "function") {
      const trimmed = message.trim();

      ph.capture("feedback_submitted", {
        feedback_type: feedbackType,
        message: trimmed,
        source: "timed_prompt",
      });

      if (surveyId) {
        ph.capture("survey sent", {
          $survey_id: surveyId,
          $survey_response: trimmed,
          $survey_response_1: feedbackType,
          feedback_type: feedbackType,
          message: trimmed,
          survey_type: "timed_prompt",
        });
      } else {
        console.warn("[TimedSurvey] Missing NEXT_PUBLIC_POSTHOG_EVERYUSER_SURVEY_ID");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    setIsSubmitting(false);
    setSubmitted(true);

    setTimeout(() => {
      setIsOpen(false);
    }, 2000);
  };

  const handleDismiss = () => {
    setDismissed(true);

    if (ph && typeof ph.capture === "function") {
      ph.capture("feedback_dismissed", {
        source: "timed_prompt",
        feedback_type: feedbackType,
      });
      if (surveyId) {
        ph.capture("survey dismissed", {
          $survey_id: surveyId,
          survey_type: "timed_prompt",
        });
      }
    }

    setTimeout(() => {
      setIsOpen(false);
    }, 300);
  };

  const feedbackTypes: { value: FeedbackType; label: string }[] = [
    { value: "general", label: "General" },
    { value: "feature", label: "Feature" },
    { value: "bug", label: "Bug" },
  ];

  if (!isOpen || dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-background border border-border rounded-lg shadow-soft-lg animate-in zoom-in-95 fade-in duration-300">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="p-10 text-center">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
            <p className="text-muted-foreground">Your feedback helps us improve wrapshoot.</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                <MessageSquarePlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">How&apos;s your experience so far?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We&apos;d love to hear your thoughts on wrapshoot. Your feedback helps us build a better product.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Feedback Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">What kind of feedback?</label>
                <div className="flex gap-2">
                  {feedbackTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFeedbackType(type.value)}
                      className={cn(
                        "flex-1 px-4 py-2.5 text-sm rounded-lg border transition-all",
                        feedbackType === type.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Your thoughts</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What do you like? What could be better? Any features you'd love to see?"
                  className="w-full h-32 px-4 py-3 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  autoFocus
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDismiss}
                  className="flex-1"
                >
                  Maybe later
                </Button>
                <Button
                  type="submit"
                  disabled={!message.trim() || isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Feedback
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
