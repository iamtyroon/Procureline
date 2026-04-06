import {
    compareBlocklyWorkspaceRecords,
    createBlocklyWorkspaceRecord,
    createEmptyBlocklyWorkspaceJson,
    isBlocklyWorkspaceRecord,
    normalizeBlocklyWorkspaceRecord,
    type BlocklyWorkspaceRecord,
} from "./blockly-serialization";

const DEPARTMENT_USER_WORKSPACE_DRAFT_DB_NAME = "procureline-blockly-drafts";
const DEPARTMENT_USER_WORKSPACE_DRAFT_DB_VERSION = 1;
const DEPARTMENT_USER_WORKSPACE_DRAFT_STORE = "department-user-workspace-drafts";
const DEPARTMENT_USER_WORKSPACE_LEASE_TTL_MS = 15_000;
const DEPARTMENT_USER_WORKSPACE_RECOVERY_MESSAGE =
    "Recovered unsaved changes. Review and save.";

export type DepartmentUserWorkspaceSaveIndicatorState =
    | "blocked"
    | "error"
    | "idle"
    | "queued"
    | "saved"
    | "saving";

export type DepartmentUserWorkspaceSaveFailureCode =
    | "PLAN_NOT_FOUND"
    | "STALE_WORKSPACE_REVISION"
    | "UNAUTHORIZED"
    | "VALIDATION_FAILED"
    | "UNKNOWN";

export interface DepartmentUserWorkspaceDraftState {
    planId: string;
    queuedSnapshot: BlocklyWorkspaceRecord | null;
    recoverySnapshot: BlocklyWorkspaceRecord | null;
    updatedAt: number;
    userId: string;
}

export interface DepartmentUserWorkspaceSessionLease {
    heartbeatAt: number;
    sessionId: string;
}

export interface DepartmentUserWorkspaceStorageFailure {
    code: "STORAGE_CORRUPT" | "STORAGE_UNAVAILABLE";
    message: string;
}

export interface DepartmentUserWorkspaceSaveFailure {
    code: DepartmentUserWorkspaceSaveFailureCode;
    message: string;
    stopRetry: boolean;
}

export interface DepartmentUserWorkspaceLeaveGuardArgs {
    hasUnsyncedRisk: boolean;
    isSaveInFlight: boolean;
    mode: "edit" | "view";
}

type DepartmentUserWorkspaceDraftStateResult =
    | {
          ok: true;
          value: DepartmentUserWorkspaceDraftState | null;
      }
    | {
          error: DepartmentUserWorkspaceStorageFailure;
          ok: false;
      };

type DepartmentUserWorkspaceStorageWriteResult =
    | {
          ok: true;
      }
    | {
          error: DepartmentUserWorkspaceStorageFailure;
          ok: false;
      };

function getIndexedDbFactory():
    | IDBFactory
    | null {
    if (typeof window === "undefined") {
        return null;
    }

    return window.indexedDB;
}

async function openDepartmentUserWorkspaceDraftDatabase(): Promise<IDBDatabase> {
    const indexedDbFactory = getIndexedDbFactory();
    if (!indexedDbFactory) {
        throw new Error("IndexedDB is unavailable in this browser context.");
    }

    return await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDbFactory.open(
            DEPARTMENT_USER_WORKSPACE_DRAFT_DB_NAME,
            DEPARTMENT_USER_WORKSPACE_DRAFT_DB_VERSION,
        );

        request.onupgradeneeded = () => {
            const database = request.result;
            if (
                !database.objectStoreNames.contains(
                    DEPARTMENT_USER_WORKSPACE_DRAFT_STORE,
                )
            ) {
                database.createObjectStore(DEPARTMENT_USER_WORKSPACE_DRAFT_STORE, {
                    keyPath: "id",
                });
            }
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(
                request.error ??
                    new Error("Failed to open the Blockly workspace draft database."),
            );
        };
    });
}

function createDepartmentUserWorkspaceDraftRecordId(args: {
    planId: string;
    userId: string;
}): string {
    return `procureline:blockly-draft:${args.userId}:${args.planId}`;
}

function createDepartmentUserWorkspaceSessionLeaseStorageKey(args: {
    planId: string;
    userId: string;
}): string {
    return `procureline:blockly-session:${args.userId}:${args.planId}`;
}

function normalizeDepartmentUserWorkspaceDraftState(
    value: unknown,
): DepartmentUserWorkspaceDraftState | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    const candidate = value as Record<string, unknown>;
    if (
        typeof candidate.planId !== "string" ||
        typeof candidate.updatedAt !== "number" ||
        typeof candidate.userId !== "string"
    ) {
        return null;
    }

    const queuedSnapshot =
        candidate.queuedSnapshot === null || candidate.queuedSnapshot === undefined
            ? null
            : isBlocklyWorkspaceRecord(candidate.queuedSnapshot)
              ? normalizeBlocklyWorkspaceRecord(candidate.queuedSnapshot)
              : null;
    const recoverySnapshot =
        candidate.recoverySnapshot === null ||
        candidate.recoverySnapshot === undefined
            ? null
            : isBlocklyWorkspaceRecord(candidate.recoverySnapshot)
              ? normalizeBlocklyWorkspaceRecord(candidate.recoverySnapshot)
              : null;

    return {
        planId: candidate.planId,
        queuedSnapshot,
        recoverySnapshot,
        updatedAt: candidate.updatedAt,
        userId: candidate.userId,
    };
}

function toDepartmentUserWorkspaceStorageFailure(
    error: unknown,
    fallbackMessage: string,
): DepartmentUserWorkspaceStorageFailure {
    return {
        code: "STORAGE_UNAVAILABLE",
        message:
            error instanceof Error && error.message.trim().length > 0
                ? error.message
                : fallbackMessage,
    };
}

export function coalesceDepartmentUserWorkspaceSnapshot(
    currentSnapshot: BlocklyWorkspaceRecord | null | undefined,
    nextSnapshot: BlocklyWorkspaceRecord,
): BlocklyWorkspaceRecord {
    return compareBlocklyWorkspaceRecords(currentSnapshot, nextSnapshot) >= 0
        ? normalizeBlocklyWorkspaceRecord(currentSnapshot)
        : normalizeBlocklyWorkspaceRecord(nextSnapshot);
}

export function compareDepartmentUserWorkspaceRecoveryFreshness(args: {
    localSnapshot: BlocklyWorkspaceRecord | null | undefined;
    serverSnapshot: BlocklyWorkspaceRecord | null | undefined;
}): "equal" | "local_newer" | "server_authoritative" {
    const comparison = compareBlocklyWorkspaceRecords(
        args.localSnapshot,
        args.serverSnapshot,
    );
    if (comparison > 0) {
        return "local_newer";
    }

    if (comparison < 0) {
        return "server_authoritative";
    }

    return "equal";
}

export function shouldOfferDepartmentUserWorkspaceRecovery(args: {
    localSnapshot: BlocklyWorkspaceRecord | null | undefined;
    serverSnapshot: BlocklyWorkspaceRecord | null | undefined;
}): boolean {
    return (
        compareDepartmentUserWorkspaceRecoveryFreshness(args) === "local_newer"
    );
}

export function createRecoveredDepartmentUserWorkspaceRecord(args: {
    currentUserId: string;
    localSnapshot: BlocklyWorkspaceRecord;
    serverSnapshot: BlocklyWorkspaceRecord | null | undefined;
}): BlocklyWorkspaceRecord {
    const now = Date.now();
    return createBlocklyWorkspaceRecord({
        lastSavedAt: now,
        lastSavedByUserId: args.currentUserId,
        recoveredAt: now,
        revision:
            Math.max(
                args.localSnapshot.editorMetadata.revision,
                args.serverSnapshot?.editorMetadata.revision ?? 0,
            ) + 1,
        saveSource: "workspace_recovery",
        workspaceJson: args.localSnapshot.workspaceJson,
    });
}

export function createClearedDepartmentUserWorkspaceRecord(args: {
    currentUserId: string;
    previousSnapshot: BlocklyWorkspaceRecord | null | undefined;
}): BlocklyWorkspaceRecord {
    return createBlocklyWorkspaceRecord({
        lastSavedByUserId: args.currentUserId,
        recoveredAt: null,
        revision: (args.previousSnapshot?.editorMetadata.revision ?? 0) + 1,
        saveSource: "workspace_clear",
        workspaceJson: createEmptyBlocklyWorkspaceJson(),
    });
}

export function getDepartmentUserWorkspaceSaveIndicatorLabel(args: {
    blockedMessage?: string | null;
    indicatorState: DepartmentUserWorkspaceSaveIndicatorState;
    lastSavedAt: number | null;
}): string {
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

export function getDepartmentUserWorkspaceRecoveryMessage(): string {
    return DEPARTMENT_USER_WORKSPACE_RECOVERY_MESSAGE;
}

export function shouldWarnDepartmentUserBeforeLeave(
    args: DepartmentUserWorkspaceLeaveGuardArgs,
): boolean {
    return (
        args.mode === "edit" &&
        (args.hasUnsyncedRisk || args.isSaveInFlight)
    );
}

export function shouldInterceptDepartmentUserRouteNavigation(
    args: DepartmentUserWorkspaceLeaveGuardArgs & {
        currentUrl: string;
        nextUrl: string;
    },
): boolean {
    if (!shouldWarnDepartmentUserBeforeLeave(args)) {
        return false;
    }

    try {
        const currentLocation = new URL(args.currentUrl);
        const nextLocation = new URL(args.nextUrl, currentLocation);

        return (
            currentLocation.origin === nextLocation.origin &&
            currentLocation.href !== nextLocation.href
        );
    } catch {
        return false;
    }
}

export function parseDepartmentUserWorkspaceSaveFailure(
    error: unknown,
): DepartmentUserWorkspaceSaveFailure {
    const rawMessage =
        error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : "Draft sync could not be confirmed.";
    const dataCode =
        typeof (error as { data?: { code?: unknown } }).data?.code === "string"
            ? ((error as { data?: { code?: string } }).data?.code ?? null)
            : null;
    const matchedCode =
        dataCode ??
        rawMessage.match(
            /"code":"(PLAN_NOT_FOUND|STALE_WORKSPACE_REVISION|UNAUTHORIZED|VALIDATION_FAILED)"/,
        )?.[1] ??
        null;
    const matchedMessage =
        typeof (error as { data?: { message?: unknown } }).data?.message === "string"
            ? ((error as { data?: { message?: string } }).data?.message ?? rawMessage)
            : rawMessage.match(/"message":"([^"]+)"/)?.[1]?.replace(/\\"/g, '"') ??
              rawMessage;

    switch (matchedCode) {
        case "PLAN_NOT_FOUND":
            return {
                code: matchedCode,
                message:
                    matchedMessage || "This plan is no longer available for draft changes.",
                stopRetry: true,
            };
        case "STALE_WORKSPACE_REVISION":
            return {
                code: matchedCode,
                message:
                    matchedMessage ||
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

export function serializeDepartmentUserWorkspaceSessionLease(
    lease: DepartmentUserWorkspaceSessionLease,
): string {
    return JSON.stringify(lease);
}

export function parseDepartmentUserWorkspaceSessionLease(
    rawLease: string | null | undefined,
): DepartmentUserWorkspaceSessionLease | null {
    if (!rawLease) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawLease) as Record<string, unknown>;
        if (
            typeof parsed.heartbeatAt !== "number" ||
            typeof parsed.sessionId !== "string"
        ) {
            return null;
        }

        return {
            heartbeatAt: parsed.heartbeatAt,
            sessionId: parsed.sessionId,
        };
    } catch {
        return null;
    }
}

export function hasCompetingDepartmentUserWorkspaceSession(args: {
    currentTime?: number;
    lease: DepartmentUserWorkspaceSessionLease | null | undefined;
    sessionId: string;
    ttlMs?: number;
}): boolean {
    if (!args.lease || args.lease.sessionId === args.sessionId) {
        return false;
    }

    const now = args.currentTime ?? Date.now();
    const ttlMs =
        args.ttlMs && args.ttlMs > 0
            ? args.ttlMs
            : DEPARTMENT_USER_WORKSPACE_LEASE_TTL_MS;

    return now - args.lease.heartbeatAt < ttlMs;
}

export function readDepartmentUserWorkspaceSessionLease(args: {
    planId: string;
    userId: string;
}): DepartmentUserWorkspaceSessionLease | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        return parseDepartmentUserWorkspaceSessionLease(
            window.localStorage.getItem(
                createDepartmentUserWorkspaceSessionLeaseStorageKey(args),
            ),
        );
    } catch {
        return null;
    }
}

export function claimDepartmentUserWorkspaceSessionLease(args: {
    heartbeatAt?: number;
    planId: string;
    sessionId: string;
    userId: string;
}): DepartmentUserWorkspaceStorageWriteResult {
    if (typeof window === "undefined") {
        return { ok: true };
    }

    try {
        window.localStorage.setItem(
            createDepartmentUserWorkspaceSessionLeaseStorageKey(args),
            serializeDepartmentUserWorkspaceSessionLease({
                heartbeatAt: args.heartbeatAt ?? Date.now(),
                sessionId: args.sessionId,
            }),
        );
        return { ok: true };
    } catch (error) {
        return {
            error: toDepartmentUserWorkspaceStorageFailure(
                error,
                "This browser blocked the workspace session marker.",
            ),
            ok: false,
        };
    }
}

export function releaseDepartmentUserWorkspaceSessionLease(args: {
    planId: string;
    sessionId: string;
    userId: string;
}): void {
    if (typeof window === "undefined") {
        return;
    }

    try {
        const currentLease = readDepartmentUserWorkspaceSessionLease(args);
        if (!currentLease || currentLease.sessionId !== args.sessionId) {
            return;
        }

        window.localStorage.removeItem(
            createDepartmentUserWorkspaceSessionLeaseStorageKey(args),
        );
    } catch {
        // Lease release is best effort only.
    }
}

export async function readDepartmentUserWorkspaceDraftState(args: {
    planId: string;
    userId: string;
}): Promise<DepartmentUserWorkspaceDraftStateResult> {
    try {
        const database = await openDepartmentUserWorkspaceDraftDatabase();
        const record = await new Promise<unknown>((resolve, reject) => {
            const transaction = database.transaction(
                DEPARTMENT_USER_WORKSPACE_DRAFT_STORE,
                "readonly",
            );
            const store = transaction.objectStore(
                DEPARTMENT_USER_WORKSPACE_DRAFT_STORE,
            );
            const request = store.get(
                createDepartmentUserWorkspaceDraftRecordId(args),
            );

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
                    message:
                        "Saved local workspace recovery data was corrupted and has been cleared.",
                },
                ok: false,
            };
        }

        return {
            ok: true,
            value: normalizedState,
        };
    } catch (error) {
        return {
            error: toDepartmentUserWorkspaceStorageFailure(
                error,
                "This browser could not read local workspace recovery data.",
            ),
            ok: false,
        };
    }
}

async function writeDepartmentUserWorkspaceDraftState(args: {
    planId: string;
    queuedSnapshot: BlocklyWorkspaceRecord | null;
    recoverySnapshot: BlocklyWorkspaceRecord | null;
    userId: string;
}): Promise<DepartmentUserWorkspaceStorageWriteResult> {
    try {
        const database = await openDepartmentUserWorkspaceDraftDatabase();
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction(
                DEPARTMENT_USER_WORKSPACE_DRAFT_STORE,
                "readwrite",
            );
            const store = transaction.objectStore(
                DEPARTMENT_USER_WORKSPACE_DRAFT_STORE,
            );
            const id = createDepartmentUserWorkspaceDraftRecordId(args);
            const request =
                args.queuedSnapshot === null && args.recoverySnapshot === null
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
            transaction.onerror = () =>
                reject(
                    transaction.error ??
                        new Error("Failed to update local workspace draft data."),
                );
        });

        return {
            ok: true,
        };
    } catch (error) {
        return {
            error: toDepartmentUserWorkspaceStorageFailure(
                error,
                "This browser could not update local workspace recovery data.",
            ),
            ok: false,
        };
    }
}

export async function upsertDepartmentUserWorkspaceQueuedSnapshot(args: {
    planId: string;
    snapshot: BlocklyWorkspaceRecord;
    userId: string;
}): Promise<DepartmentUserWorkspaceStorageWriteResult> {
    const existingState = await readDepartmentUserWorkspaceDraftState(args);
    if (!existingState.ok && existingState.error.code === "STORAGE_CORRUPT") {
        return existingState;
    }

    const currentState = existingState.ok ? existingState.value : null;
    const queuedSnapshot = coalesceDepartmentUserWorkspaceSnapshot(
        currentState?.queuedSnapshot,
        args.snapshot,
    );
    const recoverySnapshot = coalesceDepartmentUserWorkspaceSnapshot(
        currentState?.recoverySnapshot,
        args.snapshot,
    );

    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot,
        recoverySnapshot,
        userId: args.userId,
    });
}

export async function upsertDepartmentUserWorkspaceRecoverySnapshot(args: {
    planId: string;
    snapshot: BlocklyWorkspaceRecord;
    userId: string;
}): Promise<DepartmentUserWorkspaceStorageWriteResult> {
    const existingState = await readDepartmentUserWorkspaceDraftState(args);
    if (!existingState.ok && existingState.error.code === "STORAGE_CORRUPT") {
        return existingState;
    }

    const currentState = existingState.ok ? existingState.value : null;
    const recoverySnapshot = coalesceDepartmentUserWorkspaceSnapshot(
        currentState?.recoverySnapshot,
        args.snapshot,
    );

    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot: currentState?.queuedSnapshot ?? null,
        recoverySnapshot,
        userId: args.userId,
    });
}

export async function clearDepartmentUserWorkspaceQueuedSnapshot(args: {
    planId: string;
    userId: string;
}): Promise<DepartmentUserWorkspaceStorageWriteResult> {
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

export async function clearDepartmentUserWorkspaceRecoverySnapshot(args: {
    planId: string;
    userId: string;
}): Promise<DepartmentUserWorkspaceStorageWriteResult> {
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

export async function clearDepartmentUserWorkspaceDraftState(args: {
    planId: string;
    userId: string;
}): Promise<DepartmentUserWorkspaceStorageWriteResult> {
    return await writeDepartmentUserWorkspaceDraftState({
        planId: args.planId,
        queuedSnapshot: null,
        recoverySnapshot: null,
        userId: args.userId,
    });
}
