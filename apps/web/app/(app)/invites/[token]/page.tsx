"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, X, Users, Clock } from "lucide-react";
import {
  acceptProjectInvite,
  getInviteByToken,
} from "@/lib/actions/project-members";
import type { ProjectRole } from "@/lib/permissions";

const roleLabels: Record<ProjectRole, string> = {
  ADMIN: "Admin",
  COORDINATOR: "Coordinator",
  DEPARTMENT_HEAD: "Department Head",
  CREW: "Crew",
  CAST: "Cast",
  VIEWER: "Viewer",
};

interface InviteDetails {
  id: string;
  email: string;
  role: ProjectRole;
  expiresAt: string;
  createdAt: string;
  projectId?: string;
  projectName?: string;
  inviterName: string;
  isExpired: boolean;
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = React.useState<
    "loading" | "preview" | "accepting" | "success" | "error"
  >("loading");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [projectId, setProjectId] = React.useState<string | null>(null);
  const [inviteDetails, setInviteDetails] =
    React.useState<InviteDetails | null>(null);

  React.useEffect(() => {
    const token = params.token as string;
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invite link");
      return;
    }

    // Load invite details first
    getInviteByToken(token)
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
      const pId = await acceptProjectInvite(token);
      setProjectId(pId);
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
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">
              You&apos;re invited to join
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
              <span className="text-muted-foreground">Your role</span>
              <Badge variant="secondary">
                {roleLabels[inviteDetails.role]}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expires</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(inviteDetails.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

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
          <p className="text-muted-foreground">Joining project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-xl font-semibold">You&apos;re in!</h1>
        <p className="text-muted-foreground">
          You&apos;ve been added to{" "}
          <span className="font-medium">
            {inviteDetails?.projectName || "the project"}
          </span>
          . Start collaborating with your team.
        </p>
        <Button onClick={() => router.push(`/projects/${projectId}`)}>
          Go to Project
        </Button>
      </div>
    </div>
  );
}
