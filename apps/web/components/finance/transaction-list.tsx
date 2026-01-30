"use client";

import * as React from "react";
import { MoreHorizontal, Receipt, Eye, Pencil, Check, X, Trash2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type Transaction,
  type ReceiptStatus,
  deleteTransaction,
  updateReceiptStatus,
} from "@/lib/actions/transactions";

interface TransactionListProps {
  transactions: Transaction[];
  budgetId: string;
  onEdit: (transaction: Transaction) => void;
  onRefresh: () => void;
  isAdmin?: boolean;
}

export function TransactionList({
  transactions,
  budgetId,
  onEdit,
  onRefresh,
  isAdmin = false,
}: TransactionListProps) {
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getReceiptStatusBadge = (status: ReceiptStatus) => {
    const variants: Record<ReceiptStatus, { className: string; label: string }> = {
      MISSING: {
        className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        label: "Missing",
      },
      PENDING: {
        className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        label: "Pending",
      },
      APPROVED: {
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        label: "Approved",
      },
      REJECTED: {
        className: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
        label: "Rejected",
      },
    };
    return variants[status];
  };

  const handleDelete = async (transaction: Transaction) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;

    setActionLoading(transaction.id);
    try {
      await deleteTransaction(transaction.id, budgetId);
      onRefresh();
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (transaction: Transaction) => {
    setActionLoading(transaction.id);
    try {
      await updateReceiptStatus(transaction.id, "APPROVED");
      onRefresh();
    } catch (error) {
      console.error("Failed to approve receipt:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (transaction: Transaction) => {
    setActionLoading(transaction.id);
    try {
      await updateReceiptStatus(transaction.id, "REJECTED");
      onRefresh();
    } catch (error) {
      console.error("Failed to reject receipt:", error);
    } finally {
      setActionLoading(null);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8">
        <div className="text-center text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium mb-2">No Expenses Yet</h3>
          <p className="text-sm">
            Add your first expense to start tracking spending against this budget.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                Date
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                Vendor
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                Description
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">
                Category
              </th>
              <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">
                Amount
              </th>
              <th className="text-center text-xs font-medium text-muted-foreground px-4 py-3">
                Receipt
              </th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const receiptBadge = getReceiptStatusBadge(transaction.receiptStatus);
              const isLoading = actionLoading === transaction.id;

              return (
                <tr
                  key={transaction.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-sm">{transaction.vendor}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground line-clamp-1">
                      {transaction.description}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                      {transaction.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium text-sm">
                      {formatCurrency(transaction.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge className={cn("text-xs", receiptBadge.className)}>
                      {receiptBadge.label}
                    </Badge>
                  </td>
                  <td className="px-2 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isLoading}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {transaction.receiptUrl && (
                          <DropdownMenuItem
                            onClick={() => window.open(transaction.receiptUrl!, "_blank")}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Receipt
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(transaction)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>

                        {/* Receipt approval actions for admins */}
                        {isAdmin && transaction.receiptStatus === "PENDING" && transaction.receiptUrl && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleApprove(transaction)}>
                              <Check className="h-4 w-4 mr-2 text-emerald-600" />
                              Approve Receipt
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleReject(transaction)}>
                              <X className="h-4 w-4 mr-2 text-red-600" />
                              Reject Receipt
                            </DropdownMenuItem>
                          </>
                        )}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(transaction)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {transactions.length} expense{transactions.length !== 1 ? "s" : ""}
          </span>
          <span className="font-medium">
            Total: {formatCurrency(transactions.reduce((sum, t) => sum + Number(t.amount), 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
