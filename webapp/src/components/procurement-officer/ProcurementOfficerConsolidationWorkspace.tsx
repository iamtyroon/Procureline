"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
    AlertTriangle,
    ArrowLeft,
    Building2,
    CheckCircle2,
    Clock3,
    Loader2,
    RefreshCw,
    Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CONSOLIDATION_EMPTY_MESSAGE } from "@/lib/procurement-officer/consolidation";
import { formatProcurementFiscalYearLabel } from "@/lib/procurement-officer/dashboard";
import type { ConsolidationBlocklyState } from "./ProcurementOfficerConsolidationBlocklyShell";

const BlocklyShell = dynamic(
    () => import("./ProcurementOfficerConsolidationBlocklyShell"),
    {
        ssr: false,
        loading: () => (
            <div className="flex h-full min-h-[28rem] items-center justify-center rounded-lg border border-border/70 bg-muted/20 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading Blockly shell...
            </div>
        ),
    },
);

interface ConsolidationWorkspaceData {
    draft: null | {
        draftData: {
            notes?: string;
            selectedSourceDepartmentIds?: string[];
        };
        revision: number;
        workspaceState: unknown;
    };
    fiscalYears: {
        options: string[];
        selectedFiscalYear: string;
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
        maximumFractionDigits: 0,
    })}`;
}

function formatDate(value: number | null): string {
    if (!value) {
        return "Approval date unavailable";
    }

    return new Intl.DateTimeFormat("en-KE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(new Date(value));
}

export function ProcurementOfficerConsolidationWorkspace(): JSX.Element {
    const searchParams = useSearchParams();
    const router = useRouter();
    const requestedFiscalYear = searchParams.get("poFiscalYear") ?? undefined;
    const workspace = useQuery(
        api.functions.consolidations.getProcurementOfficerConsolidationWorkspace,
        requestedFiscalYear ? { selectedFiscalYear: requestedFiscalYear } : {},
    ) as ConsolidationWorkspaceData | undefined;
    const saveDraft = useMutation(
        api.functions.consolidations.saveProcurementOfficerConsolidationDraft,
    );
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [notes, setNotes] = useState("");
    const [workspaceState, setWorkspaceState] =
        useState<ConsolidationBlocklyState | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSavedRevision, setLastSavedRevision] = useState<number | null>(null);
    const autosaveTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!workspace) {
            return;
        }
        const savedSourceIds =
            workspace.draft?.draftData.selectedSourceDepartmentIds?.filter((id) =>
                workspace.readiness.readyDepartments.some(
                    (department) => department.departmentId === id,
                ),
            ) ?? workspace.readiness.readyDepartments.map((department) => department.departmentId);
        setSelectedSourceIds(savedSourceIds);
        setNotes(workspace.draft?.draftData.notes ?? "");
        setLastSavedRevision(workspace.draft?.revision ?? null);
        setIsHydrated(false);
        setWorkspaceState(null);
    }, [workspace?.draft?.revision, workspace?.readiness.selectedFiscalYear]);

    const selectedSourceSet = useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);
    const selectedDepartments =
        workspace?.readiness.readyDepartments.filter((department) =>
            selectedSourceSet.has(department.departmentId),
        ) ?? [];
    const blockedCount = workspace?.readiness.blockedDepartments.length ?? 0;
    const readyPercent =
        workspace && workspace.readiness.totalDepartmentCount > 0
            ? Math.round(
                  (workspace.readiness.readyCount /
                      workspace.readiness.totalDepartmentCount) *
                      100,
              )
            : 0;

    const persistDraft = useCallback(async (mode: "autosave" | "manual") => {
        if (!workspace || !workspaceState || !isHydrated) {
            return;
        }

        setIsSaving(true);
        try {
            const result = (await saveDraft({
                expectedRevision: lastSavedRevision ?? undefined,
                fiscalYear: workspace.readiness.selectedFiscalYear,
                notes,
                selectedSourceDepartmentIds: selectedSourceIds,
                workspaceState,
            })) as { draft: { revision: number } | null };
            setLastSavedRevision(result.draft?.revision ?? lastSavedRevision);
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
    }, [
        isHydrated,
        lastSavedRevision,
        notes,
        saveDraft,
        selectedSourceIds,
        workspace,
        workspaceState,
    ]);

    useEffect(() => {
        if (!isHydrated || !workspaceState || !workspace || workspace.readiness.readyCount === 0) {
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
    }, [isHydrated, notes, persistDraft, selectedSourceIds, workspace, workspaceState]);

    if (!workspace) {
        return (
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-none items-center justify-center px-4 py-8">
                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background px-5 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading consolidation workspace...
                </div>
            </div>
        );
    }

    function replaceFiscalYear(nextFiscalYear: string): void {
        const next = new URLSearchParams(searchParams.toString());
        next.set("poFiscalYear", nextFiscalYear);
        router.replace(`/po/consolidation?${next.toString()}`);
    }

    const noActiveDepartments = !workspace.readiness.hasActiveDepartments;
    const noApprovedPlans =
        workspace.readiness.hasActiveDepartments && workspace.readiness.readyCount === 0;

    return (
        <div className="min-h-[calc(100vh-4rem)] bg-muted/15">
            <div className="mx-auto flex w-full max-w-none flex-col gap-4 px-4 py-4 xl:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/po">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Dashboard
                            </Link>
                        </Button>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-semibold tracking-tight text-foreground">
                                    Consolidation Workspace
                                </h1>
                                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-900">
                                    Live workspace
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {workspace.readiness.readyCount} of {workspace.readiness.totalDepartmentCount} departments ready for {workspace.readiness.selectedFiscalYearLabel}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {workspace.fiscalYears.options.map((fiscalYear) => (
                            <Button
                                key={fiscalYear}
                                type="button"
                                size="sm"
                                variant={
                                    fiscalYear === workspace.readiness.selectedFiscalYear
                                        ? "default"
                                        : "outline"
                                }
                                onClick={() => replaceFiscalYear(fiscalYear)}
                            >
                                {formatProcurementFiscalYearLabel(fiscalYear)}
                            </Button>
                        ))}
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => void persistDraft("manual")}
                            disabled={
                                isSaving ||
                                !isHydrated ||
                                workspace.readiness.readyCount === 0
                            }
                        >
                            {isSaving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="mr-2 h-4 w-4" />
                            )}
                            Save
                        </Button>
                    </div>
                </div>

                {noActiveDepartments ? (
                    <WorkspaceStatePanel
                        icon={<Building2 className="h-7 w-7" />}
                        title="No active departments configured"
                        body="Create departments before opening consolidation. There are no submissions to approve yet."
                        ctaHref="/po/departments"
                        ctaLabel="Open department setup"
                    />
                ) : noApprovedPlans ? (
                    <WorkspaceStatePanel
                        icon={<AlertTriangle className="h-7 w-7" />}
                        title="Approved plans required"
                        body={CONSOLIDATION_EMPTY_MESSAGE}
                        ctaHref="/po"
                        ctaLabel="Review submissions"
                    />
                ) : (
                    <>
                        {blockedCount > 0 ? (
                            <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                                <div className="font-semibold">
                                    {blockedCount} department{blockedCount === 1 ? "" : "s"} not approved yet
                                </div>
                                <div className="mt-1">
                                    {workspace.readiness.blockedDepartments
                                        .slice(0, 4)
                                        .map((department) => `${department.departmentName}: ${department.reasonLabel}`)
                                        .join("; ")}
                                </div>
                            </div>
                        ) : null}

                        <div className="grid min-h-[42rem] gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
                            <aside className="rounded-lg border border-border/70 bg-background p-3">
                                <div className="mb-3 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-sm font-semibold text-foreground">
                                            Department sources
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Approved only
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {workspace.readiness.readyCount}/{workspace.readiness.totalDepartmentCount}
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    {workspace.readiness.readyDepartments.map((department) => {
                                        const selected = selectedSourceSet.has(department.departmentId);
                                        return (
                                            <button
                                                key={department.departmentId}
                                                className={cn(
                                                    "w-full rounded-lg border px-3 py-2 text-left transition",
                                                    selected
                                                        ? "border-emerald-400 bg-emerald-50 text-emerald-950"
                                                        : "border-border/70 bg-background hover:border-primary/30",
                                                )}
                                                type="button"
                                                onClick={() =>
                                                    setSelectedSourceIds((current) =>
                                                        selected
                                                            ? current.filter((id) => id !== department.departmentId)
                                                            : [...current, department.departmentId],
                                                    )
                                                }
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold">
                                                        {department.departmentName}
                                                    </span>
                                                    {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                                                </div>
                                                <div className="mt-1 text-xs text-muted-foreground">
                                                    Vote {department.voteNumber} · {department.itemCount} items
                                                </div>
                                                <div className="mt-1 text-xs font-medium">
                                                    {formatKes(department.estimatedBudgetUsed)}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {blockedCount > 0 ? (
                                    <div className="mt-4 border-t border-border/70 pt-3">
                                        <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                                            Not ready
                                        </h3>
                                        <div className="mt-2 space-y-2">
                                            {workspace.readiness.blockedDepartments.map((department) => (
                                                <div
                                                    key={department.departmentId}
                                                    className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2"
                                                >
                                                    <div className="text-xs font-semibold text-foreground">
                                                        {department.departmentName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {department.reasonLabel}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </aside>

                            <main className="rounded-lg border border-border/70 bg-background p-3">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-sm font-semibold text-foreground">
                                            Blockly consolidation canvas
                                        </h2>
                                        <p className="text-xs text-muted-foreground">
                                            Shell only. Item aggregation, finalization, and export remain later stories.
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="gap-1">
                                        <Clock3 className="h-3.5 w-3.5" />
                                        {isHydrated ? "Autosave ready" : "Hydrating"}
                                    </Badge>
                                </div>
                                <BlocklyShell
                                    key={`${workspace.readiness.selectedFiscalYear}-${workspace.draft?.revision ?? "new"}`}
                                    initialWorkspaceState={workspace.draft?.workspaceState ?? null}
                                    onHydrated={() => setIsHydrated(true)}
                                    onWorkspaceChange={setWorkspaceState}
                                    sourceDepartments={selectedDepartments.map((department) => ({
                                        departmentId: department.departmentId,
                                        departmentName: department.departmentName,
                                    }))}
                                    userId={workspace.user.userId}
                                />
                            </main>

                            <aside className="space-y-4 rounded-lg border border-border/70 bg-background p-3">
                                <div>
                                    <h2 className="text-sm font-semibold text-foreground">
                                        Totals and readiness
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        Source metadata only
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <Metric label="Ready departments" value={`${workspace.readiness.readyCount} / ${workspace.readiness.totalDepartmentCount}`} />
                                    <Progress value={readyPercent} />
                                    <Metric label="Approved source total" value={formatKes(workspace.readiness.totalBudget)} />
                                    <Metric label="Approved source items" value={String(workspace.readiness.totalItemCount)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                                        Draft notes
                                    </label>
                                    <Textarea
                                        value={notes}
                                        onChange={(event) => setNotes(event.target.value)}
                                        placeholder="Internal consolidation notes"
                                        className="min-h-28 resize-none"
                                    />
                                </div>
                                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                                    Draft revision: {lastSavedRevision ?? "new"}
                                    <br />
                                    Selected sources: {selectedSourceIds.length}
                                    <br />
                                    Latest approval: {formatDate(
                                        Math.max(
                                            0,
                                            ...workspace.readiness.readyDepartments.map(
                                                (department) => department.approvedAt ?? 0,
                                            ),
                                        ) || null,
                                    )}
                                </div>
                            </aside>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Metric(props: { label: string; value: string }) {
    return (
        <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
            <div className="text-xs text-muted-foreground">{props.label}</div>
            <div className="mt-1 text-lg font-semibold text-foreground">
                {props.value}
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
        <div className="flex min-h-[32rem] items-center justify-center rounded-lg border border-border/70 bg-background p-6">
            <div className="max-w-lg text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {props.icon}
                </div>
                <h2 className="mt-4 text-xl font-semibold text-foreground">
                    {props.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {props.body}
                </p>
                <Button className="mt-5" asChild>
                    <Link href={props.ctaHref}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {props.ctaLabel}
                    </Link>
                </Button>
            </div>
        </div>
    );
}
