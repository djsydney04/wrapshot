"use client";

import * as React from "react";
import { Send, Loader2, Check, Users, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CastMemberWithInviteStatus } from "@/lib/actions/cast";
import type { CrewMemberWithInviteStatus } from "@/lib/actions/crew";

interface DistributeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shootingDayId: string;
  cast: CastMemberWithInviteStatus[];
  crew: CrewMemberWithInviteStatus[];
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: "cast" | "crew";
}

export function DistributeDialog({
  open,
  onOpenChange,
  shootingDayId,
  cast,
  crew,
}: DistributeDialogProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Build recipients list (only those with email)
  const recipients: Recipient[] = React.useMemo(() => {
    const list: Recipient[] = [];
    for (const c of cast) {
      if (c.email) {
        list.push({
          id: `cast-${c.id}`,
          name: c.actorName || c.characterName,
          email: c.email,
          type: "cast",
        });
      }
    }
    for (const c of crew) {
      if (c.email) {
        list.push({
          id: `crew-${c.id}`,
          name: c.name || c.role,
          email: c.email,
          type: "crew",
        });
      }
    }
    return list;
  }, [cast, crew]);

  const castRecipients = recipients.filter((r) => r.type === "cast");
  const crewRecipients = recipients.filter((r) => r.type === "crew");

  const toggleRecipient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllCast = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = castRecipients.every((r) => next.has(r.id));
      if (allSelected) {
        castRecipients.forEach((r) => next.delete(r.id));
      } else {
        castRecipients.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const selectAllCrew = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = crewRecipients.every((r) => next.has(r.id));
      if (allSelected) {
        crewRecipients.forEach((r) => next.delete(r.id));
      } else {
        crewRecipients.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const handleSend = async () => {
    const selectedRecipients = recipients.filter((r) => selectedIds.has(r.id));
    if (selectedRecipients.length === 0) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/callsheets/${shootingDayId}/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: selectedRecipients.map((r) => ({
            name: r.name,
            email: r.email,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send");
      }

      setSent(true);
      setTimeout(() => {
        onOpenChange(false);
        setSent(false);
        setSelectedIds(new Set());
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send emails");
    } finally {
      setSending(false);
    }
  };

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSent(false);
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Distribute Call Sheet</DialogTitle>
          <DialogDescription>
            Email the call sheet PDF to selected cast and crew members.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="text-center py-8">
            <Check className="h-10 w-10 mx-auto text-green-500 mb-3" />
            <p className="font-medium">Call sheet sent!</p>
            <p className="text-sm text-muted-foreground">
              Sent to {selectedIds.size} recipient{selectedIds.size !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {recipients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No cast or crew members have email addresses configured.
              </p>
            ) : (
              <>
                {/* Cast */}
                {castRecipients.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Users className="h-4 w-4" />
                        Cast ({castRecipients.length})
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllCast}>
                        {castRecipients.every((r) => selectedIds.has(r.id)) ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {castRecipients.map((r) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleRecipient(r.id)}
                            className="rounded border-border"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Crew */}
                {crewRecipients.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <UserCircle className="h-4 w-4" />
                        Crew ({crewRecipients.length})
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAllCrew}>
                        {crewRecipients.every((r) => selectedIds.has(r.id)) ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    <div className="space-y-1">
                      {crewRecipients.map((r) => (
                        <label
                          key={r.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleRecipient(r.id)}
                            className="rounded border-border"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{r.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}
          </div>
        )}

        {!sent && recipients.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={selectedIds.size === 0 || sending}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Send to {selectedIds.size} recipient{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
