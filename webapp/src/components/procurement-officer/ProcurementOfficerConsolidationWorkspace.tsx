"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Building2, CheckCircle2, FileSpreadsheet, Loader2, Lock, PencilLine, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode, RefObject } from "react";
import { api } from "@/convex/_generated/api";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CONSOLIDATION_EMPTY_MESSAGE } from "@/lib/procurement-officer/consolidation";
import type {
    ConsolidationBlocklyState,
    ConsolidationSourceDepartment,
    ConsolidationSourceItem,
    ConsolidationTimingSection,
} from "./ProcurementOfficerConsolidationBlocklyShell";
import { enrichConsolidationSourceDepartment } from "./ProcurementOfficerConsolidationBlocklyShell";

const BlocklyShell = dynamic(
    () => import("./ProcurementOfficerConsolidationBlocklyShell"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full min-h-[30rem] items-center justify-center bg-background text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Blockly shell...
            </div>
        ),
    },
);

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function parseWorkspaceJson(value: unknown): Record<string, unknown> {
    if (typeof value === "string") {
        try {
            return asRecord(JSON.parse(value) as unknown) ?? {
                blocks: { blocks: [], languageVersion: 0 },
            };
        } catch {
            return { blocks: { blocks: [], languageVersion: 0 } };
        }
    }

    return asRecord(value) ?? { blocks: { blocks: [], languageVersion: 0 } };
}

function getNestedBlock(value: unknown): Record<string, unknown> | null {
    return asRecord(asRecord(value)?.block);
}

function findAggregateBlock(workspaceJson: unknown): Record<string, unknown> | null {
    const blocks = asRecord(asRecord(workspaceJson)?.blocks)?.blocks;
    if (!Array.isArray(blocks)) {
        return null;
    }

    return (
        blocks
            .map((block) => asRecord(block))
            .find((block) => block?.type === "aggregate_plan_block") ?? null
    );
}

function collectConnectedDepartmentIds(workspaceState: ConsolidationBlocklyState): string[] {
    const workspaceJson = parseWorkspaceJson(workspaceState.workspaceJson);
    const aggregateBlock = findAggregateBlock(workspaceJson);
    let currentBlock = getNestedBlock(
        asRecord(aggregateBlock?.inputs)?.DEPARTMENTS,
    );
    const connectedDepartmentIds: string[] = [];
    const seenDepartmentIds = new Set<string>();

    while (currentBlock) {
        if (currentBlock.type !== "department_block") {
            currentBlock = getNestedBlock(currentBlock.next);
            continue;
        }

        const departmentId = String(
            asRecord(currentBlock.fields)?.DEPARTMENT_ID ?? "",
        ).trim();
        if (departmentId && !seenDepartmentIds.has(departmentId)) {
            connectedDepartmentIds.push(departmentId);
            seenDepartmentIds.add(departmentId);
        }
        currentBlock = getNestedBlock(currentBlock.next);
    }

    return connectedDepartmentIds;
}

function createDepartmentStubChain(
    selectedSourceDepartmentIds: readonly string[],
): Record<string, unknown> | null {
    let firstBlock: Record<string, unknown> | null = null;
    let previousBlock: Record<string, unknown> | null = null;

    for (const departmentId of selectedSourceDepartmentIds) {
        const block: Record<string, unknown> = {
            fields: { DEPARTMENT_ID: departmentId },
            type: "department_block",
        };
        if (!firstBlock) {
            firstBlock = block;
        }
        if (previousBlock) {
            previousBlock.next = { block };
        }
        previousBlock = block;
    }

    return firstBlock;
}

function createDepartmentStubChainFromAggregate(
    aggregateBlock: Record<string, unknown> | null,
): Record<string, unknown> | null {
    let currentBlock = getNestedBlock(asRecord(aggregateBlock?.inputs)?.DEPARTMENTS);
    let firstBlock: Record<string, unknown> | null = null;
    let previousBlock: Record<string, unknown> | null = null;

    while (currentBlock) {
        if (currentBlock.type === "department_block") {
            const departmentId = String(
                asRecord(currentBlock.fields)?.DEPARTMENT_ID ?? "",
            ).trim();
            if (departmentId) {
                const block: Record<string, unknown> = {
                    fields: { DEPARTMENT_ID: departmentId },
                    type: "department_block",
                };

                if (!firstBlock) {
                    firstBlock = block;
                }
                if (previousBlock) {
                    previousBlock.next = { block };
                }
                previousBlock = block;
            }
        }
        currentBlock = getNestedBlock(currentBlock.next);
    }

    return firstBlock;
}

function createCompactConsolidationWorkspaceState(args: {
    fiscalYear: string;
    selectedSourceDepartmentIds: readonly string[];
    workspaceState: ConsolidationBlocklyState;
}): ConsolidationBlocklyState {
    const workspaceJson = parseWorkspaceJson(args.workspaceState.workspaceJson);
    const aggregateBlock = findAggregateBlock(workspaceJson);
    const departmentStubChain =
        createDepartmentStubChainFromAggregate(aggregateBlock) ??
        createDepartmentStubChain(args.selectedSourceDepartmentIds);
    const compactAggregateBlock: Record<string, unknown> = {
        fields: {
            ...(asRecord(aggregateBlock?.fields) ?? {}),
            FINANCIAL_YEAR: args.fiscalYear,
        },
        type: "aggregate_plan_block",
        x: typeof aggregateBlock?.x === "number" ? aggregateBlock.x : 80,
        y: typeof aggregateBlock?.y === "number" ? aggregateBlock.y : 60,
    };

    if (departmentStubChain) {
        compactAggregateBlock.inputs = {
            DEPARTMENTS: { block: departmentStubChain },
        };
    }
    return {
        ...args.workspaceState,
        workspaceJson: {
            blocks: {
                blocks: [compactAggregateBlock],
                languageVersion: 0,
            },
        },
    };
}

interface ConsolidationWorkspaceData {
    actors?: {
        finalizedBy?: null | {
            email: string | null;
            name: string | null;
            tenantUserId: string;
        };
        snapshotCapturedBy?: null | {
            email: string | null;
            name: string | null;
            tenantUserId: string;
        };
    };
    draft: null | {
        draftData: {
            notes?: string;
            selectedSourceDepartmentIds?: string[];
        };
        finalizedAt?: number | null;
        finalizedByTenantUserId?: string | null;
        revision: number;
        status: "draft" | "finalized";
        workspaceState: unknown;
    };
    readiness: {
        blockedDepartments: Array<{
            departmentId: string;
            departmentName: string;
            reasonLabel: string;
            voteNumber: string;
        }>;
        hasActiveDepartments: boolean;
        readyCount: number;
        readyDepartments: Array<{
            approvedAt: number | null;
            departmentId: string;
            departmentName: string;
            estimatedBudgetUsed: number;
            itemCount: number;
            planId: string;
            voteNumber: string;
            workspaceState?: unknown;
        }>;
        selectedFiscalYear: string;
        selectedFiscalYearLabel: string;
        totalBudget: number;
        totalDepartmentCount: number;
        totalItemCount: number;
    };
    snapshot: null | {
        calculatedTotals: {
            itemCount?: number;
            q1Total?: number;
            q2Total?: number;
            q3Total?: number;
            q4Total?: number;
            totalCost?: number;
        };
        capturedAt: number;
        capturedByTenantUserId: string;
        notes: string;
    };
    user: {
        userId: string;
    };
}

function formatKes(amount: number): string {
    return `KES ${amount.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    })}`;
}

function formatAmount(amount: number): string {
    return amount.toLocaleString("en-US", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    });
}

function formatQty(amount: number): string {
    return Number.isInteger(amount) ? String(amount) : formatAmount(amount);
}

export function ProcurementOfficerConsolidationWorkspace(): JSX.Element {
    const searchParams = useSearchParams();
    const requestedFiscalYear = searchParams.get("poFiscalYear") ?? undefined;
    const workspace = useQuery(
        api.functions.consolidations.getProcurementOfficerConsolidationWorkspace,
        requestedFiscalYear ? { selectedFiscalYear: requestedFiscalYear } : {},
    ) as ConsolidationWorkspaceData | undefined;
    const saveDraft = useMutation(
        api.functions.consolidations.saveProcurementOfficerConsolidationDraft,
    );
    const finalizeDraft = useMutation(
        api.functions.consolidations.finalizeProcurementOfficerConsolidation,
    );
    const reopenForEditing = useMutation(
        api.functions.consolidations.reopenProcurementOfficerConsolidationForEditing,
    );
    const [workspaceState, setWorkspaceState] =
        useState<ConsolidationBlocklyState | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isReopening, setIsReopening] = useState(false);
    const [lastSavedRevision, setLastSavedRevision] = useState<number | null>(null);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
    const autosaveTimerRef = useRef<number | null>(null);
    const lastInitializedFiscalYearRef = useRef<string | null>(null);

    useEffect(() => {
        if (!workspace) {
            return;
        }
        setLastSavedRevision(workspace.draft?.revision ?? null);
    }, [workspace?.draft?.revision]);

    useEffect(() => {
        if (!workspace) {
            return;
        }
        if (
            lastInitializedFiscalYearRef.current ===
            workspace.readiness.selectedFiscalYear
        ) {
            return;
        }

        lastInitializedFiscalYearRef.current = workspace.readiness.selectedFiscalYear;
        setWorkspaceState(null);
        setIsDirty(false);
        setSelectedDepartmentId(null);
    }, [workspace?.readiness.selectedFiscalYear]);

    const sourceDepartments: ConsolidationSourceDepartment[] = useMemo(
        () =>
            workspace?.readiness.readyDepartments.map((department) =>
                enrichConsolidationSourceDepartment({
                    departmentId: department.departmentId,
                    departmentName: department.departmentName,
                    estimatedBudgetUsed: department.estimatedBudgetUsed,
                    itemCount: department.itemCount,
                    voteNumber: department.voteNumber,
                    workspaceState: department.workspaceState ?? null,
                }),
            ) ?? [],
        [workspace?.readiness.readyDepartments],
    );
    const isFinalized = workspace?.draft?.status === "finalized";
    const selectedDepartment = useMemo(
        () =>
            sourceDepartments.find(
                (department) => department.departmentId === selectedDepartmentId,
            ) ?? null,
        [selectedDepartmentId, sourceDepartments],
    );

    const persistDraft = useCallback(
        async (mode: "autosave" | "manual") => {
            if (!workspace || !workspaceState) {
                return;
            }
            if (isFinalized) {
                toast.error("Finalized consolidations are read-only.");
                return;
            }

            setIsSaving(true);
            try {
                const selectedSourceDepartmentIds =
                    collectConnectedDepartmentIds(workspaceState);
                const result = (await saveDraft({
                    expectedRevision: lastSavedRevision ?? undefined,
                    fiscalYear: workspace.readiness.selectedFiscalYear,
                    notes: "",
                    selectedSourceDepartmentIds,
                    workspaceState: createCompactConsolidationWorkspaceState({
                        fiscalYear: workspace.readiness.selectedFiscalYear,
                        selectedSourceDepartmentIds,
                        workspaceState,
                    }),
                })) as { draft: { revision: number } | null };
                setLastSavedRevision(result.draft?.revision ?? lastSavedRevision);
                setIsDirty(false);
                if (mode === "manual") {
                    toast.success("Consolidation draft saved.");
                }
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Could not save consolidation draft.";
                toast.error(message);
            } finally {
                setIsSaving(false);
            }
        },
        [
            lastSavedRevision,
            saveDraft,
            workspace,
            workspaceState,
            isFinalized,
        ],
    );

    const finalizeConsolidation = useCallback(async () => {
        if (!workspace?.draft || isFinalized) {
            return;
        }

        setIsFinalizing(true);
        try {
            const result = (await finalizeDraft({
                expectedRevision: workspace.draft.revision,
                fiscalYear: workspace.readiness.selectedFiscalYear,
            })) as { draft: { revision: number } | null };
            setLastSavedRevision(result.draft?.revision ?? workspace.draft.revision);
            setIsDirty(false);
            toast.success("Consolidation finalized.");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not finalize consolidation.";
            toast.error(message);
        } finally {
            setIsFinalizing(false);
        }
    }, [finalizeDraft, isFinalized, workspace]);

    const reopenConsolidation = useCallback(async () => {
        if (!workspace?.draft || !isFinalized) {
            return;
        }

        setIsReopening(true);
        try {
            const result = (await reopenForEditing({
                expectedRevision: workspace.draft.revision,
                fiscalYear: workspace.readiness.selectedFiscalYear,
            })) as { draft: { revision: number } | null };
            setLastSavedRevision(result.draft?.revision ?? workspace.draft.revision);
            setIsDirty(false);
            toast.success("Consolidation reopened for editing.");
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not reopen consolidation for editing.";
            toast.error(message);
        } finally {
            setIsReopening(false);
        }
    }, [isFinalized, reopenForEditing, workspace]);

    useEffect(() => {
        if (!isDirty || !workspaceState || !workspace || isFinalized) {
            return;
        }

        if (autosaveTimerRef.current !== null) {
            window.clearTimeout(autosaveTimerRef.current);
        }
        autosaveTimerRef.current = window.setTimeout(() => {
            void persistDraft("autosave");
            autosaveTimerRef.current = null;
        }, 1_200);

        return () => {
            if (autosaveTimerRef.current !== null) {
                window.clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
        };
    }, [isDirty, isFinalized, persistDraft, workspace, workspaceState]);

    if (!workspace) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background">
                <div className="flex items-center gap-3 rounded-md border border-border px-5 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading consolidation workspace...
                </div>
            </div>
        );
    }

    const noActiveDepartments = !workspace.readiness.hasActiveDepartments;
    const noApprovedPlans =
        workspace.readiness.hasActiveDepartments && workspace.readiness.readyCount === 0;
    const blockedDepartments = workspace.readiness.blockedDepartments;
    const finalizedByLabel =
        workspace.actors?.finalizedBy?.email ??
        workspace.actors?.snapshotCapturedBy?.email ??
        "recorded user";

    if (noActiveDepartments) {
        return (
            <WorkspaceStatePanel
                icon={<Building2 className="h-7 w-7" />}
                title="No active departments configured"
                body="Create departments before opening consolidation. There are no submissions to approve yet."
                ctaHref="/po/departments"
                ctaLabel="Open department setup"
            />
        );
    }

    if (noApprovedPlans) {
        return (
            <WorkspaceStatePanel
                icon={<AlertTriangle className="h-7 w-7" />}
                title="Approved plans required"
                body={CONSOLIDATION_EMPTY_MESSAGE}
                ctaHref="/po"
                ctaLabel="Review submissions"
            />
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] min-h-[42rem] flex-col overflow-hidden bg-background dark:bg-[#0B1220]">
            <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-6 py-4 dark:border-[#243041] dark:bg-[#111827]/95 dark:shadow-[0_12px_34px_rgba(0,0,0,0.24)]">
                <div className="min-w-0">
                    <h1 className="text-base font-semibold text-foreground">
                        Master Consolidation Plan
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {isFinalized
                            ? "Official record locked for export"
                            : "Review university-wide plans"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="dark:border-[#243041] dark:bg-[#0B1220] dark:text-slate-100 dark:hover:bg-[#172131] dark:hover:text-white"
                        asChild
                    >
                        <Link href="/po">Exit</Link>
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        className="dark:bg-emerald-500 dark:text-slate-950 dark:shadow-[0_0_16px_rgba(34,197,94,0.28)] dark:hover:bg-emerald-400"
                        onClick={() => void persistDraft("manual")}
                        disabled={isFinalized || isSaving || !workspaceState}
                    >
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Draft
                    </Button>
                    {isFinalized ? (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="dark:border-[#243041] dark:bg-[#0B1220] dark:text-slate-100 dark:hover:bg-[#172131] dark:hover:text-white"
                                    disabled={isReopening || !workspace.draft}
                                >
                                    {isReopening ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <PencilLine className="mr-2 h-4 w-4" />
                                    )}
                                    Edit Draft
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Edit finalized plan</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This returns the consolidation to draft mode so you can update the workspace and finalize it again. The previous finalization snapshot remains in the audit history, and export readiness pauses until you finalize again.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => void reopenConsolidation()}>
                                        Edit Draft
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    ) : null}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                type="button"
                                size="sm"
                                variant={isFinalized ? "outline" : "default"}
                                className="dark:border-[#243041] dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
                                disabled={
                                    isFinalized ||
                                    isFinalizing ||
                                    isSaving ||
                                    !workspace.draft ||
                                    workspace.readiness.readyCount === 0
                                }
                            >
                                {isFinalizing ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : isFinalized ? (
                                    <Lock className="mr-2 h-4 w-4" />
                                ) : (
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                )}
                                {isFinalized ? "Finalized" : "Finalize Plan"}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Finalize consolidated plan</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Finalization locks this consolidation as the current official record for export. You can reopen it later with Edit Draft, make changes, and finalize again.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void finalizeConsolidation()}>
                                    Finalize Plan
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {isFinalized ? (
                <div className="border-b border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4" />
                            <span>
                                Finalized on {formatDateTime(workspace.draft?.finalizedAt ?? workspace.snapshot?.capturedAt)} by{" "}
                                {finalizedByLabel}
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-emerald-300 bg-emerald-100/70 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Export ready
                        </Button>
                    </div>
                </div>
            ) : null}

            {isFinalized && workspace.snapshot ? (
                <div className="grid grid-cols-5 gap-2 border-b border-border bg-card px-6 py-3 text-xs dark:border-[#243041] dark:bg-[#111827]">
                    <SummaryMetric label="Snapshot total" value={formatKes(workspace.snapshot.calculatedTotals.totalCost ?? 0)} />
                    <SummaryMetric label="Items" value={formatQty(workspace.snapshot.calculatedTotals.itemCount ?? 0)} />
                    <SummaryMetric label="Q1" value={formatKes(workspace.snapshot.calculatedTotals.q1Total ?? 0)} />
                    <SummaryMetric label="Q2" value={formatKes(workspace.snapshot.calculatedTotals.q2Total ?? 0)} />
                    <SummaryMetric label="Q3/Q4" value={`${formatKes(workspace.snapshot.calculatedTotals.q3Total ?? 0)} / ${formatKes(workspace.snapshot.calculatedTotals.q4Total ?? 0)}`} />
                </div>
            ) : null}

            {blockedDepartments.length > 0 ? (
                <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    {blockedDepartments.length} department
                    {blockedDepartments.length === 1 ? "" : "s"} not approved yet:
                    {" "}
                    {blockedDepartments
                        .slice(0, 4)
                        .map(
                            (department) =>
                                `${department.departmentName} (${department.reasonLabel})`,
                        )
                        .join("; ")}
                </div>
            ) : null}


            <div className="flex min-h-0 flex-1 border-t border-transparent dark:border-[#243041]/70">
                <div className="min-w-0 flex-1">
                    <BlocklyShell
                        key={workspace.readiness.selectedFiscalYear}
                        fiscalYear={workspace.readiness.selectedFiscalYear}
                        initialWorkspaceState={workspace.draft?.workspaceState ?? null}
                        onSelectedDepartmentChange={setSelectedDepartmentId}
                        onWorkspaceChange={(state) => {
                            if (isFinalized) {
                                return;
                            }
                            setWorkspaceState(state);
                            if (state.editorMetadata.saveSource !== "workspace_seed") {
                                setIsDirty(true);
                            }
                        }}
                        readOnly={isFinalized}
                        sourceDepartments={sourceDepartments}
                        userId={workspace.user.userId}
                    />
                </div>
                <ConsolidationDepartmentDetailsPanel department={selectedDepartment} />
            </div>
        </div>
    );
}

function formatDateTime(value: number | null | undefined): string {
    if (!value) {
        return "an unknown date";
    }
    return new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function ConsolidationDepartmentDetailsPanel(props: {
    department: ConsolidationSourceDepartment | null;
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState("all");
    const [scrollTop, setScrollTop] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const items = props.department?.items ?? [];
    const categories = props.department?.categories ?? [];
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const filteredItems = useMemo(
        () =>
            items.filter((item) => {
                const matchesCategory =
                    selectedCategoryId === "all" ||
                    item.categoryId === selectedCategoryId;
                if (!matchesCategory) {
                    return false;
                }
                if (!normalizedSearchQuery) {
                    return true;
                }
                return [
                    item.categoryName,
                    item.itemDescription,
                    item.procurementMethod,
                    item.sourceOfFunds,
                    item.unitOfMeasurement,
                ].some((value) => value.toLowerCase().includes(normalizedSearchQuery));
            }),
        [items, normalizedSearchQuery, selectedCategoryId],
    );
    const rowHeight = 46;
    const viewportHeight = 340;
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 8);
    const visibleCount = Math.ceil(viewportHeight / rowHeight) + 16;
    const visibleItems = filteredItems.slice(startIndex, startIndex + visibleCount);

    useEffect(() => {
        setSearchQuery("");
        setSelectedCategoryId("all");
        setScrollTop(0);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [props.department?.departmentId]);

    useEffect(() => {
        setScrollTop(0);
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [normalizedSearchQuery, selectedCategoryId]);

    return (
        <aside className="flex w-[34rem] shrink-0 flex-col border-l border-border/80 bg-card shadow-[-12px_0_32px_rgba(15,23,42,0.08)] dark:border-[#243041] dark:bg-[#111827] dark:shadow-[-12px_0_36px_rgba(0,0,0,0.36)]">
            {!props.department ? (
                <EmptyDepartmentDetailsPanel />
            ) : (
                <>
                    <div className="border-b border-border/80 bg-card px-4 py-2.5 shadow-sm dark:border-[#243041] dark:bg-[#111827]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-foreground">
                                    {props.department.departmentName}
                                </div>
                                <div className="mt-0.5 text-xs text-muted-foreground">
                                    Vote {props.department.voteNumber} -{" "}
                                    {props.department.categoryCount ?? categories.length} categories -{" "}
                                    {props.department.itemCount} items
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="text-xs uppercase text-muted-foreground">Total</div>
                                <div className="text-sm font-semibold text-foreground">
                                    {formatKes(props.department.totalCost ?? 0)}
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[0.68rem] text-muted-foreground">
                            <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 dark:border-[#243041] dark:bg-[#172131]">
                                Budget {formatKes(props.department.estimatedBudgetUsed)}
                            </span>
                            <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 dark:border-[#243041] dark:bg-[#172131]">
                                Q1 {formatKes(props.department.quarterTotals?.q1 ?? 0)}
                            </span>
                            <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 dark:border-[#243041] dark:bg-[#172131]">
                                Q2 {formatKes(props.department.quarterTotals?.q2 ?? 0)}
                            </span>
                            <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 dark:border-[#243041] dark:bg-[#172131]">
                                Q3 {formatKes(props.department.quarterTotals?.q3 ?? 0)}
                            </span>
                            <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 dark:border-[#243041] dark:bg-[#172131]">
                                Q4 {formatKes(props.department.quarterTotals?.q4 ?? 0)}
                            </span>
                        </div>
                    </div>

                    <div className="border-b border-border/80 bg-card p-3 shadow-sm dark:border-[#243041] dark:bg-[#111827]">
                        <TimingDetailsPanel sections={props.department.timingSections ?? []} />

                        <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background px-2 shadow-inner dark:border-[#243041] dark:bg-[#0B1220]">
                            <Search className="h-4 w-4 text-muted-foreground" />
                            <input
                                className="h-9 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                                placeholder="Search items"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                        </div>
                        <select
                            className="mt-2 h-9 w-full rounded-md border border-border/80 bg-background px-2 text-sm text-foreground shadow-sm dark:border-[#243041] dark:bg-[#0B1220] dark:text-slate-100"
                            value={selectedCategoryId}
                            onChange={(event) => setSelectedCategoryId(event.target.value)}
                        >
                            <option value="all">All categories</option>
                            {categories.map((category) => (
                                <option
                                    key={category.categoryId || category.categoryName}
                                    value={category.categoryId}
                                >
                                    {category.categoryName} ({category.itemCount})
                                </option>
                            ))}
                        </select>
                    </div>

                    <VirtualizedItemRows
                        items={filteredItems}
                        rowHeight={rowHeight}
                        scrollContainerRef={scrollContainerRef}
                        startIndex={startIndex}
                        visibleItems={visibleItems}
                        viewportHeight={viewportHeight}
                        onScrollTopChange={setScrollTop}
                    />
                </>
            )}
        </aside>
    );
}

function TimingDetailsPanel(props: { sections: ConsolidationTimingSection[] }) {
    const sections =
        props.sections.length > 0
            ? props.sections
            : [
                  {
                      fields: [],
                      label: "Planned timing",
                      type: "planned_timing_block" as const,
                  },
                  {
                      fields: [],
                      label: "Actual timing",
                      type: "actual_timing_block" as const,
                  },
                  {
                      fields: [],
                      label: "Variance timing",
                      type: "variance_timing_block" as const,
                  },
              ];

    const completedCount = sections.filter((section) =>
        section.fields.some(
            (field) => field.value.trim() && field.value.trim() !== "_",
        ),
    ).length;

    return (
        <details className="mb-2 rounded-md border border-border/80 bg-muted/35 px-3 py-2 text-xs shadow-sm dark:border-[#243041] dark:bg-[#172131]/72">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                <span>Timing details</span>
                <span className="text-xs font-medium text-muted-foreground">
                    {completedCount}/3 filled
                </span>
            </summary>
            <div className="mt-2 grid gap-2">
                {sections.map((section) => {
                    const filledFields = section.fields.filter(
                        (field) => field.value.trim() && field.value.trim() !== "_",
                    );
                    const summary =
                        filledFields.length > 0
                            ? filledFields
                                  .slice(0, 2)
                                  .map((field) => `${field.label}: ${field.value}`)
                                  .join(" / ")
                            : "No timing values set";

                    return (
                        <div
                            className="rounded border border-border/70 bg-background px-2 py-1.5 dark:border-[#243041] dark:bg-[#0B1220]"
                            key={section.type}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <div className="font-semibold text-foreground">
                                    {section.label}
                                </div>
                                <div className="text-muted-foreground">
                                    {filledFields.length > 0 ? "Filled" : "Empty"}
                                </div>
                            </div>
                            <div className="mt-1 truncate text-muted-foreground">
                                {summary}
                            </div>
                        </div>
                    );
                })}
            </div>
        </details>
    );
}

function EmptyDepartmentDetailsPanel() {
    const placeholderRows = [
        ["Category", "Submitted item", "-", "-", "-", "-", "-", "-", "-", "-"],
        ["Category", "Submitted item", "-", "-", "-", "-", "-", "-", "-", "-"],
        ["Category", "Submitted item", "-", "-", "-", "-", "-", "-", "-", "-"],
        ["Category", "Submitted item", "-", "-", "-", "-", "-", "-", "-", "-"],
    ];

    return (
        <>
            <div className="border-b border-border/80 bg-card p-4 shadow-sm dark:border-[#243041] dark:bg-[#111827]">
                <div className="text-sm font-semibold text-foreground">
                    Department details
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                    Select a department summary block to inspect its submitted plan.
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <SummaryMetric label="Total" value="KES 0.00" muted />
                    <SummaryMetric label="Budget" value="KES 0.00" muted />
                    <SummaryMetric label="Q1" value="KES 0.00" muted />
                    <SummaryMetric label="Q2" value="KES 0.00" muted />
                    <SummaryMetric label="Q3" value="KES 0.00" muted />
                    <SummaryMetric label="Q4" value="KES 0.00" muted />
                </div>
            </div>

            <div className="border-b border-border bg-card p-3 dark:border-[#243041] dark:bg-[#111827]">
                <div className="flex items-center gap-2 rounded-md border border-border/80 bg-background px-2 opacity-75 shadow-inner dark:border-[#243041] dark:bg-[#0B1220]">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-muted-foreground outline-none"
                        disabled
                        placeholder="Search items"
                    />
                </div>
                <select
                    className="mt-2 h-9 w-full rounded-md border border-border/80 bg-background px-2 text-sm text-muted-foreground opacity-75 shadow-sm dark:border-[#243041] dark:bg-[#0B1220]"
                    disabled
                    value="all"
                >
                    <option value="all">All categories</option>
                </select>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="grid min-w-[68rem] grid-cols-[1.1fr_1.8fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr] gap-2 border-b border-border/80 bg-muted px-3 py-2 text-[0.7rem] font-semibold uppercase text-foreground/75 shadow-sm dark:border-[#243041] dark:bg-[#172131] dark:text-slate-200">
                        <span>Category</span>
                        <span>Item</span>
                        <span>Q1</span>
                        <span>Q2</span>
                        <span>Q3</span>
                        <span>Q4</span>
                        <span>Qty</span>
                        <span>Unit</span>
                        <span>Method</span>
                        <span>Total</span>
                    </div>
                    <div className="relative">
                        {placeholderRows.map((row, rowIndex) => (
                            <div
                                className="grid min-w-[68rem] grid-cols-[1.1fr_1.8fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr] gap-2 border-b border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground/70 dark:border-[#243041]/80 dark:bg-[#0B1220]/72 dark:text-slate-300"
                                key={`empty-row-${rowIndex}`}
                            >
                                {row.map((cell, cellIndex) => (
                                    <span
                                        className={cellIndex === 1 ? "font-medium" : ""}
                                        key={`empty-cell-${rowIndex}-${cellIndex}`}
                                    >
                                        {cell}
                                    </span>
                                ))}
                            </div>
                        ))}
                        <div className="mx-4 mt-6 rounded-md border border-dashed border-border/90 bg-muted/35 px-4 py-5 text-center shadow-sm dark:border-slate-600 dark:bg-[#172131]/55">
                            <div className="text-sm font-medium text-foreground">
                                No department selected
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                                Select a connected department block to load submitted categories and items.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

function SummaryMetric(props: { label: string; muted?: boolean; value: string }) {
    return (
        <div className={`rounded-md border border-border/80 bg-muted/35 px-2 py-1 shadow-sm dark:border-[#243041] dark:bg-[#172131]/72 ${props.muted ? "opacity-75" : ""}`}>
            <div className="text-[0.68rem] uppercase text-muted-foreground">{props.label}</div>
            <div className="font-semibold text-foreground">{props.value}</div>
        </div>
    );
}

function VirtualizedItemRows(props: {
    items: ConsolidationSourceItem[];
    onScrollTopChange: (scrollTop: number) => void;
    rowHeight: number;
    scrollContainerRef: RefObject<HTMLDivElement>;
    startIndex: number;
    viewportHeight: number;
    visibleItems: ConsolidationSourceItem[];
}) {
    const columnClass =
        "grid-cols-[9rem_14rem_4.5rem_4.5rem_4.5rem_4.5rem_4.5rem_6rem_7rem_7rem]";

    return (
            <div
                ref={props.scrollContainerRef}
                data-testid="consolidation-items-table"
                className="min-h-0 flex-1 overflow-auto border-t border-border/80 bg-background dark:border-[#243041] dark:bg-[#0B1220]"
                style={{ maxHeight: props.viewportHeight }}
                onScroll={(event) => {
                    props.onScrollTopChange(event.currentTarget.scrollTop);
                }}
            >
                <div
                    className={`sticky top-0 z-10 grid min-w-[70rem] ${columnClass} gap-x-3 border-b border-border/80 bg-muted/95 px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-wide text-foreground/75 shadow-sm backdrop-blur dark:border-[#243041] dark:bg-[#172131]/95 dark:text-slate-200`}
                >
                    <span>Category</span>
                    <span>Item</span>
                    <span className="text-right">Q1</span>
                    <span className="text-right">Q2</span>
                    <span className="text-right">Q3</span>
                    <span className="text-right">Q4</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right">Unit</span>
                    <span>Method</span>
                    <span className="text-right">Total</span>
                </div>
                <div
                    className="relative min-w-[70rem]"
                    style={{ height: props.items.length * props.rowHeight }}
                >
                    {props.visibleItems.map((item, index) => (
                        <ItemRow
                            columnClass={columnClass}
                            item={item}
                            key={`${item.categoryId}:${item.itemId}:${props.startIndex + index}`}
                            rowHeight={props.rowHeight}
                            top={(props.startIndex + index) * props.rowHeight}
                        />
                    ))}
                    {props.items.length === 0 ? (
                        <div className="absolute inset-x-0 top-8 text-center text-sm text-muted-foreground">
                            No items match the current filters.
                        </div>
                    ) : null}
                </div>
            </div>
    );
}

function ItemRow(props: {
    columnClass: string;
    item: ConsolidationSourceItem;
    rowHeight: number;
    top: number;
}) {
    return (
        <div
            className={`absolute left-0 right-0 grid ${props.columnClass} items-center gap-x-3 border-b border-border/70 bg-card px-3 text-xs text-muted-foreground shadow-[0_1px_0_rgba(15,23,42,0.04)] odd:bg-muted/15 hover:bg-muted/30 dark:border-[#243041]/80 dark:bg-[#0F172A] dark:text-slate-300 dark:odd:bg-[#111827] dark:hover:bg-[#172131]`}
            style={{ height: props.rowHeight, top: props.top }}
        >
            <span className="truncate pr-3" title={props.item.categoryName}>
                {props.item.categoryName}
            </span>
            <span className="truncate pr-3 font-medium text-foreground" title={props.item.itemDescription}>
                {props.item.itemDescription}
            </span>
            <span className="text-right tabular-nums">{formatQty(props.item.q1Qty)}</span>
            <span className="text-right tabular-nums">{formatQty(props.item.q2Qty)}</span>
            <span className="text-right tabular-nums">{formatQty(props.item.q3Qty)}</span>
            <span className="text-right tabular-nums">{formatQty(props.item.q4Qty)}</span>
            <span className="text-right tabular-nums">{formatQty(props.item.totalQty)}</span>
            <span className="text-right tabular-nums">{formatAmount(props.item.unitPrice)}</span>
            <span className="truncate px-3" title={props.item.procurementMethod}>
                {props.item.procurementMethod || "-"}
            </span>
            <span className="text-right font-semibold tabular-nums text-foreground">
                {formatAmount(props.item.totalCost)}
            </span>
        </div>
    );
}

function WorkspaceStatePanel(props: {
    body: string;
    ctaHref: string;
    ctaLabel: string;
    icon: ReactNode;
    title: string;
}) {
    return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
            <div className="max-w-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {props.icon}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                    {props.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{props.body}</p>
                <Button className="mt-5" asChild>
                    <Link href={props.ctaHref}>{props.ctaLabel}</Link>
                </Button>
            </div>
        </div>
    );
}
