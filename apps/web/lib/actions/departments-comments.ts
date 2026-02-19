"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export interface DepartmentCommentThread {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentComment {
  id: string;
  threadId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

async function getOrCreateThread(
  projectId: string,
  entityType: string,
  entityId: string,
  userId: string,
) {
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("DepartmentCommentThread")
    .select("*")
    .eq("projectId", projectId)
    .eq("entityType", entityType)
    .eq("entityId", entityId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    return existing as DepartmentCommentThread;
  }

  const { data: created, error: createError } = await supabase
    .from("DepartmentCommentThread")
    .insert({
      projectId,
      entityType,
      entityId,
      createdBy: userId,
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(createError?.message || "Failed to create comment thread");
  }

  return created as DepartmentCommentThread;
}

export async function getDepartmentComments(
  projectId: string,
  entityType: string,
  entityId: string,
) {
  const supabase = await createClient();

  const { data: thread, error: threadError } = await supabase
    .from("DepartmentCommentThread")
    .select("*")
    .eq("projectId", projectId)
    .eq("entityType", entityType)
    .eq("entityId", entityId)
    .maybeSingle();

  if (threadError) {
    console.error("Error fetching department comment thread:", threadError);
    return { data: null, error: threadError.message };
  }

  if (!thread) {
    return {
      data: {
        thread: null,
        comments: [],
      },
      error: null,
    };
  }

  const { data: comments, error: commentsError } = await supabase
    .from("DepartmentComment")
    .select("*")
    .eq("threadId", thread.id)
    .order("createdAt", { ascending: true });

  if (commentsError) {
    console.error("Error fetching department comments:", commentsError);
    return { data: null, error: commentsError.message };
  }

  return {
    data: {
      thread: thread as DepartmentCommentThread,
      comments: (comments || []) as DepartmentComment[],
    },
    error: null,
  };
}

export async function createDepartmentComment(input: {
  projectId: string;
  entityType: string;
  entityId: string;
  body: string;
}) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const body = input.body.trim();
  if (!body) {
    return { data: null, error: "Comment body is required" };
  }

  let thread: DepartmentCommentThread;

  try {
    thread = await getOrCreateThread(
      input.projectId,
      input.entityType,
      input.entityId,
      userId,
    );
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to prepare comment thread",
    };
  }

  const { data, error } = await supabase
    .from("DepartmentComment")
    .insert({
      threadId: thread.id,
      authorId: userId,
      body,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating department comment:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);
  return { data: data as DepartmentComment, error: null };
}

export async function deleteDepartmentComment(
  commentId: string,
  projectId: string,
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("DepartmentComment")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("Error deleting department comment:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true, error: null };
}
