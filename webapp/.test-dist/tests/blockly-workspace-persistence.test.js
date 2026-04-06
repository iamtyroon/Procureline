"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBlocklyWorkspacePersistenceTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const blockly_serialization_1 = require("../lib/blockly/blockly-serialization");
const workspace_draft_queue_1 = require("../lib/blockly/workspace-draft-queue");
const workspace_save_1 = require("../lib/blockly/workspace-save");
function runBlocklyWorkspacePersistenceTests() {
    const completedTests = [];
    const olderSnapshot = (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedAt: 100,
        lastSavedByUserId: "du-1",
        revision: 2,
        saveSource: "workspace_sync",
    });
    const newerSnapshot = (0, blockly_serialization_1.createBlocklyWorkspaceRecord)({
        lastSavedAt: 200,
        lastSavedByUserId: "du-1",
        recoveredAt: 150,
        revision: 4,
        saveSource: "workspace_recovery",
    });
    strict_1.default.equal((0, workspace_draft_queue_1.coalesceDepartmentUserWorkspaceSnapshot)(olderSnapshot, newerSnapshot)
        .editorMetadata.revision, 4);
    strict_1.default.equal((0, workspace_draft_queue_1.compareDepartmentUserWorkspaceRecoveryFreshness)({
        localSnapshot: newerSnapshot,
        serverSnapshot: olderSnapshot,
    }), "local_newer");
    completedTests.push("workspace persistence helpers coalesce queued snapshots to the newest durable revision");
    const recoveredRecord = (0, workspace_draft_queue_1.createRecoveredDepartmentUserWorkspaceRecord)({
        currentUserId: "du-2",
        localSnapshot: olderSnapshot,
        serverSnapshot: newerSnapshot,
    });
    strict_1.default.equal(recoveredRecord.editorMetadata.saveSource, "workspace_recovery");
    strict_1.default.equal(recoveredRecord.editorMetadata.lastSavedByUserId, "du-2");
    strict_1.default.equal(recoveredRecord.editorMetadata.revision, 5);
    const clearedRecord = (0, workspace_draft_queue_1.createClearedDepartmentUserWorkspaceRecord)({
        currentUserId: "du-2",
        previousSnapshot: recoveredRecord,
    });
    strict_1.default.equal(clearedRecord.editorMetadata.saveSource, "workspace_clear");
    strict_1.default.equal(clearedRecord.editorMetadata.revision, 6);
    strict_1.default.deepEqual(clearedRecord.workspaceJson, {
        blocks: {
            blocks: [],
            languageVersion: 0,
        },
    });
    completedTests.push("recovery and clear-plan records reuse the canonical JSON metadata seam instead of inventing a new draft format");
    strict_1.default.equal((0, workspace_draft_queue_1.getDepartmentUserWorkspaceSaveIndicatorLabel)({
        indicatorState: "queued",
        lastSavedAt: null,
    }), "Saved locally. Sync pending.");
    strict_1.default.equal((0, workspace_draft_queue_1.getDepartmentUserWorkspaceSaveIndicatorLabel)({
        blockedMessage: "Another tab owns this draft.",
        indicatorState: "blocked",
        lastSavedAt: null,
    }), "Another tab owns this draft.");
    completedTests.push("save indicator labels stay truthful when work is only local or blocked by another session");
    strict_1.default.deepEqual((0, workspace_draft_queue_1.parseDepartmentUserWorkspaceSessionLease)('{"heartbeatAt":123,"sessionId":"tab-a"}'), {
        heartbeatAt: 123,
        sessionId: "tab-a",
    });
    strict_1.default.equal((0, workspace_draft_queue_1.hasCompetingDepartmentUserWorkspaceSession)({
        currentTime: 10_000,
        lease: {
            heartbeatAt: 5_000,
            sessionId: "tab-a",
        },
        sessionId: "tab-b",
        ttlMs: 10_000,
    }), true);
    strict_1.default.equal((0, workspace_draft_queue_1.hasCompetingDepartmentUserWorkspaceSession)({
        currentTime: 25_500,
        lease: {
            heartbeatAt: 5_000,
            sessionId: "tab-a",
        },
        sessionId: "tab-b",
        ttlMs: 10_000,
    }), false);
    completedTests.push("same-plan multi-tab lease checks only block replay while a competing local session is still fresh");
    strict_1.default.deepEqual((0, workspace_draft_queue_1.parseDepartmentUserWorkspaceSaveFailure)(new Error('Uncaught ConvexError: {"code":"STALE_WORKSPACE_REVISION","message":"Refresh before replaying older changes."}')), {
        code: "STALE_WORKSPACE_REVISION",
        message: "Refresh before replaying older changes.",
        stopRetry: true,
    });
    strict_1.default.equal((0, workspace_draft_queue_1.parseDepartmentUserWorkspaceSaveFailure)(new Error("Network connection dropped")).stopRetry, false);
    completedTests.push("save failure parsing distinguishes stale-revision conflicts from transient retryable sync failures");
    strict_1.default.equal((0, workspace_save_1.isDepartmentUserWorkspaceDraftStale)({
        incomingWorkspaceState: olderSnapshot,
        persistedWorkspaceState: newerSnapshot,
    }), true);
    strict_1.default.equal((0, workspace_save_1.isDepartmentUserWorkspaceDraftStale)({
        incomingWorkspaceState: newerSnapshot,
        persistedWorkspaceState: newerSnapshot,
    }), false);
    strict_1.default.deepEqual((0, workspace_save_1.prepareDepartmentUserWorkspaceDraftPersistence)({
        accessMode: "editable",
        categories: [
            {
                id: "cat-it",
                name: "ICT Equipment",
            },
        ],
        categoryDocs: [
            {
                _id: "cat-it",
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
    }), {
        code: "STALE_WORKSPACE_REVISION",
        message: "A newer workspace draft already exists. Refresh the editor before replaying older local changes.",
        ok: false,
    });
    completedTests.push("server-side draft preparation rejects stale queued revisions before they can overwrite a newer saved plan");
    strict_1.default.equal((0, workspace_draft_queue_1.shouldWarnDepartmentUserBeforeLeave)({
        hasUnsyncedRisk: true,
        isSaveInFlight: false,
        mode: "edit",
    }), true);
    strict_1.default.equal((0, workspace_draft_queue_1.shouldWarnDepartmentUserBeforeLeave)({
        hasUnsyncedRisk: false,
        isSaveInFlight: true,
        mode: "edit",
    }), true);
    strict_1.default.equal((0, workspace_draft_queue_1.shouldWarnDepartmentUserBeforeLeave)({
        hasUnsyncedRisk: true,
        isSaveInFlight: true,
        mode: "view",
    }), false);
    completedTests.push("leave-page guard logic stays active for unsynced or in-flight edit sessions and stays off in read-only mode");
    strict_1.default.equal((0, workspace_draft_queue_1.shouldInterceptDepartmentUserRouteNavigation)({
        currentUrl: "https://procureline.test/du/plans/plan-1",
        hasUnsyncedRisk: true,
        isSaveInFlight: false,
        mode: "edit",
        nextUrl: "https://procureline.test/du",
    }), true);
    strict_1.default.equal((0, workspace_draft_queue_1.shouldInterceptDepartmentUserRouteNavigation)({
        currentUrl: "https://procureline.test/du/plans/plan-1",
        hasUnsyncedRisk: true,
        isSaveInFlight: false,
        mode: "edit",
        nextUrl: "https://example.com/outside",
    }), false);
    strict_1.default.equal((0, workspace_draft_queue_1.shouldInterceptDepartmentUserRouteNavigation)({
        currentUrl: "https://procureline.test/du/plans/plan-1",
        hasUnsyncedRisk: false,
        isSaveInFlight: false,
        mode: "edit",
        nextUrl: "https://procureline.test/du",
    }), false);
    completedTests.push("route-level guard decisions only intercept same-origin navigation when the editor still has unsaved risk");
    return completedTests;
}
exports.runBlocklyWorkspacePersistenceTests = runBlocklyWorkspacePersistenceTests;
