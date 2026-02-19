"use client";

import * as React from "react";
import { Mail, Phone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { DEPARTMENT_LABELS } from "@/lib/types";
import {
  type CrewMemberWithInviteStatus,
  type CrewMemberInput,
  type DepartmentType,
} from "@/lib/actions/crew";
import { CrewAccessPanel } from "@/components/crew/crew-access-panel";

interface CrewProfileModalProps {
  member: CrewMemberWithInviteStatus;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void | Promise<void>;
  onUpdate: (id: string, updates: Partial<CrewMemberInput>) => void | Promise<void>;
  onAccessChanged?: () => void;
}

export function CrewProfileModal({
  member,
  projectId,
  open,
  onOpenChange,
  onDelete,
  onUpdate,
  onAccessChanged,
}: CrewProfileModalProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editData, setEditData] = React.useState({
    name: member.name,
    role: member.role,
    department: member.department,
    isHead: member.isHead,
    email: member.email || "",
    phone: member.phone || "",
    profilePhotoUrl: member.profilePhotoUrl || null,
  });

  React.useEffect(() => {
    setEditData({
      name: member.name,
      role: member.role,
      department: member.department,
      isHead: member.isHead,
      email: member.email || "",
      phone: member.phone || "",
      profilePhotoUrl: member.profilePhotoUrl || null,
    });
    setIsEditing(false);
  }, [member]);

  const handleSave = async () => {
    await onUpdate(member.id, {
      name: editData.name,
      role: editData.role,
      department: editData.department,
      isHead: editData.isHead,
      email: editData.email || undefined,
      phone: editData.phone || undefined,
      profilePhotoUrl: editData.profilePhotoUrl || undefined,
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to remove this crew member?")) {
      await onDelete(member.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Profile" : "Crew Profile"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Profile Photo */}
          <div className="flex justify-center">
            {isEditing ? (
              <div className="w-32">
                <ImageUpload
                  value={editData.profilePhotoUrl}
                  onChange={(url) => setEditData({ ...editData, profilePhotoUrl: url })}
                  bucket="profile-photos"
                  folder={member.projectId}
                  aspectRatio="square"
                  placeholder="Add photo"
                />
              </div>
            ) : (
              <div className="relative">
                <Avatar
                  alt={member.name}
                  src={member.profilePhotoUrl}
                  size="xl"
                />
                {member.isHead && (
                  <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                    Department Head
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Name & Role */}
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Input
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Department</label>
                <Select
                  value={editData.department}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      department: e.target.value as DepartmentType,
                    })
                  }
                  options={Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editData.isHead}
                  onChange={(e) =>
                    setEditData({ ...editData, isHead: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Department Head
              </label>
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-xl font-semibold">{member.name}</h2>
              <p className="text-muted-foreground">{member.role}</p>
              <Badge variant="secondary" className="mt-2">
                {DEPARTMENT_LABELS[member.department]}
              </Badge>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-3 pt-2">
            {isEditing ? (
              <>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Phone
                  </label>
                  <Input
                    type="tel"
                    value={editData.phone}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </>
            ) : (
              <>
                {member.email && (
                  <a
                    href={`mailto:${member.email}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </a>
                )}
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{member.phone}</p>
                    </div>
                  </a>
                )}
                {!member.email && !member.phone && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No contact information added
                  </p>
                )}
              </>
            )}
          </div>

          {/* Access & Permissions Panel (view mode only) */}
          {!isEditing && (
            <CrewAccessPanel
              member={member}
              projectId={projectId}
              onAccessChanged={onAccessChanged}
            />
          )}
        </DialogBody>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
