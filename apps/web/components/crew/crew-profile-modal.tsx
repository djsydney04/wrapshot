"use client";

import * as React from "react";
import { Mail, Phone, Trash2, Calendar, DollarSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ui/image-upload";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { DEPARTMENT_LABELS, type CrewMember } from "@/lib/mock-data";

interface CrewProfileModalProps {
  member: CrewMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<CrewMember>) => void;
}

export function CrewProfileModal({
  member,
  open,
  onOpenChange,
  onDelete,
  onUpdate,
}: CrewProfileModalProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editData, setEditData] = React.useState({
    name: member.name,
    role: member.role,
    email: member.email || "",
    phone: member.phone || "",
    rate: member.rate || "",
    notes: member.notes || "",
    profilePhotoUrl: member.profilePhotoUrl || null,
  });

  React.useEffect(() => {
    setEditData({
      name: member.name,
      role: member.role,
      email: member.email || "",
      phone: member.phone || "",
      rate: member.rate || "",
      notes: member.notes || "",
      profilePhotoUrl: member.profilePhotoUrl || null,
    });
    setIsEditing(false);
  }, [member]);

  const handleSave = () => {
    onUpdate(member.id, {
      name: editData.name,
      role: editData.role,
      email: editData.email || undefined,
      phone: editData.phone || undefined,
      rate: editData.rate || undefined,
      notes: editData.notes || undefined,
      profilePhotoUrl: editData.profilePhotoUrl || undefined,
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to remove this crew member?")) {
      onDelete(member.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-md">
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
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    Rate
                  </label>
                  <Input
                    value={editData.rate}
                    onChange={(e) => setEditData({ ...editData, rate: e.target.value })}
                    placeholder="e.g., $500/day"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Notes
                  </label>
                  <Textarea
                    value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    rows={2}
                    placeholder="Additional notes..."
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
                {member.rate && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Rate</p>
                      <p className="text-sm text-muted-foreground">{member.rate}</p>
                    </div>
                  </div>
                )}
                {member.startDate && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Contract Period</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(member.startDate).toLocaleDateString()}
                        {member.endDate && ` - ${new Date(member.endDate).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                )}
                {member.notes && (
                  <div className="p-3 rounded-lg border border-border">
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{member.notes}</p>
                  </div>
                )}
                {!member.email && !member.phone && !member.rate && !member.notes && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No contact information added
                  </p>
                )}
              </>
            )}
          </div>
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
