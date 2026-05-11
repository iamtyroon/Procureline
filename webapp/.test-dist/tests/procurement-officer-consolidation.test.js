"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runProcurementOfficerConsolidationTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const consolidation_1 = require("../lib/procurement-officer/consolidation");
function runProcurementOfficerConsolidationTests() {
    const completedTests = [];
    const readiness = (0, consolidation_1.buildConsolidationReadiness)({
        departments: [
            {
                code: "ICT",
                id: "department-ict",
                isActive: true,
                name: "ICT",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                voteNumber: "ICT-001",
            },
            {
                code: "FIN",
                id: "department-finance",
                isActive: true,
                name: "Finance",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                voteNumber: "FIN-001",
            },
            {
                code: "HR",
                id: "department-hr",
                isActive: true,
                name: "Human Resources",
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                voteNumber: "HR-001",
            },
        ],
        plans: [
            {
                approvedAt: Date.UTC(2026, 7, 15, 12, 0, 0),
                consolidatedAt: Date.UTC(2026, 7, 16, 12, 0, 0),
                departmentId: "department-ict",
                estimatedBudgetUsed: 250_000,
                fiscalYear: "2026-2027",
                id: "plan-approved-older",
                itemCount: 4,
                status: "approved",
                updatedAt: Date.UTC(2026, 7, 15, 13, 0, 0),
            },
            {
                approvedAt: Date.UTC(2026, 7, 17, 12, 0, 0),
                departmentId: "department-ict",
                estimatedBudgetUsed: 275_000,
                fiscalYear: "2026-2027",
                id: "plan-approved-newer",
                itemCount: 6,
                status: "approved",
                updatedAt: Date.UTC(2026, 7, 17, 13, 0, 0),
                workspaceState: {
                    workspaceJson: {
                        blocks: {
                            blocks: [
                                {
                                    type: "department_block",
                                    inputs: {
                                        CATEGORIES: {
                                            block: {
                                                type: "category_block",
                                                fields: {
                                                    CATEGORY_NAME: "ICT Equipment",
                                                },
                                            },
                                        },
                                    },
                                },
                            ],
                            languageVersion: 0,
                        },
                    },
                },
            },
            {
                departmentId: "department-finance",
                estimatedBudgetUsed: 90_000,
                fiscalYear: "2026-2027",
                id: "plan-submitted",
                itemCount: 3,
                status: "submitted",
                updatedAt: Date.UTC(2026, 7, 18, 12, 0, 0),
            },
        ],
        selectedFiscalYear: "2026-2027",
    });
    strict_1.default.equal(readiness.readyCount, 1);
    strict_1.default.equal(readiness.totalDepartmentCount, 3);
    strict_1.default.deepEqual(readiness.readyDepartmentIds, ["department-ict"]);
    strict_1.default.equal(readiness.readyDepartments[0]?.planId, "plan-approved-newer");
    strict_1.default.equal(readiness.readyDepartments[0]?.estimatedBudgetUsed, 275_000);
    strict_1.default.deepEqual(readiness.readyDepartments[0]?.workspaceState, {
        workspaceJson: {
            blocks: {
                blocks: [
                    {
                        type: "department_block",
                        inputs: {
                            CATEGORIES: {
                                block: {
                                    type: "category_block",
                                    fields: {
                                        CATEGORY_NAME: "ICT Equipment",
                                    },
                                },
                            },
                        },
                    },
                ],
                languageVersion: 0,
            },
        },
    });
    strict_1.default.equal(readiness.blockedDepartments.find((department) => department.departmentId === "department-finance")?.reason, "submitted");
    strict_1.default.equal(readiness.blockedDepartments.find((department) => department.departmentId === "department-hr")?.reason, "missing_plan");
    completedTests.push("consolidation readiness derives sources only from approved current-year plans, keeps consolidatedAt informational, deduplicates by approval recency, and carries source workspace state for toolbox seeding");
    const canonical = (0, consolidation_1.selectCanonicalApprovedPlansByDepartment)({
        plans: [
            {
                approvedAt: 100,
                departmentId: "department-a",
                estimatedBudgetUsed: 1,
                fiscalYear: "2026-2027",
                id: "a",
                itemCount: 1,
                status: "approved",
                updatedAt: 100,
            },
            {
                approvedAt: 100,
                departmentId: "department-a",
                estimatedBudgetUsed: 2,
                fiscalYear: "2026-2027",
                id: "b",
                itemCount: 2,
                status: "approved",
                updatedAt: 200,
            },
        ],
        selectedFiscalYear: "2026-2027",
    });
    strict_1.default.equal(canonical.get("department-a")?.id, "b");
    completedTests.push("consolidation canonical source selection falls back to updated-at and stable ids when approval timestamps tie");
    const normalizedYear = (0, consolidation_1.normalizeConsolidationFiscalYear)({
        departments: [
            {
                id: "department-safe",
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
        ],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        requestedFiscalYear: "../../../arbitrary",
    });
    strict_1.default.equal(normalizedYear.selectedFiscalYear, "2026-2027");
    strict_1.default.equal((0, consolidation_1.normalizeConsolidationFiscalYear)({
        departments: [
            {
                id: "department-safe",
                isActive: true,
                submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
            },
        ],
        now: Date.UTC(2026, 7, 10, 12, 0, 0),
        requestedFiscalYear: "2039-2040",
    }).selectedFiscalYear, "2026-2027");
    completedTests.push("consolidation fiscal-year normalization ignores malformed client input and falls back to safe dashboard-backed options");
    strict_1.default.equal((0, consolidation_1.validateConsolidationDraftPayload)({
        notes: "Approved source notes",
        selectedSourceDepartmentIds: ["department-ict"],
        workspaceState: {
            blocks: {
                blocks: [{ type: "aggregate_plan_block" }],
                languageVersion: 0,
            },
        },
    }).ok, true);
    strict_1.default.equal((0, consolidation_1.validateConsolidationDraftPayload)({
        selectedSourceDepartmentIds: ["department-ict"],
        workspaceState: {
            editorMetadata: {
                lastSavedAt: 1,
                lastSavedByUserId: "po-user",
                recoveredAt: null,
                revision: 1,
                saveSource: "workspace_sync",
            },
            format: "blockly_json",
            schemaVersion: 1,
            workspaceJson: JSON.stringify({
                blocks: {
                    blocks: [{ type: "department_block" }],
                    languageVersion: 0,
                },
            }),
        },
    }).ok, true);
    strict_1.default.equal((0, consolidation_1.validateConsolidationDraftPayload)({
        selectedSourceDepartmentIds: ["department-ict", "department-ict"],
    }).ok, false);
    strict_1.default.equal((0, consolidation_1.validateConsolidationDraftPayload)({
        selectedSourceDepartmentIds: Array.from({ length: 250 }, (_, index) => `department-${index}`),
    }).ok, true);
    strict_1.default.equal((0, consolidation_1.validateConsolidationDraftPayload)({
        selectedSourceDepartmentIds: [],
        workspaceState: createDeepWorkspaceState(26),
    }).ok, false);
    strict_1.default.equal((0, consolidation_1.validateConsolidationDraftPayload)({
        selectedSourceDepartmentIds: ["department-ict"],
        workspaceState: {
            blocks: {
                blocks: Array.from({ length: 1_500 }, (_, index) => ({
                    type: "item_block",
                    fields: {
                        ITEM_DESC: `Line item ${index}`,
                    },
                })),
                languageVersion: 0,
            },
        },
    }).ok, true);
    completedTests.push("consolidation draft validation accepts persisted stringified Blockly JSON, large block counts, and institution-scale department counts while rejecting duplicate sources plus overly deep JSON before persistence");
    const routeSource = (0, node_fs_1.readFileSync)((0, node_path_1.join)(process.cwd(), "app/(app)/po/consolidation/page.tsx"), "utf8");
    const workspaceSource = (0, node_fs_1.readFileSync)((0, node_path_1.join)(process.cwd(), "src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx"), "utf8");
    const shellSource = (0, node_fs_1.readFileSync)((0, node_path_1.join)(process.cwd(), "src/components/procurement-officer/ProcurementOfficerConsolidationBlocklyShell.tsx"), "utf8");
    strict_1.default.equal(routeSource.includes("ProcurementOfficerRoutePlaceholder"), false);
    strict_1.default.equal(routeSource.includes("ProcurementOfficerConsolidationWorkspace"), true);
    strict_1.default.equal(consolidation_1.CONSOLIDATION_EMPTY_MESSAGE.includes("No approved plans"), true);
    strict_1.default.equal(workspaceSource.includes("CONSOLIDATION_EMPTY_MESSAGE"), true);
    strict_1.default.equal(workspaceSource.includes("Open department setup"), true);
    strict_1.default.equal(workspaceSource.includes("Open consolidation workspace"), false);
    strict_1.default.equal(workspaceSource.includes("Excel"), false);
    strict_1.default.equal(shellSource.includes('await import("blockly")'), true);
    strict_1.default.equal(shellSource.includes("Blockly.Xml"), false);
    completedTests.push("consolidation UI source replaces the placeholder route, includes setup and no-approved-plan states, lazy-loads Blockly, and excludes export controls");
    return completedTests;
}
exports.runProcurementOfficerConsolidationTests = runProcurementOfficerConsolidationTests;
function createDeepWorkspaceState(depth) {
    let current = {};
    const root = current;
    for (let index = 0; index < depth; index += 1) {
        const next = {};
        current.child = next;
        current = next;
    }
    return root;
}
