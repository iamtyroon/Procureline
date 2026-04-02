"use client";
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlocklyWorkspace = exports.createSerializedBlocklyWorkspaceSnapshot = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const lucide_react_1 = require("lucide-react");
const react_1 = require("react");
const button_1 = require("@/components/ui/button");
const card_1 = require("@/components/ui/card");
const block_definitions_1 = require("@/lib/blockly/block-definitions");
const blockly_serialization_1 = require("@/lib/blockly/blockly-serialization");
const du_workspace_calculations_1 = require("@/lib/blockly/du-workspace-calculations");
const BlocklyWorkspace_module_css_1 = __importDefault(require("./BlocklyWorkspace.module.css"));
function createSerializedBlocklyWorkspaceSnapshot(args) {
    return (0, blockly_serialization_1.serializeBlocklyWorkspace)({
        Blockly: args.Blockly,
        lastSavedByUserId: args.currentUserId,
        previousRecord: args.previousRecord,
        workspace: args.workspace,
    });
}
exports.createSerializedBlocklyWorkspaceSnapshot = createSerializedBlocklyWorkspaceSnapshot;
function BlocklyWorkspace(props) {
    const hostRef = (0, react_1.useRef)(null);
    const workspaceRef = (0, react_1.useRef)(null);
    const blocklyRef = (0, react_1.useRef)(null);
    const saveTimerRef = (0, react_1.useRef)(null);
    const previousWorkspaceRecordRef = (0, react_1.useRef)(props.workspaceState);
    const initialWorkspaceStateRef = (0, react_1.useRef)(props.workspaceState);
    const onBudgetStateChangeRef = (0, react_1.useRef)(props.onBudgetStateChange);
    const onWorkspaceChangeRef = (0, react_1.useRef)(props.onWorkspaceChange);
    const [retryKey, setRetryKey] = (0, react_1.useState)(0);
    const [initializationError, setInitializationError] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        onBudgetStateChangeRef.current = props.onBudgetStateChange;
    }, [props.onBudgetStateChange]);
    (0, react_1.useEffect)(() => {
        onWorkspaceChangeRef.current = props.onWorkspaceChange;
    }, [props.onWorkspaceChange]);
    (0, react_1.useEffect)(() => {
        previousWorkspaceRecordRef.current = props.workspaceState;
        initialWorkspaceStateRef.current = props.workspaceState;
    }, [props.workspaceState]);
    const syncBudgetState = (0, react_1.useCallback)((rollup) => {
        onBudgetStateChangeRef.current((0, du_workspace_calculations_1.mapDepartmentUserBudgetMeterState)({
            totalBudget: props.budgetAllocation,
            usedAmount: rollup?.departmentTotal ?? 0,
        }));
    }, [props.budgetAllocation]);
    const emitWorkspaceSnapshot = (0, react_1.useCallback)((rollup) => {
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
    const queueWorkspaceSnapshot = (0, react_1.useCallback)((rollup) => {
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
    const recalculateWorkspace = (0, react_1.useCallback)((Blockly, workspace, shouldPersist) => {
        const departmentBlock = workspace
            .getTopBlocks(false)
            .find((block) => block.type === "department_block");
        let rollup = null;
        Blockly.Events.disable();
        try {
            rollup = (0, du_workspace_calculations_1.applyDepartmentWorkspaceRollup)(departmentBlock ?? null);
        }
        finally {
            Blockly.Events.enable();
        }
        syncBudgetState(rollup);
        if (shouldPersist) {
            queueWorkspaceSnapshot(rollup);
        }
        return rollup;
    }, [queueWorkspaceSnapshot, syncBudgetState]);
    (0, react_1.useEffect)(() => {
        let isDisposed = false;
        async function initializeWorkspace() {
            try {
                setInitializationError(null);
                const Blockly = await import("blockly");
                if (isDisposed || !hostRef.current) {
                    return;
                }
                (0, block_definitions_1.registerDepartmentUserBlocklyBlocks)(Blockly);
                const workspace = Blockly.inject(hostRef.current, {
                    grid: {
                        colour: "#d4d4d8",
                        length: 3,
                        snap: true,
                        spacing: 20,
                    },
                    readOnly: props.editorMode === "view",
                    scrollbars: true,
                    toolbox: props.editorMode === "edit"
                        ? props.toolboxDefinition
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
                (0, blockly_serialization_1.loadBlocklyWorkspace)({
                    Blockly,
                    record: initialWorkspaceStateRef.current,
                    workspace,
                });
                const handleWorkspaceChange = (event) => {
                    if (event.type === "ui") {
                        return;
                    }
                    recalculateWorkspace(Blockly, workspace, props.editorMode === "edit");
                };
                workspace.addChangeListener(handleWorkspaceChange);
                recalculateWorkspace(Blockly, workspace, false);
            }
            catch (error) {
                if (isDisposed) {
                    return;
                }
                setInitializationError(error instanceof Error
                    ? error.message
                    : "Blockly failed to initialize.");
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
    }, [props.editorMode, props.toolboxDefinition, recalculateWorkspace, retryKey]);
    (0, react_1.useEffect)(() => {
        if (!workspaceRef.current || props.editorMode !== "edit") {
            return;
        }
        workspaceRef.current.updateToolbox(props.toolboxDefinition);
    }, [props.editorMode, props.toolboxDefinition]);
    if (initializationError) {
        return ((0, jsx_runtime_1.jsxs)(card_1.Card, { className: BlocklyWorkspace_module_css_1.default.hostCard, children: [(0, jsx_runtime_1.jsxs)(card_1.CardHeader, { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700", children: (0, jsx_runtime_1.jsx)(lucide_react_1.AlertTriangle, { className: "h-5 w-5" }) }), (0, jsx_runtime_1.jsx)(card_1.CardTitle, { className: "text-2xl tracking-[-0.04em]", children: "Editor failed to load" })] }), (0, jsx_runtime_1.jsxs)(card_1.CardContent, { className: "space-y-4 text-sm text-muted-foreground", children: [(0, jsx_runtime_1.jsx)("p", { children: "Blockly could not attach to the planning surface. Retry the editor or return to the dashboard launchpad." }), (0, jsx_runtime_1.jsx)("p", { className: "rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3", children: initializationError }), (0, jsx_runtime_1.jsxs)(button_1.Button, { onClick: () => setRetryKey((current) => current + 1), type: "button", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "mr-2 h-4 w-4" }), "Retry editor"] })] })] }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { className: `${BlocklyWorkspace_module_css_1.default.hostShell} blockly-host`, children: (0, jsx_runtime_1.jsx)("div", { className: BlocklyWorkspace_module_css_1.default.blocklyViewport, ref: hostRef }) }));
}
exports.BlocklyWorkspace = BlocklyWorkspace;
