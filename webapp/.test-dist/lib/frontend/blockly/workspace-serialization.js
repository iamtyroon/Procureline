"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSerializedBlocklyWorkspaceSnapshot = exports.loadBlocklyWorkspace = exports.serializeBlocklyWorkspace = void 0;
const blockly_serialization_1 = require("@/lib/shared/blockly/blockly-serialization");
function serializeBlocklyWorkspace(args) {
    const previousRevision = args.previousRecord?.editorMetadata.revision ?? 0;
    const workspaceJson = args.Blockly.serialization.workspaces.save(args.workspace);
    return (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedAt: args.lastSavedAt ?? Date.now(),
        lastSavedByUserId: args.lastSavedByUserId,
        recoveredAt: args.previousRecord?.editorMetadata.recoveredAt ?? null,
        revision: previousRevision + 1,
        saveSource: args.saveSource ?? "workspace_sync",
        workspaceJson,
    });
}
exports.serializeBlocklyWorkspace = serializeBlocklyWorkspace;
function loadBlocklyWorkspace(args) {
    const record = (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(args.record);
    args.Blockly.serialization.workspaces.load((0, blockly_serialization_1.normalizeBlocklyWorkspaceJson)(record.workspaceJson), args.workspace);
}
exports.loadBlocklyWorkspace = loadBlocklyWorkspace;
function createSerializedBlocklyWorkspaceSnapshot(args) {
    return serializeBlocklyWorkspace({
        Blockly: args.Blockly,
        lastSavedByUserId: args.currentUserId,
        previousRecord: args.previousRecord,
        workspace: args.workspace,
    });
}
exports.createSerializedBlocklyWorkspaceSnapshot = createSerializedBlocklyWorkspaceSnapshot;
