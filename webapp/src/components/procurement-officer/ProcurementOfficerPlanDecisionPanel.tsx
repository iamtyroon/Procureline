"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type DecisionType = "rejected" | "revision_requested";

export function ProcurementOfficerPlanDecisionPanel(props: {
    canTakeReviewAction: boolean;
    latestDecision:
        | {
              comment: string;
              decidedAtLabel: string;
              flaggedTargets: Array<{ id: string; label: string }>;
              notificationStatus: "failed" | "queued" | null;
              revisionDeadlineLabel: string | null;
              statusLabel: string;
          }
        | null
        | undefined;
    onDecisionComplete?: () => void;
    planId: string;
    selectedTargets: Array<{ id: string; label: string; type: "category" | "item" }>;
    undoApproval:
        | {
              blockedReason: string | null;
              canUndo: boolean;
              undoDeadlineAt: number | null;
          }
        | null
        | undefined;
}) {
    const approveReview = useMutation(
        api.functions.procurementOfficerPlanReview.approveProcurementOfficerPlanReview,
    );
    const rejectReview = useMutation(
        api.functions.procurementOfficerPlanReview.rejectProcurementOfficerPlanReview,
    );
    const undoApproval = useMutation(
        api.functions.procurementOfficerPlanReview.undoProcurementOfficerPlanApproval,
    );
    const [comment, setComment] = useState("");
    const [decisionType, setDecisionType] = useState<DecisionType>("revision_requested");
    const [revisionDeadlineInput, setRevisionDeadlineInput] = useState("");
    const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "undo" | null>(null);

    async function handleApprove() {
        if (!props.canTakeReviewAction || pendingAction) {
            return;
        }

        setPendingAction("approve");
        try {
            const result = await approveReview({
                body: comment.trim().length > 0 ? comment : undefined,
                planId: props.planId,
            });
            toast.success(
                result.notificationStatus === "queued"
                    ? "Plan approved and notification queued."
                    : "Plan approved, but no email notification was queued.",
            );
            setComment("");
            props.onDecisionComplete?.();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "The plan could not be approved.",
            );
        } finally {
            setPendingAction(null);
        }
    }

    async function handleDecision() {
        if (!props.canTakeReviewAction || pendingAction) {
            return;
        }
        if (comment.trim().length === 0) {
            toast.error("Decision comments are required.");
            return;
        }

        setPendingAction("reject");
        try {
            const result = await rejectReview({
                body: comment,
                decisionType,
                flaggedTargets: props.selectedTargets,
                planId: props.planId,
                revisionDeadlineInput:
                    revisionDeadlineInput.trim().length > 0 ? revisionDeadlineInput : undefined,
            });
            toast.success(
                result.notificationStatus === "queued"
                    ? `${result.statusLabel} saved and notification queued.`
                    : `${result.statusLabel} saved, but no email notification was queued.`,
            );
            setComment("");
            setRevisionDeadlineInput("");
            props.onDecisionComplete?.();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "The review decision could not be saved.",
            );
        } finally {
            setPendingAction(null);
        }
    }

    async function handleUndo() {
        if (!props.undoApproval?.canUndo || pendingAction) {
            return;
        }

        setPendingAction("undo");
        try {
            await undoApproval({ planId: props.planId });
            toast.success("Approval undone. The plan is back in submitted review.");
            props.onDecisionComplete?.();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "Approval could not be undone.",
            );
        } finally {
            setPendingAction(null);
        }
    }

    return (
        <div className="space-y-4">
            {props.latestDecision ? (
                <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="rounded-full">
                            Latest decision
                        </Badge>
                        <Badge className="rounded-full">{props.latestDecision.statusLabel}</Badge>
                        <span className="text-xs text-muted-foreground">
                            {props.latestDecision.decidedAtLabel}
                        </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground">
                        {props.latestDecision.comment}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>
                            Notification: {props.latestDecision.notificationStatus ?? "not queued"}
                        </span>
                        {props.latestDecision.revisionDeadlineLabel ? (
                            <span>
                                Deadline: {props.latestDecision.revisionDeadlineLabel}
                            </span>
                        ) : null}
                        {props.latestDecision.flaggedTargets.length > 0 ? (
                            <span>
                                {props.latestDecision.flaggedTargets.length} flagged target(s)
                            </span>
                        ) : null}
                    </div>
                </div>
            ) : null}

            {props.canTakeReviewAction ? (
                <>
                    <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">
                            Decision comment
                        </div>
                        <Textarea
                            onChange={(event) => setComment(event.target.value)}
                            placeholder="Explain the approval, rejection, or requested revision."
                            rows={4}
                            value={comment}
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => setDecisionType("revision_requested")}
                            type="button"
                            variant={decisionType === "revision_requested" ? "default" : "outline"}
                        >
                            Request revision
                        </Button>
                        <Button
                            onClick={() => setDecisionType("rejected")}
                            type="button"
                            variant={decisionType === "rejected" ? "destructive" : "outline"}
                        >
                            Reject
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-foreground">
                                Revision deadline
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Optional for rejected or revision-requested plans
                            </div>
                        </div>
                        <Input
                            onChange={(event) => setRevisionDeadlineInput(event.target.value)}
                            type="datetime-local"
                            value={revisionDeadlineInput}
                        />
                    </div>

                    <div className="space-y-2">
                        <div className="text-sm font-medium text-foreground">
                            Flagged targets
                        </div>
                        {props.selectedTargets.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
                                No specific categories or items selected.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {props.selectedTargets.map((target) => (
                                    <div
                                        key={target.id}
                                        className="rounded-xl border border-border/70 bg-muted/10 px-3 py-3 text-sm text-foreground"
                                    >
                                        {target.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            disabled={pendingAction !== null}
                            onClick={() => void handleDecision()}
                            type="button"
                            variant={decisionType === "rejected" ? "destructive" : "outline"}
                        >
                            {pendingAction === "reject" ? (
                                <>
                                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                getDecisionLabel(decisionType)
                            )}
                        </Button>
                        <Button
                            disabled={pendingAction !== null}
                            onClick={() => void handleApprove()}
                            type="button"
                        >
                            {pendingAction === "approve" ? (
                                <>
                                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                    Approving...
                                </>
                            ) : (
                                "Approve plan"
                            )}
                        </Button>
                    </div>
                </>
            ) : props.undoApproval?.canUndo ? (
                <div className="flex justify-end">
                    <Button
                        disabled={pendingAction !== null}
                        onClick={() => void handleUndo()}
                        type="button"
                        variant="outline"
                    >
                        {pendingAction === "undo" ? (
                            <>
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                Undoing...
                            </>
                        ) : (
                            "Undo approval"
                        )}
                    </Button>
                </div>
            ) : props.undoApproval?.blockedReason ? (
                <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
                    {props.undoApproval.blockedReason}
                </div>
            ) : null}
        </div>
    );
}

function getDecisionLabel(value: DecisionType): string {
    return value === "revision_requested" ? "Save revision request" : "Reject plan";
}
