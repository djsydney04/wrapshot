"use client";

import * as React from "react";
import { Share2, X, Send, Loader2, CheckCircle, Copy, Check, Mail, MessageCircle } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  variant?: "sidebar" | "default" | "header";
}

const DEFAULT_MESSAGE = "Hey! I've been using wrapshoot to manage my film production - it's been super helpful for scheduling, scene breakdowns, and keeping everything organized. Thought you might find it useful for your projects too!";

const DEFAULT_TEXT_MESSAGE = "Hey! Check out wrapshoot - it's a great tool for managing film productions. I've been using it for scheduling and scene breakdowns.";

export function ShareButton({ variant = "sidebar" }: ShareButtonProps) {
  const posthog = usePostHog();
  const [isOpen, setIsOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState(DEFAULT_MESSAGE);
  const [textMessage, setTextMessage] = React.useState(DEFAULT_TEXT_MESSAGE);
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [shareMethod, setShareMethod] = React.useState<"email" | "text">("email");

  const landingPageUrl = process.env.NEXT_PUBLIC_APP_URL || "https://wrapshoot.com";

  const handleOpen = () => {
    setIsOpen(true);
    posthog?.capture("share_modal_opened");
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(landingPageUrl);
      setCopied(true);
      posthog?.capture("share_link_copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          message: message.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invite");
      }

      posthog?.capture("share_email_sent", {
        has_message: !!message.trim(),
      });

      setSubmitted(true);
      setTimeout(() => {
        setIsOpen(false);
        setSubmitted(false);
        setEmail("");
        setMessage(DEFAULT_MESSAGE);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTextShare = () => {
    const fullMessage = `${textMessage}\n\n${landingPageUrl}`;
    const smsUrl = phoneNumber
      ? `sms:${phoneNumber}?body=${encodeURIComponent(fullMessage)}`
      : `sms:?body=${encodeURIComponent(fullMessage)}`;

    posthog?.capture("share_text_opened", {
      has_phone: !!phoneNumber,
    });

    window.open(smsUrl, "_self");
  };

  const resetForm = () => {
    setEmail("");
    setMessage(DEFAULT_MESSAGE);
    setTextMessage(DEFAULT_TEXT_MESSAGE);
    setPhoneNumber("");
    setError(null);
    setShareMethod("email");
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(resetForm, 300);
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

  // Header variant
  if (variant === "header") {
    return (
      <>
        <SimpleTooltip content="Share with friends">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpen}
            className={buttonStyles.header}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </SimpleTooltip>
        {isOpen && <ShareModal
          isOpen={isOpen}
          onClose={handleClose}
          submitted={submitted}
          email={email}
          setEmail={setEmail}
          message={message}
          setMessage={setMessage}
          textMessage={textMessage}
          setTextMessage={setTextMessage}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          isSubmitting={isSubmitting}
          handleEmailSubmit={handleEmailSubmit}
          handleTextShare={handleTextShare}
          error={error}
          landingPageUrl={landingPageUrl}
          copied={copied}
          handleCopyLink={handleCopyLink}
          shareMethod={shareMethod}
          setShareMethod={setShareMethod}
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
            <Share2 className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-left">Share</p>
          </div>
        </button>
        {isOpen && <ShareModal
          isOpen={isOpen}
          onClose={handleClose}
          submitted={submitted}
          email={email}
          setEmail={setEmail}
          message={message}
          setMessage={setMessage}
          textMessage={textMessage}
          setTextMessage={setTextMessage}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          isSubmitting={isSubmitting}
          handleEmailSubmit={handleEmailSubmit}
          handleTextShare={handleTextShare}
          error={error}
          landingPageUrl={landingPageUrl}
          copied={copied}
          handleCopyLink={handleCopyLink}
          shareMethod={shareMethod}
          setShareMethod={setShareMethod}
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
        <Share2 className="h-4 w-4" />
        Share
      </Button>
      {isOpen && <ShareModal
        isOpen={isOpen}
        onClose={handleClose}
        submitted={submitted}
        email={email}
        setEmail={setEmail}
        message={message}
        setMessage={setMessage}
        textMessage={textMessage}
        setTextMessage={setTextMessage}
        phoneNumber={phoneNumber}
        setPhoneNumber={setPhoneNumber}
        isSubmitting={isSubmitting}
        handleEmailSubmit={handleEmailSubmit}
        handleTextShare={handleTextShare}
        error={error}
        landingPageUrl={landingPageUrl}
        copied={copied}
        handleCopyLink={handleCopyLink}
        shareMethod={shareMethod}
        setShareMethod={setShareMethod}
      />}
    </>
  );
}

// Modal component
interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  submitted: boolean;
  email: string;
  setEmail: (email: string) => void;
  message: string;
  setMessage: (message: string) => void;
  textMessage: string;
  setTextMessage: (message: string) => void;
  phoneNumber: string;
  setPhoneNumber: (phone: string) => void;
  isSubmitting: boolean;
  handleEmailSubmit: (e: React.FormEvent) => void;
  handleTextShare: () => void;
  error: string | null;
  landingPageUrl: string;
  copied: boolean;
  handleCopyLink: () => void;
  shareMethod: "email" | "text";
  setShareMethod: (method: "email" | "text") => void;
}

function ShareModal({
  isOpen,
  onClose,
  submitted,
  email,
  setEmail,
  message,
  setMessage,
  textMessage,
  setTextMessage,
  phoneNumber,
  setPhoneNumber,
  isSubmitting,
  handleEmailSubmit,
  handleTextShare,
  error,
  landingPageUrl,
  copied,
  handleCopyLink,
  shareMethod,
  setShareMethod,
}: ShareModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md mx-4 bg-background border border-border rounded-lg shadow-soft-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Share wrapshoot</h2>
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
            <h3 className="text-lg font-medium mb-1">Invite sent!</h3>
            <p className="text-sm text-muted-foreground">Your friend will receive an email shortly.</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Copy Link Section */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Share link
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={landingPageUrl}
                  className="flex-1 text-sm bg-muted"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or send an invite</span>
              </div>
            </div>

            {/* Quick Share Buttons */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTextShare}
                className="flex-1"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Text
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShareMethod("email")}
                className={cn(
                  "flex-1",
                  shareMethod === "email" && "ring-2 ring-ring"
                )}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>

            {/* Email Form */}
            {shareMethod === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Friend&apos;s email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="friend@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Personal message
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full h-24 px-3 py-2 text-sm bg-background border border-border rounded-md placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!email.trim() || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Email Invite
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
