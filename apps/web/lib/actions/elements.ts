"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";
import type { ElementCategory } from "@/lib/constants/elements";

export interface ElementInput {
  projectId: string;
  category: ElementCategory;
  name: string;
  description?: string;
  notes?: string;
}

export interface Element {
  id: string;
  projectId: string;
  category: ElementCategory;
  name: string;
  description: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  sceneCount?: number;
  scenes?: { id: string; sceneNumber: string; quantity: number }[];
}

export interface SceneElement {
  id: string;
  sceneId: string;
  elementId: string;
  quantity: number;
  notes: string | null;
}

// Fetch all elements for a project
export async function getElements(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Element")
    .select("*")
    .eq("projectId", projectId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching elements:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Element[], error: null };
}

// Get elements by category
export async function getElementsByCategory(projectId: string, category: ElementCategory) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Element")
    .select("*")
    .eq("projectId", projectId)
    .eq("category", category)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching elements by category:", error);
    return { data: null, error: error.message };
  }

  return { data: data as Element[], error: null };
}

// Get a single element with its scenes
export async function getElement(elementId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Element")
    .select(`
      *,
      sceneElements:SceneElement(
        id,
        quantity,
        notes,
        scene:Scene(id, sceneNumber)
      )
    `)
    .eq("id", elementId)
    .single();

  if (error) {
    console.error("Error fetching element:", error);
    return { data: null, error: error.message };
  }

  // Transform the data to include scene info
  const element = {
    ...data,
    scenes: data.sceneElements?.map((se: { scene: { id: string; sceneNumber: string }; quantity: number }) => ({
      id: se.scene.id,
      sceneNumber: se.scene.sceneNumber,
      quantity: se.quantity,
    })),
    sceneCount: data.sceneElements?.length || 0,
  };

  return { data: element as Element, error: null };
}

// Create a new element
export async function createElement(input: ElementInput) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Element")
    .insert({
      projectId: input.projectId,
      category: input.category,
      name: input.name,
      description: input.description || null,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating element:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${input.projectId}`);

  return { data, error: null };
}

// Update an element
export async function updateElement(id: string, updates: Partial<ElementInput>) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Remove projectId from updates if present
  const { projectId, ...elementUpdates } = updates;

  const { data, error } = await supabase
    .from("Element")
    .update({
      ...elementUpdates,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating element:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${data.projectId}`);

  return { data, error: null };
}

// Delete an element
export async function deleteElement(id: string, projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("Element").delete().eq("id", id);

  if (error) {
    console.error("Error deleting element:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { success: true, error: null };
}

// Assign element to scene
export async function assignElementToScene(
  elementId: string,
  sceneId: string,
  quantity: number = 1,
  notes?: string
) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("SceneElement")
    .upsert(
      {
        elementId,
        sceneId,
        quantity,
        notes: notes || null,
      },
      {
        onConflict: "sceneId,elementId",
      }
    )
    .select()
    .single();

  if (error) {
    console.error("Error assigning element to scene:", error);
    return { data: null, error: error.message };
  }

  return { data: data as SceneElement, error: null };
}

// Remove element from scene
export async function removeElementFromScene(elementId: string, sceneId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("SceneElement")
    .delete()
    .eq("elementId", elementId)
    .eq("sceneId", sceneId);

  if (error) {
    console.error("Error removing element from scene:", error);
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}

// Get elements for a specific scene
export async function getSceneElements(sceneId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("SceneElement")
    .select(`
      *,
      element:Element(*)
    `)
    .eq("sceneId", sceneId);

  if (error) {
    console.error("Error fetching scene elements:", error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

// Get elements with scene counts
export async function getElementsWithSceneCounts(projectId: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  // Get elements
  const { data: elements, error: elemError } = await supabase
    .from("Element")
    .select("*")
    .eq("projectId", projectId)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (elemError) {
    console.error("Error fetching elements:", elemError);
    return { data: null, error: elemError.message };
  }

  // Get scene counts per element
  const { data: sceneLinks, error: sceneError } = await supabase
    .from("SceneElement")
    .select("elementId")
    .in(
      "elementId",
      elements.map((e) => e.id)
    );

  if (sceneError) {
    console.error("Error fetching scene counts:", sceneError);
    return { data: elements as Element[], error: null };
  }

  // Count scenes per element
  const countMap = new Map<string, number>();
  sceneLinks?.forEach((link) => {
    countMap.set(link.elementId, (countMap.get(link.elementId) || 0) + 1);
  });

  // Add counts to elements
  const elementsWithCounts = elements.map((elem) => ({
    ...elem,
    sceneCount: countMap.get(elem.id) || 0,
  }));

  return { data: elementsWithCounts as Element[], error: null };
}

// Quick create element - lightweight creation for inline breakdown editor
export async function quickCreateElement(
  projectId: string,
  category: ElementCategory,
  name: string,
  notes?: string
): Promise<{ data: Element | null; error: string | null }> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("Element")
    .insert({
      projectId,
      category,
      name,
      description: null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error quick creating element:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { data: data as Element, error: null };
}

// Bulk create elements (useful for importing from script breakdown)
export async function bulkCreateElements(projectId: string, elements: Omit<ElementInput, "projectId">[]) {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    return { data: null, error: "Not authenticated" };
  }

  const records = elements.map((elem) => ({
    projectId,
    category: elem.category,
    name: elem.name,
    description: elem.description || null,
    notes: elem.notes || null,
  }));

  const { data, error } = await supabase
    .from("Element")
    .insert(records)
    .select();

  if (error) {
    console.error("Error bulk creating elements:", error);
    return { data: null, error: error.message };
  }

  revalidatePath(`/projects/${projectId}`);

  return { data: data as Element[], error: null };
}
