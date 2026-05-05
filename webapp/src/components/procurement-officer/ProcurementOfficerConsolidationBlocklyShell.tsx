"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type BlocklyModule = typeof import("blockly");
type BlocklyWorkspaceSvg = import("blockly").WorkspaceSvg;

export interface ConsolidationBlocklyState {
    format: "blockly_json";
    schemaVersion: number;
    workspaceJson: Record<string, unknown>;
    editorMetadata: {
        lastSavedAt: number;
        lastSavedByUserId: string;
        recoveredAt: number | null;
        revision: number;
        saveSource: "workspace_seed" | "workspace_sync";
    };
}

function createSeedWorkspaceJson(sourceDepartments: Array<{ departmentId: string; departmentName: string }>) {
    return {
        blocks: {
            blocks: [
                {
                    type: "aggregate_plan_block",
                    id: "aggregate-master-plan",
                    x: 40,
                    y: 40,
                    fields: {
                        TITLE: "Institutional Annual Procurement Plan",
                    },
                },
                ...sourceDepartments.slice(0, 5).map((department, index) => ({
                    type: "approved_department_source_block",
                    id: `approved-source-${department.departmentId}`,
                    x: 80,
                    y: 150 + index * 76,
                    fields: {
                        DEPARTMENT_ID: department.departmentId,
                        DEPARTMENT_NAME: department.departmentName,
                    },
                })),
            ],
            languageVersion: 0,
        },
    };
}

function registerConsolidationBlocks(Blockly: BlocklyModule): void {
    if (!Blockly.Blocks.aggregate_plan_block) {
        Blockly.Blocks.aggregate_plan_block = {
            init: function init() {
                this.appendDummyInput()
                    .appendField("master plan")
                    .appendField(new Blockly.FieldTextInput("Institutional Annual Procurement Plan"), "TITLE");
                this.setColour(210);
                this.setTooltip("Story 7.1 consolidation shell placeholder.");
                this.setHelpUrl("");
            },
        };
    }

    if (!Blockly.Blocks.approved_department_source_block) {
        Blockly.Blocks.approved_department_source_block = {
            init: function init() {
                this.appendDummyInput()
                    .appendField("approved source")
                    .appendField(new Blockly.FieldTextInput("Department"), "DEPARTMENT_NAME");
                this.appendDummyInput()
                    .appendField("id")
                    .appendField(new Blockly.FieldTextInput("department-id"), "DEPARTMENT_ID");
                this.setColour(145);
                this.setTooltip("Approved department plan source.");
                this.setHelpUrl("");
            },
        };
    }
}

function buildToolbox() {
    return {
        kind: "categoryToolbox",
        contents: [
            {
                kind: "category",
                name: "Master Plan",
                colour: "210",
                contents: [{ kind: "block", type: "aggregate_plan_block" }],
            },
            {
                kind: "category",
                name: "Approved Sources",
                colour: "145",
                contents: [{ kind: "block", type: "approved_department_source_block" }],
            },
        ],
    };
}

function normalizeWorkspaceRecord(value: unknown, fallback: {
    sourceDepartments: Array<{ departmentId: string; departmentName: string }>;
    userId: string;
}): ConsolidationBlocklyState {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const record = value as Partial<ConsolidationBlocklyState>;
        if (
            record.format === "blockly_json" &&
            record.workspaceJson &&
            typeof record.workspaceJson === "object" &&
            !Array.isArray(record.workspaceJson)
        ) {
            return {
                editorMetadata: {
                    lastSavedAt: record.editorMetadata?.lastSavedAt ?? Date.now(),
                    lastSavedByUserId:
                        record.editorMetadata?.lastSavedByUserId ?? fallback.userId,
                    recoveredAt: record.editorMetadata?.recoveredAt ?? null,
                    revision: record.editorMetadata?.revision ?? 1,
                    saveSource: record.editorMetadata?.saveSource ?? "workspace_seed",
                },
                format: "blockly_json",
                schemaVersion: record.schemaVersion ?? 1,
                workspaceJson: record.workspaceJson,
            };
        }
    }

    return {
        editorMetadata: {
            lastSavedAt: Date.now(),
            lastSavedByUserId: fallback.userId,
            recoveredAt: null,
            revision: 1,
            saveSource: "workspace_seed",
        },
        format: "blockly_json",
        schemaVersion: 1,
        workspaceJson: createSeedWorkspaceJson(fallback.sourceDepartments),
    };
}

export default function ProcurementOfficerConsolidationBlocklyShell(props: {
    initialWorkspaceState: unknown;
    onHydrated: () => void;
    onWorkspaceChange: (state: ConsolidationBlocklyState) => void;
    sourceDepartments: Array<{ departmentId: string; departmentName: string }>;
    userId: string;
}): JSX.Element {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const workspaceRef = useRef<BlocklyWorkspaceSvg | null>(null);
    const blocklyRef = useRef<BlocklyModule | null>(null);
    const latestRecordRef = useRef<ConsolidationBlocklyState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        let disposed = false;

        async function initialize(): Promise<void> {
            try {
                setError(null);
                const Blockly = await import("blockly");
                if (disposed || !hostRef.current) {
                    return;
                }

                registerConsolidationBlocks(Blockly);
                const workspace = Blockly.inject(hostRef.current, {
                    grid: { length: 24, colour: "#d1d5db", snap: true, spacing: 24 },
                    move: {
                        drag: true,
                        scrollbars: true,
                        wheel: true,
                    },
                    renderer: "zelos",
                    toolbox: buildToolbox(),
                    trashcan: true,
                    zoom: {
                        controls: true,
                        maxScale: 1.4,
                        minScale: 0.5,
                        scaleSpeed: 1.08,
                        startScale: 0.82,
                        wheel: true,
                    },
                });
                const initialRecord = normalizeWorkspaceRecord(props.initialWorkspaceState, {
                    sourceDepartments: props.sourceDepartments,
                    userId: props.userId,
                });

                Blockly.serialization.workspaces.load(initialRecord.workspaceJson, workspace);
                blocklyRef.current = Blockly;
                workspaceRef.current = workspace;
                latestRecordRef.current = initialRecord;
                props.onWorkspaceChange(initialRecord);
                props.onHydrated();

                workspace.addChangeListener((event) => {
                    if (
                        event.type === Blockly.Events.VIEWPORT_CHANGE ||
                        event.type === Blockly.Events.SELECTED ||
                        event.isUiEvent
                    ) {
                        return;
                    }

                    const previousRevision =
                        latestRecordRef.current?.editorMetadata.revision ?? 0;
                    const nextRecord: ConsolidationBlocklyState = {
                        editorMetadata: {
                            lastSavedAt: Date.now(),
                            lastSavedByUserId: props.userId,
                            recoveredAt: latestRecordRef.current?.editorMetadata.recoveredAt ?? null,
                            revision: previousRevision + 1,
                            saveSource: "workspace_sync",
                        },
                        format: "blockly_json",
                        schemaVersion: 1,
                        workspaceJson: Blockly.serialization.workspaces.save(workspace) as Record<string, unknown>,
                    };
                    latestRecordRef.current = nextRecord;
                    props.onWorkspaceChange(nextRecord);
                });

                window.requestAnimationFrame(() => Blockly.svgResize(workspace));
            } catch (initializationError) {
                if (disposed) {
                    return;
                }
                setError(
                    initializationError instanceof Error
                        ? initializationError.message
                        : "Blockly failed to initialize.",
                );
            }
        }

        void initialize();

        return () => {
            disposed = true;
            workspaceRef.current?.dispose();
            workspaceRef.current = null;
            blocklyRef.current = null;
        };
    }, [props.initialWorkspaceState, props.onHydrated, props.onWorkspaceChange, props.sourceDepartments, props.userId, retryKey]);

    if (error) {
        return (
            <div className="flex h-full min-h-[28rem] flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-rose-300 bg-rose-50/60 p-6 text-center text-rose-950">
                <AlertTriangle className="h-8 w-8" />
                <div className="max-w-md text-sm">{error}</div>
                <Button onClick={() => setRetryKey((current) => current + 1)} type="button">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="h-full min-h-[28rem] overflow-hidden rounded-lg border border-border/70 bg-background">
            <div ref={hostRef} className="h-full min-h-[28rem] w-full" />
        </div>
    );
}
