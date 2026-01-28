"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, Loader2, X } from "lucide-react";
import { acceptProjectInvite } from "@/lib/actions/project-members";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = React.useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = React.useState("");
  const [projectId, setProjectId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const token = params.token as string;
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invite link");
      return;
    }

    acceptProjectInvite(token)
      .then((pId) => {
        setProjectId(pId);
        setStatus("success");
      })
      .catch((error) => {
        setStatus("error");
        setErrorMessage(error.message || "Failed to accept invite");
      });
  }, [params.token]);

  if (status === "loading") {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Accepting invite...</p>
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

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
          <Check className="h-6 w-6 text-emerald-600" />
        </div>
        <h1 className="text-xl font-semibold">You&apos;re in!</h1>
        <p className="text-muted-foreground">
          You&apos;ve been added to the project. Start collaborating with your team.
        </p>
        <Button onClick={() => router.push(`/projects/${projectId}`)}>
          Go to Project
        </Button>
      </div>
    </div>
  );
}
