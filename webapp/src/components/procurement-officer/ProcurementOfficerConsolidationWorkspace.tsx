"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { AlertTriangle, Building2, CheckCircle2, Download, FileSpreadsheet, Loader2, Lock, Minus, PencilLine, Plus, Save, Search, X } from "lucide-react";
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
        id: string;
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
        complianceSummary?: unknown;
        notes: string;
        id: string;
        selectedSourceDepartmentIds?: string[];
        sourcePlanIds?: string[];
        workspaceState?: unknown;
    };
    tenant?: {
        name: string;
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

function downloadBase64Workbook(args: { fileName: string; workbookBase64: string }) {
    const byteCharacters = window.atob(args.workbookBase64);
    const byteNumbers = Array.from(byteCharacters, (character) =>
        character.charCodeAt(0),
    );
    const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = args.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
}

function shouldUseLocalConsolidatedExport(): boolean {
    return process.env.NODE_ENV !== "production";
}

function buildLocalConsolidatedExportRequest(args: {
    workspace: ConsolidationWorkspaceData;
}) {
    const selectedSourceDepartmentIds =
        args.workspace.snapshot?.selectedSourceDepartmentIds ??
        args.workspace.draft?.draftData.selectedSourceDepartmentIds ??
        [];
    const selectedDepartmentIds = new Set(selectedSourceDepartmentIds);
    const sourceDepartments =
        selectedSourceDepartmentIds.length > 0
            ? args.workspace.readiness.readyDepartments.filter((department) =>
                  selectedDepartmentIds.has(department.departmentId),
              )
            : args.workspace.readiness.readyDepartments;
    const fiscalYear = args.workspace.readiness.selectedFiscalYear;
    const exportId = `local-${args.workspace.snapshot?.id ?? args.workspace.draft?.id ?? Date.now()}`;

    return {
        actor: {
            userId: args.workspace.user.userId,
        },
        exportRequest: {
            exportId,
            formatterPayload: {
                audit: {
                    requestedAt: Date.now(),
                    requestedByUserId: args.workspace.user.userId,
                },
                calculatedTotals: args.workspace.snapshot?.calculatedTotals ?? {},
                complianceSummary: args.workspace.snapshot?.complianceSummary ?? {},
                consolidationId: args.workspace.draft?.id ?? "",
                exportId,
                fiscalYear,
                generatedAt: Date.now(),
                generatedBy: args.workspace.user.userId,
                institution: {
                    name: args.workspace.tenant?.name ?? "Institution",
                },
                institutionName: args.workspace.tenant?.name ?? "Institution",
                reportName: `Consolidated Plan ${fiscalYear}`,
                selectedSourceDepartmentIds,
                snapshotId: args.workspace.snapshot?.id ?? "",
                sourceDepartments,
                sourcePlanIds: args.workspace.snapshot?.sourcePlanIds ?? [],
                sourceSnapshot: {
                    capturedAt: args.workspace.snapshot?.capturedAt ?? Date.now(),
                    capturedBy: args.workspace.snapshot?.capturedByTenantUserId,
                    notes: args.workspace.snapshot?.notes,
                },
                workspaceState: args.workspace.snapshot?.workspaceState ?? null,
            },
            idempotencyKey: `local:${exportId}`,
            reportName: `Consolidated Plan ${fiscalYear}`,
        },
    };
}

async function requestLocalConsolidatedExport(args: {
    workspace: ConsolidationWorkspaceData;
}): Promise<{ fileName: string; workbookBase64: string }> {
    const response = await fetch("/api/local/consolidated-plan-export", {
        body: JSON.stringify(buildLocalConsolidatedExportRequest(args)),
        headers: { "Content-Type": "application/json" },
        method: "POST",
    });
    const result = (await response.json()) as
        | { success: true; data: { fileName: string; workbookBase64: string } }
        | { success: false; error?: { message?: string } };

    if (!response.ok || !result.success) {
        throw new Error(
            !result.success && result.error?.message
                ? result.error.message
                : "Could not generate local Excel export.",
        );
    }

    return result.data;
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
    const queueExport = useAction(api.actions.files.queueConsolidatedPlanExcelExport);
    const [workspaceState, setWorkspaceState] =
        useState<ConsolidationBlocklyState | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewZoom, setPreviewZoom] = useState(1);
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
    const preview = useQuery(
        api.functions.consolidationExports.getProcurementOfficerConsolidationExcelPreview,
        isFinalized && workspace.draft?.id
            ? {
                  consolidationId: workspace.draft.id as never,
                  fiscalYear: workspace.readiness.selectedFiscalYear,
              }
            : "skip",
    ) as
        | {
              columns: string[];
              rows: Array<Array<number | string>>;
              snapshotId: string;
          }
        | undefined;
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

    const requestExport = useCallback(async () => {
        if (!workspace?.draft?.id || !isFinalized || !workspace.snapshot) {
            toast.error("Finalize the consolidation before exporting");
            return;
        }

        setIsExporting(true);
        try {
            if (shouldUseLocalConsolidatedExport()) {
                const localResult = await requestLocalConsolidatedExport({ workspace });
                setIsPreviewOpen(false);
                downloadBase64Workbook(localResult);
                toast.success("Excel export downloaded.");
                return;
            }

            const result = (await queueExport({
                consolidationId: workspace.draft.id as never,
                fiscalYear: workspace.readiness.selectedFiscalYear,
                format: "xlsx",
            })) as {
                fileName?: string | null;
                status?: string;
                workbookBase64?: string | null;
            };
            setIsPreviewOpen(false);
            if (result.workbookBase64) {
                downloadBase64Workbook({
                    fileName:
                        result.fileName ??
                        `consolidated-plan-${workspace.readiness.selectedFiscalYear}.xlsx`,
                    workbookBase64: result.workbookBase64,
                });
                toast.success("Excel export downloaded.");
            } else {
                toast.success("Excel export queued.");
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Could not queue Excel export.";
            toast.error(message);
        } finally {
            setIsExporting(false);
        }
    }, [isFinalized, queueExport, workspace]);

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
                    {!isFinalized ? (
                        <p className="text-sm text-muted-foreground">
                            Review university-wide plans
                        </p>
                    ) : null}
                    {isFinalized ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-300">
                            <Lock className="h-3.5 w-3.5" />
                            <span>
                                Finalized on {formatDateTime(workspace.draft?.finalizedAt ?? workspace.snapshot?.capturedAt)} by{" "}
                                {finalizedByLabel}
                            </span>
                        </div>
                    ) : null}
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
                    {isFinalized ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
                            disabled={isExporting || !workspace.snapshot}
                            onClick={() => setIsPreviewOpen(true)}
                        >
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Preview .xlsx
                        </Button>
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
            {isFinalized && workspace.snapshot ? (
                <ConsolidatedPlanPreviewModal
                    departments={sourceDepartments}
                    fiscalYear={workspace.readiness.selectedFiscalYear}
                    institutionName={workspace.tenant?.name ?? "Institution"}
                    isExporting={isExporting}
                    isOpen={isPreviewOpen}
                    previewSnapshotId={preview?.snapshotId ?? workspace.snapshot.id}
                    snapshot={workspace.snapshot}
                    zoom={previewZoom}
                    selectedSourceDepartmentIds={
                        workspace.snapshot.selectedSourceDepartmentIds ?? []
                    }
                    onClose={() => setIsPreviewOpen(false)}
                    onDownload={() => void requestExport()}
                    onZoomChange={setPreviewZoom}
                />
            ) : null}
        </div>
    );
}

function ConsolidatedPlanPreviewModal(props: {
    departments: ConsolidationSourceDepartment[];
    fiscalYear: string;
    institutionName: string;
    isExporting: boolean;
    isOpen: boolean;
    onClose: () => void;
    onDownload: () => void;
    onZoomChange: (zoom: number) => void;
    previewSnapshotId: string;
    selectedSourceDepartmentIds: string[];
    snapshot: NonNullable<ConsolidationWorkspaceData["snapshot"]>;
    zoom: number;
}) {
    const selectedDepartmentIds = new Set(props.selectedSourceDepartmentIds);
    const departments =
        props.selectedSourceDepartmentIds.length > 0
            ? props.departments.filter((department) =>
                  selectedDepartmentIds.has(department.departmentId),
              )
            : props.departments;
    const previewRows = buildPreviewRows(departments, props.snapshot);

    if (!props.isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5">
            <div className="flex max-h-[90vh] w-full max-w-[86rem] flex-col rounded-md bg-background shadow-2xl dark:bg-[#111827]">
                <div className="flex items-center justify-between gap-4 border-b border-border px-9 py-6 dark:border-[#243041]">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground">
                            Consolidated Plan Preview
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {props.institutionName} {props.fiscalYear}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-md border border-border bg-background p-1 dark:border-[#243041] dark:bg-[#0B1220]">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={props.zoom <= 0.7}
                                onClick={() =>
                                    props.onZoomChange(Math.max(0.7, props.zoom - 0.1))
                                }
                                title="Zoom out"
                            >
                                <Minus className="h-4 w-4" />
                            </Button>
                            <div className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                                {Math.round(props.zoom * 100)}%
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                disabled={props.zoom >= 1.4}
                                onClick={() =>
                                    props.onZoomChange(Math.min(1.4, props.zoom + 0.1))
                                }
                                title="Zoom in"
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground"
                            onClick={props.onClose}
                            title="Close preview"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-9 py-8">
                    <div
                        className="origin-top-left border-[3px] border-slate-700 bg-white text-[0.72rem] text-slate-950 shadow-sm dark:border-[#334155]"
                        style={{
                            transform: `scale(${props.zoom})`,
                            width: `${100 / props.zoom}%`,
                        }}
                    >
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="sticky left-0 z-20 w-10 border-2 border-slate-600 bg-slate-200 px-1 py-1 text-center font-bold text-slate-700"></th>
                                    {EXCEL_COLUMN_LABELS.map((label) => (
                                        <th
                                            className="border-2 border-slate-600 bg-slate-200 px-2 py-1 text-center font-bold text-slate-700"
                                            key={label}
                                        >
                                            {label}
                                        </th>
                                    ))}
                                </tr>
                                <tr>
                                    <ExcelRowHeader rowNumber={1} />
                                    <th className="border-2 border-slate-600 bg-white px-2 py-3 text-center text-sm font-bold" colSpan={16}>
                                        Consolidated Procurement Plan Template
                                    </th>
                                </tr>
                                <tr className="bg-slate-100 text-left font-bold">
                                    <ExcelRowHeader rowNumber={2} />
                                    <th className="border-2 border-slate-600 px-2 py-2">Vote Number</th>
                                    <th className="border-2 border-slate-600 px-2 py-2">Item/Service Description</th>
                                    <th className="border-2 border-slate-600 px-2 py-2">Unit Of Measurement</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Qty</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Unit Price</th>
                                    <th className="border-2 border-slate-600 px-2 py-2">Proc Method</th>
                                    <th className="border-2 border-slate-600 px-2 py-2">Source Of Funds</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Estimated Unit Cost (Kes)</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-center" colSpan={8}>
                                        Timing of Activities (Quarterly Basis)
                                    </th>
                                </tr>
                                <tr className="bg-slate-100 font-bold">
                                    <ExcelRowHeader rowNumber={3} />
                                    <th className="border-2 border-slate-600 px-2 py-2" colSpan={8}></th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Qty</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Total Cost</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Qty</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Total Cost</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Qty</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Total Cost</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Qty</th>
                                    <th className="border-2 border-slate-600 px-2 py-2 text-right">Total Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewRows.map((row, index) => (
                                    <PreviewRowRenderer
                                        key={`${row.kind}-${index}`}
                                        row={row}
                                        rowNumber={index + 4}
                                    />
                                ))}
                            </tbody>
                        </table>
                        {departments.length === 0 ? (
                            <div className="px-4 py-8 text-center text-sm text-slate-500">
                                No finalized source departments are available for preview.
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border px-9 py-5 dark:border-[#243041]">
                    <Button type="button" variant="outline" onClick={props.onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={props.isExporting || departments.length === 0}
                        onClick={props.onDownload}
                    >
                        {props.isExporting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        Download .xlsx
                    </Button>
                </div>
            </div>
        </div>
    );
}

const EXCEL_COLUMN_LABELS = Array.from({ length: 16 }, (_, index) =>
    String.fromCharCode(65 + index),
);

type PreviewRow =
    | {
          kind: "aggregate";
          amount: number;
          label: string;
          percent: string;
          q1: number;
          q2: number;
          q3: number;
          q4: number;
      }
    | {
          kind: "category";
          categoryName: string;
      }
    | {
          kind: "category-total";
          totalCost: number;
          q1: number;
          q2: number;
          q3: number;
          q4: number;
      }
    | {
          kind: "department";
          departmentName: string;
          departmentNumber: number;
      }
    | {
          kind: "department-total";
          q1: number;
          q2: number;
          q3: number;
          q4: number;
          totalCost: number;
      }
    | {
          kind: "empty-category";
      }
    | {
          item: ConsolidationSourceItem;
          kind: "item";
          voteNumber: string;
      }
    | {
          kind: "timing-header";
      }
    | {
          kind: "timing-labels";
          labels: string[];
      }
    | {
          kind: "timing-row";
          section: ConsolidationTimingSection;
      };

function ExcelRowHeader(props: { rowNumber: number }) {
    return (
        <th className="sticky left-0 z-10 w-10 border-2 border-slate-600 bg-slate-200 px-1 py-2 text-center font-bold text-slate-700">
            {props.rowNumber}
        </th>
    );
}

function buildPreviewRows(
    departments: ConsolidationSourceDepartment[],
    snapshot: NonNullable<ConsolidationWorkspaceData["snapshot"]>,
): PreviewRow[] {
    const rows: PreviewRow[] = [];
    departments.forEach((department, departmentIndex) => {
        rows.push({
            departmentName: department.departmentName,
            departmentNumber: departmentIndex + 1,
            kind: "department",
        });

        const categories = department.categories ?? [];
        const itemsByCategory = new Map<string, ConsolidationSourceItem[]>();
        for (const item of department.items ?? []) {
            const existing = itemsByCategory.get(item.categoryId) ?? [];
            existing.push(item);
            itemsByCategory.set(item.categoryId, existing);
        }

        for (const category of categories) {
            const items = itemsByCategory.get(category.categoryId) ?? [];
            rows.push({ categoryName: category.categoryName, kind: "category" });
            for (const item of items) {
                rows.push({
                    item,
                    kind: "item",
                    voteNumber: department.voteNumber,
                });
            }
            rows.push({
                kind: "category-total",
                q1: category.quarterTotals.q1,
                q2: category.quarterTotals.q2,
                q3: category.quarterTotals.q3,
                q4: category.quarterTotals.q4,
                totalCost: category.totalCost,
            });
        }

        if (categories.length === 0) {
            rows.push({ kind: "empty-category" });
        }

        rows.push({
            kind: "department-total",
            q1: department.quarterTotals?.q1 ?? 0,
            q2: department.quarterTotals?.q2 ?? 0,
            q3: department.quarterTotals?.q3 ?? 0,
            q4: department.quarterTotals?.q4 ?? 0,
            totalCost: department.totalCost ?? 0,
        });
        rows.push(...buildDepartmentTimingPreviewRows(department.timingSections ?? []));
    });
    rows.push(...buildAggregatePreviewRows(snapshot));
    return rows;
}

function parsePreviewAmount(value: unknown): number {
    const parsed = Number(String(value ?? "").replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
}

function getAggregateField(
    snapshot: NonNullable<ConsolidationWorkspaceData["snapshot"]>,
    fieldName: string,
): number {
    const aggregateFields = asRecord(
        asRecord(snapshot.complianceSummary)?.aggregateFields,
    );
    return parsePreviewAmount(aggregateFields?.[fieldName]);
}

function buildAggregatePreviewRows(
    snapshot: NonNullable<ConsolidationWorkspaceData["snapshot"]>,
): Array<Extract<PreviewRow, { kind: "aggregate" }>> {
    return [
        {
            amount:
                snapshot.calculatedTotals.totalCost ??
                getAggregateField(snapshot, "GRAND_TOTAL"),
            kind: "aggregate" as const,
            label: "ANNUAL GRAND Total",
            percent: "100%",
            q1:
                snapshot.calculatedTotals.q1Total ??
                getAggregateField(snapshot, "AGG_Q1_TOTAL"),
            q2:
                snapshot.calculatedTotals.q2Total ??
                getAggregateField(snapshot, "AGG_Q2_TOTAL"),
            q3:
                snapshot.calculatedTotals.q3Total ??
                getAggregateField(snapshot, "AGG_Q3_TOTAL"),
            q4:
                snapshot.calculatedTotals.q4Total ??
                getAggregateField(snapshot, "AGG_Q4_TOTAL"),
        },
        {
            amount: getAggregateField(snapshot, "AGPO_CALCULATED"),
            kind: "aggregate" as const,
            label: "AGPO",
            percent: "30%",
            q1: getAggregateField(snapshot, "AGPO_Q1_TOTAL"),
            q2: getAggregateField(snapshot, "AGPO_Q2_TOTAL"),
            q3: getAggregateField(snapshot, "AGPO_Q3_TOTAL"),
            q4: getAggregateField(snapshot, "AGPO_Q4_TOTAL"),
        },
        {
            amount: getAggregateField(snapshot, "PWD_CALCULATED"),
            kind: "aggregate" as const,
            label: "PWD",
            percent: "2%",
            q1: getAggregateField(snapshot, "PWD_Q1_TOTAL"),
            q2: getAggregateField(snapshot, "PWD_Q2_TOTAL"),
            q3: getAggregateField(snapshot, "PWD_Q3_TOTAL"),
            q4: getAggregateField(snapshot, "PWD_Q4_TOTAL"),
        },
        {
            amount: getAggregateField(snapshot, "LOCAL_CONTENT_CALCULATED"),
            kind: "aggregate" as const,
            label: "LOCAL CONTENT",
            percent: "40%",
            q1: getAggregateField(snapshot, "LOCAL_Q1_TOTAL"),
            q2: getAggregateField(snapshot, "LOCAL_Q2_TOTAL"),
            q3: getAggregateField(snapshot, "LOCAL_Q3_TOTAL"),
            q4: getAggregateField(snapshot, "LOCAL_Q4_TOTAL"),
        },
    ];
}

function renderAggregateCells(row: Extract<PreviewRow, { kind: "aggregate" }>) {
    return (
        <>
            <td className="border-2 border-slate-500 px-2 py-2 text-right">{row.percent}</td>
            <td className="border-2 border-slate-500 px-2 py-2">{row.label}</td>
            <td className="border-2 border-slate-500 px-2 py-2" colSpan={5}></td>
            <td className="border-2 border-slate-500 px-2 py-2 text-right tabular-nums">
                KES {formatAmount(row.amount)}
            </td>
            <td className="border-2 border-slate-500 px-2 py-2"></td>
            <td className="border-2 border-slate-500 px-2 py-2 text-right tabular-nums">
                {formatAmount(row.q1)}
            </td>
            <td className="border-2 border-slate-500 px-2 py-2"></td>
            <td className="border-2 border-slate-500 px-2 py-2 text-right tabular-nums">
                {formatAmount(row.q2)}
            </td>
            <td className="border-2 border-slate-500 px-2 py-2"></td>
            <td className="border-2 border-slate-500 px-2 py-2 text-right tabular-nums">
                {formatAmount(row.q3)}
            </td>
            <td className="border-2 border-slate-500 px-2 py-2"></td>
            <td className="border-2 border-slate-500 px-2 py-2 text-right tabular-nums">
                {formatAmount(row.q4)}
            </td>
        </>
    );
}

function PreviewRowRenderer(props: { row: PreviewRow; rowNumber: number }) {
    switch (props.row.kind) {
        case "aggregate":
            return (
                <tr className="bg-[#fce4d6] font-semibold">
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    {renderAggregateCells(props.row)}
                </tr>
            );
        case "category":
            return (
                <tr>
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className="border-2 border-[#375623] bg-[#70ad47] px-2 py-2 text-center font-bold italic text-slate-950" colSpan={16}>
                        Item Category {props.row.categoryName}
                    </td>
                </tr>
            );
        case "category-total":
            return (
                <tr className="font-bold">
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className="border-2 border-[#375623] bg-[#70ad47] px-2 py-2 text-right" colSpan={7}>
                        Total
                    </td>
                    <PreviewTotalCell>{props.row.totalCost}</PreviewTotalCell>
                    <td className="border-2 border-[#375623] bg-[#70ad47] px-2 py-2"></td>
                    <PreviewTotalCell>{props.row.q1}</PreviewTotalCell>
                    <td className="border-2 border-[#375623] bg-[#70ad47] px-2 py-2"></td>
                    <PreviewTotalCell>{props.row.q2}</PreviewTotalCell>
                    <td className="border-2 border-[#375623] bg-[#70ad47] px-2 py-2"></td>
                    <PreviewTotalCell>{props.row.q3}</PreviewTotalCell>
                    <td className="border-2 border-[#375623] bg-[#70ad47] px-2 py-2"></td>
                    <PreviewTotalCell>{props.row.q4}</PreviewTotalCell>
                </tr>
            );
        case "department":
            return (
                <tr>
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2 text-center font-bold text-white" colSpan={16}>
                        Department {props.row.departmentNumber}: {props.row.departmentName}
                    </td>
                </tr>
            );
        case "department-total":
            return (
                <tr className="font-bold">
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2 text-right text-white" colSpan={7}>
                        Department Total
                    </td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2 text-right tabular-nums text-white">
                        {formatAmount(props.row.totalCost)}
                    </td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2"></td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2 text-right tabular-nums text-white">
                        {formatAmount(props.row.q1)}
                    </td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2"></td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2 text-right tabular-nums text-white">
                        {formatAmount(props.row.q2)}
                    </td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2"></td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2 text-right tabular-nums text-white">
                        {formatAmount(props.row.q3)}
                    </td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2"></td>
                    <td className="border-2 border-[#1f4e79] bg-[#4472c4] px-2 py-2 text-right tabular-nums text-white">
                        {formatAmount(props.row.q4)}
                    </td>
                </tr>
            );
        case "empty-category":
            return (
                <tr>
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className="border-2 border-slate-500 px-2 py-3 text-center text-slate-500" colSpan={16}>
                        No item categories in this finalized source department.
                    </td>
                </tr>
            );
        case "item":
            return (
                <tr>
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <PreviewCell>{props.row.voteNumber}</PreviewCell>
                    <PreviewCell>{props.row.item.itemDescription}</PreviewCell>
                    <PreviewCell>{props.row.item.unitOfMeasurement}</PreviewCell>
                    <PreviewNumberCell>{props.row.item.totalQty}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.unitPrice}</PreviewNumberCell>
                    <PreviewCell>{props.row.item.procurementMethod || "-"}</PreviewCell>
                    <PreviewCell>{props.row.item.sourceOfFunds || "-"}</PreviewCell>
                    <PreviewNumberCell>{props.row.item.totalCost}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q1Qty}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q1Total}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q2Qty}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q2Total}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q3Qty}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q3Total}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q4Qty}</PreviewNumberCell>
                    <PreviewNumberCell>{props.row.item.q4Total}</PreviewNumberCell>
                </tr>
            );
        case "timing-header":
            return (
                <tr>
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className="border-2 border-[#7f6000] bg-[#f6c35b] px-2 py-2 text-center font-bold text-slate-950" colSpan={16}>
                        Department Timing Blocks
                    </td>
                </tr>
            );
        case "timing-labels": {
            const timingLabels = props.row.labels;
            return (
                <tr className="bg-[#fff2cc] font-bold">
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className="border-2 border-[#b8860b] px-2 py-2">Timing Type</td>
                    {timingLabels.slice(0, 9).map((label) => (
                        <td
                            className="border-2 border-[#b8860b] px-2 py-2"
                            colSpan={label === timingLabels[timingLabels.length - 1] ? 7 : 1}
                            key={label}
                        >
                            {label}
                        </td>
                    ))}
                </tr>
            );
        }
        case "timing-row": {
            const timingSection = props.row.section;
            const labels = timingSection.fields.map((field) => field.label);
            const cellColorClass =
                timingSection.type === "planned_timing_block"
                    ? "bg-[#d8c8ff]"
                    : timingSection.type === "actual_timing_block"
                      ? "bg-[#ffc7dc]"
                      : "bg-[#ffd0a8]";
            return (
                <tr>
                    <ExcelRowHeader rowNumber={props.rowNumber} />
                    <td className={`border-2 border-[#b8860b] px-2 py-2 font-semibold ${cellColorClass}`}>
                        {timingSection.label}
                    </td>
                    {timingSection.fields.slice(0, 9).map((field) => (
                        <td
                            className={`border-2 border-[#b8860b] px-2 py-2 ${cellColorClass}`}
                            colSpan={field.label === labels[labels.length - 1] ? 7 : 1}
                            key={`${timingSection.type}-${field.label}`}
                        >
                            {field.value.trim() && field.value.trim() !== "_"
                                ? field.value
                                : "-"}
                        </td>
                    ))}
                </tr>
            );
        }
    }
}

function buildDepartmentTimingPreviewRows(
    sections: ConsolidationTimingSection[],
): PreviewRow[] {
    const defaultFieldLabels = [
        "Time process days",
        "Invite/Advertisement",
        "Bid Opening",
        "Bid Evaluation",
        "Tender Award",
        "Notification of Award",
        "Contract Signing",
        "Total Time for Contract",
        "Date of Completion",
    ];
    const defaultSections: ConsolidationTimingSection[] = [
        {
            fields: defaultFieldLabels.map((label) => ({ label, value: "_" })),
            label: "Planned timing",
            type: "planned_timing_block",
        },
        {
            fields: defaultFieldLabels.map((label) => ({ label, value: "_" })),
            label: "Actual timing",
            type: "actual_timing_block",
        },
        {
            fields: defaultFieldLabels.map((label) => ({ label, value: "_" })),
            label: "Variance timing",
            type: "variance_timing_block",
        },
    ];
    const resolvedSections = sections.length > 0 ? sections : defaultSections;
    const labels =
        resolvedSections[0]?.fields.map((field) => field.label) ?? defaultFieldLabels;

    return [
        { kind: "timing-header" },
        { kind: "timing-labels", labels },
        ...resolvedSections.map((section) => ({
            kind: "timing-row" as const,
            section,
        })),
    ];
}

function PreviewCell(props: { children: ReactNode }) {
    return (
        <td className="border-2 border-slate-500 px-2 py-2 align-top">
            {props.children}
        </td>
    );
}

function PreviewNumberCell(props: { children: number }) {
    return (
        <td className="border-2 border-slate-500 px-2 py-2 text-right tabular-nums">
            {props.children === 0 ? "-" : formatAmount(props.children)}
        </td>
    );
}

function PreviewTotalCell(props: { children: number }) {
    return (
        <td className="border-2 border-[#375623] bg-[#70ad47] px-2 py-2 text-right tabular-nums">
            {formatAmount(props.children)}
        </td>
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

