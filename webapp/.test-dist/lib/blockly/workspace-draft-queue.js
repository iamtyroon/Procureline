"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearDepartmentUserWorkspaceDraftState = exports.clearDepartmentUserWorkspaceRecoverySnapshot = exports.clearDepartmentUserWorkspaceQueuedSnapshot = exports.upsertDepartmentUserWorkspaceRecoverySnapshot = exports.upsertDepartmentUserWorkspaceQueuedSnapshot = exports.readDepartmentUserWorkspaceDraftState = exports.releaseDepartmentUserWorkspaceSessionLease = exports.claimDepartmentUserWorkspaceSessionLease = exports.readDepartmentUserWorkspaceSessionLease = exports.hasCompetingDepartmentUserWorkspaceSession = exports.parseDepartmentUserWorkspaceSessionLease = exports.serializeDepartmentUserWorkspaceSessionLease = exports.parseDepartmentUserWorkspaceSaveFailure = exports.shouldInterceptDepartmentUserRouteNavigation = exports.shouldWarnDepartmentUserBeforeLeave = exports.getDepartmentUserWorkspaceRecoveryMessage = exports.getDepartmentUserWorkspaceSaveIndicatorLabel = exports.createClearedDepartmentUserWorkspaceRecord = exports.createRecoveredDepartmentUserWorkspaceRecord = exports.shouldOfferDepartmentUserWorkspaceRecovery = exports.compareDepartmentUserWorkspaceRecoveryFreshness = exports.coalesceDepartmentUserWorkspaceSnapshot = void 0;
const blockly_serialization_1 = require("./blockly-serialization");
const DEPARTMENT_USER_WORKSPACE_DRAFT_DB_NAME = "procureline-blockly-drafts";
const DEPARTMENT_USER_WORKSPACE_DRAFT_DB_VERSION = 1;
const DEPARTMENT_USER_WORKSPACE_DRAFT_STORE = "department-user-workspace-drafts";
const DEPARTMENT_USER_WORKSPACE_LEASE_TTL_MS = 15_000;
const DEPARTMENT_USER_WORKSPACE_RECOVERY_MESSAGE = "Recovered unsaved changes. Review and save.";
function getIndexedDbFactory() {
    if (typeof window === "undefined") {
        return null;
    }
    return window.indexedDB;
}
async function openDepartmentUserWorkspaceDraftDatabase() {
    const indexedDbFactory = getIndexedDbFactory();
    if (!indexedDbFactory) {
        throw new Error("IndexedDB is unavailable in this browser context.");
    }
    return await new Promise((resolve, reject) => {
        const request = indexedDbFactory.open(DEPARTMENT_USER_WORKSPACE_DRAFT_DB_NAME, DEPARTMENT_USER_WORKSPACE_DRAFT_DB_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(DEPARTMENT_USER_WORKSPACE_DRAFT_STORE)) {
                database.createObjectStore(DEPARTMENT_USER_WORKSPACE_DRAFT_STORE, {
                    keyPath: "id",
                });
            }
        };
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error ??
                new Error("Failed to open the Blockly workspace draft database."));
        };
    });
}
function createDepartmentUserWorkspaceDraftRecordId(args) {
    return `procureline:blockly-draft:${args.userId}:${args.planId}`;
}
function createDepartmentUserWorkspaceSessionLeaseStorageKey(args) {
    return `procureline:blockly-session:${args.userId}:${args.planId}`;
}
function normalizeDepartmentUserWorkspaceDraftState(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const candidate = value;
    if (typeof candidate.planId !== "string" ||
        typeof candidate.updatedAt !== "number" ||
        typeof candidate.userId !== "string") {
        return null;
    }
    const queuedSnapshot = candidate.queuedSnapshot === null || candidate.queuedSnapshot === undefined
        ? null
        : (0, blockly_serialization_1.isBlocklyWorkspaceRecord)(candidate.queuedSnapshot)
            ? (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(candidate.queuedSnapshot)
            : null;
    const recoverySnapshot = candidate.recoverySnapshot === null ||
        candidate.recoverySnapshot === undefined
        ? null
        : (0, blockly_serialization_1.isBlocklyWorkspaceRecord)(candidate.recoverySnapshot)
            ? (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(candidate.recoverySnapshot)
            : null;
    return {
        planId: candidate.planId,
        queuedSnapshot,
        recoverySnapshot,
        updatedAt: candidate.updatedAt,
        userId: candidate.userId,
    };
}
function toDepartmentUserWorkspaceStorageFailure(error, fallbackMessage) {
    return {
        code: "STORAGE_UNAVAILABLE",
        message: error instanceof Error && error.message.trim().length > 0
            ? error.message
            : fallbackMessage,
    };
}
function coalesceDepartmentUserWorkspaceSnapshot(currentSnapshot, nextSnapshot) {
    return (0, blockly_serialization_1.compareBlocklyWorkspaceRecords)(currentSnapshot, nextSnapshot) >= 0
        ? (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(currentSnapshot)
        : (0, blockly_serialization_1.normalizeBlocklyWorkspaceRecord)(nextSnapshot);
}
exports.coalesceDepartmentUserWorkspaceSnapshot = coalesceDepartmentUserWorkspaceSnapshot;
function compareDepartmentUserWorkspaceRecoveryFreshness(args) {
    const comparison = (0, blockly_serialization_1.compareBlocklyWorkspaceRecords)(args.localSnapshot, args.serverSnapshot);
    if (comparison > 0) {
        return "local_newer";
    }
    if (comparison < 0) {
        return "server_authoritative";
    }
    return "equal";
}
exports.compareDepartmentUserWorkspaceRecoveryFreshness = compareDepartmentUserWorkspaceRecoveryFreshness;
function shouldOfferDepartmentUserWorkspaceRecovery(args) {
    return (compareDepartmentUserWorkspaceRecoveryFreshness(args) === "local_newer");
}
exports.shouldOfferDepartmentUserWorkspaceRecovery = shouldOfferDepartmentUserWorkspaceRecovery;
function createRecoveredDepartmentUserWorkspaceRecord(args) {
    const now = Date.now();
    return (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedAt: now,
        lastSavedByUserId: args.currentUserId,
        recoveredAt: now,
        revision: Math.max(args.localSnapshot.editorMetadata.revision, args.serverSnapshot?.editorMetadata.revision ?? 0) + 1,
        saveSource: "workspace_recovery",
        workspaceJson: args.localSnapshot.workspaceJson,
    });
}
exports.createRecoveredDepartmentUserWorkspaceRecord = createRecoveredDepartmentUserWorkspaceRecord;
function createClearedDepartmentUserWorkspaceRecord(args) {
    return (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedByUserId: args.currentUserId,
        recoveredAt: null,
        revision: (args.previousSnapshot?.editorMetadata.revision ?? 0) + 1,
        saveSource: "workspace_clear",
        workspaceJson: (0, blockly_serialization_1.createEmptyBlocklyWorkspaceJson)(),
    });
}
exports.createClearedDepartmentUserWorkspaceRecord = createClearedDepartmentUserWorkspaceRecord;
function getDepartmentUserWorkspaceSaveIndicatorLabel(args) {
    switch (args.indicatorState) {
        case "saving":
            return "Saving draft...";
        case "saved":
            return args.lastSavedAt
                ? `Saved ${new Date(args.lastSavedAt).toLocaleTimeString()}`
                : "Saved";
        case "queued":
            return "Saved locally. Sync pending.";
        case "blocked":
            return args.blockedMessage?.trim() || "Sync blocked. Review changes.";
        case "error":
            return "Save failed";
        case "idle":
        default:
            return "Draft open";
    }
}
exports.getDepartmentUserWorkspaceSaveIndicatorLabel = getDepartmentUserWorkspaceSaveIndicatorLabel;
function getDepartmentUserWorkspaceRecoveryMessage() {
    return DEPARTMENT_USER_WORKSPACE_RECOVERY_MESSAGE;
}
exports.getDepartmentUserWorkspaceRecoveryMessage = getDepartmentUserWorkspaceRecoveryMessage;
function shouldWarnDepartmentUserBeforeLeave(args) {
    return (args.mode === "edit" &&
        (args.hasUnsyncedRisk || args.isSaveInFlight));
}
exports.shouldWarnDepartmentUserBeforeLeave = shouldWarnDepartmentUserBeforeLeave;
function shouldInterceptDepartmentUserRouteNavigation(args) {
    if (!shouldWarnDepartmentUserBeforeLeave(args)) {
        return false;
    }
    try {
        const currentLocation = new URL(args.currentUrl);
        const nextLocation = new URL(args.nextUrl, currentLocation);
        return (currentLocation.origin === nextLocation.origin &&
            currentLocation.href !== nextLocation.href);
    }
    catch {
        return false;
    }
}
exports.shouldInterceptDepartmentUserRouteNavigation = shouldInterceptDepartmentUserRouteNavigation;
function parseDepartmentUserWorkspaceSaveFailure(error) {
    const rawMessage = error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : "Draft sync could not be confirmed.";
    const dataCode = typeof error.data?.code === "string"
        ? (error.data?.code ?? null)
        : null;
    const matchedCode = dataCode ??
        rawMessage.match(/"code":"(PLAN_NOT_FOUND|STALE_WORKSPACE_REVISION|UNAUTHORIZED|VALIDATION_FAILED)"/)?.[1] ??
        null;
    const matchedMessage = typeof error.data?.message === "string"
        ? (error.data?.message ?? rawMessage)
        : rawMessage.match(/"message":"([^"]+)"/)?.[1]?.replace(/\\"/g, '"') ??
            rawMessage;
    switch (matchedCode) {
        case "PLAN_NOT_FOUND":
            return {
                code: matchedCode,
                message: matchedMessage || "This plan is no longer available for draft changes.",
                stopRetry: true,
            };
        case "STALE_WORKSPACE_REVISION":
            return {
                code: matchedCode,
                message: matchedMessage ||
                    "A newer draft already exists in another session. Refresh before continuing here.",
                stopRetry: true,
            };
        case "UNAUTHORIZED":
        case "VALIDATION_FAILED":
            return {
                code: matchedCode,
                message: matchedMessage,
                stopRetry: true,
            };
        default:
            return {
                code: "UNKNOWN",
                message: rawMessage,
                stopRetry: false,
            };
    }
}
exports.parseDepartmentUserWorkspaceSaveFailure = parseDepartmentUserWorkspaceSaveFailure;
function serializeDepartmentUserWorkspaceSessionLease(lease) {
    return JSON.stringify(lease);
}
exports.serializeDepartmentUserWorkspaceSessionLease = serializeDepartmentUserWorkspaceSessionLease;
function parseDepartmentUserWorkspaceSessionLease(rawLease) {
    if (!rawLease) {
        return null;
    }
    try {
        const parsed = JSON.parse(rawLease);
        if (typeof parsed.heartbeatAt !== "number" ||
            typeof parsed.sessionId !== "string") {
            return null;
        }
        return {
            heartbeatAt: parsed.heartbeatAt,
            sessionId: parsed.sessionId,
        };
    }
    catch {
        return null;
    }
}
exports.parseDepartmentUserWorkspaceSessionLease = parseDepartmentUserWorkspaceSessionLease;
function hasCompetingDepartmentUserWorkspaceSession(args) {
    if (!args.lease || args.lease.sessionId === args.sessionId) {
        return false;
    }
    const now = args.currentTime ?? Date.now();
    const ttlMs = args.ttlMs && args.ttlMs > 0
        ? args.ttlMs
        : DEPARTMENT_USER_WORKSPACE_LEASE_TTL_MS;
    return now - args.lease.heartbeatAt < ttlMs;
}
exports.hasCompetingDepartmentUserWorkspaceSession = hasCompetingDepartmentUserWorkspaceSession;
function readDepartmentUserWorkspaceSessionLease(args) {
    if (typeof window === "undefined") {
        return null;
    }
    try {
        return parseDepartmentUserWorkspaceSessionLease(window.localStorage.getItem(createDepartmentUserWorkspaceSessionLeaseStorageKey(args)));
    }
    catch {
        return null;
    }
}
exports.readDepartmentUserWorkspaceSessionLease = readDepartmentUserWorkspaceSessionLease;
function claimDepartmentUserWorkspaceSessionLease(args) {
    if (typeof window === "undefined") {
        return { ok: true };
    }
    try {
        window.localStorage.setItem(createDepartmentUserWorkspaceSessionLeaseStorageKey(args), serializeDepartmentUserWorkspaceSessionLease({
            heartbeatAt: args.heartbeatAt ?? Date.now(),
            sessionId: args.sessionId,
        }));
        return { ok: true };
    }
    catch (error) {
        return {
            error: toDepartmentUserWorkspaceStorageFailure(error, "This browser blocked the workspace session marker."),
            ok: false,
        };
    }
}
exports.claimDepartmentUserWorkspaceSessionLease = claimDepartmentUserWorkspaceSessionLease;
function releaseDepartmentUserWorkspaceSessionLease(args) {
    if (typeof window === "undefined") {
        return;
    }
    try {
        const currentLease = readDepartmentUserWorkspaceSessionLease(args);
        if (!currentLease || currentLease.sessionId !== args.sessionId) {
            return;
        }
        window.localStorage.removeItem(createDepartmentUserWorkspaceSessionLeaseStorageKey(args));
    }
    catch {
        // Lease release is best effort only.
    }
}
exports.releaseDepartmentUserWorkspaceSessionLease = releaseDepartmentUserWorkspaceSessionLease;
async function readDepartmentUserWorkspaceDraftState(args) {
    try {
        const database = await openDepartmentUserWorkspaceDraftDatabase();
        const record = await new Promise((resolve, reject) => {
            const transaction = database.transaction(DEPARTMENT_USER_WORKSPACE_DRAFT_STORE, "readonly");
            const store = transaction.objectStore(DEPARTMENT_USER_WORKSPACE_DRAFT_STORE);
            const request = store.get(createDepartmentUserWorkspaceDraftRecordId(args));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        if (!record) {
            return {
                ok: true,
                value: null,
            };
        }
        const normalizedState = normalizeDepartmentUserWorkspaceDraftState(record);
        if (!normalizedState) {
            await clearDepartmentUserWorkspaceDraftState(args);
            return {
                error: {
                    code: "STORAGE_CORRUPT",
                    message: "Saved local workspace recovery data was corrupted and has been cleared.",
                },
                ok: false,
            };
        }
        return {
            ok: true,
            value: normalizedState,
        };
    }
    catch (error) {
        return {
            error: toDepartmentUserWorkspaceStorageFailure(error, "This browser could not read local workspace recovery data."),
            ok: false,
        };
    }
}
exports.readDepartmentUserWorkspaceDraftState = readDepartmentUserWorkspaceDraftState;
async function writeDepartmentUserWorkspaceDraftState(args) {
    try {
        const database = await openDepartmentUserWorkspaceDraftDatabase();
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(DEPARTMENT_USER_WORKSPACE_DRAFT_STORE, "readwrite");
            const store = transaction.objectStore(DEPARTMENT_USER_WORKSPACE_DRAFT_STORE);
            const id = createDepartmentUserWorkspaceDraftRecordId(args);
            const request = args.queuedSnapshot === null && args.recoverySnapshot === null
                ? store.delete(id)
                : store.put({
                    id,
                    planId: args.planId,
                    queuedSnapshot: args.queuedSnapshot,
                    recoverySnapshot: args.recoverySnapshot,
                    updatedAt: Date.now(),
                    userId: args.userId,
                });
            request.onerror = () => reject(request.error);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ??
                new Error("Failed to update local workspace draft data."));
        });
        return {
            ok: true,
        };
    }
    catch (error) {
        return {
            error: toDepartmentUserWorkspaceStorageFailure(error, "This browser could not update local workspace recovery data."),
            ok: false,
        };
    }
}
async function upsertDepartmentUserWorkspaceQueuedSnapshot(args) {
    const existingState = await readDepartmentUserWorkspaceDraftState(args);
    if (!existingState.ok && existingState.error.code === "STORAGE_CORRUPT") {
        return existingState;
    }
    const currentState = existingState.ok ? existingState.value : null;
    const queuedSnapshot = coalesceDepartmentUserWorkspaceSnapshot(currentState?.queuedSnapshot, args.snapshot);
    const recoverySnapshot = coalesceDepartmentUserWorkspaceSnapshot(currentState?.recoverySnapshot, args.snapshot);
    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot,
        recoverySnapshot,
        userId: args.userId,
    });
}
exports.upsertDepartmentUserWorkspaceQueuedSnapshot = upsertDepartmentUserWorkspaceQueuedSnapshot;
async function upsertDepartmentUserWorkspaceRecoverySnapshot(args) {
    const existingState = await readDepartmentUserWorkspaceDraftState(args);
    if (!existingState.ok && existingState.error.code === "STORAGE_CORRUPT") {
        return existingState;
    }
    const currentState = existingState.ok ? existingState.value : null;
    const recoverySnapshot = coalesceDepartmentUserWorkspaceSnapshot(currentState?.recoverySnapshot, args.snapshot);
    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot: currentState?.queuedSnapshot ?? null,
        recoverySnapshot,
        userId: args.userId,
    });
}
exports.upsertDepartmentUserWorkspaceRecoverySnapshot = upsertDepartmentUserWorkspaceRecoverySnapshot;
async function clearDepartmentUserWorkspaceQueuedSnapshot(args) {
    const existingState = await readDepartmentUserWorkspaceDraftState(args);
    if (!existingState.ok && existingState.error.code === "STORAGE_CORRUPT") {
        return existingState;
    }
    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot: null,
        recoverySnapshot: existingState.ok
            ? existingState.value?.recoverySnapshot ?? null
            : null,
        userId: args.userId,
    });
}
exports.clearDepartmentUserWorkspaceQueuedSnapshot = clearDepartmentUserWorkspaceQueuedSnapshot;
async function clearDepartmentUserWorkspaceRecoverySnapshot(args) {
    const existingState = await readDepartmentUserWorkspaceDraftState(args);
    if (!existingState.ok && existingState.error.code === "STORAGE_CORRUPT") {
        return existingState;
    }
    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot: existingState.ok
            ? existingState.value?.queuedSnapshot ?? null
            : null,
        recoverySnapshot: null,
        userId: args.userId,
    });
}
exports.clearDepartmentUserWorkspaceRecoverySnapshot = clearDepartmentUserWorkspaceRecoverySnapshot;
async function clearDepartmentUserWorkspaceDraftState(args) {
    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot: null,
        recoverySnapshot: null,
        userId: args.userId,
    });
}
exports.clearDepartmentUserWorkspaceDraftState = clearDepartmentUserWorkspaceDraftState;
