"use server";

import { revalidatePath } from "next/cache";
import {
  getCallSheetsForProjectData,
  getOrCreateCallSheetData,
  updateCallSheetData,
  publishCallSheetData,
  getFullCallSheetDataForProject,
} from "@/lib/data/call-sheets";

export type {
  CallSheetSummary,
  CallSheetRow,
  CallSheetUpdates,
  CallSheetFullData,
} from "@/lib/data/call-sheets";

// Get all call sheets for a project (for list view status)
export async function getCallSheetsForProject(projectId: string) {
  return getCallSheetsForProjectData(projectId);
}

// Get or create a call sheet for a shooting day
export async function getOrCreateCallSheet(shootingDayId: string) {
  return getOrCreateCallSheetData(shootingDayId);
}

// Update a call sheet's notes/info fields
export async function updateCallSheet(
  callSheetId: string,
  updates: Parameters<typeof updateCallSheetData>[1],
) {
  const { data, error, projectId } = await updateCallSheetData(
    callSheetId,
    updates,
  );

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }

  return { data, error };
}

// Publish a call sheet (sets publishedAt, increments version)
export async function publishCallSheet(callSheetId: string) {
  const { data, error, projectId } = await publishCallSheetData(callSheetId);

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }

  return { data, error };
}

// Get full call sheet data (deep join for preview/PDF/email)
export async function getFullCallSheetData(
  shootingDayId: string,
  projectId: string,
) {
  return getFullCallSheetDataForProject(shootingDayId, projectId);
}
