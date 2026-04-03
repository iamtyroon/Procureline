"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, FileDown, Layers3, PackagePlus, Send } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BlocklyBudgetHeader } from "@/src/components/blockly/BlocklyBudgetHeader";
import { BlocklyLoadingSkeleton } from "@/src/components/blockly/BlocklyLoadingSkeleton";
import type { BlocklyWorkspaceChangePayload } from "@/src/components/blockly/BlocklyWorkspace";
import { buildPlanningWorkspacePresentation } from "@/lib/blockly/editor-contract";
import type { BlocklyWorkspaceRecord } from "@/lib/blockly/blockly-serialization";
import { buildDepartmentUserToolbox } from "@/lib/blockly/du-toolbox";
import {
    mapDepartmentUserBudgetMeterState,
    type DepartmentUserBudgetMeterState,
} from "@/lib/blockly/du-workspace-calculations";
import { buildDepartmentUserWorkspaceDraftSaveInput } from "@/lib/blockly/workspace-save";
import { PROCUREMENT_ITEM_PRICE_CHANGE_NOTICE } from "@/lib/procurement-officer/items";
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
        id: string;
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
                items: props.items,
                preserveUnavailableRequestedCategories: true,
                selectedCategoryIds: props.selectedCategoryIds,
            }),
        [props.categories, props.department, props.items, props.selectedCategoryIds],
    );
    const [budgetState, setBudgetState] = useState<DepartmentUserBudgetMeterState>(() =>
        mapDepartmentUserBudgetMeterState({
            totalBudget: props.department.budgetAllocation,
            usedAmount: 0,
        }),
    );
    const [saveState, setSaveState] = useState<"error" | "idle" | "saved" | "saving">("idle");
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(
        props.workspaceState?.editorMetadata.lastSavedAt ?? null,
    );
    const previousItemsRef = useRef(props.items);
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

    async function handleWorkspaceChange(payload: BlocklyWorkspaceChangePayload): Promise<void> {
        setBudgetState(
            mapDepartmentUserBudgetMeterState({
                totalBudget: props.department.budgetAllocation,
                usedAmount: payload.rollup?.departmentTotal ?? 0,
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
                    rollup: payload.rollup,
                    selectedCategoryIds: toolbox.sanitizedCategoryIds,
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

    return (
        <div className="space-y-4">
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
                                        <Badge variant="outline" className="rounded-full border-amber-300 bg-amber-50 text-amber-800">
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
                                    onClick={() =>
                                        startTransition(() =>
                                            handleReservedAction(
                                                "Submission stays reserved until Story 6.1 completes the plan-submission flow.",
                                            ),
                                        )
                                    }
                                    type="button"
                                    variant={props.mode === "edit" ? "default" : "outline"}
                                >
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <BlocklyBudgetHeader budgetState={budgetState} />
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
                        <div className="rounded-2xl border border-border/60 bg-background/90 px-4 py-3 text-sm text-muted-foreground">
                            {props.mode === "edit"
                                ? "The live Blockly toolbox stays scoped to these categories and the department source block."
                                : "Read-only mode keeps the selected category context visible even when Blockly toolbox editing is disabled."}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {toolbox.sanitizedCategoryIds.length === 0 ? (
                                <Badge variant="secondary" className="rounded-full">
                                    No active categories available
                                </Badge>
                            ) : (
                                toolbox.sanitizedCategoryIds.map((categoryId) => {
                                    const category = props.categories.find(
                                        (candidate) => candidate.id === categoryId,
                                    );
                                    return (
                                        <Badge
                                            key={categoryId}
                                            variant="secondary"
                                            className="rounded-full"
                                        >
                                            <Layers3 className="mr-1 h-3.5 w-3.5" />
                                            {category?.name ?? categoryId}
                                        </Badge>
                                    );
                                })
                            )}
                        </div>

                        <div className="rounded-2xl border border-border/60 bg-background/90 px-4 py-4 text-sm">
                            <div className="font-semibold text-foreground">
                                Department source
                            </div>
                            <div className="mt-2 space-y-1 text-muted-foreground">
                                <div>{props.department.name}</div>
                                <div>Vote: {props.department.voteNumber}</div>
                                <div>
                                    Budget:{" "}
                                    {props.department.budgetAllocation === null
                                        ? "Not allocated"
                                        : formatKenyanCurrency(props.department.budgetAllocation)}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <LazyBlocklyWorkspace
                    budgetAllocation={props.department.budgetAllocation}
                    categories={props.categories}
                    currentUserId={props.currentUserId}
                    editorMode={props.mode}
                    items={props.items}
                    onBudgetStateChange={setBudgetState}
                    onWorkspaceChange={(payload) => {
                        void handleWorkspaceChange(payload);
                    }}
                    selectedCategoryIds={toolbox.sanitizedCategoryIds}
                    toolboxDefinition={toolbox.toolboxDefinition}
                    workspaceState={props.workspaceState}
                />
            </div>
        </div>
    );
}

function formatKenyanCurrency(amount: number): string {
    return new Intl.NumberFormat("en-KE", {
        currency: "KES",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
        style: "currency",
    }).format(amount);
}
