"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Building2, Loader2, Save, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode, RefObject } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CONSOLIDATION_EMPTY_MESSAGE } from "@/lib/procurement-officer/consolidation";
import type {
    ConsolidationBlocklyState,
    ConsolidationSourceDepartment,
    ConsolidationSourceItem,
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
    const [workspaceState, setWorkspaceState] =
        useState<ConsolidationBlocklyState | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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
                        Review university-wide plans
                    </p>
                </div>

                <div className="text-center">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">
                        Grand Total
                    </div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 dark:drop-shadow-[0_0_10px_rgba(52,211,153,0.28)]">
                        {formatKes(workspace.readiness.totalBudget)}
                    </div>
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
                            setWorkspaceState(state);
                            if (state.editorMetadata.saveSource !== "workspace_seed") {
                                setIsDirty(true);
                            }
                        }}
                        sourceDepartments={sourceDepartments}
                        userId={workspace.user.userId}
                    />
                </div>
                <ConsolidationDepartmentDetailsPanel department={selectedDepartment} />
            </div>
        </div>
    );
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
    const viewportHeight = 520;
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
                    <div className="border-b border-border/80 bg-card p-4 shadow-sm dark:border-[#243041] dark:bg-[#111827]">
                        <div className="text-sm font-semibold text-foreground">
                            {props.department.departmentName}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            Vote {props.department.voteNumber} -{" "}
                            {props.department.categoryCount ?? categories.length} categories -{" "}
                            {props.department.itemCount} items
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <SummaryMetric
                                label="Total"
                                value={formatKes(props.department.totalCost ?? 0)}
                            />
                            <SummaryMetric
                                label="Budget"
                                value={formatKes(props.department.estimatedBudgetUsed)}
                            />
                            <SummaryMetric
                                label="Q1"
                                value={formatKes(props.department.quarterTotals?.q1 ?? 0)}
                            />
                            <SummaryMetric
                                label="Q2"
                                value={formatKes(props.department.quarterTotals?.q2 ?? 0)}
                            />
                            <SummaryMetric
                                label="Q3"
                                value={formatKes(props.department.quarterTotals?.q3 ?? 0)}
                            />
                            <SummaryMetric
                                label="Q4"
                                value={formatKes(props.department.quarterTotals?.q4 ?? 0)}
                            />
                        </div>
                    </div>

                    <div className="border-b border-border/80 bg-card p-3 shadow-sm dark:border-[#243041] dark:bg-[#111827]">
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
    return (
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
            <div
                ref={props.scrollContainerRef}
                className="h-full overflow-y-auto"
                style={{ maxHeight: props.viewportHeight }}
                onScroll={(event) => {
                    props.onScrollTopChange(event.currentTarget.scrollTop);
                }}
            >
                <div
                    className="relative"
                    style={{ height: props.items.length * props.rowHeight }}
                >
                    {props.visibleItems.map((item, index) => (
                        <ItemRow
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
            </div>
        </div>
    );
}

function ItemRow(props: {
    item: ConsolidationSourceItem;
    rowHeight: number;
    top: number;
}) {
    return (
        <div
            className="absolute left-0 right-0 grid min-w-[68rem] grid-cols-[1.1fr_1.8fr_0.7fr_0.7fr_0.7fr_0.7fr_0.7fr_0.8fr_0.8fr_0.8fr] gap-2 border-b border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground shadow-[0_1px_0_rgba(15,23,42,0.04)] odd:bg-muted/15 dark:border-[#243041]/80 dark:bg-[#0F172A] dark:text-slate-300 dark:odd:bg-[#111827]"
            style={{ height: props.rowHeight, top: props.top }}
        >
            <span className="truncate" title={props.item.categoryName}>
                {props.item.categoryName}
            </span>
            <span className="truncate font-medium text-foreground" title={props.item.itemDescription}>
                {props.item.itemDescription}
            </span>
            <span>{formatQty(props.item.q1Qty)}</span>
            <span>{formatQty(props.item.q2Qty)}</span>
            <span>{formatQty(props.item.q3Qty)}</span>
            <span>{formatQty(props.item.q4Qty)}</span>
            <span>{formatQty(props.item.totalQty)}</span>
            <span>{formatAmount(props.item.unitPrice)}</span>
            <span className="truncate" title={props.item.procurementMethod}>
                {props.item.procurementMethod || "-"}
            </span>
            <span className="font-semibold">{formatAmount(props.item.totalCost)}</span>
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
