"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Building2, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CONSOLIDATION_EMPTY_MESSAGE } from "@/lib/procurement-officer/consolidation";
import type {
    ConsolidationBlocklyState,
    ConsolidationSourceDepartment,
} from "./ProcurementOfficerConsolidationBlocklyShell";

const BlocklyShell = dynamic(
    () => import("./ProcurementOfficerConsolidationBlocklyShell"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full min-h-[30rem] items-center justify-center bg-white text-sm text-slate-500">
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

function createCompactConsolidationWorkspaceState(args: {
    fiscalYear: string;
    selectedSourceDepartmentIds: readonly string[];
    workspaceState: ConsolidationBlocklyState;
}): ConsolidationBlocklyState {
    const workspaceJson = parseWorkspaceJson(args.workspaceState.workspaceJson);
    const aggregateBlock = findAggregateBlock(workspaceJson);
    const departmentStubChain = createDepartmentStubChain(
        args.selectedSourceDepartmentIds,
    );
    const compactAggregateBlock: Record<string, unknown> = {
        fields: {
            FINANCIAL_YEAR: args.fiscalYear,
            ...(asRecord(aggregateBlock?.fields) ?? {}),
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
    draft: null | {
        draftData: {
            notes?: string;
            selectedSourceDepartmentIds?: string[];
        };
        revision: number;
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
    const [workspaceState, setWorkspaceState] =
        useState<ConsolidationBlocklyState | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedRevision, setLastSavedRevision] = useState<number | null>(null);
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
    }, [workspace?.readiness.selectedFiscalYear]);

    const sourceDepartments: ConsolidationSourceDepartment[] = useMemo(
        () =>
            workspace?.readiness.readyDepartments.map((department) => ({
                departmentId: department.departmentId,
                departmentName: department.departmentName,
                estimatedBudgetUsed: department.estimatedBudgetUsed,
                itemCount: department.itemCount,
                voteNumber: department.voteNumber,
                workspaceState: department.workspaceState ?? null,
            })) ?? [],
        [workspace?.readiness.readyDepartments],
    );

    const persistDraft = useCallback(
        async (mode: "autosave" | "manual") => {
            if (!workspace || !workspaceState) {
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
        ],
    );

    useEffect(() => {
        if (!isDirty || !workspaceState || !workspace) {
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
    }, [isDirty, persistDraft, workspace, workspaceState]);

    if (!workspace) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-white">
                <div className="flex items-center gap-3 rounded-md border border-slate-200 px-5 py-4 text-sm text-slate-500">
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
        <div className="flex h-[calc(100vh-4rem)] min-h-[42rem] flex-col overflow-hidden bg-white">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                <div className="min-w-0">
                    <h1 className="text-base font-semibold text-slate-950">
                        Master Consolidation Plan
                    </h1>
                    <p className="text-sm text-slate-500">
                        Review university-wide plans
                    </p>
                </div>

                <div className="text-center">
                    <div className="text-xs font-semibold uppercase text-slate-500">
                        Grand Total
                    </div>
                    <div className="text-lg font-bold text-emerald-600">
                        {formatKes(workspace.readiness.totalBudget)}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                        <Link href="/po">Exit</Link>
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => void persistDraft("manual")}
                        disabled={isSaving || !workspaceState}
                    >
                        {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Draft
                    </Button>
                </div>
            </div>

            {blockedDepartments.length > 0 ? (
                <div className="border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-950">
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

            <div className="min-h-0 flex-1">
                <BlocklyShell
                    key={workspace.readiness.selectedFiscalYear}
                    fiscalYear={workspace.readiness.selectedFiscalYear}
                    initialWorkspaceState={workspace.draft?.workspaceState ?? null}
                    onWorkspaceChange={(state) => {
                        setWorkspaceState(state);
                        if (state.editorMetadata.saveSource !== "workspace_seed") {
                            setIsDirty(true);
                        }
                    }}
                    sourceDepartments={sourceDepartments}
                    userId={workspace.user.userId}
                />
            </div>
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
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-white p-6">
            <div className="max-w-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                    {props.icon}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-950">
                    {props.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{props.body}</p>
                <Button className="mt-5" asChild>
                    <Link href={props.ctaHref}>{props.ctaLabel}</Link>
                </Button>
            </div>
        </div>
    );
}
