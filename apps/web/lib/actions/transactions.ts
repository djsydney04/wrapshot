"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/permissions/server";

export type ReceiptStatus = "MISSING" | "PENDING" | "APPROVED" | "REJECTED";

export interface Transaction {
  id: string;
  budgetId: string;
  lineItemId: string | null;
  date: string;
  vendor: string;
  amount: number;
  description: string;
  category: string;
  receiptUrl: string | null;
  receiptStatus: ReceiptStatus;
  enteredBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionWithDetails extends Transaction {
  lineItem?: {
    id: string;
    accountCode: string;
    description: string;
  } | null;
  enteredByUser?: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface CreateTransactionInput {
  budgetId: string;
  lineItemId?: string | null;
  date: string;
  vendor: string;
  amount: number;
  description: string;
  category: string;
  receiptUrl?: string | null;
  notes?: string | null;
}

export interface UpdateTransactionInput {
  lineItemId?: string | null;
  date?: string;
  vendor?: string;
  amount?: number;
  description?: string;
  category?: string;
  receiptUrl?: string | null;
  notes?: string | null;
}

export interface ReceiptStatusRow {
  budgetId: string;
  receiptStatus: ReceiptStatus;
}

// Get all transactions for a budget
export async function getTransactions(budgetId: string): Promise<Transaction[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("Transaction")
    .select("*")
    .eq("budgetId", budgetId)
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }

  return data || [];
}

// Get receipt statuses for a list of budgets (for dashboard rollups)
export async function getReceiptStatusesForBudgets(budgetIds: string[]): Promise<ReceiptStatusRow[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  if (budgetIds.length === 0) return [];

  const { data, error } = await supabase
    .from("Transaction")
    .select("budgetId, receiptStatus")
    .in("budgetId", budgetIds);

  if (error) {
    console.error("Error fetching receipt statuses:", error);
    return [];
  }

  return (data || []) as ReceiptStatusRow[];
}

// Get a single transaction with joined data
export async function getTransaction(transactionId: string): Promise<TransactionWithDetails | null> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("Transaction")
    .select(`
      *,
      lineItem:BudgetLineItem(id, accountCode, description)
    `)
    .eq("id", transactionId)
    .single();

  if (error) {
    console.error("Error fetching transaction:", error);
    return null;
  }

  // Fetch user details separately since we can't join auth.users directly
  if (data?.enteredBy) {
    const { data: profile } = await supabase
      .from("UserProfile")
      .select("email, firstName, lastName")
      .eq("userId", data.enteredBy)
      .single();

    return {
      ...data,
      enteredByUser: profile || null,
    };
  }

  return data;
}

// Create a new transaction
export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Determine receipt status based on whether a receipt URL is provided
  const receiptStatus: ReceiptStatus = input.receiptUrl ? "PENDING" : "MISSING";

  const { data, error } = await supabase
    .from("Transaction")
    .insert({
      budgetId: input.budgetId,
      lineItemId: input.lineItemId || null,
      date: input.date,
      vendor: input.vendor,
      amount: input.amount,
      description: input.description,
      category: input.category,
      receiptUrl: input.receiptUrl || null,
      receiptStatus,
      enteredBy: userId,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating transaction:", error);
    throw new Error(`Failed to create transaction: ${error.message}`);
  }

  revalidatePath(`/finance/${input.budgetId}`);
  return data;
}

// Update a transaction
export async function updateTransaction(
  transactionId: string,
  updates: UpdateTransactionInput
): Promise<Transaction> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Build update object, only including provided fields
  const updateData: Record<string, unknown> = {};

  if (updates.lineItemId !== undefined) updateData.lineItemId = updates.lineItemId;
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.vendor !== undefined) updateData.vendor = updates.vendor;
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  // Handle receipt URL changes with automatic status update
  if (updates.receiptUrl !== undefined) {
    updateData.receiptUrl = updates.receiptUrl;
    // If receipt is added/changed, set to PENDING; if removed, set to MISSING
    updateData.receiptStatus = updates.receiptUrl ? "PENDING" : "MISSING";
  }

  const { data, error } = await supabase
    .from("Transaction")
    .update(updateData)
    .eq("id", transactionId)
    .select()
    .single();

  if (error) {
    console.error("Error updating transaction:", error);
    throw new Error(`Failed to update transaction: ${error.message}`);
  }

  revalidatePath(`/finance/${data.budgetId}`);
  return data;
}

// Delete a transaction
export async function deleteTransaction(transactionId: string, budgetId: string): Promise<void> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { error } = await supabase
    .from("Transaction")
    .delete()
    .eq("id", transactionId);

  if (error) {
    console.error("Error deleting transaction:", error);
    throw new Error(`Failed to delete transaction: ${error.message}`);
  }

  revalidatePath(`/finance/${budgetId}`);
}

// Update receipt status (approve/reject)
export async function updateReceiptStatus(
  transactionId: string,
  status: "APPROVED" | "REJECTED"
): Promise<Transaction> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const updateData: Record<string, unknown> = {
    receiptStatus: status,
  };

  // Set approver info if approving
  if (status === "APPROVED") {
    updateData.approvedBy = userId;
    updateData.approvedAt = new Date().toISOString();
  } else {
    // Clear approval if rejecting
    updateData.approvedBy = null;
    updateData.approvedAt = null;
  }

  const { data, error } = await supabase
    .from("Transaction")
    .update(updateData)
    .eq("id", transactionId)
    .select()
    .single();

  if (error) {
    console.error("Error updating receipt status:", error);
    throw new Error(`Failed to update receipt status: ${error.message}`);
  }

  revalidatePath(`/finance/${data.budgetId}`);
  return data;
}

// Get transactions with pending receipts for review
export async function getPendingReceipts(budgetId: string): Promise<Transaction[]> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("Transaction")
    .select("*")
    .eq("budgetId", budgetId)
    .eq("receiptStatus", "PENDING")
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching pending receipts:", error);
    return [];
  }

  return data || [];
}

// Get transaction summary for a budget
export async function getTransactionSummary(budgetId: string): Promise<{
  totalTransactions: number;
  totalAmount: number;
  pendingReceipts: number;
  missingReceipts: number;
  approvedReceipts: number;
}> {
  const supabase = await createClient();
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("Transaction")
    .select("amount, receiptStatus")
    .eq("budgetId", budgetId);

  if (error) {
    console.error("Error fetching transaction summary:", error);
    return {
      totalTransactions: 0,
      totalAmount: 0,
      pendingReceipts: 0,
      missingReceipts: 0,
      approvedReceipts: 0,
    };
  }

  const transactions = data || [];
  return {
    totalTransactions: transactions.length,
    totalAmount: transactions.reduce((sum, t) => sum + Number(t.amount), 0),
    pendingReceipts: transactions.filter((t) => t.receiptStatus === "PENDING").length,
    missingReceipts: transactions.filter((t) => t.receiptStatus === "MISSING").length,
    approvedReceipts: transactions.filter((t) => t.receiptStatus === "APPROVED").length,
  };
}
