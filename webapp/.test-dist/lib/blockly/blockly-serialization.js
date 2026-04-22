"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadBlocklyWorkspace = exports.compareBlocklyWorkspaceRecords = exports.serializeBlocklyWorkspace = exports.normalizeBlocklyWorkspaceRecord = exports.isBlocklyWorkspaceRecord = exports.createPersistedBlocklyWorkspaceRecord = exports.areBlocklyWorkspaceJsonEquivalent = exports.stringifyBlocklyWorkspaceJson = exports.normalizeBlocklyWorkspaceJson = exports.parseBlocklyWorkspaceJson = exports.createBlocklyWorkspaceRecord = exports.createEmptyBlocklyWorkspaceJson = exports.isBlocklyWorkspaceSaveSource = exports.BLOCKLY_WORKSPACE_SCHEMA_VERSION = exports.BLOCKLY_WORKSPACE_FORMAT = void 0;
exports.BLOCKLY_WORKSPACE_FORMAT = "blockly_json";
exports.BLOCKLY_WORKSPACE_SCHEMA_VERSION = 1;
function isBlocklyWorkspaceSaveSource(value) {
    return (value === "workspace_clear" ||
        value === "workspace_recovery" ||
        value === "workspace_seed" ||
        value === "workspace_sync");
}
exports.isBlocklyWorkspaceSaveSource = isBlocklyWorkspaceSaveSource;
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
function parseBlocklyWorkspaceJson(value) {
    if (typeof value === "string") {
        try {
            const parsedValue = JSON.parse(value);
            return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
                ? parsedValue
                : null;
        }
        catch {
            return null;
        }
    }
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : null;
}
exports.parseBlocklyWorkspaceJson = parseBlocklyWorkspaceJson;
function normalizeBlocklyWorkspaceJson(value) {
    return parseBlocklyWorkspaceJson(value) ?? createEmptyBlocklyWorkspaceJson();
}
exports.normalizeBlocklyWorkspaceJson = normalizeBlocklyWorkspaceJson;
function stringifyBlocklyWorkspaceJson(value) {
    return JSON.stringify(normalizeBlocklyWorkspaceJson(value));
}
exports.stringifyBlocklyWorkspaceJson = stringifyBlocklyWorkspaceJson;
function areBlocklyWorkspaceJsonEquivalent(left, right) {
    return stringifyBlocklyWorkspaceJson(left) === stringifyBlocklyWorkspaceJson(right);
}
exports.areBlocklyWorkspaceJsonEquivalent = areBlocklyWorkspaceJsonEquivalent;
function createPersistedBlocklyWorkspaceRecord(record) {
    const normalizedRecord = normalizeBlocklyWorkspaceRecord(record);
    return {
        ...normalizedRecord,
        workspaceJson: stringifyBlocklyWorkspaceJson(normalizedRecord.workspaceJson),
    };
}
exports.createPersistedBlocklyWorkspaceRecord = createPersistedBlocklyWorkspaceRecord;
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
        (typeof record.workspaceJson === "string" ||
            (typeof record.workspaceJson === "object" &&
                record.workspaceJson !== null &&
                !Array.isArray(record.workspaceJson))) &&
        editorMetadata !== null &&
        typeof editorMetadata.lastSavedAt === "number" &&
        typeof editorMetadata.lastSavedByUserId === "string" &&
        (typeof editorMetadata.recoveredAt === "number" ||
            editorMetadata.recoveredAt === null) &&
        typeof editorMetadata.revision === "number" &&
        isBlocklyWorkspaceSaveSource(editorMetadata.saveSource));
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
        workspaceJson: normalizeBlocklyWorkspaceJson(value.workspaceJson),
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
function compareBlocklyWorkspaceRecords(left, right) {
    const leftRevision = left?.editorMetadata.revision ?? 0;
    const rightRevision = right?.editorMetadata.revision ?? 0;
    if (leftRevision !== rightRevision) {
        return leftRevision - rightRevision;
    }
    const leftRecoveredAt = left?.editorMetadata.recoveredAt ?? 0;
    const rightRecoveredAt = right?.editorMetadata.recoveredAt ?? 0;
    if (leftRecoveredAt !== rightRecoveredAt) {
        return leftRecoveredAt - rightRecoveredAt;
    }
    const leftSavedAt = left?.editorMetadata.lastSavedAt ?? 0;
    const rightSavedAt = right?.editorMetadata.lastSavedAt ?? 0;
    return leftSavedAt - rightSavedAt;
}
exports.compareBlocklyWorkspaceRecords = compareBlocklyWorkspaceRecords;
function loadBlocklyWorkspace(args) {
    const record = normalizeBlocklyWorkspaceRecord(args.record);
    args.Blockly.serialization.workspaces.load(normalizeBlocklyWorkspaceJson(record.workspaceJson), args.workspace);
}
exports.loadBlocklyWorkspace = loadBlocklyWorkspace;
