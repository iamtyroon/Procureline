import assert from "node:assert/strict";
import { createBlocklyWorkspaceRecord } from "../lib/blockly/blockly-serialization";
import {
    createRecoveredDepartmentUserWorkspaceRecord,
    createClearedDepartmentUserWorkspaceRecord,
    createDepartmentUserWorkspaceLeaveGuardHistoryState,
    coalesceDepartmentUserWorkspaceSnapshot,
    compareDepartmentUserWorkspaceRecoveryFreshness,
    getDepartmentUserWorkspaceLeaveGuardHistoryAction,
    getDepartmentUserWorkspaceSaveIndicatorLabel,
    hasCompetingDepartmentUserWorkspaceSession,
    parseDepartmentUserWorkspaceSaveFailure,
    parseDepartmentUserWorkspaceSessionLease,
    shouldInterceptDepartmentUserRouteNavigation,
    shouldWarnDepartmentUserBeforeLeave,
} from "../lib/blockly/workspace-draft-queue";
import {
    isDepartmentUserWorkspaceDraftStale,
    prepareDepartmentUserWorkspaceDraftPersistence,
} from "../lib/blockly/workspace-save";

export function runBlocklyWorkspacePersistenceTests(): string[] {
    const completedTests: string[] = [];

    const olderSnapshot = createBlocklyWorkspaceRecord({
        lastSavedAt: 100,
        lastSavedByUserId: "du-1",
        revision: 2,
        saveSource: "workspace_sync",
    });
    const newerSnapshot = createBlocklyWorkspaceRecord({
        lastSavedAt: 200,
        lastSavedByUserId: "du-1",
        recoveredAt: 150,
        revision: 4,
        saveSource: "workspace_recovery",
    });
    assert.equal(
        coalesceDepartmentUserWorkspaceSnapshot(olderSnapshot, newerSnapshot)
            .editorMetadata.revision,
        4,
    );
    assert.equal(
        compareDepartmentUserWorkspaceRecoveryFreshness({
            localSnapshot: newerSnapshot,
            serverSnapshot: olderSnapshot,
        }),
        "local_newer",
    );
    completedTests.push("workspace persistence helpers coalesce queued snapshots to the newest durable revision");

    const recoveredRecord = createRecoveredDepartmentUserWorkspaceRecord({
        currentUserId: "du-2",
        localSnapshot: olderSnapshot,
        serverSnapshot: newerSnapshot,
    });
    assert.equal(recoveredRecord.editorMetadata.saveSource, "workspace_recovery");
    assert.equal(recoveredRecord.editorMetadata.lastSavedByUserId, "du-2");
    assert.equal(recoveredRecord.editorMetadata.revision, 5);

    const clearedRecord = createClearedDepartmentUserWorkspaceRecord({
        currentUserId: "du-2",
        previousSnapshot: recoveredRecord,
    });
    assert.equal(clearedRecord.editorMetadata.saveSource, "workspace_clear");
    assert.equal(clearedRecord.editorMetadata.revision, 6);
    assert.deepEqual(clearedRecord.workspaceJson, {
        blocks: {
            blocks: [],
            languageVersion: 0,
        },
    });
    completedTests.push("recovery and clear-plan records reuse the canonical JSON metadata seam instead of inventing a new draft format");

    assert.equal(
        getDepartmentUserWorkspaceSaveIndicatorLabel({
            indicatorState: "queued",
            lastSavedAt: null,
        }),
        "Saved locally. Sync pending.",
    );
    assert.equal(
        getDepartmentUserWorkspaceSaveIndicatorLabel({
            blockedMessage: "Another tab owns this draft.",
            indicatorState: "blocked",
            lastSavedAt: null,
        }),
        "Another tab owns this draft.",
    );
    completedTests.push("save indicator labels stay truthful when work is only local or blocked by another session");

    assert.deepEqual(
        parseDepartmentUserWorkspaceSessionLease('{"heartbeatAt":123,"sessionId":"tab-a"}'),
        {
            heartbeatAt: 123,
            sessionId: "tab-a",
        },
    );
    assert.equal(
        hasCompetingDepartmentUserWorkspaceSession({
            currentTime: 10_000,
            lease: {
                heartbeatAt: 5_000,
                sessionId: "tab-a",
            },
            sessionId: "tab-b",
            ttlMs: 10_000,
        }),
        true,
    );
    assert.equal(
        hasCompetingDepartmentUserWorkspaceSession({
            currentTime: 25_500,
            lease: {
                heartbeatAt: 5_000,
                sessionId: "tab-a",
            },
            sessionId: "tab-b",
            ttlMs: 10_000,
        }),
        false,
    );
    completedTests.push("same-plan multi-tab lease checks only block replay while a competing local session is still fresh");

    assert.deepEqual(
        parseDepartmentUserWorkspaceSaveFailure(
            new Error(
                'Uncaught ConvexError: {"code":"STALE_WORKSPACE_REVISION","message":"Refresh before replaying older changes."}',
            ),
        ),
        {
            code: "STALE_WORKSPACE_REVISION",
            message: "Refresh before replaying older changes.",
            stopRetry: true,
        },
    );
    assert.equal(
        parseDepartmentUserWorkspaceSaveFailure(
            new Error("Network connection dropped"),
        ).stopRetry,
        false,
    );
    completedTests.push("save failure parsing distinguishes stale-revision conflicts from transient retryable sync failures");

    assert.equal(
        isDepartmentUserWorkspaceDraftStale({
            incomingWorkspaceState: olderSnapshot,
            persistedWorkspaceState: newerSnapshot,
        }),
        true,
    );
    assert.equal(
        isDepartmentUserWorkspaceDraftStale({
            incomingWorkspaceState: newerSnapshot,
            persistedWorkspaceState: newerSnapshot,
        }),
        false,
    );
    const sameRevisionEquivalentSnapshot = createBlocklyWorkspaceRecord({
        lastSavedAt: 999,
        lastSavedByUserId: "du-1",
        recoveredAt: newerSnapshot.editorMetadata.recoveredAt,
        revision: newerSnapshot.editorMetadata.revision,
        saveSource: newerSnapshot.editorMetadata.saveSource,
    });
    assert.equal(
        isDepartmentUserWorkspaceDraftStale({
            incomingWorkspaceState: sameRevisionEquivalentSnapshot,
            persistedWorkspaceState: newerSnapshot,
        }),
        false,
    );
    const sameRevisionConflictingSnapshot = createBlocklyWorkspaceRecord({
        lastSavedAt: 999,
        lastSavedByUserId: "du-1",
        revision: newerSnapshot.editorMetadata.revision,
        saveSource: "workspace_sync",
        workspaceJson: {
            blocks: {
                blocks: [{ id: "conflict", type: "department_block" }],
                languageVersion: 0,
            },
        },
    });
    assert.equal(
        isDepartmentUserWorkspaceDraftStale({
            incomingWorkspaceState: sameRevisionConflictingSnapshot,
            persistedWorkspaceState: newerSnapshot,
        }),
        true,
    );
    assert.deepEqual(
        prepareDepartmentUserWorkspaceDraftPersistence({
            accessMode: "editable",
            categories: [
                {
                    id: "cat-it",
                    name: "ICT Equipment",
                },
            ],
            categoryDocs: [
                {
                    _id: "cat-it" as never,
                    name: "ICT Equipment",
                },
            ],
            currentUserId: "du-1",
            existingSelectedCategoryIds: [],
            items: [
                {
                    categoryId: "cat-it",
                    complianceFlags: ["agpo"],
                    description: "Portable computers",
                    id: "item-laptop",
                    name: "Laptops",
                    procurementMethod: "RFQ",
                    sourceOfFunds: "GOK",
                    unitOfMeasurement: "each",
                    unitPrice: 50_000,
                },
            ],
            planStatus: "draft",
            persistedWorkspaceState: newerSnapshot,
            totalBudget: 250_000,
            workspaceState: olderSnapshot,
        }),
        {
            code: "STALE_WORKSPACE_REVISION",
            message:
                "A newer workspace draft already exists. Refresh the editor before replaying older local changes.",
            ok: false,
        },
    );
    completedTests.push("server-side draft preparation rejects stale queued revisions before they can overwrite a newer saved plan");

    assert.equal(
        shouldWarnDepartmentUserBeforeLeave({
            hasUnsyncedRisk: true,
            isSaveInFlight: false,
            mode: "edit",
        }),
        true,
    );
    assert.equal(
        shouldWarnDepartmentUserBeforeLeave({
            hasUnsyncedRisk: false,
            isSaveInFlight: true,
            mode: "edit",
        }),
        true,
    );
    assert.equal(
        shouldWarnDepartmentUserBeforeLeave({
            hasUnsyncedRisk: true,
            isSaveInFlight: true,
            mode: "view",
        }),
        false,
    );
    completedTests.push("leave-page guard logic stays active for unsynced or in-flight edit sessions and stays off in read-only mode");

    assert.equal(
        shouldInterceptDepartmentUserRouteNavigation({
            currentUrl: "https://procureline.test/du/plans/plan-1",
            hasUnsyncedRisk: true,
            isSaveInFlight: false,
            mode: "edit",
            nextUrl: "https://procureline.test/du",
        }),
        true,
    );
    assert.equal(
        shouldInterceptDepartmentUserRouteNavigation({
            currentUrl: "https://procureline.test/du/plans/plan-1",
            hasUnsyncedRisk: true,
            isSaveInFlight: false,
            mode: "edit",
            nextUrl: "https://example.com/outside",
        }),
        false,
    );
    assert.equal(
        shouldInterceptDepartmentUserRouteNavigation({
            currentUrl: "https://procureline.test/du/plans/plan-1",
            hasUnsyncedRisk: false,
            isSaveInFlight: false,
            mode: "edit",
            nextUrl: "https://procureline.test/du",
        }),
        false,
    );
    completedTests.push("route-level guard decisions only intercept same-origin navigation when the editor still has unsaved risk");

    assert.equal(
        getDepartmentUserWorkspaceLeaveGuardHistoryAction({
            historyState: null,
            isGuardArmed: false,
            sessionId: "tab-a",
            shouldWarnBeforeLeave: true,
        }),
        "arm",
    );
    assert.equal(
        getDepartmentUserWorkspaceLeaveGuardHistoryAction({
            historyState: createDepartmentUserWorkspaceLeaveGuardHistoryState("tab-a"),
            isGuardArmed: true,
            sessionId: "tab-a",
            shouldWarnBeforeLeave: false,
        }),
        "disarm",
    );
    assert.equal(
        getDepartmentUserWorkspaceLeaveGuardHistoryAction({
            historyState: createDepartmentUserWorkspaceLeaveGuardHistoryState("tab-b"),
            isGuardArmed: true,
            sessionId: "tab-a",
            shouldWarnBeforeLeave: false,
        }),
        "noop",
    );
    completedTests.push("leave-guard history orchestration now arms only during real risk and disarms the synthetic back-stack entry once the draft is safe again");

    return completedTests;
}
