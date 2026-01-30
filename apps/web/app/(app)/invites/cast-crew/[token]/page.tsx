"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, X, Film, Users, Clock } from "lucide-react";
import {
  acceptCastCrewInvite,
  getCastCrewInviteByToken,
} from "@/lib/actions/cast-crew-invites";

interface CastCrewInviteDetails {
  id: string;
  email: string;
  inviteType: "CAST" | "CREW";
  roleName: string;
  personName: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  projectId?: string;
  projectName?: string;
  inviterName: string;
  isExpired: boolean;
  isAccepted: boolean;
}

export default function AcceptCastCrewInvitePage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = React.useState<
    "loading" | "preview" | "accepting" | "success" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [inviteDetails, setInviteDetails] =
    React.useState<CastCrewInviteDetails | null>(null);

  React.useEffect(() => {
    const token = params.token as string;
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invite link");
      return;
    }

    // Load invite details first
    getCastCrewInviteByToken(token)
      .then((details) => {
        if (!details) {
          setStatus("error");
          setErrorMessage("This invite link is invalid or has already been used");
          return;
        }

        if (details.isExpired) {
          setStatus("error");
          setErrorMessage("This invite has expired. Please ask for a new invite.");
          return;
        }

        if (details.isAccepted) {
          setStatus("error");
          setErrorMessage("This invite has already been accepted.");
          return;
        }

        setInviteDetails(details);
        setStatus("preview");
      })
      .catch((error) => {
        setStatus("error");
        setErrorMessage(error.message || "Failed to load invite");
      });
  }, [params.token]);

  const handleAccept = async () => {
    const token = params.token as string;
    setStatus("accepting");

    try {
      const result = await acceptCastCrewInvite(token);
      if (!result.success) {
        throw new Error(result.error || "Failed to accept invite");
      }
      setProjectId(result.projectId || null);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to accept invite"
      );
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <X className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold">Invite Failed</h1>
          <p className="text-muted-foreground">{errorMessage}</p>
          <Button onClick={() => router.push("/projects")}>
            Go to Projects
          </Button>
        </div>
      </div>
    );
  }

  if (status === "preview" && inviteDetails) {
    const isCast = inviteDetails.inviteType === "CAST";

    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isCast ? (
              <Film className="h-8 w-8 text-primary" />
            ) : (
              <Users className="h-8 w-8 text-primary" />
            )}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              You&apos;re invited as {isCast ? "cast" : "crew"}
            </h1>
            <p className="text-xl font-medium text-primary">
              {inviteDetails.projectName || "a project"}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Invited by</span>
              <span className="font-medium">{inviteDetails.inviterName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {isCast ? "Character" : "Role"}
              </span>
              <Badge variant="secondary">{inviteDetails.roleName}</Badge>
            </div>
            {inviteDetails.personName && inviteDetails.personName !== inviteDetails.roleName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isCast ? "Actor" : "Name"}
                </span>
                <span className="font-medium">{inviteDetails.personName}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expires</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(inviteDetails.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            By accepting, your account will be linked to your {isCast ? "cast" : "crew"}{" "}
            profile on this project.
          </p>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.push("/projects")}>
              Decline
            </Button>
            <Button onClick={handleAccept} className="gap-2">
              <Check className="h-4 w-4" />
              Accept Invite
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "accepting") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Linking your account...</p>
        </div>
      </div>
    );
  }

  // Success state
  const isCast = inviteDetails?.inviteType === "CAST";

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-xl font-semibold">You&apos;re connected!</h1>
        <p className="text-muted-foreground">
          Your account has been linked to your {isCast ? "cast" : "crew"} profile on{" "}
          <span className="font-medium">
            {inviteDetails?.projectName || "the project"}
          </span>
          . You can now access project details and updates.
        </p>
        <Button onClick={() => router.push(`/projects/${projectId}`)}>
          Go to Project
        </Button>
      </div>
    </div>
  );
}
