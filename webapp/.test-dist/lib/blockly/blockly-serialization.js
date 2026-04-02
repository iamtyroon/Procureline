"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBlocklyWorkspace = exports.serializeBlocklyWorkspace = exports.normalizeBlocklyWorkspaceRecord = exports.isBlocklyWorkspaceRecord = exports.createBlocklyWorkspaceRecord = exports.createEmptyBlocklyWorkspaceJson = exports.BLOCKLY_WORKSPACE_SCHEMA_VERSION = exports.BLOCKLY_WORKSPACE_FORMAT = void 0;
exports.BLOCKLY_WORKSPACE_FORMAT = "blockly_json";
exports.BLOCKLY_WORKSPACE_SCHEMA_VERSION = 1;
function createEmptyBlocklyWorkspaceJson() {
    return {
        blocks: {
            blocks: [],
            languageVersion: 0,
        },
    };
}
exports.createEmptyBlocklyWorkspaceJson = createEmptyBlocklyWorkspaceJson;
function createBlocklyWorkspaceRecord(args) {
    return {
        editorMetadata: {
            lastSavedAt: args?.lastSavedAt ?? Date.now(),
            lastSavedByUserId: args?.lastSavedByUserId ?? "system",
            recoveredAt: args?.recoveredAt ?? null,
            revision: args?.revision ?? 1,
            saveSource: args?.saveSource ?? "workspace_seed",
        },
        format: exports.BLOCKLY_WORKSPACE_FORMAT,
        schemaVersion: exports.BLOCKLY_WORKSPACE_SCHEMA_VERSION,
        workspaceJson: args?.workspaceJson ?? createEmptyBlocklyWorkspaceJson(),
    };
}
exports.createBlocklyWorkspaceRecord = createBlocklyWorkspaceRecord;
function isBlocklyWorkspaceRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const record = value;
    const editorMetadata = typeof record.editorMetadata === "object" && record.editorMetadata !== null
        ? record.editorMetadata
        : null;
    return (record.format === exports.BLOCKLY_WORKSPACE_FORMAT &&
        record.schemaVersion === exports.BLOCKLY_WORKSPACE_SCHEMA_VERSION &&
        typeof record.workspaceJson === "object" &&
        record.workspaceJson !== null &&
        editorMetadata !== null &&
        typeof editorMetadata.lastSavedAt === "number" &&
        typeof editorMetadata.lastSavedByUserId === "string" &&
        (typeof editorMetadata.recoveredAt === "number" ||
            editorMetadata.recoveredAt === null) &&
        typeof editorMetadata.revision === "number" &&
        (editorMetadata.saveSource === "workspace_seed" ||
            editorMetadata.saveSource === "workspace_sync"));
}
exports.isBlocklyWorkspaceRecord = isBlocklyWorkspaceRecord;
function normalizeBlocklyWorkspaceRecord(value, fallback) {
    if (!isBlocklyWorkspaceRecord(value)) {
        return createBlocklyWorkspaceRecord(fallback);
    }
    return createBlocklyWorkspaceRecord({
        lastSavedAt: value.editorMetadata.lastSavedAt,
        lastSavedByUserId: value.editorMetadata.lastSavedByUserId,
        recoveredAt: value.editorMetadata.recoveredAt,
        revision: value.editorMetadata.revision,
        saveSource: value.editorMetadata.saveSource,
        workspaceJson: value.workspaceJson,
    });
}
exports.normalizeBlocklyWorkspaceRecord = normalizeBlocklyWorkspaceRecord;
function serializeBlocklyWorkspace(args) {
    const previousRevision = args.previousRecord?.editorMetadata.revision ?? 0;
    const workspaceJson = args.Blockly.serialization.workspaces.save(args.workspace);
    return createBlocklyWorkspaceRecord({
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
    const record = normalizeBlocklyWorkspaceRecord(args.record);
    args.Blockly.serialization.workspaces.load(record.workspaceJson, args.workspace);
}
exports.loadBlocklyWorkspace = loadBlocklyWorkspace;
