"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export interface DepartmentAttachment {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface CreateDepartmentAttachmentInput {
  projectId: string;
  entityType: string;
  entityId: string;
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
}

export async function getDepartmentAttachments(
  projectId: string,
  entityType: string,
  entityId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("DepartmentAttachment")
    .select("*")
    .eq("projectId", projectId)
    .eq("entityType", entityType)
    .eq("entityId", entityId)
    .order("createdAt", { ascending: false });

  if (error) {
    console.error("Error fetching department attachments:", error);
    return { data: null, error: error.message };
  }

  return { data: (data || []) as DepartmentAttachment[], error: null };
}

export async function createDepartmentAttachment(
  input: CreateDepartmentAttachmentInput,
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("DepartmentAttachment")
    .insert({
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      fileUrl: input.fileUrl,
      fileName: input.fileName || null,
      mimeType: input.mimeType || null,
      sizeBytes: input.sizeBytes || null,
      uploadedBy: userId,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating department attachment:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as DepartmentAttachment, error: null };
}

export async function deleteDepartmentAttachment(
  attachmentId: string,
  projectId: string,
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("DepartmentAttachment")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    console.error("Error deleting department attachment:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, error: null };
}
