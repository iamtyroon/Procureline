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
import { ProcurementOfficerPlanDecisionPanel } from "@/src/components/procurement-officer/ProcurementOfficerPlanDecisionPanel";
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
  const approveRedraft = useMutation(
    api.functions.planRedrafts.approveProcurementOfficerPlanRedraftRequest,
  );
  const denyRedraft = useMutation(
    api.functions.planRedrafts.denyProcurementOfficerPlanRedraftRequest,
  );
  const startedPlanIdRef = useRef<string | null>(null);
  const [redraftDecisionNote, setRedraftDecisionNote] = useState("");
  const [redraftDecision, setRedraftDecision] = useState<
    "approve" | "deny" | null
  >(null);

  useEffect(() => {
    if (!open) {
      startedPlanIdRef.current = null;
      setRedraftDecisionNote("");
      setRedraftDecision(null);
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
  const pendingRedraftRequest = reviewWorkspace?.workspace?.redraftRequest;

  async function handleRedraftDecision(
    decision: "approve" | "deny",
  ): Promise<void> {
    if (!pendingRedraftRequest || redraftDecision) {
      return;
    }

    setRedraftDecision(decision);
    const decisionNote = redraftDecisionNote.trim();
    try {
      if (decision === "approve") {
        await approveRedraft({
          decisionNote: decisionNote.length > 0 ? decisionNote : undefined,
          requestId: pendingRedraftRequest.id,
        });
        toast.success("Plan rolled back to draft for redraft.");
        onClose();
      } else {
        await denyRedraft({
          decisionNote: decisionNote.length > 0 ? decisionNote : undefined,
          requestId: pendingRedraftRequest.id,
        });
        toast.success("Redraft request denied.");
        setRedraftDecisionNote("");
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "The redraft request could not be updated.",
      );
    } finally {
      setRedraftDecision(null);
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
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
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

              {pendingRedraftRequest ? (
                <div className="rounded-2xl border border-amber-300/80 bg-amber-50/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-amber-950">
                        Redraft request
                      </div>
                      <div className="mt-1 text-xs text-amber-900">
                        Requested {formatTimestamp(pendingRedraftRequest.requestedAt)}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-amber-400 bg-amber-100 text-amber-950"
                    >
                      Action needed
                    </Badge>
                  </div>
                  <div className="mt-3 rounded-xl border border-amber-200 bg-background/85 px-3 py-3 text-sm leading-6 text-foreground">
                    {pendingRedraftRequest.reason}
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="text-sm font-medium text-amber-950">
                      Decision note
                    </div>
                    <Textarea
                      onChange={(event) =>
                        setRedraftDecisionNote(event.target.value)
                      }
                      placeholder="Optional note for the department"
                      rows={3}
                      value={redraftDecisionNote}
                    />
                  </div>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      disabled={redraftDecision !== null}
                      onClick={() => void handleRedraftDecision("deny")}
                      type="button"
                      variant="outline"
                    >
                      {redraftDecision === "deny" ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Denying...
                        </>
                      ) : (
                        "Deny redraft"
                      )}
                    </Button>
                    <Button
                      disabled={
                        redraftDecision !== null ||
                        reviewWorkspace.workspace.plan.status !== "approved"
                      }
                      onClick={() => void handleRedraftDecision("approve")}
                      type="button"
                    >
                      {redraftDecision === "approve" ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        "Approve redraft"
                      )}
                    </Button>
                  </div>
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

        {planId ? (
          <div className="border-t border-border/70 bg-muted/20 px-6 py-4">
            <ProcurementOfficerPlanDecisionPanel
              canTakeReviewAction={Boolean(canTakeReviewAction)}
              latestDecision={reviewWorkspace?.workspace?.meta?.latestDecision}
              onDecisionComplete={onClose}
              planId={planId}
              selectedTargets={[]}
              undoApproval={reviewWorkspace?.workspace?.plan?.undoApproval}
            />
          </div>
        ) : null}
      </DialogContent>
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
    <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-muted/10 px-3 text-xs">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
