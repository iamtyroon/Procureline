"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { registerDepartmentUserBlocklyBlocks } from "@/lib/blockly/block-definitions";
import {
    loadBlocklyWorkspace,
    type BlocklyWorkspaceRecord,
} from "@/lib/blockly/blockly-serialization";
import {
    createSerializedBlocklyWorkspaceSnapshot,
} from "@/lib/blockly/workspace-save";
import {
    applyDepartmentWorkspaceRollup,
    mapDepartmentUserBudgetMeterState,
    type DepartmentUserBudgetMeterState,
    type DepartmentUserDepartmentRollup,
} from "@/lib/blockly/du-workspace-calculations";
import { synchronizeDepartmentUserWorkspaceCatalogIdentity } from "@/lib/blockly/workspace-catalog-identity";
import styles from "./BlocklyWorkspace.module.css";

type BlocklyModule = typeof import("blockly");
type BlocklyWorkspaceSvg = import("blockly").WorkspaceSvg;

export interface BlocklyWorkspaceChangePayload {
    rollup: DepartmentUserDepartmentRollup | null;
    workspaceState: BlocklyWorkspaceRecord;
}

export function BlocklyWorkspace(props: {
    budgetAllocation: number | null;
    categories: Array<{
        id: string;
        name: string;
    }>;
    currentUserId: string;
    editorMode: "edit" | "view";
    items: Array<{
        categoryId: string;
        description: string | null;
        id: string;
        lastPriceChangedAt: number | null;
        name: string;
        procurementMethod: string | null;
        sourceOfFunds: string | null;
        unitOfMeasurement: string | null;
        unitPrice: number | null;
    }>;
    onBudgetStateChange: (state: DepartmentUserBudgetMeterState) => void;
    onWorkspaceChange: (payload: BlocklyWorkspaceChangePayload) => void;
    selectedCategoryIds: string[];
    toolboxDefinition: Record<string, unknown>;
    workspaceState: BlocklyWorkspaceRecord | null;
}): JSX.Element {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const workspaceRef = useRef<BlocklyWorkspaceSvg | null>(null);
    const blocklyRef = useRef<BlocklyModule | null>(null);
    const saveTimerRef = useRef<number | null>(null);
    const previousWorkspaceRecordRef = useRef<BlocklyWorkspaceRecord | null>(
        props.workspaceState,
    );
    const initialWorkspaceStateRef = useRef<BlocklyWorkspaceRecord | null>(props.workspaceState);
    const onBudgetStateChangeRef = useRef(props.onBudgetStateChange);
    const onWorkspaceChangeRef = useRef(props.onWorkspaceChange);
    const recalculateWorkspaceRef = useRef<
        | ((
              Blockly: BlocklyModule,
              workspace: BlocklyWorkspaceSvg,
              shouldPersist: boolean,
          ) => DepartmentUserDepartmentRollup | null)
        | null
    >(null);
    const toolboxDefinitionRef = useRef(props.toolboxDefinition);
    const [retryKey, setRetryKey] = useState(0);
    const [initializationError, setInitializationError] = useState<string | null>(null);

    useEffect(() => {
        onBudgetStateChangeRef.current = props.onBudgetStateChange;
    }, [props.onBudgetStateChange]);

    useEffect(() => {
        onWorkspaceChangeRef.current = props.onWorkspaceChange;
    }, [props.onWorkspaceChange]);

    useEffect(() => {
        toolboxDefinitionRef.current = props.toolboxDefinition;
    }, [props.toolboxDefinition]);

    useEffect(() => {
        previousWorkspaceRecordRef.current = props.workspaceState;
        initialWorkspaceStateRef.current = props.workspaceState;
    }, [props.workspaceState]);

    const syncBudgetState = useCallback((rollup: DepartmentUserDepartmentRollup | null): void => {
        onBudgetStateChangeRef.current(
            mapDepartmentUserBudgetMeterState({
                totalBudget: props.budgetAllocation,
                usedAmount: rollup?.departmentTotal ?? 0,
            }),
        );
    }, [props.budgetAllocation]);

    const emitWorkspaceSnapshot = useCallback((rollup: DepartmentUserDepartmentRollup | null): void => {
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
            rollup,
            workspaceState: nextWorkspaceState,
        });
    }, [props.currentUserId]);

    const queueWorkspaceSnapshot = useCallback((rollup: DepartmentUserDepartmentRollup | null): void => {
        if (props.editorMode !== "edit") {
            return;
        }

        if (saveTimerRef.current !== null) {
            window.clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = window.setTimeout(() => {
            emitWorkspaceSnapshot(rollup);
            saveTimerRef.current = null;
        }, 700);
    }, [emitWorkspaceSnapshot, props.editorMode]);

    const recalculateWorkspace = useCallback((
        Blockly: BlocklyModule,
        workspace: BlocklyWorkspaceSvg,
        shouldPersist: boolean,
    ): DepartmentUserDepartmentRollup | null => {
        const departmentBlock = workspace
            .getTopBlocks(false)
            .find((block) => block.type === "department_block") as Parameters<
                typeof applyDepartmentWorkspaceRollup
            >[0] | undefined;

        let rollup: DepartmentUserDepartmentRollup | null = null;
        Blockly.Events.disable();
        try {
            synchronizeDepartmentUserWorkspaceCatalogIdentity({
                categories: props.categories,
                departmentBlock: departmentBlock ?? null,
                items: props.items,
            });
            rollup = applyDepartmentWorkspaceRollup(departmentBlock ?? null);
        } finally {
            Blockly.Events.enable();
        }

        syncBudgetState(rollup);

        if (shouldPersist) {
            queueWorkspaceSnapshot(rollup);
        }

        return rollup;
    }, [props.categories, props.items, queueWorkspaceSnapshot, syncBudgetState]);

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
                const workspace = Blockly.inject(hostRef.current, {
                    grid: {
                        colour: "#d4d4d8",
                        length: 3,
                        snap: true,
                        spacing: 20,
                    },
                    readOnly: props.editorMode === "view",
                    scrollbars: true,
                    toolbox:
                        props.editorMode === "edit"
                            ? (toolboxDefinitionRef.current as never)
                            : undefined,
                    trashcan: true,
                    zoom: {
                        controls: true,
                        startScale: 0.9,
                        wheel: true,
                    },
                });

                blocklyRef.current = Blockly;
                workspaceRef.current = workspace;

                loadBlocklyWorkspace({
                    Blockly,
                    record: initialWorkspaceStateRef.current,
                    workspace,
                });

                const handleWorkspaceChange = (event: { type: string }) => {
                    if (event.type === "ui") {
                        return;
                    }

                    recalculateWorkspaceRef.current?.(
                        Blockly,
                        workspace,
                        props.editorMode === "edit",
                    );
                };

                workspace.addChangeListener(handleWorkspaceChange);
                recalculateWorkspaceRef.current?.(Blockly, workspace, false);
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

            workspaceRef.current?.dispose();
            workspaceRef.current = null;
        };
    }, [props.editorMode, retryKey]);

    useEffect(() => {
        if (!workspaceRef.current || props.editorMode !== "edit") {
            return;
        }

        workspaceRef.current.updateToolbox(props.toolboxDefinition as never);
    }, [props.editorMode, props.toolboxDefinition]);

    useEffect(() => {
        if (!blocklyRef.current || !workspaceRef.current) {
            return;
        }

        recalculateWorkspace(
            blocklyRef.current,
            workspaceRef.current,
            props.editorMode === "edit",
        );
    }, [props.categories, props.editorMode, props.items, recalculateWorkspace]);

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
        <div className={`${styles.hostShell} blockly-host`}>
            <div className={styles.blocklyViewport} ref={hostRef} />
        </div>
    );
}
