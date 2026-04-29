"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDepartmentUserRevisionFlowTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const revision_feedback_1 = require("../lib/department-user/revision-feedback");
const compliance_1 = require("../lib/procurement/compliance");
const revision_deadline_1 = require("../lib/plans/revision-deadline");
function runDepartmentUserRevisionFlowTests() {
    const completedTests = [];
    const effectiveDeadline = (0, revision_deadline_1.deriveDepartmentUserEffectiveRevisionDeadline)({
        decisionType: "revision_requested",
        decidedAt: Date.UTC(2026, 7, 30, 8, 0, 0),
        revisionDeadlineAt: Date.UTC(2026, 7, 31, 8, 0, 0),
        submissionDeadlineAt: Date.UTC(2026, 7, 30, 12, 0, 0),
    });
    strict_1.default.equal(effectiveDeadline.effectiveDeadlineAt, Date.UTC(2026, 8, 1, 8, 0, 0));
    strict_1.default.equal(effectiveDeadline.precedence, "automatic_extension");
    completedTests.push("effective revision deadlines apply the FR57e late-rejection extension and keep the later deadline as the canonical DU resubmission cutoff");
    const flaggedIssues = (0, revision_feedback_1.mapDepartmentUserFlaggedTargetsToIssues)({
        flaggedTargets: [
            {
                categoryId: "cat-it",
                id: "item:cat-it:item-laptop",
                itemId: "item-laptop",
                label: "Laptop",
                type: "item",
            },
            {
                categoryId: "cat-archived",
                id: "category:cat-archived",
                itemId: null,
                label: "Archived Category",
                type: "category",
            },
        ],
        workspaceSummary: {
            budgetState: {
                advisoryText: "Within budget.",
                announcementText: "Within budget.",
                bannerText: null,
                canSubmitByBudget: true,
                overBudgetAmount: 0,
                remainingBudget: 100,
                state: "safe",
                statusLabel: "Within budget",
                totalBudget: 100,
                usageLabel: "0%",
                usedAmount: 0,
                usedPercent: 0,
            },
            categories: [
                {
                    categoryId: "cat-it",
                    categoryName: "ICT Equipment",
                    itemCount: 1,
                    items: [
                        {
                            blockId: "block-laptop",
                            complianceFlags: [],
                            isActive: true,
                            itemDescription: "Laptop",
                            itemId: "item-laptop",
                            itemName: "Laptop",
                            maxQuantity: null,
                            minQuantity: null,
                            quarterTotals: { q1: 0, q2: 0, q3: 0, q4: 0 },
                            totalCost: 0,
                            totalQuantity: 0,
                            unitOfMeasurement: "Each",
                            unitPrice: 0,
                        },
                    ],
                    quarterTotals: { q1: 0, q2: 0, q3: 0, q4: 0 },
                    totalCost: 0,
                },
            ],
            complianceState: (0, compliance_1.createUnavailableProcurementComplianceSnapshot)({
                totalEligibleSpend: 0,
            }),
            departmentTotal: 0,
            quarterTotals: { q1: 0, q2: 0, q3: 0, q4: 0 },
            totalItemCount: 1,
            validationState: {
                hasBlockingIssues: false,
                issues: [],
                itemIssuesByBlockId: {},
                submitBlockedReasons: [],
                validationUnavailableReason: null,
            },
        },
    });
    strict_1.default.equal(flaggedIssues[0]?.fixTarget?.type, "workspace_block");
    strict_1.default.equal(flaggedIssues[1]?.fixTarget?.type, "workspace_summary");
    strict_1.default.match(flaggedIssues[1]?.message ?? "", /Previously flagged category is unavailable/i);
    completedTests.push("flagged revision targets map into deterministic DU submission blockers and degrade missing catalog entities to explicit fallback warnings instead of disappearing");
    const revisionHistory = (0, revision_feedback_1.buildDepartmentUserRevisionHistory)({
        decisions: [
            {
                comment: "Update delivery phasing.",
                decidedAt: Date.UTC(2026, 7, 14, 8, 0, 0),
                decisionType: "revision_requested",
                flaggedTargets: [],
                id: "decision-1",
                lifecycleStatus: "active",
                revisionDeadlineAt: null,
                submissionReference: "CS-2627-001",
            },
        ],
        snapshots: [
            {
                capturedAt: Date.UTC(2026, 7, 10, 9, 0, 0),
                lifecycleStatus: "active",
                submissionReference: "CS-2627-001",
                submissionSequence: 1,
                submittedAt: Date.UTC(2026, 7, 10, 8, 0, 0),
            },
            {
                capturedAt: Date.UTC(2026, 7, 16, 9, 0, 0),
                lifecycleStatus: "active",
                submissionReference: "CS-2627-002",
                submissionSequence: 2,
                submittedAt: Date.UTC(2026, 7, 16, 8, 0, 0),
            },
        ],
        timeZone: "Africa/Nairobi",
    });
    strict_1.default.deepEqual(revisionHistory.map((entry) => entry.title), ["Submitted", "Revision Requested", "Submitted"]);
    completedTests.push("revision history merges immutable submission snapshots and DU-visible review decisions into one chronological DU-facing timeline without inventing extra workflow states");
    return completedTests;
}
exports.runDepartmentUserRevisionFlowTests = runDepartmentUserRevisionFlowTests;
