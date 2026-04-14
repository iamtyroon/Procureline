"use client";

import { useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  PROCUREMENT_ITEM_COMPLIANCE_FLAGS,
  PROCUREMENT_ITEM_PROCUREMENT_METHODS,
  PROCUREMENT_ITEM_UNITS,
} from "@/lib/procurement-officer/items";
import { cn } from "@/lib/utils";
import {
  requestApprovalCategorySchema,
  requestApprovalItemSchema,
  requestDenialSchema,
  type RequestApprovalCategoryValues,
  type RequestApprovalItemValues,
  type RequestDenialValues,
} from "@/lib/validators/request-decision";

type RequestRow = {
  canApprove: boolean;
  canDeny: boolean;
  canUndo: boolean;
  categoryId?: string | null;
  categoryName?: string | null;
  createdAt: number;
  description: string;
  departmentId: string;
  departmentName: string;
  decisionReason: string | null;
  decisionStatusLabel: string;
  estimatedUnitPrice?: number | null;
  id: string;
  justification: string;
  linkedCategoryRequestId?: string | null;
  name: string;
  requestorId: string;
  requestorLabel: string;
  status: "pending" | "approved" | "denied" | "expired" | "cancelled";
  submittedAt: number;
  type: "item" | "category";
  updatedAt: number;
};

type RequestCluster = {
  id: string;
  name: string;
  requestType: "item" | "category";
  requestCount: number;
  requestorCount: number;
  departmentCount: number;
  statusCounts: Record<RequestRow["status"], number>;
  requests: RequestRow[];
};

type RequestData = {
  clusters: RequestCluster[];
  departments: Array<{ id: string; name: string }>;
  summary: {
    pendingCategoryCount: number;
    pendingItemCount: number;
    totalCount: number;
    totalPendingCount: number;
  };
};

function formatTimestamp(value: number): string {
  return format(new Date(value), "dd MMM yyyy HH:mm");
}

export function ProcurementOfficerRequestsWorkspace(): JSX.Element {
  const [view, setView] = useState<"inbox" | "history">("inbox");
  const [statusFilter, setStatusFilter] = useState<
    "all" | RequestRow["status"]
  >("all");
  const [typeFilter, setTypeFilter] = useState<"all" | RequestRow["type"]>(
    "all",
  );
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [approvalTarget, setApprovalTarget] = useState<RequestRow | null>(null);
  const [denialTarget, setDenialTarget] = useState<RequestRow | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [isBulkDenialOpen, setIsBulkDenialOpen] = useState(false);
  const [bulkDenialTarget, setBulkDenialTarget] = useState<{
    requestIds: string[];
    requestType: "item" | "category";
  } | null>(null);

  const filterArgs = useMemo(() => {
    const startDate = startDateFilter
      ? new Date(startDateFilter).getTime()
      : undefined;
    const endDate = endDateFilter
      ? new Date(endDateFilter).getTime() + 86_399_999
      : undefined;
    const resolvedStatus =
      view === "inbox"
        ? "pending"
        : statusFilter !== "all"
          ? statusFilter
          : undefined;
    return {
      departmentId: departmentFilter !== "all" ? departmentFilter : undefined,
      requestType: typeFilter !== "all" ? typeFilter : undefined,
      status: resolvedStatus,
      startDate,
      endDate,
      view,
    };
  }, [
    departmentFilter,
    endDateFilter,
    startDateFilter,
    statusFilter,
    typeFilter,
    view,
  ]);

  const requestData = useQuery(
    api.functions.requests.getProcurementOfficerCatalogRequests,
    filterArgs,
  ) as RequestData | undefined;
  const categoriesWorkspace = useQuery(
    api.functions.categories.getCategoriesWorkspace,
  );

  const approveCategory = useAction(api.functions.requests.approveCategoryRequest);
  const approveItem = useAction(api.functions.requests.approveItemRequest);
  const denyRequest = useAction(api.functions.requests.denyCatalogRequest);
  const undoDenial = useAction(api.functions.requests.undoCatalogRequestDenial);
  const bulkApprove = useAction(api.functions.requests.bulkApproveCatalogRequests);
  const bulkDeny = useAction(api.functions.requests.bulkDenyCatalogRequests);

  const categoryForm = useForm<RequestApprovalCategoryValues>({
    resolver: zodResolver(requestApprovalCategorySchema),
    defaultValues: {
      description: "",
      name: "",
    },
  });

  const itemForm = useForm<RequestApprovalItemValues>({
    resolver: zodResolver(requestApprovalItemSchema),
    defaultValues: {
      categoryId: "",
      complianceFlags: [],
      customUnit: "",
      description: "",
      maxQuantity: undefined,
      minQuantity: undefined,
      name: "",
      procurementMethod: "RFQ",
      sourceOfFunds: "GOK",
      unit: "each",
      unitPrice: 0,
    },
  });

  const denialForm = useForm<RequestDenialValues>({
    resolver: zodResolver(requestDenialSchema),
    defaultValues: {
      reason: "",
    },
  });
  const bulkDenialForm = useForm<RequestDenialValues>({
    resolver: zodResolver(requestDenialSchema),
    defaultValues: {
      reason: "",
    },
  });

  const activeCategories = useMemo(() => {
    const rows = categoriesWorkspace?.rows ?? [];
    return rows.filter((row) => row.isActive);
  }, [categoriesWorkspace?.rows]);

  const rows = useMemo(() => {
    return requestData?.clusters.flatMap((cluster) => cluster.requests) ?? [];
  }, [requestData?.clusters]);

  const selectionCount = selectedRequestIds.length;
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRequestIds.includes(row.id)),
    [rows, selectedRequestIds],
  );

  useEffect(() => {
    if (view !== "inbox") {
      return;
    }

    if (statusFilter !== "pending") {
      setStatusFilter("pending");
    }
  }, [statusFilter, view]);

  useEffect(() => {
    if (view !== "history") {
      return;
    }

    if (statusFilter === "pending") {
      setStatusFilter("all");
    }
  }, [statusFilter, view]);

  useEffect(() => {
    setSelectedRequestIds((current) =>
      current.filter((id) => rows.some((row) => row.id === id)),
    );
  }, [rows]);

  function resetSelection(): void {
    setSelectedRequestIds([]);
  }

  function toggleRequestSelection(requestId: string): void {
    setSelectedRequestIds((current) =>
      current.includes(requestId)
        ? current.filter((id) => id !== requestId)
        : [...current, requestId],
    );
  }

  async function handleApproveSubmit(
    values: RequestApprovalCategoryValues | RequestApprovalItemValues,
  ): Promise<void> {
    if (!approvalTarget) return;
    try {
      if (approvalTarget.type === "category") {
        await approveCategory({
          category: values as RequestApprovalCategoryValues,
          requestId: approvalTarget.id,
        });
      } else {
        await approveItem({
          item: values as RequestApprovalItemValues,
          requestId: approvalTarget.id,
        });
      }
      toast.success("Request approved.");
      setApprovalTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval failed.";
      toast.error(message);
    }
  }

  async function handleDenySubmit(values: RequestDenialValues): Promise<void> {
    if (!denialTarget) return;
    try {
      await denyRequest({
        reason: values.reason,
        requestId: denialTarget.id,
        requestType: denialTarget.type,
      });
      toast.success("Request denied.");
      setDenialTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Denial failed.";
      toast.error(message);
    }
  }

  async function handleUndo(request: RequestRow): Promise<void> {
    try {
      await undoDenial({ requestId: request.id, requestType: request.type });
      toast.success("Denial undone.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo failed.";
      toast.error(message);
    }
  }

  async function handleBulkApprove(): Promise<void> {
    if (selectedRows.length === 0) {
      toast.error("Select at least one request.");
      return;
    }
    const types = Array.from(new Set(selectedRows.map((row) => row.type)));
    if (types.length !== 1) {
      toast.error("Bulk actions must stay within a single request type.");
      return;
    }
    try {
      const result = await bulkApprove({
        requestIds: selectedRows.map((row) => row.id),
        requestType: types[0] as "item" | "category",
      });
      const processedCount = Array.isArray(result?.processed)
        ? result.processed.length
        : selectedRows.length;
      const skippedCount = Array.isArray(result?.skipped)
        ? result.skipped.length
        : 0;
      toast.success(
        skippedCount > 0
          ? `Approved ${processedCount} requests. Skipped ${skippedCount}.`
          : `Approved ${processedCount} requests.`,
      );
      resetSelection();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk approval failed.";
      toast.error(message);
    }
  }

  function handleBulkDeny(): void {
    if (selectedRows.length === 0) {
      toast.error("Select at least one request.");
      return;
    }
    const types = Array.from(new Set(selectedRows.map((row) => row.type)));
    if (types.length !== 1) {
      toast.error("Bulk actions must stay within a single request type.");
      return;
    }
    setBulkDenialTarget({
      requestIds: selectedRows.map((row) => row.id),
      requestType: types[0] as "item" | "category",
    });
    bulkDenialForm.reset({ reason: "" });
    setIsBulkDenialOpen(true);
  }

  async function handleBulkDenySubmit(values: RequestDenialValues): Promise<void> {
    if (!bulkDenialTarget) {
      return;
    }
    try {
      const result = await bulkDeny({
        reason: values.reason,
        requestIds: bulkDenialTarget.requestIds,
        requestType: bulkDenialTarget.requestType,
      });
      const processedCount = Array.isArray(result?.processed)
        ? result.processed.length
        : bulkDenialTarget.requestIds.length;
      const skippedCount = Array.isArray(result?.skipped)
        ? result.skipped.length
        : 0;
      toast.success(
        skippedCount > 0
          ? `Denied ${processedCount} requests. Skipped ${skippedCount}.`
          : `Denied ${processedCount} requests.`,
      );
      setIsBulkDenialOpen(false);
      setBulkDenialTarget(null);
      resetSelection();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bulk denial failed.";
      toast.error(message);
    }
  }

  function openApprovalDialog(request: RequestRow): void {
    setApprovalTarget(request);
    if (request.type === "category") {
      categoryForm.reset({
        name: request.name,
        description: request.description,
      });
    } else {
      itemForm.reset({
        categoryId: request.categoryId ?? "",
        complianceFlags: [],
        customUnit: "",
        description: request.description,
        maxQuantity: undefined,
        minQuantity: undefined,
        name: request.name,
        procurementMethod: "RFQ",
        sourceOfFunds: "GOK",
        unit: "each",
        unitPrice: request.estimatedUnitPrice ?? 0,
      });
    }
  }

  function openDenialDialog(request: RequestRow): void {
    setDenialTarget(request);
    denialForm.reset({ reason: "" });
  }

  if (!requestData) {
    return <div className="text-sm text-muted-foreground">Loading request inbox...</div>;
  }

  const resolvedRequestData = requestData;
  const summary = resolvedRequestData.summary;

  function toggleClusterSelection(cluster: RequestCluster): void {
    const pendingIds = cluster.requests
      .filter((row) => row.status === "pending")
      .map((row) => row.id);
    if (pendingIds.length === 0) {
      return;
    }

    setSelectedRequestIds((current) => {
      const allSelected = pendingIds.every((id) => current.includes(id));
      if (allSelected) {
        return current.filter((id) => !pendingIds.includes(id));
      }

      const next = new Set(current);
      for (const id of pendingIds) {
        next.add(id);
      }
      return Array.from(next);
    });
  }

  function formatCurrency(amount: number): string {
    return `KES ${amount.toLocaleString("en-US", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    })}`;
  }

  function renderClusters(): JSX.Element {
    if (resolvedRequestData.clusters.length === 0) {
      return (
        <div className="rounded-2xl border border-border/70 bg-muted/10 p-6 text-sm text-muted-foreground">
          No requests match the current filters.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {resolvedRequestData.clusters.map((cluster) => (
          <div
            key={cluster.id}
            className="rounded-2xl border border-border/70 bg-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {cluster.name}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {cluster.requestType === "item" ? "Item" : "Category"} request -{" "}
                  {cluster.requestCount} request
                  {cluster.requestCount === 1 ? "" : "s"} -{" "}
                  {cluster.departmentCount} department
                  {cluster.departmentCount === 1 ? "" : "s"} -{" "}
                  {cluster.requestorCount} requestor
                  {cluster.requestorCount === 1 ? "" : "s"}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Pending {cluster.statusCounts.pending}</span>
                <span>Approved {cluster.statusCounts.approved}</span>
                <span>Denied {cluster.statusCounts.denied}</span>
                <span>Expired {cluster.statusCounts.expired}</span>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={cluster.requests
                        .filter((row) => row.status === "pending")
                        .every((row) => selectedRequestIds.includes(row.id))}
                      onCheckedChange={() => toggleClusterSelection(cluster)}
                      disabled={
                        cluster.requests.filter((row) => row.status === "pending")
                          .length === 0
                      }
                    />
                  </TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Department & DU</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cluster.requests.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedRequestIds.includes(row.id)}
                        onCheckedChange={() => toggleRequestSelection(row.id)}
                        disabled={row.status !== "pending"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-semibold text-foreground">
                        {row.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.type === "item" ? "Item" : "Category"} request
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">
                        {row.departmentName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.requestorLabel}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.type === "item" ? (
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground">
                            Category: {row.categoryName ?? "Unassigned"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Est. price: {formatCurrency(row.estimatedUnitPrice ?? 0)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          New catalog category
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(row.submittedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-border/70 text-xs",
                          row.status === "pending" &&
                            "border-amber-300/70 bg-amber-50 text-amber-900",
                          row.status === "approved" &&
                            "border-emerald-300/70 bg-emerald-50 text-emerald-900",
                          row.status === "denied" &&
                            "border-rose-300/70 bg-rose-50 text-rose-900",
                          row.status === "expired" &&
                            "border-slate-300/70 bg-slate-50 text-slate-700",
                          row.status === "cancelled" &&
                            "border-slate-300/70 bg-slate-50 text-slate-700",
                        )}
                      >
                        {row.decisionStatusLabel}
                      </Badge>
                      {row.decisionReason ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.decisionReason}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openApprovalDialog(row)}
                          disabled={!row.canApprove}
                        >
                          Approve
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openDenialDialog(row)}
                          disabled={!row.canDeny}
                        >
                          Deny
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void handleUndo(row);
                          }}
                          disabled={!row.canUndo}
                        >
                          Undo
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pending items
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {summary.pendingItemCount}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Pending categories
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {summary.pendingCategoryCount}
          </div>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Total requests
          </div>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {summary.totalCount}
          </div>
        </div>
      </div>

      <Tabs value={view} onValueChange={(value) => setView(value as "inbox" | "history")}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList className="h-auto rounded-full border border-border/70 bg-card p-1">
            <TabsTrigger className="rounded-full px-4 py-2" value="inbox">
              Inbox
            </TabsTrigger>
            <TabsTrigger className="rounded-full px-4 py-2" value="history">
              History
            </TabsTrigger>
          </TabsList>
          <div className="ml-auto text-xs text-muted-foreground">
            {selectionCount > 0
              ? `${selectionCount} selected`
              : "Select pending rows to bulk process."}
          </div>
        </div>
        <TabsContent value="inbox" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[180px]">
              <Select
                value={typeFilter}
                onValueChange={(value) =>
                  setTypeFilter(value as "all" | RequestRow["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px]">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {requestData.departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={startDateFilter}
              onChange={(event) => setStartDateFilter(event.target.value)}
            />
            <Input
              type="date"
              value={endDateFilter}
              onChange={(event) => setEndDateFilter(event.target.value)}
            />
            <div className="ml-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleBulkApprove();
                }}
              >
                Bulk approve
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void handleBulkDeny();
                }}
              >
                Bulk deny
              </Button>
            </div>
          </div>
          {renderClusters()}
        </TabsContent>
        <TabsContent value="history" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[180px]">
              <Select
                value={typeFilter}
                onValueChange={(value) =>
                  setTypeFilter(value as "all" | RequestRow["type"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="item">Item</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px]">
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "all" | RequestRow["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[220px]">
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {requestData.departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              type="date"
              value={startDateFilter}
              onChange={(event) => setStartDateFilter(event.target.value)}
            />
            <Input
              type="date"
              value={endDateFilter}
              onChange={(event) => setEndDateFilter(event.target.value)}
            />
          </div>
          {renderClusters()}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(approvalTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setApprovalTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {approvalTarget?.type === "category"
                ? "Approve category request"
                : "Approve item request"}
            </DialogTitle>
            <DialogDescription>
              Review and adjust the catalog-safe fields before approving.
            </DialogDescription>
          </DialogHeader>
          {approvalTarget?.type === "category" ? (
            <Form {...categoryForm}>
              <form
                className="space-y-4"
                onSubmit={(event) =>
                  void categoryForm.handleSubmit(handleApproveSubmit)(event)
                }
              >
                <FormField
                  control={categoryForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category name</FormLabel>
                      <FormControl>
                        <Input placeholder="ICT Equipment" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={categoryForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="High-value items required for campus operations."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setApprovalTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Approve request</Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <Form {...itemForm}>
              <form
                className="space-y-4"
                onSubmit={(event) =>
                  void itemForm.handleSubmit(handleApproveSubmit)(event)
                }
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={itemForm.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {activeCategories.map((category) => (
                              <SelectItem
                                key={category.id}
                                value={String(category.id)}
                              >
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={itemForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item name</FormLabel>
                        <FormControl>
                          <Input placeholder="Laptop computer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={itemForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Laptop computer Core i7, 16GB RAM, 512GB SSD"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={itemForm.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROCUREMENT_ITEM_UNITS.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={itemForm.control}
                    name="unitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit price</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            {...field}
                            onChange={(event) =>
                              field.onChange(event.target.valueAsNumber)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={itemForm.control}
                    name="procurementMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proc method</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROCUREMENT_ITEM_PROCUREMENT_METHODS.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {itemForm.watch("unit") === "custom" ? (
                  <FormField
                    control={itemForm.control}
                    name="customUnit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom unit</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="service"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}

                <div className="grid gap-4 md:grid-cols-3">
                  <FormField
                    control={itemForm.control}
                    name="sourceOfFunds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source of funds</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={itemForm.control}
                    name="minQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value === ""
                                  ? undefined
                                  : event.target.valueAsNumber,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={itemForm.control}
                    name="maxQuantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={field.value ?? ""}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value === ""
                                  ? undefined
                                  : event.target.valueAsNumber,
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={itemForm.control}
                  name="complianceFlags"
                  render={() => (
                    <FormItem>
                      <FormLabel>Compliance flags</FormLabel>
                      <div className="grid gap-3 md:grid-cols-3">
                        {PROCUREMENT_ITEM_COMPLIANCE_FLAGS.map((flag) => (
                          <FormField
                            key={flag}
                            control={itemForm.control}
                            name="complianceFlags"
                            render={({ field }) => {
                              const currentValues = field.value;
                              return (
                                <FormItem className="flex items-center gap-3 rounded-2xl border border-border/70 px-3 py-3">
                                  <FormControl>
                                    <Checkbox
                                      checked={currentValues.includes(flag)}
                                      onCheckedChange={(checked) => {
                                        field.onChange(
                                          checked
                                            ? [...currentValues, flag]
                                            : currentValues.filter(
                                                (value) => value !== flag,
                                              ),
                                        );
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="m-0 capitalize">
                                    {flag.replace("_", " ")}
                                  </FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setApprovalTarget(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Approve request</Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={isBulkDenialOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsBulkDenialOpen(false);
            setBulkDenialTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk deny requests</DialogTitle>
            <DialogDescription>
              Apply one denial reason to the selected requests.
            </DialogDescription>
          </DialogHeader>
          <Form {...bulkDenialForm}>
            <form
              className="space-y-4"
              onSubmit={(event) =>
                void bulkDenialForm.handleSubmit(handleBulkDenySubmit)(event)
              }
            >
              <FormField
                control={bulkDenialForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter the shared denial reason."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsBulkDenialOpen(false);
                    setBulkDenialTarget(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  Deny selected
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(denialTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDenialTarget(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Deny request</DialogTitle>
            <DialogDescription>
              Provide a clear denial reason that will be shared with the requestor.
            </DialogDescription>
          </DialogHeader>
          <Form {...denialForm}>
            <form
              className="space-y-4"
              onSubmit={(event) =>
                void denialForm.handleSubmit(handleDenySubmit)(event)
              }
            >
              <FormField
                control={denialForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Explain why this request cannot be approved."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDenialTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive">
                  Deny request
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
