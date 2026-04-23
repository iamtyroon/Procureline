"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  resolveProcurementOfficerReviewRenderState,
  shouldStartProcurementOfficerReviewTracking,
} from "@/lib/procurement-officer/review";

function formatTimestamp(value: number): string {
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatCurrency(value: number): string {
  return `KES ${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      });
}

export function ProcurementOfficerPlanReviewSummaryModal({
  onClose,
  open,
  planId,
}: {
  onClose: () => void;
  open: boolean;
  planId: string | null;
}): JSX.Element {
  const reviewWorkspace = useQuery(
    api.functions.procurementOfficerPlanReview.getProcurementOfficerPlanReviewWorkspace,
    open && planId ? { planId } : "skip",
  ) as any;
  const startReview = useMutation(
    api.functions.procurementOfficerPlanReview.startProcurementOfficerPlanReview,
  );
  const rejectReview = useMutation(
    api.functions.procurementOfficerPlanReview.rejectProcurementOfficerPlanReview,
  );
  const approveReview = useMutation(
    api.functions.procurementOfficerPlanReview.approveProcurementOfficerPlanReview,
  );
  const startedPlanIdRef = useRef<string | null>(null);
  const [isSendBackOpen, setIsSendBackOpen] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const [sendBackBudgetValue, setSendBackBudgetValue] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  useEffect(() => {
    if (!open) {
      startedPlanIdRef.current = null;
      setIsSendBackOpen(false);
      setSendBackComment("");
      setSendBackBudgetValue("");
      setIsRejecting(false);
      setIsApproving(false);
      return;
    }

    if (
      !planId ||
      !reviewWorkspace ||
      reviewWorkspace.state !== "ready" ||
      !shouldStartProcurementOfficerReviewTracking(
        reviewWorkspace.workspace.plan.status,
      )
    ) {
      return;
    }

    if (startedPlanIdRef.current === planId) {
      return;
    }

    startedPlanIdRef.current = planId;
    void startReview({ planId }).catch((error) => {
      startedPlanIdRef.current = null;
      toast.error(
        error instanceof Error
          ? error.message
          : "Review tracking could not be started.",
      );
    });
  }, [open, planId, reviewWorkspace, startReview]);

  const renderState = useMemo(() => {
    if (!reviewWorkspace?.workspace) {
      return null;
    }

    return resolveProcurementOfficerReviewRenderState({
      items: reviewWorkspace.workspace.catalog.items,
      persistedPlanSummary: {
        categorySummaries: reviewWorkspace.workspace.plan.categorySummaries,
        estimatedBudgetUsed: reviewWorkspace.workspace.plan.estimatedBudgetUsed,
        itemCount: reviewWorkspace.workspace.plan.itemCount,
      },
      totalBudget: reviewWorkspace.workspace.department.budgetAllocation,
      workspaceState: reviewWorkspace.workspace.plan.workspaceState,
    });
  }, [reviewWorkspace]);

  const canTakeReviewAction =
    reviewWorkspace?.workspace?.plan.status === "submitted";
  const currentBudgetLabel = reviewWorkspace?.workspace?.department
    .budgetAllocation
    ? formatCurrency(reviewWorkspace.workspace.department.budgetAllocation)
    : "No active budget set";

  async function handleApprove(): Promise<void> {
    if (!planId || !canTakeReviewAction || isApproving) {
      return;
    }

    setIsApproving(true);
    try {
      await approveReview({ planId });
      toast.success("Plan approved and sent to editor.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The plan could not be approved.",
      );
    } finally {
      setIsApproving(false);
    }
  }

  async function handleSendBack(): Promise<void> {
    if (!planId || !canTakeReviewAction || isRejecting) {
      return;
    }

    const trimmedComment = sendBackComment.trim();
    if (trimmedComment.length === 0) {
      toast.error("Add a comment before sending the plan back.");
      return;
    }

    const trimmedBudgetValue = sendBackBudgetValue.trim();
    const parsedBudget =
      trimmedBudgetValue.length === 0 ? null : Number(trimmedBudgetValue);

    if (
      trimmedBudgetValue.length > 0 &&
      (!Number.isFinite(parsedBudget) || Number.isNaN(parsedBudget))
    ) {
      toast.error("Enter a valid department budget or leave it blank.");
      return;
    }

    setIsRejecting(true);
    try {
      const result = await rejectReview({
        body: trimmedComment,
        nextDepartmentBudgetAllocation: parsedBudget,
        planId,
      });
      toast.success(
        result.departmentBudgetChanged
          ? "Plan sent back with the updated department budget."
          : "Plan sent back to the department.",
      );
      setIsSendBackOpen(false);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The plan could not be sent back.",
      );
    } finally {
      setIsRejecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[72rem] flex-col overflow-hidden border-border/70 p-0 sm:max-h-[calc(100dvh-3rem)] sm:w-[min(96vw,72rem)] sm:rounded-[28px]">
        <div className="border-b border-border/70 bg-muted/35 px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">
                Review summary
              </Badge>
              {reviewWorkspace?.workspace ? (
                <>
                  <Badge variant="outline" className="rounded-full">
                    FY {reviewWorkspace.workspace.meta.fiscalYear}
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {reviewWorkspace.workspace.plan.statusLabel}
                  </Badge>
                  {reviewWorkspace.workspace.meta.reviewStartedAt ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-amber-300 bg-amber-50 text-amber-900"
                    >
                      Review started {formatTimestamp(reviewWorkspace.workspace.meta.reviewStartedAt)}
                    </Badge>
                  ) : null}
                </>
              ) : null}
            </div>
            <DialogTitle className="text-3xl tracking-[-0.04em] text-foreground">
              {reviewWorkspace?.workspace?.department.name ?? "Plan review"}
            </DialogTitle>
            <DialogDescription className="max-w-4xl text-sm leading-7 text-muted-foreground">
              Review the submitted plan in a simpler summary view. This modal remains read-only for plan content and only starts canonical review tracking.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!planId || !reviewWorkspace || !renderState ? (
            <div className="flex min-h-[18rem] items-center justify-center rounded-2xl border border-border/70 bg-muted/10">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                Preparing the review summary...
              </div>
            </div>
          ) : reviewWorkspace.state === "redirect" ? (
            <div className="rounded-2xl border border-amber-300/80 bg-amber-50 px-5 py-5 text-sm leading-6 text-amber-900">
              {reviewWorkspace.message ?? "That plan is no longer available for review."}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-5">
                <ReviewStat
                  label="Department code"
                  value={reviewWorkspace.workspace.department.code ?? "--"}
                />
                <ReviewStat
                  label="Fiscal year"
                  value={reviewWorkspace.workspace.meta.fiscalYear}
                />
                <ReviewStat
                  label="Submitted"
                  value={reviewWorkspace.workspace.meta.submittedAtLabel}
                />
                <ReviewStat
                  label="Items"
                  value={String(reviewWorkspace.workspace.plan.itemCount)}
                />
                <ReviewStat
                  label="Total amount"
                  value={reviewWorkspace.workspace.plan.totalAmountLabel}
                />
              </div>

              {renderState.reason ? (
                <div className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                  {renderState.reason}
                </div>
              ) : null}

              <div className="rounded-2xl border border-border/70 bg-background">
                <div className="px-5 py-4">
                  <div className="text-sm font-semibold text-foreground">
                    Plan structure
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Summary-first view of the submitted categories, items, quarterly quantities, and totals.
                  </div>
                </div>
                <Separator />

                <div className="space-y-4 p-5">
                  {renderState.summary.categories.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                      No reviewable summary details are available for this plan.
                    </div>
                  ) : (
                    renderState.summary.categories.map((category) => (
                      <div
                        key={category.categoryId}
                        className="rounded-2xl border border-border/70 bg-muted/10"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                          <div>
                            <div className="text-xl font-semibold text-foreground">
                              {category.categoryName}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {category.itemCount} item{category.itemCount === 1 ? "" : "s"}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Category Total</div>
                            <div className="text-xl font-semibold text-primary">
                              {formatCurrency(category.totalCost)}
                            </div>
                          </div>
                        </div>

                        {category.items.length > 0 ? (
                          <div className="overflow-x-auto px-5 pb-5">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Q1</TableHead>
                                  <TableHead>Q2</TableHead>
                                  <TableHead>Q3</TableHead>
                                  <TableHead>Q4</TableHead>
                                  <TableHead>Unit Price</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {category.items.map((item) => (
                                  <TableRow key={`${category.categoryId}:${item.itemId ?? item.itemName}`}>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <div className="font-medium text-foreground">
                                          {item.itemName}
                                        </div>
                                        {item.itemDescription !== item.itemName ? (
                                          <div className="text-xs text-muted-foreground">
                                            {item.itemDescription}
                                          </div>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatQuantity(item.quarterTotals.q1)}</TableCell>
                                    <TableCell>{formatQuantity(item.quarterTotals.q2)}</TableCell>
                                    <TableCell>{formatQuantity(item.quarterTotals.q3)}</TableCell>
                                    <TableCell>{formatQuantity(item.quarterTotals.q4)}</TableCell>
                                    <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                                    <TableCell className="text-right font-semibold text-emerald-600">
                                      {formatCurrency(item.totalCost)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="px-5 pb-5">
                            <div className="rounded-2xl border border-dashed border-border/70 bg-background px-4 py-4 text-sm text-muted-foreground">
                              Item-level detail is unavailable for this category, but the persisted category total remains reviewable.
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {canTakeReviewAction ? (
          <div className="flex flex-col-reverse gap-3 border-t border-border/70 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
            <Button
              onClick={() => setIsSendBackOpen(true)}
              type="button"
              variant="outline"
            >
              Comment & Send Back
            </Button>
            <Button
              disabled={isApproving || isRejecting}
              onClick={() => void handleApprove()}
              type="button"
            >
              {isApproving ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                "Approve & Send to Editor"
              )}
            </Button>
          </div>
        ) : null}
      </DialogContent>

      <Dialog open={isSendBackOpen} onOpenChange={setIsSendBackOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-2xl border-border/70 sm:w-full">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle>Comment And Send Back</DialogTitle>
            <DialogDescription className="leading-6">
              Add the revision note for the department. You can also update the
              department budget here if the review requires it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">
                Review comment
              </div>
              <Textarea
                onChange={(event) => setSendBackComment(event.target.value)}
                placeholder="Explain what needs to change before this plan can be resubmitted."
                rows={5}
                value={sendBackComment}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">
                  Updated department budget
                </div>
                <div className="text-xs text-muted-foreground">
                  Current: {currentBudgetLabel}
                </div>
              </div>
              <Input
                inputMode="decimal"
                min="0"
                onChange={(event) => setSendBackBudgetValue(event.target.value)}
                placeholder="Leave blank to keep the current budget"
                type="number"
                value={sendBackBudgetValue}
              />
              <p className="text-xs leading-5 text-muted-foreground">
                This is optional. If entered, the department budget is updated
                before the plan is returned for revision.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              disabled={isRejecting}
              onClick={() => setIsSendBackOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isRejecting}
              onClick={() => void handleSendBack()}
              type="button"
              variant="destructive"
            >
              {isRejecting ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Sending Back...
                </>
              ) : (
                "Send Back"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function ReviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
