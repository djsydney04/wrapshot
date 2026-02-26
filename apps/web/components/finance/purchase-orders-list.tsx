"use client";

import * as React from "react";
import {
  MoreHorizontal,
  Check,
  Send,
  CircleDot,
  CircleCheck,
  Ban,
  Trash2,
} from "lucide-react";
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
  deletePurchaseOrder,
  updatePurchaseOrderStatus,
  type PurchaseOrder,
  type PurchaseOrderStatus,
} from "@/lib/actions/purchase-orders";
import { toast } from "sonner";

interface PurchaseOrdersListProps {
  orders: PurchaseOrder[];
  canManage: boolean;
  currentUserId?: string | null;
  isFinanceManager?: boolean;
  onRefresh: () => void;
}

const STATUS_BADGES: Record<
  PurchaseOrderStatus,
  { className: string; label: string }
> = {
  DRAFT: {
    className: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    label: "Draft",
  },
  APPROVED: {
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    label: "Approved",
  },
  SENT: {
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    label: "Sent",
  },
  PARTIAL: {
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    label: "Partial",
  },
  CLOSED: {
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    label: "Closed",
  },
  CANCELLED: {
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    label: "Cancelled",
  },
};

export function PurchaseOrdersList({
  orders,
  canManage,
  currentUserId,
  isFinanceManager = false,
  onRefresh,
}: PurchaseOrdersListProps) {
  const [actionId, setActionId] = React.useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateValue: string | null) => {
    if (!dateValue) return "-";
    return new Date(dateValue).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleStatusChange = async (
    orderId: string,
    status: PurchaseOrderStatus,
  ) => {
    setActionId(orderId);
    try {
      await updatePurchaseOrderStatus(orderId, status);
      toast.success("Purchase order updated");
      onRefresh();
    } catch (error) {
      console.error("Failed to update PO status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update PO");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (order: PurchaseOrder) => {
    const confirmed = confirm(
      `Delete ${order.poNumber}? Only draft or cancelled POs can be deleted.`,
    );
    if (!confirmed) return;

    setActionId(order.id);
    try {
      await deletePurchaseOrder(order.id);
      toast.success("Purchase order deleted");
      onRefresh();
    } catch (error) {
      console.error("Failed to delete PO:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete PO");
    } finally {
      setActionId(null);
    }
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
        No purchase orders yet. Create one to track committed spend before expenses hit.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">PO</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Vendor / Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                Total
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                Committed
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Expected
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const statusMeta = STATUS_BADGES[order.status];
              const isLoading = actionId === order.id;
              const firstLine = order.lines[0]?.description;
              const rowCanManage =
                canManage && (isFinanceManager || order.createdBy === currentUserId);

              return (
                <tr
                  key={order.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium">{order.poNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(order.issueDate)}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium">{order.vendor}</div>
                    <div className="text-muted-foreground">{order.title}</div>
                    {firstLine && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {firstLine}
                        {order.lines.length > 1 ? ` +${order.lines.length - 1} more` : ""}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-sm">
                    <Badge className={statusMeta.className}>{statusMeta.label}</Badge>
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {formatCurrency(order.totalAmount)}
                  </td>

                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {formatCurrency(order.committedAmount)}
                  </td>

                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDate(order.expectedDate)}
                  </td>

                  <td className="px-2 py-3">
                    {rowCanManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" disabled={isLoading}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {order.status === "DRAFT" && (
                            <DropdownMenuItem
                              onClick={() => void handleStatusChange(order.id, "APPROVED")}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                          )}

                          {(order.status === "APPROVED" || order.status === "PARTIAL") && (
                            <DropdownMenuItem
                              onClick={() => void handleStatusChange(order.id, "SENT")}
                            >
                              <Send className="mr-2 h-4 w-4" />
                              Mark Sent
                            </DropdownMenuItem>
                          )}

                          {(order.status === "APPROVED" || order.status === "SENT") && (
                            <DropdownMenuItem
                              onClick={() => void handleStatusChange(order.id, "PARTIAL")}
                            >
                              <CircleDot className="mr-2 h-4 w-4" />
                              Mark Partial
                            </DropdownMenuItem>
                          )}

                          {(order.status === "APPROVED" ||
                            order.status === "SENT" ||
                            order.status === "PARTIAL") && (
                            <DropdownMenuItem
                              onClick={() => void handleStatusChange(order.id, "CLOSED")}
                            >
                              <CircleCheck className="mr-2 h-4 w-4" />
                              Close PO
                            </DropdownMenuItem>
                          )}

                          {(order.status === "DRAFT" ||
                            order.status === "APPROVED" ||
                            order.status === "SENT" ||
                            order.status === "PARTIAL") && (
                            <DropdownMenuItem
                              onClick={() => void handleStatusChange(order.id, "CANCELLED")}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          )}

                          {(order.status === "DRAFT" || order.status === "CANCELLED") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void handleDelete(order)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
