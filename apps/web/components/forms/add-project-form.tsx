"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProjectStore } from "@/lib/stores/project-store";
import type { Project } from "@/lib/mock-data";

interface AddProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "DEVELOPMENT", label: "Development" },
  { value: "PRE_PRODUCTION", label: "Pre-Production" },
  { value: "PRODUCTION", label: "Production" },
  { value: "POST_PRODUCTION", label: "Post-Production" },
];

export function AddProjectForm({ open, onOpenChange }: AddProjectFormProps) {
  const router = useRouter();
  const { addProject } = useProjectStore();
  const [loading, setLoading] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    description: "",
    status: "DEVELOPMENT" as Project["status"],
    director: "",
    producer: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Calculate default dates (start: today, end: 3 months from now)
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const newProject = addProject({
      name: formData.name,
      description: formData.description || "",
      status: formData.status,
      director: formData.director || undefined,
      producer: formData.producer || undefined,
      startDate,
      endDate,
      scenesCount: 0,
      shootingDaysCount: 0,
      castCount: 0,
      locationsCount: 0,
    });

    setLoading(false);
    onOpenChange(false);

    // Reset form
    setFormData({
      name: "",
      description: "",
      status: "DEVELOPMENT",
      director: "",
      producer: "",
    });

    // Navigate to the new project
    if (newProject) {
      router.push(`/projects/${newProject.id}`);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({
      name: "",
      description: "",
      status: "DEVELOPMENT",
      director: "",
      producer: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onClose={handleClose} className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Film className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Create a new production
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Project name
              </label>
              <Input
                autoFocus
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., My Short Film"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Brief description (optional)"
                rows={2}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Director
                </label>
                <Input
                  value={formData.director}
                  onChange={(e) =>
                    setFormData({ ...formData, director: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Producer
                </label>
                <Input
                  value={formData.producer}
                  onChange={(e) =>
                    setFormData({ ...formData, producer: e.target.value })
                  }
                  placeholder="Optional"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Status
              </label>
              <Select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as Project["status"],
                  })
                }
                options={statusOptions}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name.trim()}>
              {loading ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
