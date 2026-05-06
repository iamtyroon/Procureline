export const BLOCKLY_WORKSPACE_FORMAT = "blockly_json" as const;
export const BLOCKLY_WORKSPACE_SCHEMA_VERSION = 1 as const;

export type BlocklyWorkspaceJson = Record<string, unknown>;
export type BlocklyWorkspaceStoredJson = BlocklyWorkspaceJson | string;

export type BlocklyWorkspaceSaveSource =
    | "workspace_clear"
    | "workspace_recovery"
    | "workspace_seed"
    | "workspace_sync";

export interface BlocklyWorkspaceEditorMetadata {
    lastSavedAt: number;
    lastSavedByUserId: string;
    recoveredAt: number | null;
    revision: number;
    saveSource: BlocklyWorkspaceSaveSource;
}

export interface BlocklyWorkspaceRecord {
    editorMetadata: BlocklyWorkspaceEditorMetadata;
    format: typeof BLOCKLY_WORKSPACE_FORMAT;
    schemaVersion: typeof BLOCKLY_WORKSPACE_SCHEMA_VERSION;
    workspaceJson: BlocklyWorkspaceStoredJson;
}

export function isBlocklyWorkspaceSaveSource(
    value: unknown,
): value is BlocklyWorkspaceSaveSource {
    return (
        value === "workspace_clear" ||
        value === "workspace_recovery" ||
        value === "workspace_seed" ||
        value === "workspace_sync"
    );
}

export function createEmptyBlocklyWorkspaceJson(): BlocklyWorkspaceJson {
    return {
        blocks: {
            blocks: [],
            languageVersion: 0,
        },
    };
}

export function createBlocklyWorkspaceRecord(args?: {
    lastSavedAt?: number;
    lastSavedByUserId?: string;
    recoveredAt?: number | null;
    revision?: number;
    saveSource?: BlocklyWorkspaceSaveSource;
    workspaceJson?: BlocklyWorkspaceStoredJson;
}): BlocklyWorkspaceRecord {
    return {
        editorMetadata: {
            lastSavedAt: args?.lastSavedAt ?? Date.now(),
            lastSavedByUserId: args?.lastSavedByUserId ?? "system",
            recoveredAt: args?.recoveredAt ?? null,
            revision: args?.revision ?? 1,
            saveSource: args?.saveSource ?? "workspace_seed",
        },
        format: BLOCKLY_WORKSPACE_FORMAT,
        schemaVersion: BLOCKLY_WORKSPACE_SCHEMA_VERSION,
        workspaceJson: args?.workspaceJson ?? createEmptyBlocklyWorkspaceJson(),
    };
}

export function parseBlocklyWorkspaceJson(value: unknown): BlocklyWorkspaceJson | null {
    if (typeof value === "string") {
        try {
            const parsedValue = JSON.parse(value) as unknown;
            return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
                ? (parsedValue as BlocklyWorkspaceJson)
                : null;
        } catch {
            return null;
        }
    }

    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as BlocklyWorkspaceJson)
        : null;
}

export function normalizeBlocklyWorkspaceJson(value: unknown): BlocklyWorkspaceJson {
    return parseBlocklyWorkspaceJson(value) ?? createEmptyBlocklyWorkspaceJson();
}

export function stringifyBlocklyWorkspaceJson(value: unknown): string {
    return JSON.stringify(normalizeBlocklyWorkspaceJson(value));
}

export function areBlocklyWorkspaceJsonEquivalent(
    left: unknown,
    right: unknown,
): boolean {
    return stringifyBlocklyWorkspaceJson(left) === stringifyBlocklyWorkspaceJson(right);
}

export function createPersistedBlocklyWorkspaceRecord(
    record: BlocklyWorkspaceRecord,
): BlocklyWorkspaceRecord {
    const normalizedRecord = normalizeBlocklyWorkspaceRecord(record);

    return {
        ...normalizedRecord,
        workspaceJson: stringifyBlocklyWorkspaceJson(normalizedRecord.workspaceJson),
    };
}

export function isBlocklyWorkspaceRecord(value: unknown): value is BlocklyWorkspaceRecord {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }

    const record = value as Record<string, unknown>;
    const editorMetadata =
        typeof record.editorMetadata === "object" && record.editorMetadata !== null
            ? (record.editorMetadata as Record<string, unknown>)
            : null;

    return (
        record.format === BLOCKLY_WORKSPACE_FORMAT &&
        record.schemaVersion === BLOCKLY_WORKSPACE_SCHEMA_VERSION &&
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
        isBlocklyWorkspaceSaveSource(editorMetadata.saveSource)
    );
}

export function normalizeBlocklyWorkspaceRecord(
    value: unknown,
    fallback?: {
        lastSavedAt?: number;
        lastSavedByUserId?: string;
        recoveredAt?: number | null;
        revision?: number;
        saveSource?: BlocklyWorkspaceSaveSource;
    },
): BlocklyWorkspaceRecord {
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

export function compareBlocklyWorkspaceRecords(
    left: BlocklyWorkspaceRecord | null | undefined,
    right: BlocklyWorkspaceRecord | null | undefined,
): number {
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
