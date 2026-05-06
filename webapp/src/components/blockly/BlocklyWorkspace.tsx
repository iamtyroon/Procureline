"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { registerDepartmentUserBlocklyBlocks } from "@/lib/frontend/blockly/block-definitions";
import {
    type BlocklyWorkspaceRecord,
} from "@/lib/shared/blockly/blockly-serialization";
import {
    createSerializedBlocklyWorkspaceSnapshot,
    loadBlocklyWorkspace,
} from "@/lib/frontend/blockly/workspace-serialization";
import {
    applyDepartmentWorkspaceRollup,
    mapDepartmentUserBudgetMeterState,
    type DepartmentUserBudgetMeterState,
    type DepartmentUserWorkspaceSummary,
} from "@/lib/shared/blockly/du-workspace-calculations";
import {
    synchronizeDepartmentUserWorkspaceCatalogIdentity,
    collectDepartmentUserWorkspaceSourceUsageFromDepartmentBlock,
    type DepartmentUserWorkspaceSourceUsage,
    type DepartmentUserCatalogItem,
} from "@/lib/shared/blockly/workspace-catalog-identity";
import {
    resolveDepartmentUserWorkspaceEvent,
    type DepartmentUserCategoryDeletionConfirmation,
} from "@/lib/frontend/blockly/workspace-events";
import {
    readDepartmentUserWorkspaceUiState,
    restoreDepartmentUserWorkspaceUiState,
    writeDepartmentUserWorkspaceUiState,
} from "@/lib/frontend/blockly/workspace-ui-state";
import { buildDepartmentUserBlocklyInjectionOptions } from "@/lib/frontend/blockly/workspace-runtime";
import styles from "./BlocklyWorkspace.module.css";

type BlocklyModule = typeof import("blockly");
type BlocklyWorkspaceSvg = import("blockly").WorkspaceSvg;

export interface BlocklyWorkspaceChangePayload {
    summary: DepartmentUserWorkspaceSummary | null;
    workspaceState: BlocklyWorkspaceRecord;
}

export interface BlocklyWorkspaceValidationNotice {
    kind: "duplicate_item";
    message: string;
}

export interface BlocklyWorkspaceHistoryState {
    canRedo: boolean;
    canUndo: boolean;
}

export interface BlocklyWorkspaceSelectedBlockLike {
    getFieldValue(name: string): string;
    getParent?(): BlocklyWorkspaceSelectedBlockLike | null;
    type: string;
}

export function BlocklyWorkspace(props: {
    budgetAllocation: number | null;
    categories: Array<{
        id: string;
        name: string;
    }>;
    currentUserId: string;
    editorMode: "edit" | "view";
    items: Array<
        DepartmentUserCatalogItem & {
            lastPriceChangedAt: number | null;
        }
    >;
    historyActionRequest?: {
        kind: "redo" | "undo";
        nonce: number;
    } | null;
    onBudgetStateChange: (state: DepartmentUserBudgetMeterState) => void;
    onHistoryStateChange?: (state: BlocklyWorkspaceHistoryState) => void;
    onSelectedBlockChange?: (block: BlocklyWorkspaceSelectedBlockLike | null) => void;
    onValidationNotice?: (notice: BlocklyWorkspaceValidationNotice) => void;
    onWorkspaceChange: (payload: BlocklyWorkspaceChangePayload) => void;
    onWorkspaceStructureChange: (sourceUsage: DepartmentUserWorkspaceSourceUsage) => void;
    onWorkspaceSummaryChange: (summary: DepartmentUserWorkspaceSummary | null) => void;
    planId: string;
    selectedCategoryIds: string[];
    toolboxDefinition: Record<string, unknown>;
    workspaceState: BlocklyWorkspaceRecord | null;
}): JSX.Element {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const workspaceRef = useRef<BlocklyWorkspaceSvg | null>(null);
    const blocklyRef = useRef<BlocklyModule | null>(null);
    const saveTimerRef = useRef<number | null>(null);
    const structureRefreshTimerRef = useRef<number | null>(null);
    const viewportPersistenceTimerRef = useRef<number | null>(null);
    const previousWorkspaceRecordRef = useRef<BlocklyWorkspaceRecord | null>(
        props.workspaceState,
    );
    const initialWorkspaceStateRef = useRef<BlocklyWorkspaceRecord | null>(props.workspaceState);
    const lastHistoryActionNonceRef = useRef<number | null>(null);
    const onBudgetStateChangeRef = useRef(props.onBudgetStateChange);
    const onHistoryStateChangeRef = useRef(props.onHistoryStateChange);
    const onSelectedBlockChangeRef = useRef(props.onSelectedBlockChange);
    const onWorkspaceChangeRef = useRef(props.onWorkspaceChange);
    const onValidationNoticeRef = useRef(props.onValidationNotice);
    const onWorkspaceStructureChangeRef = useRef(props.onWorkspaceStructureChange);
    const onWorkspaceSummaryChangeRef = useRef(props.onWorkspaceSummaryChange);
    const recalculateWorkspaceRef = useRef<
        | ((
              Blockly: BlocklyModule,
              workspace: BlocklyWorkspaceSvg,
          ) => DepartmentUserWorkspaceSummary | null)
        | null
    >(null);
    const toolboxDefinitionRef = useRef(props.toolboxDefinition);
    const approvedCategoryDeletionIdsRef = useRef<Set<string>>(new Set());
    const [retryKey, setRetryKey] = useState(0);
    const [initializationError, setInitializationError] = useState<string | null>(null);
    const [pendingCategoryDeletion, setPendingCategoryDeletion] =
        useState<DepartmentUserCategoryDeletionConfirmation | null>(null);
    const layoutRefreshTimerRef = useRef<number | null>(null);

    useEffect(() => {
        onBudgetStateChangeRef.current = props.onBudgetStateChange;
    }, [props.onBudgetStateChange]);

    useEffect(() => {
        onHistoryStateChangeRef.current = props.onHistoryStateChange;
    }, [props.onHistoryStateChange]);

    useEffect(() => {
        onSelectedBlockChangeRef.current = props.onSelectedBlockChange;
    }, [props.onSelectedBlockChange]);

    useEffect(() => {
        onWorkspaceChangeRef.current = props.onWorkspaceChange;
    }, [props.onWorkspaceChange]);

    useEffect(() => {
        onValidationNoticeRef.current = props.onValidationNotice;
    }, [props.onValidationNotice]);

    useEffect(() => {
        onWorkspaceStructureChangeRef.current = props.onWorkspaceStructureChange;
    }, [props.onWorkspaceStructureChange]);

    useEffect(() => {
        onWorkspaceSummaryChangeRef.current = props.onWorkspaceSummaryChange;
    }, [props.onWorkspaceSummaryChange]);

    useEffect(() => {
        toolboxDefinitionRef.current = props.toolboxDefinition;
    }, [props.toolboxDefinition]);

    useEffect(() => {
        previousWorkspaceRecordRef.current = props.workspaceState;
        initialWorkspaceStateRef.current = props.workspaceState;
    }, [props.workspaceState]);

    const syncBudgetState = useCallback((summary: DepartmentUserWorkspaceSummary | null): void => {
        onBudgetStateChangeRef.current(
            summary?.budgetState ??
                mapDepartmentUserBudgetMeterState({
                    totalBudget: props.budgetAllocation,
                    usedAmount: 0,
                }),
        );
    }, [props.budgetAllocation]);

    const emitHistoryState = useCallback((workspace: BlocklyWorkspaceSvg | null): void => {
        if (!workspace) {
            onHistoryStateChangeRef.current?.({
                canRedo: false,
                canUndo: false,
            });
            return;
        }

        onHistoryStateChangeRef.current?.({
            canRedo: workspace.getRedoStack().length > 0,
            canUndo: workspace.getUndoStack().length > 0,
        });
    }, []);

    const emitWorkspaceSnapshot = useCallback((summary: DepartmentUserWorkspaceSummary | null): void => {
        if (!blocklyRef.current || !workspaceRef.current) {
            return;
        }

        const nextWorkspaceState = createSerializedBlocklyWorkspaceSnapshot({
            Blockly: blocklyRef.current,
            currentUserId: props.currentUserId,
            previousRecord: previousWorkspaceRecordRef.current,
            workspace: workspaceRef.current,
        });
        previousWorkspaceRecordRef.current = nextWorkspaceState;
        onWorkspaceChangeRef.current({
            summary,
            workspaceState: nextWorkspaceState,
        });
    }, [props.currentUserId]);

    const queueWorkspaceSnapshot = useCallback((summary: DepartmentUserWorkspaceSummary | null): void => {
        if (props.editorMode !== "edit") {
            return;
        }

        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = window.setTimeout(() => {
            emitWorkspaceSnapshot(summary);
            saveTimerRef.current = null;
        }, 700);
    }, [emitWorkspaceSnapshot, props.editorMode]);

    const queueStructureSourceUsageRefresh = useCallback((): void => {
        if (!workspaceRef.current) {
            return;
        }

        if (structureRefreshTimerRef.current !== null) {
            window.clearTimeout(structureRefreshTimerRef.current);
        }

        structureRefreshTimerRef.current = window.setTimeout(() => {
            const departmentBlock =
                workspaceRef.current
                    ?.getTopBlocks(false)
                    .find((block) => block.type === "department_block") ?? null;
            const nextSourceUsage = collectDepartmentUserWorkspaceSourceUsageFromDepartmentBlock({
                categories: props.categories,
                departmentBlock: departmentBlock as Parameters<
                    typeof collectDepartmentUserWorkspaceSourceUsageFromDepartmentBlock
                >[0]["departmentBlock"],
                items: props.items,
            });
            onWorkspaceStructureChangeRef.current(nextSourceUsage);
            structureRefreshTimerRef.current = null;
        }, 150);
    }, [props.categories, props.items]);

    const queueViewportPersistence = useCallback((viewportState: {
        scale?: number;
        viewLeft?: number;
        viewTop?: number;
    }): void => {
        if (
            viewportState.scale === undefined ||
            viewportState.viewLeft === undefined ||
            viewportState.viewTop === undefined
        ) {
            return;
        }

        if (viewportPersistenceTimerRef.current !== null) {
            window.clearTimeout(viewportPersistenceTimerRef.current);
        }

        viewportPersistenceTimerRef.current = window.setTimeout(() => {
            writeDepartmentUserWorkspaceUiState({
                planId: props.planId,
                state: {
                    scale: viewportState.scale!,
                    viewLeft: viewportState.viewLeft!,
                    viewTop: viewportState.viewTop!,
                },
                userId: props.currentUserId,
            });
            viewportPersistenceTimerRef.current = null;
        }, 150);
    }, [props.currentUserId, props.planId]);

    const recalculateWorkspace = useCallback((
        Blockly: BlocklyModule,
        workspace: BlocklyWorkspaceSvg,
    ): DepartmentUserWorkspaceSummary | null => {
        const departmentBlock = workspace
            .getTopBlocks(false)
            .find((block) => block.type === "department_block") as Parameters<
                typeof applyDepartmentWorkspaceRollup
            >[0]["departmentBlock"] | undefined;

        let summary: DepartmentUserWorkspaceSummary | null = null;
        Blockly.Events.disable();
        try {
            synchronizeDepartmentUserWorkspaceCatalogIdentity({
                categories: props.categories,
                departmentBlock: departmentBlock ?? null,
                items: props.items,
            });
            summary = applyDepartmentWorkspaceRollup({
                departmentBlock: departmentBlock ?? null,
                items: props.items,
                totalBudget: props.budgetAllocation,
            });
        } finally {
            Blockly.Events.enable();
        }

        syncBudgetState(summary);
        onWorkspaceSummaryChangeRef.current(summary);

        return summary;
    }, [props.budgetAllocation, props.categories, props.items, syncBudgetState]);

    useEffect(() => {
        recalculateWorkspaceRef.current = recalculateWorkspace;
    }, [recalculateWorkspace]);

    useEffect(() => {
        let isDisposed = false;

        async function initializeWorkspace(): Promise<void> {
            try {
                setInitializationError(null);

                const Blockly = await import("blockly");
                if (isDisposed || !hostRef.current) {
                    return;
                }

                registerDepartmentUserBlocklyBlocks(Blockly);
                const workspace = Blockly.inject(
                    hostRef.current,
                    buildDepartmentUserBlocklyInjectionOptions({
                        editorMode: props.editorMode,
                        toolboxDefinition: toolboxDefinitionRef.current,
                    }) as never,
                );

                blocklyRef.current = Blockly;
                workspaceRef.current = workspace;

                const syncFlyoutScrollbarVisibility = () => {
                    if (!hostRef.current) {
                        return;
                    }

                    const hasVisibleFlyout = Array.from(
                        hostRef.current.querySelectorAll(".blocklyFlyout"),
                    ).some((flyout) => {
                        const rect = flyout.getBoundingClientRect();
                        return (
                            window.getComputedStyle(flyout).display !== "none" &&
                            rect.width > 0 &&
                            rect.height > 0
                        );
                    });

                    for (const scrollbar of Array.from(
                        hostRef.current.querySelectorAll<SVGElement>(
                            ".blocklyFlyoutScrollbar",
                        ),
                    )) {
                        if (hasVisibleFlyout) {
                            scrollbar.style.removeProperty("display");
                        } else {
                            scrollbar.style.setProperty("display", "none", "important");
                        }
                    }
                };

                const scheduleWorkspaceLayoutRefresh = () => {
                    if (layoutRefreshTimerRef.current !== null) {
                        window.clearTimeout(layoutRefreshTimerRef.current);
                    }

                    const refresh = () => {
                        Blockly.svgResize(workspace);
                        workspace.resizeContents();
                        (
                            workspace as BlocklyWorkspaceSvg & {
                                scrollbar?: {
                                    resize?: () => void;
                                };
                            }
                        ).scrollbar?.resize?.();
                        syncFlyoutScrollbarVisibility();
                    };

                    window.requestAnimationFrame(refresh);
                    layoutRefreshTimerRef.current = window.setTimeout(() => {
                        refresh();
                        layoutRefreshTimerRef.current = null;
                    }, 90);
                };

                const blocklyRoot = hostRef.current;
                const stopWheelPropagation: EventListener = (event) => {
                    event.stopPropagation();
                };
                const protectedWheelTargets = [
                    blocklyRoot.querySelector(".blocklyToolbox"),
                    blocklyRoot.querySelector(".blocklyToolboxDiv"),
                    blocklyRoot.querySelector(".blocklyFlyout"),
                    blocklyRoot.querySelector(".blocklyFlyoutScrollbar"),
                ].filter((target): target is Element => target instanceof Element);

                for (const target of protectedWheelTargets) {
                    target.addEventListener("wheel", stopWheelPropagation, {
                        passive: true,
                    });
                    target.addEventListener("wheel", scheduleWorkspaceLayoutRefresh, {
                        passive: true,
                    });
                    target.addEventListener("pointerup", scheduleWorkspaceLayoutRefresh);
                    target.addEventListener("click", scheduleWorkspaceLayoutRefresh);
                }

                const closeToolboxFlyout = () => {
                    if (isDisposed) {
                        return;
                    }

                    const toolbox = workspace.getToolbox();
                    toolbox?.clearSelection();
                    toolbox?.getFlyout()?.hide();
                    workspace.getFlyout()?.hide();
                    scheduleWorkspaceLayoutRefresh();
                };

                const scheduleToolboxFlyoutClose = () => {
                    window.requestAnimationFrame(() => {
                        closeToolboxFlyout();
                        window.setTimeout(closeToolboxFlyout, 120);
                    });
                };

                const handleWorkspaceChange = (
                    event: {
                        blockId?: string;
                        isStart?: boolean;
                        newElementId?: string;
                        oldJson?: Record<string, unknown>;
                        run?: (forward: boolean) => void;
                        scale?: number;
                        type: string;
                        viewLeft?: number;
                        viewTop?: number;
                    },
                ) => {
                    if (event.type === "selected") {
                        const nextSelectedBlock =
                            typeof event.newElementId === "string"
                                ? (workspace.getBlockById(
                                      event.newElementId,
                                  ) as BlocklyWorkspaceSelectedBlockLike | null)
                                : null;
                        onSelectedBlockChangeRef.current?.(nextSelectedBlock ?? null);
                        emitHistoryState(workspace);
                        return;
                    }

                    if (
                        props.editorMode === "edit" &&
                        (event.type === "create" ||
                            (event.type === "drag" && event.isStart === false))
                    ) {
                        scheduleToolboxFlyoutClose();
                    }

                    const eventResolution = resolveDepartmentUserWorkspaceEvent({
                        approvedCategoryDeletionIds:
                            approvedCategoryDeletionIdsRef.current,
                        editorMode: props.editorMode,
                        event,
                    });

                    if (eventResolution.viewportState) {
                        queueViewportPersistence(eventResolution.viewportState);
                        return;
                    }

                    if (
                        eventResolution.shouldUndoDelete &&
                        eventResolution.categoryDeletionConfirmation &&
                        event.run
                    ) {
                        Blockly.Events.disable();
                        try {
                            event.run(false);
                        } finally {
                            Blockly.Events.enable();
                        }
                        recalculateWorkspaceRef.current?.(Blockly, workspace);
                        setPendingCategoryDeletion(
                            eventResolution.categoryDeletionConfirmation,
                        );
                        emitHistoryState(workspace);
                        return;
                    }

                    if (
                        event.type === "delete" &&
                        event.blockId &&
                        approvedCategoryDeletionIdsRef.current.has(event.blockId)
                    ) {
                        approvedCategoryDeletionIdsRef.current.delete(event.blockId);
                    }

                    if (!eventResolution.shouldRecalculate) {
                        emitHistoryState(workspace);
                        return;
                    }

                    if (eventResolution.shouldQueueStructureRefresh) {
                        queueStructureSourceUsageRefresh();
                    }

                    let nextSummary = recalculateWorkspaceRef.current?.(Blockly, workspace) ?? null;

                    const duplicateIssue =
                        event.blockId && (event.type === "create" || event.type === "move")
                            ? nextSummary?.validationState.issues.find(
                                  (issue) =>
                                      issue.code === "duplicate_item" &&
                                      issue.blockId === event.blockId,
                              ) ?? null
                            : null;

                    if (duplicateIssue && typeof event.run === "function") {
                        Blockly.Events.disable();
                        try {
                            event.run(false);
                        } finally {
                            Blockly.Events.enable();
                        }
                        nextSummary = recalculateWorkspaceRef.current?.(Blockly, workspace) ?? null;
                        onValidationNoticeRef.current?.({
                            kind: "duplicate_item",
                            message: duplicateIssue.message,
                        });
                    }

                    if (
                        props.editorMode === "edit" &&
                        eventResolution.shouldPersistSnapshot
                    ) {
                        queueWorkspaceSnapshot(nextSummary);
                    }

                    emitHistoryState(workspace);
                };

                workspace.addChangeListener(handleWorkspaceChange);
                window.requestAnimationFrame(() => {
                    scheduleWorkspaceLayoutRefresh();
                });

                loadBlocklyWorkspace({
                    Blockly,
                    record: initialWorkspaceStateRef.current,
                    workspace,
                });
                const persistedUiState = readDepartmentUserWorkspaceUiState({
                    planId: props.planId,
                    userId: props.currentUserId,
                });
                restoreDepartmentUserWorkspaceUiState({
                    state: persistedUiState,
                    workspace,
                });
                recalculateWorkspaceRef.current?.(Blockly, workspace);
                emitHistoryState(workspace);
            } catch (error) {
                if (isDisposed) {
                    return;
                }

                setInitializationError(
                    error instanceof Error
                        ? error.message
                        : "Blockly failed to initialize.",
                );
            }
        }

        void initializeWorkspace();

        return () => {
            isDisposed = true;
            if (saveTimerRef.current !== null) {
                window.clearTimeout(saveTimerRef.current);
                saveTimerRef.current = null;
            }
            if (structureRefreshTimerRef.current !== null) {
                window.clearTimeout(structureRefreshTimerRef.current);
                structureRefreshTimerRef.current = null;
            }
            if (viewportPersistenceTimerRef.current !== null) {
                window.clearTimeout(viewportPersistenceTimerRef.current);
                viewportPersistenceTimerRef.current = null;
            }
            if (layoutRefreshTimerRef.current !== null) {
                window.clearTimeout(layoutRefreshTimerRef.current);
                layoutRefreshTimerRef.current = null;
            }

            onSelectedBlockChangeRef.current?.(null);
            emitHistoryState(null);
            workspaceRef.current?.dispose();
            workspaceRef.current = null;
        };
    }, [
        props.currentUserId,
        props.editorMode,
        props.planId,
        queueStructureSourceUsageRefresh,
        queueViewportPersistence,
        retryKey,
    ]);

    useEffect(() => {
        if (!workspaceRef.current) {
            return;
        }

        const workspace = workspaceRef.current as BlocklyWorkspaceSvg & {
            options?: {
                languageTree?: unknown;
            };
        };
        if (!workspace.options?.languageTree) {
            return;
        }

        workspace.updateToolbox(props.toolboxDefinition as never);
        blocklyRef.current?.svgResize(workspace);
        workspace.resizeContents();
        emitHistoryState(workspace);
    }, [emitHistoryState, props.toolboxDefinition]);

    useEffect(() => {
        if (!blocklyRef.current || !workspaceRef.current) {
            return;
        }

        const nextSummary = recalculateWorkspace(blocklyRef.current, workspaceRef.current);
        if (props.editorMode === "edit") {
            queueWorkspaceSnapshot(nextSummary);
        }
        queueStructureSourceUsageRefresh();
        emitHistoryState(workspaceRef.current);
    }, [
        props.categories,
        props.editorMode,
        emitHistoryState,
        props.items,
        queueWorkspaceSnapshot,
        queueStructureSourceUsageRefresh,
        recalculateWorkspace,
    ]);

    useEffect(() => {
        if (
            !props.historyActionRequest ||
            !workspaceRef.current ||
            props.editorMode !== "edit"
        ) {
            return;
        }

        if (lastHistoryActionNonceRef.current === props.historyActionRequest.nonce) {
            return;
        }

        lastHistoryActionNonceRef.current = props.historyActionRequest.nonce;
        workspaceRef.current.undo(props.historyActionRequest.kind === "redo");
        emitHistoryState(workspaceRef.current);
    }, [emitHistoryState, props.editorMode, props.historyActionRequest]);

    if (initializationError) {
        return (
            <Card className={styles.hostCard}>
                <CardHeader className="space-y-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-2xl tracking-[-0.04em]">
                        Editor failed to load
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <p>
                        Blockly could not attach to the planning surface. Retry the editor or return to the dashboard launchpad.
                    </p>
                    <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3">
                        {initializationError}
                    </p>
                    <Button
                        onClick={() => setRetryKey((current) => current + 1)}
                        type="button"
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Retry editor
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <>
            <AlertDialog
                open={pendingCategoryDeletion !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingCategoryDeletion(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Remove category branch?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingCategoryDeletion?.message ??
                                "This category and its nested items will be removed."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                if (!pendingCategoryDeletion || !workspaceRef.current) {
                                    setPendingCategoryDeletion(null);
                                    return;
                                }

                                approvedCategoryDeletionIdsRef.current.add(
                                    pendingCategoryDeletion.blockId,
                                );
                                const block = workspaceRef.current.getBlockById(
                                    pendingCategoryDeletion.blockId,
                                );
                                setPendingCategoryDeletion(null);
                                block?.dispose(true);
                            }}
                        >
                            Remove category and items
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className={`${styles.hostShell} blockly-host`}>
                <div className={styles.blocklyViewport} ref={hostRef} />
            </div>
        </>
    );
}
