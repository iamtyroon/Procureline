"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, LoaderCircle, MessageSquarePlus, NotebookTabs } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
    BlocklyWorkspace,
    type BlocklyWorkspaceSelectedBlockLike,
} from "@/src/components/blockly/BlocklyWorkspace";
import {
    buildProcurementOfficerReviewComparison,
    buildProcurementOfficerReviewSelectionId,
    normalizeProcurementOfficerReviewComment,
    revalidateProcurementOfficerReviewSelection,
    resolveProcurementOfficerReviewSelectionFromBlocklyBlock,
    resolveProcurementOfficerReviewRenderState,
    type ProcurementOfficerReviewComparison,
} from "@/lib/procurement-officer/review";
import { buildProcurementOfficerSubmissionModalPath } from "@/lib/procurement-officer/submissions";

const EMPTY_TOOLBOX_DEFINITION = {
    contents: [],
    kind: "categoryToolbox",
} satisfies Record<string, unknown>;

type ReviewTab = "comments" | "plan" | "previousFiscalYear" | "previousSubmission";

export function ProcurementOfficerPlanReviewWorkspace(): JSX.Element {
    const router = useRouter();
    const searchParams = useSearchParams();
    const planId = searchParams.get("planId");
    const queueHref = buildProcurementOfficerSubmissionModalPath({
        submissionWorkspaceSearchParams: searchParams,
    });
    const hasRedirectedRef = useRef(false);
    const hasStartedReviewRef = useRef(false);
    const [activeTab, setActiveTab] = useState<ReviewTab>("plan");
    const [commentDraft, setCommentDraft] = useState("");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
    const reviewWorkspace = useQuery(
        api.functions.procurementOfficerPlanReview.getProcurementOfficerPlanReviewWorkspace,
        planId ? { planId } : "skip",
    ) as any;
    const startReview = useMutation(
        api.functions.procurementOfficerPlanReview.startProcurementOfficerPlanReview,
    );
    const addComment = useMutation(
        api.functions.procurementOfficerPlanReview.addProcurementOfficerPlanReviewComment,
    );

    useEffect(() => {
        if (!reviewWorkspace || reviewWorkspace.state !== "redirect" || hasRedirectedRef.current) {
            return;
        }

        hasRedirectedRef.current = true;
        if (reviewWorkspace.message) {
            toast.error(reviewWorkspace.message);
        }

        router.replace(
            buildProcurementOfficerSubmissionModalPath({
                notice: "review-target-unavailable",
                submissionWorkspaceSearchParams: searchParams,
            }),
        );
    }, [reviewWorkspace, router, searchParams]);

    useEffect(() => {
        if (!planId || !reviewWorkspace || reviewWorkspace.state !== "ready" || hasStartedReviewRef.current) {
            return;
        }

        hasStartedReviewRef.current = true;
        void startReview({ planId }).catch((error) => {
            hasStartedReviewRef.current = false;
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Review tracking could not be started.",
            );
        });
    }, [planId, reviewWorkspace, startReview]);

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

    const commentDraftState = useMemo(
        () => normalizeProcurementOfficerReviewComment(commentDraft),
        [commentDraft],
    );

    const previousSubmissionComparison = useMemo<ProcurementOfficerReviewComparison | null>(() => {
        if (!reviewWorkspace?.workspace) {
            return null;
        }

        return buildProcurementOfficerReviewComparison({
            baseline: reviewWorkspace.workspace.baselines.previousSubmission,
            currentPlan: {
                fiscalYear: reviewWorkspace.workspace.meta.fiscalYear,
                submittedAt: reviewWorkspace.workspace.plan.submittedAt,
                summary: {
                    categorySummaries: reviewWorkspace.workspace.plan.categorySummaries,
                    estimatedBudgetUsed: reviewWorkspace.workspace.plan.estimatedBudgetUsed,
                    itemCount: reviewWorkspace.workspace.plan.itemCount,
                },
                workspaceState: reviewWorkspace.workspace.plan.workspaceState,
            },
            items: reviewWorkspace.workspace.catalog.items,
            kind: "previousSubmission",
            totalBudget: reviewWorkspace.workspace.department.budgetAllocation,
        });
    }, [reviewWorkspace]);

    const previousFiscalYearComparison = useMemo<ProcurementOfficerReviewComparison | null>(() => {
        if (!reviewWorkspace?.workspace) {
            return null;
        }

        return buildProcurementOfficerReviewComparison({
            baseline: reviewWorkspace.workspace.baselines.previousFiscalYear,
            currentPlan: {
                fiscalYear: reviewWorkspace.workspace.meta.fiscalYear,
                submittedAt: reviewWorkspace.workspace.plan.submittedAt,
                summary: {
                    categorySummaries: reviewWorkspace.workspace.plan.categorySummaries,
                    estimatedBudgetUsed: reviewWorkspace.workspace.plan.estimatedBudgetUsed,
                    itemCount: reviewWorkspace.workspace.plan.itemCount,
                },
                workspaceState: reviewWorkspace.workspace.plan.workspaceState,
            },
            items: reviewWorkspace.workspace.catalog.items,
            kind: "previousFiscalYear",
            totalBudget: reviewWorkspace.workspace.department.budgetAllocation,
        });
    }, [reviewWorkspace]);

    const selectionLabels = useMemo(() => {
        const nextLabels = new Map<string, string>();

        for (const category of renderState?.summary.categories ?? []) {
            nextLabels.set(
                buildProcurementOfficerReviewSelectionId({
                    categoryId: category.categoryId,
                    type: "category",
                }),
                category.categoryName,
            );

            for (const item of category.items) {
                nextLabels.set(
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: category.categoryId,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        type: "item",
                    }),
                    `${item.itemName} (${category.categoryName})`,
                );
            }
        }

        for (const comparison of [
            previousSubmissionComparison,
            previousFiscalYearComparison,
        ]) {
            if (!comparison || comparison.state !== "ready") {
                continue;
            }

            for (const category of comparison.categoryDeltas) {
                nextLabels.set(
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: category.categoryId,
                        type: "category",
                    }),
                    category.categoryName,
                );
            }

            for (const item of comparison.itemDeltas ?? []) {
                nextLabels.set(
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: item.categoryId,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        type: "item",
                    }),
                    `${item.itemName} (${item.categoryName})`,
                );
            }
        }

        return nextLabels;
    }, [previousFiscalYearComparison, previousSubmissionComparison, renderState]);

    const visibleSelectionIds = useMemo(() => {
        if (!renderState) {
            return [] as string[];
        }

        if (activeTab === "plan") {
            return renderState.summary.categories.flatMap((category) => [
                buildProcurementOfficerReviewSelectionId({
                    categoryId: category.categoryId,
                    type: "category",
                }),
                ...category.items.map((item) =>
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: category.categoryId,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        type: "item",
                    }),
                ),
            ]);
        }

        if (activeTab === "previousSubmission" && previousSubmissionComparison) {
            return [
                ...previousSubmissionComparison.categoryDeltas.map((category) =>
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: category.categoryId,
                        type: "category",
                    }),
                ),
                ...(previousSubmissionComparison.itemDeltas ?? []).map((item) =>
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: item.categoryId,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        type: "item",
                    }),
                ),
            ];
        }

        if (activeTab === "previousFiscalYear" && previousFiscalYearComparison) {
            return [
                ...previousFiscalYearComparison.categoryDeltas.map((category) =>
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: category.categoryId,
                        type: "category",
                    }),
                ),
                ...(previousFiscalYearComparison.itemDeltas ?? []).map((item) =>
                    buildProcurementOfficerReviewSelectionId({
                        categoryId: item.categoryId,
                        itemId: item.itemId,
                        itemName: item.itemName,
                        type: "item",
                    }),
                ),
            ];
        }

        return [];
    }, [activeTab, previousFiscalYearComparison, previousSubmissionComparison, renderState]);

    useEffect(() => {
        let nextNotice: string | null = null;
        setSelectedIds((current) => {
            const revalidatedSelection = revalidateProcurementOfficerReviewSelection({
                selectedIds: current,
                visibleIds: visibleSelectionIds,
            });
            nextNotice = revalidatedSelection.notice;

            if (
                revalidatedSelection.validSelectionIds.length === current.length &&
                revalidatedSelection.validSelectionIds.every(
                    (value, index) => value === current[index],
                )
            ) {
                return current;
            }

            return revalidatedSelection.validSelectionIds;
        });
        setSelectionNotice(nextNotice);
    }, [visibleSelectionIds]);

    async function handleAddComment(): Promise<void> {
        if (!planId) {
            return;
        }
        if (!commentDraftState.ok || !commentDraftState.value) {
            toast.error(
                commentDraftState.message ?? "Internal comment could not be saved.",
            );
            return;
        }

        try {
            await addComment({
                body: commentDraftState.value,
                planId,
            });
            setCommentDraft("");
            toast.success("Internal comment saved.");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Internal comment could not be saved.",
            );
        }
    }

    function handleBlocklySelectionChange(
        block: BlocklyWorkspaceSelectedBlockLike | null,
    ): void {
        const selection = resolveProcurementOfficerReviewSelectionFromBlocklyBlock(block);
        if (!selection) {
            return;
        }

        setSelectionNotice(null);
        setSelectedIds((current) =>
            current.includes(selection.id) ? current : [...current, selection.id],
        );
    }

    function toggleSelection(nextId: string): void {
        setSelectedIds((current) =>
            current.includes(nextId)
                ? current.filter((value) => value !== nextId)
                : [...current, nextId],
        );
    }

    if (!planId) {
        return (
            <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-10 sm:px-6">
                <Card className="w-full rounded-[32px] border-border/70 bg-card/95 shadow-sm">
                    <CardHeader className="space-y-3">
                        <Badge
                            variant="outline"
                            className="w-fit rounded-full border-amber-300/70 bg-amber-50 text-amber-900"
                        >
                            Review target missing
                        </Badge>
                        <CardTitle className="text-3xl tracking-tight text-foreground">
                            No plan was selected for review
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            Return to the submission queue and open a plan row from the live review handoff.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild variant="outline">
                            <Link href={queueHref}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to submission queue
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!reviewWorkspace || reviewWorkspace.state === "redirect" || !renderState) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background px-4 py-10">
                <div className="flex max-w-md items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-5 py-4 text-sm text-muted-foreground shadow-sm">
                    <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                    <p>Preparing the review workspace...</p>
                </div>
            </div>
        );
    }

    const { workspace } = reviewWorkspace;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background">
            <div className="px-4 py-8 sm:px-6 lg:hidden">
                <Card className="mx-auto max-w-2xl rounded-[24px] border-border/70 bg-card shadow-sm">
                    <CardHeader className="space-y-4">
                        <Badge className="w-fit rounded-md bg-primary text-primary-foreground hover:bg-primary">
                            Desktop required
                        </Badge>
                        <CardTitle className="text-2xl text-foreground">
                            Procurement Officer review workspaces are designed for desktop viewports
                        </CardTitle>
                        <CardDescription className="text-base leading-7 text-muted-foreground">
                            Open this route on a desktop-sized viewport to review Blockly plans, compare baselines, and collaborate with internal comments.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>

            <div className="hidden lg:block">
                <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 xl:px-5">
                    <Card className="rounded-[28px] border-border/70 shadow-sm">
                        <CardHeader className="gap-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">
                                            Procurement review
                                        </Badge>
                                        <Badge variant="outline" className="rounded-full">
                                            FY {workspace.meta.fiscalYear}
                                        </Badge>
                                        <Badge variant="outline" className="rounded-full">
                                            {workspace.plan.statusLabel}
                                        </Badge>
                                        {workspace.meta.reviewStartedAt ? (
                                            <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-800">
                                                Review started {formatTimestamp(workspace.meta.reviewStartedAt)}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        <CardTitle className="text-3xl tracking-[-0.04em] text-foreground">
                                            {workspace.department.name}
                                        </CardTitle>
                                        <CardDescription className="max-w-4xl text-sm leading-7 text-muted-foreground">
                                            Submitted {workspace.meta.submittedAtLabel}. Opened by {workspace.meta.currentUser.name}. This surface is read-only for plan content and only writes canonical review metadata plus internal comments.
                                        </CardDescription>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button asChild type="button" variant="outline">
                                        <Link href={queueHref}>
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Back to submission queue
                                        </Link>
                                    </Button>
                                </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-5">
                                <ReviewStat label="Department code" value={workspace.department.code} />
                                <ReviewStat label="Fiscal year" value={workspace.meta.fiscalYear} />
                                <ReviewStat label="Submitted" value={workspace.meta.submittedAtLabel} />
                                <ReviewStat label="Items" value={String(workspace.plan.itemCount)} />
                                <ReviewStat label="Total amount" value={workspace.plan.totalAmountLabel} />
                            </div>
                        </CardHeader>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="space-y-4">
                            {selectionNotice ? (
                                <Card className="rounded-[24px] border-amber-300 bg-amber-50 text-amber-900 shadow-sm">
                                    <CardContent className="pt-6 text-sm">
                                        {selectionNotice}
                                    </CardContent>
                                </Card>
                            ) : null}

                            {renderState.mode === "summary" ? (
                                <Card className="rounded-[28px] border-border/70 shadow-sm">
                                    <CardHeader className="space-y-2">
                                        <Badge variant="outline" className="w-fit rounded-full border-amber-300 bg-amber-50 text-amber-800">
                                            Detailed block rendering unavailable
                                        </Badge>
                                        <CardTitle className="text-2xl tracking-[-0.04em]">
                                            Summary fallback
                                        </CardTitle>
                                        <CardDescription className="text-sm leading-7">
                                            {renderState.reason}
                                        </CardDescription>
                                    </CardHeader>
                                </Card>
                            ) : null}

                            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ReviewTab)}>
                                <TabsList className="h-auto rounded-full border border-border/70 bg-card p-1">
                                    <TabsTrigger className="rounded-full px-4 py-2" value="plan">
                                        Plan
                                    </TabsTrigger>
                                    <TabsTrigger className="rounded-full px-4 py-2" value="previousSubmission">
                                        Previous submission
                                    </TabsTrigger>
                                    <TabsTrigger className="rounded-full px-4 py-2" value="previousFiscalYear">
                                        Prior year
                                    </TabsTrigger>
                                    <TabsTrigger className="rounded-full px-4 py-2" value="comments">
                                        Comments
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent className="mt-4 space-y-4" value="plan">
                                    {renderState.mode === "detailed" ? (
                                        <BlocklyWorkspace
                                            budgetAllocation={workspace.department.budgetAllocation}
                                            categories={workspace.catalog.categories.map((category: any) => ({
                                                id: category.id,
                                                name: category.name,
                                            }))}
                                            currentUserId={workspace.meta.currentUserId}
                                            editorMode="view"
                                            items={workspace.catalog.items}
                                            onBudgetStateChange={() => {}}
                                            onSelectedBlockChange={handleBlocklySelectionChange}
                                            onWorkspaceChange={() => {}}
                                            onWorkspaceStructureChange={() => {}}
                                            onWorkspaceSummaryChange={() => {}}
                                            planId={workspace.plan.id}
                                            selectedCategoryIds={workspace.plan.selectedCategoryIds}
                                            toolboxDefinition={EMPTY_TOOLBOX_DEFINITION}
                                            workspaceState={workspace.plan.workspaceState}
                                        />
                                    ) : null}

                                    <SummaryCategoryPanel
                                        categories={renderState.summary.categories}
                                        onToggleSelection={toggleSelection}
                                        selectedIds={selectedIds}
                                    />
                                </TabsContent>

                                <TabsContent className="mt-4" value="previousSubmission">
                                    {previousSubmissionComparison ? (
                                        <ComparisonPanel
                                            comparison={previousSubmissionComparison}
                                            onToggleSelection={toggleSelection}
                                            selectedIds={selectedIds}
                                            title="Previous submitted baseline"
                                        />
                                    ) : null}
                                </TabsContent>

                                <TabsContent className="mt-4" value="previousFiscalYear">
                                    {previousFiscalYearComparison ? (
                                        <ComparisonPanel
                                            comparison={previousFiscalYearComparison}
                                            onToggleSelection={toggleSelection}
                                            selectedIds={selectedIds}
                                            title="Previous fiscal year"
                                        />
                                    ) : null}
                                </TabsContent>

                                <TabsContent className="mt-4" value="comments">
                                    <CommentsPanel
                                        comments={reviewWorkspace.comments}
                                        commentDraft={commentDraft}
                                        commentEnabled={commentDraftState.ok}
                                        onChangeCommentDraft={setCommentDraft}
                                        onSubmitComment={() => {
                                            void handleAddComment();
                                        }}
                                    />
                                </TabsContent>
                            </Tabs>
                        </div>

                        <div className="space-y-4">
                            <Card className="rounded-[28px] border-border/70 shadow-sm">
                                <CardHeader className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="rounded-full">
                                            <NotebookTabs className="mr-1 h-3.5 w-3.5" />
                                            Review side panel
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-xl tracking-[-0.04em]">
                                        Current selection
                                    </CardTitle>
                                    <CardDescription className="text-sm leading-7">
                                        Use blocks, summary rows, and comparison deltas to collect flag candidates for later decision workflows.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {selectedIds.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                                            No review targets selected yet.
                                        </div>
                                    ) : (
                                        selectedIds.map((selectionId) => (
                                            <button
                                                key={selectionId}
                                                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-muted/20 px-3 py-3 text-left text-sm transition hover:bg-muted/30"
                                                onClick={() => toggleSelection(selectionId)}
                                                type="button"
                                            >
                                                <span>{selectionLabels.get(selectionId) ?? selectionId}</span>
                                                <span className="text-muted-foreground">Remove</span>
                                            </button>
                                        ))
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="rounded-[28px] border-border/70 shadow-sm">
                                <CardHeader className="space-y-2">
                                    <Badge variant="outline" className="w-fit rounded-full">
                                        Internal collaboration
                                    </Badge>
                                    <CardTitle className="text-xl tracking-[-0.04em]">
                                        Latest private comments
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {reviewWorkspace.comments.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                                            No internal comments yet.
                                        </div>
                                    ) : (
                                        reviewWorkspace.comments.slice(-4).reverse().map((comment: any) => (
                                            <div
                                                key={comment.id}
                                                className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4"
                                            >
                                                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                                    <span>{comment.authorName}</span>
                                                    <span>{formatTimestamp(comment.createdAt)}</span>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-foreground">
                                                    {comment.body}
                                                </p>
                                            </div>
                                        ))
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
        <div className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
            </div>
            <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
        </div>
    );
}

function SummaryCategoryPanel({
    categories,
    onToggleSelection,
    selectedIds,
}: {
    categories: any[];
    onToggleSelection: (selectionId: string) => void;
    selectedIds: string[];
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-sm">
            <CardHeader className="space-y-2">
                <Badge variant="outline" className="w-fit rounded-full">
                    Reviewable summary
                </Badge>
                <CardTitle className="text-xl tracking-[-0.04em]">
                    Categories and items
                </CardTitle>
                <CardDescription className="text-sm leading-7">
                    Click categories or items to keep them in the review side panel as flag candidates.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {categories.map((category) => {
                    const categorySelectionId = buildProcurementOfficerReviewSelectionId({
                        categoryId: category.categoryId,
                        type: "category",
                    });

                    return (
                        <div
                            key={category.categoryId}
                            className="rounded-2xl border border-border/70 bg-muted/15 p-4"
                        >
                            <button
                                className="flex w-full items-center justify-between text-left"
                                onClick={() => onToggleSelection(categorySelectionId)}
                                type="button"
                            >
                                <div>
                                    <div className="text-sm font-semibold text-foreground">
                                        {category.categoryName}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        {category.itemCount} items • KES {category.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <Badge variant={selectedIds.includes(categorySelectionId) ? "default" : "outline"}>
                                    {selectedIds.includes(categorySelectionId) ? "Selected" : "Select"}
                                </Badge>
                            </button>

                            {category.items.length > 0 ? (
                                <>
                                    <Separator className="my-3" />
                                    <div className="space-y-2">
                                        {category.items.map((item: any) => {
                                            const itemSelectionId = buildProcurementOfficerReviewSelectionId({
                                                categoryId: category.categoryId,
                                                itemId: item.itemId,
                                                itemName: item.itemName,
                                                type: "item",
                                            });

                                            return (
                                                <button
                                                    key={itemSelectionId}
                                                    className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-3 text-left transition hover:bg-muted/20"
                                                    onClick={() => onToggleSelection(itemSelectionId)}
                                                    type="button"
                                                >
                                                    <div>
                                                        <div className="text-sm text-foreground">{item.itemName}</div>
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            Qty {item.totalQuantity} • KES {item.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                    </div>
                                                    <Badge variant={selectedIds.includes(itemSelectionId) ? "default" : "outline"}>
                                                        {selectedIds.includes(itemSelectionId) ? "Selected" : "Select"}
                                                    </Badge>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}

function ComparisonPanel({
    comparison,
    onToggleSelection,
    selectedIds,
    title,
}: {
    comparison: ProcurementOfficerReviewComparison;
    onToggleSelection: (selectionId: string) => void;
    selectedIds: string[];
    title: string;
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-sm">
            <CardHeader className="space-y-2">
                <Badge variant="outline" className="w-fit rounded-full">
                    Comparison
                </Badge>
                <CardTitle className="text-xl tracking-[-0.04em]">{title}</CardTitle>
                <CardDescription className="text-sm leading-7">
                    Added, removed, and changed deltas are grounded in canonical plan data.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {comparison.state === "empty" ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                        {comparison.emptyMessage}
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 md:grid-cols-3">
                            <ReviewStat label="Current total" value={`KES ${comparison.totals.currentAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                            <ReviewStat label="Baseline total" value={`KES ${comparison.totals.previousAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                            <ReviewStat label="Delta" value={`KES ${comparison.totals.deltaAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                        </div>

                        <div className="space-y-3">
                            {comparison.categoryDeltas.map((category) => {
                                const selectionId = buildProcurementOfficerReviewSelectionId({
                                    categoryId: category.categoryId,
                                    type: "category",
                                });

                                return (
                                    <button
                                        key={selectionId}
                                        className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-muted/15 px-4 py-4 text-left transition hover:bg-muted/25"
                                        onClick={() => onToggleSelection(selectionId)}
                                        type="button"
                                    >
                                        <div>
                                            <div className="text-sm font-semibold text-foreground">
                                                {category.categoryName}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {category.status} • KES {category.deltaAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} • {category.deltaItemCount} item delta
                                            </div>
                                        </div>
                                        <Badge variant={selectedIds.includes(selectionId) ? "default" : "outline"}>
                                            {selectedIds.includes(selectionId) ? "Selected" : "Select"}
                                        </Badge>
                                    </button>
                                );
                            })}
                        </div>

                        {comparison.itemDeltas ? (
                            <div className="space-y-2">
                                <Separator />
                                <div className="text-sm font-semibold text-foreground">
                                    Item-level changes
                                </div>
                                {comparison.itemDeltas.map((item) => {
                                    const selectionId = buildProcurementOfficerReviewSelectionId({
                                        categoryId: item.categoryId,
                                        itemId: item.itemId,
                                        itemName: item.itemName,
                                        type: "item",
                                    });

                                    return (
                                        <button
                                            key={selectionId}
                                            className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-background px-3 py-3 text-left transition hover:bg-muted/20"
                                            onClick={() => onToggleSelection(selectionId)}
                                            type="button"
                                        >
                                            <div>
                                                <div className="text-sm text-foreground">{item.itemName}</div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    {item.status} • Qty {item.deltaQuantity} • KES {item.deltaAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <Badge variant={selectedIds.includes(selectionId) ? "default" : "outline"}>
                                                {selectedIds.includes(selectionId) ? "Selected" : "Select"}
                                            </Badge>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-4 text-sm text-muted-foreground">
                                Item-level diff details are unavailable for this baseline, but category and total deltas remain reviewable.
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function CommentsPanel({
    comments,
    commentDraft,
    commentEnabled,
    onChangeCommentDraft,
    onSubmitComment,
}: {
    comments: Array<{
        authorName: string;
        body: string;
        createdAt: number;
        id: string;
    }>;
    commentDraft: string;
    commentEnabled: boolean;
    onChangeCommentDraft: (value: string) => void;
    onSubmitComment: () => void;
}) {
    return (
        <Card className="rounded-[28px] border-border/70 shadow-sm">
            <CardHeader className="space-y-2">
                <Badge variant="outline" className="w-fit rounded-full">
                    Internal comments
                </Badge>
                <CardTitle className="text-xl tracking-[-0.04em]">
                    Private review notes
                </CardTitle>
                <CardDescription className="text-sm leading-7">
                    Comments stay Procurement Officer-only and update reactively for other reviewers on the same plan.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <Textarea
                        onChange={(event) => onChangeCommentDraft(event.target.value)}
                        placeholder="Add an internal review note"
                        rows={4}
                        value={commentDraft}
                    />
                    <div className="flex justify-end">
                        <Button disabled={!commentEnabled} onClick={onSubmitComment} type="button">
                            <MessageSquarePlus className="mr-2 h-4 w-4" />
                            Save internal comment
                        </Button>
                    </div>
                </div>

                <ScrollArea className="h-[24rem] pr-4">
                    <div className="space-y-3">
                        {comments.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-5 text-sm text-muted-foreground">
                                No internal comments yet.
                            </div>
                        ) : (
                            comments
                                .slice()
                                .reverse()
                                .map((comment) => (
                                    <div
                                        key={comment.id}
                                        className="rounded-2xl border border-border/70 bg-muted/15 px-4 py-4"
                                    >
                                        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                            <span>{comment.authorName}</span>
                                            <span>{formatTimestamp(comment.createdAt)}</span>
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-foreground">
                                            {comment.body}
                                        </p>
                                    </div>
                                ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

function formatTimestamp(value: number): string {
    return new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(value);
}
