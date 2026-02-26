"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/permissions/server";

export type PurchaseOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "SENT"
  | "PARTIAL"
  | "CLOSED"
  | "CANCELLED";

export interface PurchaseOrderLine {
  id: string;
  purchaseOrderId: string;
  lineItemId: string | null;
  categoryId: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  amount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lineItem?: {
    id: string;
    accountCode: string;
    description: string;
  } | null;
  category?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface PurchaseOrder {
  id: string;
  budgetId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  vendor: string;
  title: string;
  description: string | null;
  issueDate: string;
  expectedDate: string | null;
  totalAmount: number;
  committedAmount: number;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  sentAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PurchaseOrderLine[];
}

export interface CreatePurchaseOrderLineInput {
  lineItemId?: string | null;
  categoryId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
  notes?: string | null;
}

export interface CreatePurchaseOrderInput {
  budgetId: string;
  poNumber?: string;
  vendor: string;
  title: string;
  description?: string | null;
  issueDate?: string;
  expectedDate?: string | null;
  notes?: string | null;
  status?: PurchaseOrderStatus;
  lines: CreatePurchaseOrderLineInput[];
}

const COMMITTING_STATUSES: PurchaseOrderStatus[] = ["APPROVED", "SENT", "PARTIAL"];

const ALLOWED_STATUS_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ["APPROVED", "CANCELLED"],
  APPROVED: ["SENT", "PARTIAL", "CLOSED", "CANCELLED"],
  SENT: ["PARTIAL", "CLOSED", "CANCELLED"],
  PARTIAL: ["SENT", "CLOSED", "CANCELLED"],
  CLOSED: [],
  CANCELLED: [],
};

async function assertBudgetWritable(budgetId: string): Promise<void> {
  const supabase = await createClient();

  const { data: budget, error } = await supabase
    .from("Budget")
    .select("id, status")
    .eq("id", budgetId)
    .single();

  if (error || !budget) {
    throw new Error("Budget not found");
  }

  if (budget.status === "LOCKED") {
    throw new Error("Cannot modify a locked budget");
  }
}

function isCommittingStatus(status: PurchaseOrderStatus): boolean {
  return COMMITTING_STATUSES.includes(status);
}

async function getNextPoNumber(budgetId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("PurchaseOrder")
    .select("poNumber")
    .eq("budgetId", budgetId);

  if (error) {
    throw new Error(`Failed to generate PO number: ${error.message}`);
  }

  const maxIndex = (data ?? []).reduce((currentMax, row) => {
    const match = row.poNumber?.match(/(\d+)$/);
    if (!match) return currentMax;
    const parsed = Number.parseInt(match[1], 10);
    return Number.isFinite(parsed) ? Math.max(currentMax, parsed) : currentMax;
  }, 0);

  return `PO-${String(maxIndex + 1).padStart(4, "0")}`;
}

export async function getPurchaseOrders(budgetId: string): Promise<PurchaseOrder[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("PurchaseOrder")
    .select(
      `
      *,
      lines:PurchaseOrderLine(
        *,
        lineItem:BudgetLineItem(id, accountCode, description),
        category:BudgetCategory(id, code, name)
      )
    `,
    )
    .eq("budgetId", budgetId)
    .order("issueDate", { ascending: false });

  if (error) {
    console.error("Error fetching purchase orders:", error);
    return [];
  }

  return (data as PurchaseOrder[] | null) ?? [];
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  await assertBudgetWritable(input.budgetId);

  const vendor = input.vendor.trim();
  const title = input.title.trim();

  if (!vendor) {
    throw new Error("Vendor is required");
  }

  if (!title) {
    throw new Error("Title is required");
  }

  if (!input.lines || input.lines.length === 0) {
    throw new Error("Add at least one PO line");
  }

  const sanitizedLines = input.lines.map((line) => ({
    ...line,
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unitCost: Number(line.unitCost),
  }));

  const hasInvalidLine = sanitizedLines.some(
    (line) =>
      line.description.length === 0 ||
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isFinite(line.unitCost) ||
      line.unitCost < 0,
  );

  if (hasInvalidLine) {
    throw new Error("Each PO line must include description, quantity, and cost");
  }

  const poNumber = input.poNumber?.trim() || (await getNextPoNumber(input.budgetId));
  const status = input.status ?? "DRAFT";

  if (status !== "DRAFT" && status !== "APPROVED") {
    throw new Error("New purchase orders must start as Draft or Approved");
  }

  const nowIso = new Date().toISOString();

  const purchaseOrderInsert: Record<string, unknown> = {
    budgetId: input.budgetId,
    poNumber,
    status,
    vendor,
    title,
    description: input.description?.trim() || null,
    issueDate: input.issueDate || new Date().toISOString().split("T")[0],
    expectedDate: input.expectedDate || null,
    notes: input.notes?.trim() || null,
    createdBy: userId,
  };

  if (status === "APPROVED") {
    purchaseOrderInsert.approvedBy = userId;
    purchaseOrderInsert.approvedAt = nowIso;
  }

  const { data: purchaseOrder, error: orderError } = await supabase
    .from("PurchaseOrder")
    .insert(purchaseOrderInsert)
    .select("id, budgetId")
    .single();

  if (orderError || !purchaseOrder) {
    console.error("Error creating purchase order:", orderError);
    throw new Error(`Failed to create purchase order: ${orderError?.message}`);
  }

  const linesPayload = sanitizedLines.map((line) => ({
    purchaseOrderId: purchaseOrder.id,
    lineItemId: line.lineItemId || null,
    categoryId: line.categoryId || null,
    description: line.description,
    quantity: line.quantity,
    unitCost: line.unitCost,
    notes: line.notes?.trim() || null,
  }));

  const { error: lineError } = await supabase
    .from("PurchaseOrderLine")
    .insert(linesPayload);

  if (lineError) {
    console.error("Error creating purchase order lines:", lineError);
    await supabase.from("PurchaseOrder").delete().eq("id", purchaseOrder.id);
    throw new Error(`Failed to create PO lines: ${lineError.message}`);
  }

  const { data: createdOrder, error: fetchError } = await supabase
    .from("PurchaseOrder")
    .select(
      `
      *,
      lines:PurchaseOrderLine(
        *,
        lineItem:BudgetLineItem(id, accountCode, description),
        category:BudgetCategory(id, code, name)
      )
    `,
    )
    .eq("id", purchaseOrder.id)
    .single();

  if (fetchError || !createdOrder) {
    console.error("Error fetching created purchase order:", fetchError);
    throw new Error("Purchase order created but could not be reloaded");
  }

  revalidatePath(`/finance/${input.budgetId}`);

  return createdOrder as PurchaseOrder;
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: PurchaseOrderStatus,
): Promise<PurchaseOrder> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: current, error: currentError } = await supabase
    .from("PurchaseOrder")
    .select("id, budgetId, status")
    .eq("id", purchaseOrderId)
    .single();

  if (currentError || !current) {
    throw new Error("Purchase order not found");
  }

  await assertBudgetWritable(current.budgetId);

  const currentStatus = current.status as PurchaseOrderStatus;

  if (currentStatus === status) {
    const { data: unchanged } = await supabase
      .from("PurchaseOrder")
      .select(
        `
        *,
        lines:PurchaseOrderLine(
          *,
          lineItem:BudgetLineItem(id, accountCode, description),
          category:BudgetCategory(id, code, name)
        )
      `,
      )
      .eq("id", purchaseOrderId)
      .single();

    if (!unchanged) {
      throw new Error("Purchase order not found");
    }

    return unchanged as PurchaseOrder;
  }

  if (!ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(status)) {
    throw new Error(`Cannot change PO status from ${currentStatus} to ${status}`);
  }

  const nowIso = new Date().toISOString();
  const updateData: Record<string, unknown> = {
    status,
  };

  if (status === "APPROVED") {
    updateData.approvedBy = userId;
    updateData.approvedAt = nowIso;
  }

  if (status === "SENT") {
    updateData.sentAt = nowIso;
  }

  if (status === "CLOSED") {
    updateData.closedAt = nowIso;
  }

  if (status === "CANCELLED") {
    updateData.cancelledAt = nowIso;
  }

  if (status !== "CANCELLED") {
    updateData.cancelledAt = null;
  }

  if (!isCommittingStatus(status)) {
    // Make it explicit in app state; DB trigger is still the source of truth.
    updateData.committedAmount = 0;
  }

  const { data, error } = await supabase
    .from("PurchaseOrder")
    .update(updateData)
    .eq("id", purchaseOrderId)
    .select(
      `
      *,
      lines:PurchaseOrderLine(
        *,
        lineItem:BudgetLineItem(id, accountCode, description),
        category:BudgetCategory(id, code, name)
      )
    `,
    )
    .single();

  if (error || !data) {
    console.error("Error updating purchase order status:", error);
    throw new Error(`Failed to update status: ${error?.message}`);
  }

  revalidatePath(`/finance/${current.budgetId}`);

  return data as PurchaseOrder;
}

export async function deletePurchaseOrder(purchaseOrderId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data: purchaseOrder, error: poError } = await supabase
    .from("PurchaseOrder")
    .select("id, budgetId, status")
    .eq("id", purchaseOrderId)
    .single();

  if (poError || !purchaseOrder) {
    throw new Error("Purchase order not found");
  }

  await assertBudgetWritable(purchaseOrder.budgetId);

  if (purchaseOrder.status !== "DRAFT" && purchaseOrder.status !== "CANCELLED") {
    throw new Error("Only draft or cancelled purchase orders can be deleted");
  }

  const { error } = await supabase
    .from("PurchaseOrder")
    .delete()
    .eq("id", purchaseOrderId);

  if (error) {
    console.error("Error deleting purchase order:", error);
    throw new Error(`Failed to delete purchase order: ${error.message}`);
  }

  revalidatePath(`/finance/${purchaseOrder.budgetId}`);
}
