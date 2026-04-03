"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, FileDown, PackagePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlocklyBudgetHeader } from "@/src/components/blockly/BlocklyBudgetHeader";
import { BlocklyComplianceSummary } from "@/src/components/blockly/BlocklyComplianceSummary";
import { BlocklyLoadingSkeleton } from "@/src/components/blockly/BlocklyLoadingSkeleton";
import { BlocklyToolboxRail } from "@/src/components/blockly/BlocklyToolboxRail";
import type { BlocklyWorkspaceChangePayload } from "@/src/components/blockly/BlocklyWorkspace";
import { buildPlanningWorkspacePresentation } from "@/lib/blockly/editor-contract";
import type { BlocklyWorkspaceRecord } from "@/lib/blockly/blockly-serialization";
import { getPersistedPlanSummaryForWorkspaceSummaryChange } from "@/lib/blockly/du-editor-fallback";
import { buildDepartmentUserToolbox } from "@/lib/blockly/du-toolbox";
import {
    calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord,
    getDepartmentUserReservedSubmitState,
    getDepartmentUserWorkspaceAnnouncement,
    mapDepartmentUserBudgetMeterState,
    resolveDepartmentUserDisplayedWorkspaceSummary,
    type DepartmentUserBudgetMeterState,
    type DepartmentUserPersistedPlanSummary,
    type DepartmentUserWorkspaceSummary,
} from "@/lib/blockly/du-workspace-calculations";
import { buildDepartmentUserWorkspaceDraftSaveInput } from "@/lib/blockly/workspace-save";
import {
    collectDepartmentUserWorkspaceSourceUsage,
    type DepartmentUserWorkspaceSourceUsage,
} from "@/lib/blockly/workspace-catalog-identity";
import { calculateProcurementComplianceSnapshot } from "@/lib/procurement/compliance";
import { PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE } from "@/lib/procurement-officer/items";
import type { CategoryIconName } from "@/lib/procurement-officer/categories";
import styles from "./BlocklyWorkspace.module.css";

const LazyBlocklyWorkspace = dynamic(
    () =>
        import("./BlocklyWorkspace").then((module) => ({
            default: module.BlocklyWorkspace,
        })),
    {
        loading: () => <BlocklyLoadingSkeleton />,
        ssr: false,
    },
);

export function BlocklyEditor(props: {
    accessMode: "editable" | "read_only_grace" | null;
    actor: "department_user" | "procurement_officer";
    actorLabel: string;
    categories: Array<{
        color?: string | null;
        id: string;
        icon?: CategoryIconName | null;
        isActive: boolean;
        name: string;
        sortOrder: number;
    }>;
    department: {
        budgetAllocation: number | null;
        code: string;
        id: string;
        name: string;
        voteNumber: string;
    };
    currentUserId: string;
    fiscalYear: string;
    items: Array<{
        categoryId: string;
        complianceFlags?: readonly string[] | null;
        description: string | null;
        id: string;
        isActive: boolean;
        lastPriceChangedAt: number | null;
        name: string;
        procurementMethod: string | null;
        sortOrder: number;
        sourceOfFunds: string | null;
        unitOfMeasurement: string | null;
        unitPrice: number | null;
    }>;
    mode: "edit" | "view";
    modeIndicatorLabel: string | null;
    planId: string;
    persistedPlanSummary: DepartmentUserPersistedPlanSummary;
    selectedCategoryIds: string[];
    subtitle: string;
    unavailableCategories: Array<{
        id: string;
        name: string;
        reason: string;
    }>;
    workspaceState: BlocklyWorkspaceRecord | null;
}) {
    const saveWorkspaceDraft = useMutation(api.functions.plans.saveDepartmentUserWorkspaceDraft);
    const [searchQuery, setSearchQuery] = useState("");
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const initialSourceUsage = useMemo(
        () =>
            collectDepartmentUserWorkspaceSourceUsage({
                categories: props.categories.map((category) => ({
                    id: category.id,
                    name: category.name,
                })),
                items: props.items,
                workspaceState: props.workspaceState,
            }),
        [props.categories, props.items, props.workspaceState],
    );
    const [sourceUsage, setSourceUsage] = useState<DepartmentUserWorkspaceSourceUsage>(
        initialSourceUsage,
    );
    const toolbox = useMemo(
        () =>
            buildDepartmentUserToolbox({
                categories: props.categories,
                department: {
                    budgetAllocation: props.department.budgetAllocation,
                    departmentId: props.department.id,
                    departmentName: props.department.name,
                    voteNumber: props.department.voteNumber,
                },
                editorMode: props.mode,
                items: props.items,
                preserveUnavailableRequestedCategories: true,
                searchQuery: deferredSearchQuery,
                selectedCategoryIds: props.selectedCategoryIds,
                sourceUsage,
            }),
        [
            deferredSearchQuery,
            props.categories,
            props.department,
            props.items,
            props.mode,
            props.selectedCategoryIds,
            sourceUsage,
        ],
    );
    const initialSummary = useMemo(
        () =>
            calculateDepartmentUserWorkspaceSummaryFromWorkspaceRecord({
                items: props.items,
                totalBudget: props.department.budgetAllocation,
                workspaceState: props.workspaceState,
            }),
        [props.department.budgetAllocation, props.items, props.workspaceState],
    );
    const preferredInitialSummary = useMemo(
        () =>
            resolveDepartmentUserDisplayedWorkspaceSummary({
                persistedPlanSummary: props.persistedPlanSummary,
                totalBudget: props.department.budgetAllocation,
                workspaceState: props.workspaceState,
                workspaceSummary: initialSummary,
            }),
        [
            initialSummary,
            props.department.budgetAllocation,
            props.persistedPlanSummary,
            props.workspaceState,
        ],
    );
    const [workspaceSummary, setWorkspaceSummary] = useState<DepartmentUserWorkspaceSummary | null>(
        preferredInitialSummary,
    );
    const [budgetState, setBudgetState] = useState<DepartmentUserBudgetMeterState>(
        () =>
            preferredInitialSummary?.budgetState ??
            mapDepartmentUserBudgetMeterState({
                totalBudget: props.department.budgetAllocation,
                usedAmount: 0,
            }),
    );
    const [liveAnnouncement, setLiveAnnouncement] = useState("");
    const [saveState, setSaveState] = useState<"error" | "idle" | "saved" | "saving">("idle");
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(
        props.workspaceState?.editorMetadata.lastSavedAt ?? null,
    );
    const latestLocalWorkspaceRevisionRef = useRef(
        props.workspaceState?.editorMetadata.revision ?? 0,
    );
    const previousPlanIdRef = useRef<string | null>(null);
    const previousResetKeyRef = useRef<string | null>(null);
    const previousAnnouncementKeyRef = useRef<string | null>(null);
    const previousItemsRef = useRef(props.items);
    const allowEditModePersistedFallbackRef = useRef(true);
    const presentation = useMemo(
        () =>
            buildPlanningWorkspacePresentation({
                actor: props.actor,
                actorLabel: props.actorLabel,
                mode: props.mode,
            }),
        [props.actor, props.actorLabel, props.mode],
    );

    useEffect(() => {
        const incomingRevision = props.workspaceState?.editorMetadata.revision ?? 0;
        const isPlanSwitch = previousPlanIdRef.current !== props.planId;
        const resetKey = `${props.planId}:${props.workspaceState?.editorMetadata.revision ?? 0}:${props.workspaceState?.editorMetadata.lastSavedAt ?? 0}:${props.department.budgetAllocation ?? "null"}`;
        if (previousResetKeyRef.current === resetKey) {
            return;
        }
        if (!isPlanSwitch && incomingRevision < latestLocalWorkspaceRevisionRef.current) {
            return;
        }

        previousPlanIdRef.current = props.planId;
        previousResetKeyRef.current = resetKey;
        latestLocalWorkspaceRevisionRef.current = incomingRevision;
        allowEditModePersistedFallbackRef.current = true;
        setSourceUsage(initialSourceUsage);
        setSearchQuery("");
        setWorkspaceSummary(preferredInitialSummary);
        setBudgetState(
            preferredInitialSummary?.budgetState ??
                mapDepartmentUserBudgetMeterState({
                    totalBudget: props.department.budgetAllocation,
                    usedAmount: 0,
                }),
        );
        setLastSavedAt(props.workspaceState?.editorMetadata.lastSavedAt ?? null);
        previousAnnouncementKeyRef.current = preferredInitialSummary
            ? getDepartmentUserWorkspaceAnnouncement(preferredInitialSummary).key
            : null;
    }, [
        initialSourceUsage,
        preferredInitialSummary,
        props.department.budgetAllocation,
        props.planId,
        props.workspaceState,
    ]);

    useEffect(() => {
        const previousItems = previousItemsRef.current;
        previousItemsRef.current = props.items;

        if (previousItems === props.items) {
            return;
        }

        const selectedCategoryIds = new Set(props.selectedCategoryIds);
        const previousItemsById = new Map(
            previousItems.map((item) => [item.id, item] as const),
        );
        const hasSelectedCatalogPriceChange = props.items.some((item) => {
            const previousItem = previousItemsById.get(item.id);
            if (!previousItem) {
                return false;
            }

            const isSelectedCatalogItem =
                selectedCategoryIds.has(item.categoryId) ||
                selectedCategoryIds.has(previousItem.categoryId);
            if (!isSelectedCatalogItem) {
                return false;
            }

            return (
                (previousItem.unitPrice ?? null) !== (item.unitPrice ?? null) ||
                (previousItem.lastPriceChangedAt ?? null) !==
                    (item.lastPriceChangedAt ?? null)
            );
        });

        if (hasSelectedCatalogPriceChange) {
            toast.info(PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE);
        }
    }, [props.items, props.selectedCategoryIds]);

    useEffect(() => {
        const announcement = getDepartmentUserWorkspaceAnnouncement(workspaceSummary);
        if (previousAnnouncementKeyRef.current === null) {
            previousAnnouncementKeyRef.current = announcement.key;
            return;
        }

        if (previousAnnouncementKeyRef.current === announcement.key) {
            return;
        }

        previousAnnouncementKeyRef.current = announcement.key;
        setLiveAnnouncement(announcement.message);
    }, [workspaceSummary]);

    async function handleWorkspaceChange(payload: BlocklyWorkspaceChangePayload): Promise<void> {
        latestLocalWorkspaceRevisionRef.current = Math.max(
            latestLocalWorkspaceRevisionRef.current,
            payload.workspaceState.editorMetadata.revision,
        );
        allowEditModePersistedFallbackRef.current = false;
        const displayedSummary = resolveDepartmentUserDisplayedWorkspaceSummary({
            persistedPlanSummary: props.mode === "view" ? props.persistedPlanSummary : null,
            totalBudget: props.department.budgetAllocation,
            workspaceState: payload.workspaceState,
            workspaceSummary: payload.summary,
        });
        setWorkspaceSummary(displayedSummary);
        setBudgetState(
            displayedSummary?.budgetState ??
                mapDepartmentUserBudgetMeterState({
                    totalBudget: props.department.budgetAllocation,
                    usedAmount: 0,
                }),
        );
        if (props.mode !== "edit") {
            return;
        }

        setSaveState("saving");
        try {
            const result = await saveWorkspaceDraft(
                buildDepartmentUserWorkspaceDraftSaveInput({
                    categories: props.categories,
                    planId: props.planId,
                    selectedCategoryIds: toolbox.sanitizedCategoryIds,
                    summary: displayedSummary,
                    workspaceState: payload.workspaceState,
                }),
            );
            setLastSavedAt(result.savedAt);
            setSaveState("saved");
        } catch {
            setSaveState("error");
            toast.error("Draft workspace sync failed. Your current session is still open.");
        }
    }

    function handleReservedAction(message: string): void {
        toast(message);
    }

    const complianceState =
        workspaceSummary?.complianceState ??
        calculateProcurementComplianceSnapshot({
            items: [],
            totalEligibleSpend: 0,
        });
    const submitState = getDepartmentUserReservedSubmitState({
        budgetState,
        mode: props.mode,
    });

    return (
        <div className="space-y-4">
            <div aria-live="polite" className="sr-only">
                {liveAnnouncement}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card className="rounded-[28px] border-border/70 shadow-sm">
                    <CardHeader className="gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Badge className="rounded-full bg-primary text-primary-foreground hover:bg-primary">
                                        {presentation.badgeLabel}
                                    </Badge>
                                    <Badge variant="secondary" className="rounded-full">
                                        {presentation.actorBadgeLabel}
                                    </Badge>
                                    <Badge variant="outline" className="rounded-full">
                                        FY {props.fiscalYear}
                                    </Badge>
                                    {props.modeIndicatorLabel ?? presentation.modeIndicatorLabel ? (
                                        <Badge variant="outline" className="rounded-full">
                                            {props.modeIndicatorLabel ?? presentation.modeIndicatorLabel}
                                        </Badge>
                                    ) : null}
                                    {props.mode === "view" ? (
                                        <Badge
                                            variant="outline"
                                            className="rounded-full border-amber-300 bg-amber-50 text-amber-800"
                                        >
                                            Read-only
                                        </Badge>
                                    ) : null}
                                </div>
                                <div>
                                    <CardTitle className="text-3xl tracking-[-0.05em] text-foreground">
                                        {props.department.name}
                                    </CardTitle>
                                    <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                                        {props.subtitle}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <Badge variant="outline" className="rounded-full">
                                        {saveState === "saving"
                                            ? "Saving draft..."
                                            : saveState === "saved"
                                              ? lastSavedAt
                                                  ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                                                  : "Saved"
                                              : saveState === "error"
                                                ? "Save failed"
                                                : "Draft open"}
                                    </Badge>
                                    <Button asChild type="button" variant="outline">
                                        <Link href="/du">
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Exit
                                        </Link>
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            startTransition(() =>
                                                handleReservedAction(
                                                    "Item request handoff stays reserved until Story 5.5 lands.",
                                                ),
                                            )
                                        }
                                        type="button"
                                        variant="outline"
                                    >
                                        <PackagePlus className="mr-2 h-4 w-4" />
                                        Request Item
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            startTransition(() =>
                                                handleReservedAction(
                                                    "Export handoff stays reserved until the export stories land.",
                                                ),
                                            )
                                        }
                                        type="button"
                                        variant="outline"
                                    >
                                        <FileDown className="mr-2 h-4 w-4" />
                                        Export
                                    </Button>
                                    <Button
                                        disabled={submitState.disabled}
                                        type="button"
                                        variant={
                                            submitState.label === "Submit Reserved"
                                                ? "default"
                                                : "outline"
                                        }
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        {submitState.label}
                                    </Button>
                                </div>
                                <p className="max-w-md text-right text-xs text-muted-foreground">
                                    {submitState.reason}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="space-y-4">
                    <BlocklyBudgetHeader budgetState={budgetState} />
                    <BlocklyComplianceSummary complianceState={complianceState} />
                </div>
            </div>

            {props.mode === "view" ? (
                <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-900">
                    <AlertTitle>Read-only planning surface</AlertTitle>
                    <AlertDescription>
                        {presentation.readOnlyMessage}
                    </AlertDescription>
                </Alert>
            ) : null}

            {props.unavailableCategories.length > 0 ? (
                <Alert className="rounded-2xl border-border/70 bg-muted/30">
                    <AlertTitle>Unavailable selected categories</AlertTitle>
                    <AlertDescription>
                        {props.unavailableCategories
                            .map((category) => `${category.name}: ${category.reason}`)
                            .join(" ")}
                    </AlertDescription>
                </Alert>
            ) : null}

            <div className={styles.editorGrid}>
                <Card className={styles.toolboxRail}>
                    <CardHeader className="space-y-3">
                        <Badge variant="outline" className="w-fit rounded-full">
                            Toolbox contract
                        </Badge>
                        <CardTitle className="text-xl tracking-[-0.04em]">
                            Selected categories
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <BlocklyToolboxRail
                            categories={toolbox.categoryStates}
                            department={{
                                budgetAllocation: props.department.budgetAllocation,
                                name: props.department.name,
                                voteNumber: props.department.voteNumber,
                            }}
                            mode={props.mode}
                            onSearchQueryChange={setSearchQuery}
                            searchQuery={searchQuery}
                        />
                    </CardContent>
                </Card>

                <LazyBlocklyWorkspace
                    budgetAllocation={props.department.budgetAllocation}
                    categories={props.categories}
                    currentUserId={props.currentUserId}
                    editorMode={props.mode}
                    items={props.items}
                    onBudgetStateChange={(nextBudgetState) => {
                        if (props.mode !== "view") {
                            setBudgetState(nextBudgetState);
                            return;
                        }

                        setBudgetState(
                            resolveDepartmentUserDisplayedWorkspaceSummary({
                                persistedPlanSummary: props.persistedPlanSummary,
                                totalBudget: props.department.budgetAllocation,
                                workspaceState: props.workspaceState,
                                workspaceSummary,
                            })?.budgetState ?? nextBudgetState,
                        );
                    }}
                    onWorkspaceChange={(payload) => {
                        void handleWorkspaceChange(payload);
                    }}
                    onWorkspaceStructureChange={(nextSourceUsage) => {
                        setSourceUsage(nextSourceUsage);
                    }}
                    onWorkspaceSummaryChange={(nextSummary) => {
                        const persistedPlanSummary =
                            getPersistedPlanSummaryForWorkspaceSummaryChange({
                                allowEditModePersistedFallback:
                                    allowEditModePersistedFallbackRef.current,
                                mode: props.mode,
                                persistedPlanSummary: props.persistedPlanSummary,
                            });
                        allowEditModePersistedFallbackRef.current = false;

                        setWorkspaceSummary(
                            resolveDepartmentUserDisplayedWorkspaceSummary({
                                persistedPlanSummary,
                                totalBudget: props.department.budgetAllocation,
                                workspaceState: props.workspaceState,
                                workspaceSummary: nextSummary,
                            }),
                        );
                    }}
                    planId={props.planId}
                    selectedCategoryIds={toolbox.sanitizedCategoryIds}
                    toolboxDefinition={toolbox.toolboxDefinition}
                    workspaceState={props.workspaceState}
                />
            </div>
        </div>
    );
}
