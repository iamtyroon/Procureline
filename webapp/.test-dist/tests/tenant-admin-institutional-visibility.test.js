"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTenantAdminInstitutionalVisibilityTests = void 0;
const strict_1 = __importDefault(require("node:assert/strict"));
const institutional_visibility_1 = require("../lib/shared/tenant-admin/institutional-visibility");
const DAY_MS = 24 * 60 * 60 * 1000;
function runTenantAdminInstitutionalVisibilityTests() {
    const completedTests = [];
    const now = Date.UTC(2026, 6, 20, 10, 0, 0);
    const overview = (0, institutional_visibility_1.buildTenantAdminInstitutionalOverview)({
        auditLogs: [
            {
                actorUserId: "user-po-1",
                event: "plan.submitted",
                id: "audit-1",
                recordId: "plan-submitted",
                timestamp: now - 2 * DAY_MS,
            },
        ],
        departments: [
            {
                budgetAllocation: 1000,
                code: "FIN-01",
                createdAt: now - 40 * DAY_MS,
                id: "department-finance",
                isActive: true,
                name: "Finance",
                normalizedCode: "fin01",
                normalizedName: "finance",
                procurementOfficerTenantUserId: "tenant-user-po-1",
                submissionEndsAt: now + 10 * DAY_MS,
                submissionStartsAt: now - 10 * DAY_MS,
                updatedAt: now - DAY_MS,
            },
            {
                budgetAllocation: 0,
                code: "HR-01",
                createdAt: now - 40 * DAY_MS,
                id: "department-hr",
                isActive: true,
                name: "Human Resources",
                normalizedCode: "hr01",
                normalizedName: "humanresources",
                procurementOfficerTenantUserId: "tenant-user-po-inactive",
                updatedAt: now - DAY_MS,
            },
            {
                budgetAllocation: 400,
                code: "fin 01",
                createdAt: now - 40 * DAY_MS,
                id: "department-finance-duplicate",
                isActive: true,
                name: "Finance!",
                normalizedCode: "",
                normalizedName: "",
                procurementOfficerTenantUserId: "tenant-user-po-1",
                updatedAt: now - DAY_MS,
            },
            {
                budgetAllocation: 900,
                code: "OLD",
                createdAt: now - 40 * DAY_MS,
                id: "department-inactive",
                isActive: false,
                name: "Inactive",
                normalizedCode: "old",
                normalizedName: "inactive",
                procurementOfficerTenantUserId: "tenant-user-po-1",
                updatedAt: now - DAY_MS,
            },
        ],
        departmentUserProfiles: [
            {
                departmentId: "department-finance",
                id: "du-profile-1",
                isActive: true,
                normalizedEmail: "du@example.com",
                tenantId: "tenant-1",
                tenantUserId: "tenant-user-du-1",
                updatedAt: now - DAY_MS,
            },
            {
                departmentId: "department-finance",
                id: "du-profile-duplicate",
                isActive: true,
                normalizedEmail: "DU@example.com",
                tenantId: "tenant-1",
                tenantUserId: "tenant-user-du-duplicate",
                updatedAt: now - DAY_MS,
            },
            {
                departmentId: "department-hr",
                id: "du-profile-cross-tenant",
                isActive: true,
                normalizedEmail: "foreign@example.com",
                tenantId: "tenant-other",
                tenantUserId: "tenant-user-du-cross-tenant",
                updatedAt: now - DAY_MS,
            },
        ],
        fiscalYear: "2026-2027",
        now,
        planReviewDecisions: [
            {
                comment: "Approved for procurement.",
                decidedAt: now - DAY_MS,
                decisionType: "approved",
                fiscalYear: "2026-2027",
                id: "decision-1",
                lifecycleStatus: "active",
                planId: "plan-approved",
            },
        ],
        planSubmissionSnapshots: [
            {
                capturedAt: now - 3 * DAY_MS,
                categorySummaries: [
                    {
                        amount: 1200,
                        categoryId: "cat-1",
                        categoryName: "ICT",
                        itemCount: 3,
                    },
                ],
                departmentId: "department-finance",
                estimatedBudgetUsed: 1200,
                fiscalYear: "2026-2027",
                id: "snapshot-1",
                itemCount: 3,
                lifecycleStatus: "active",
                planId: "plan-approved",
                selectedCategoryIds: ["cat-1"],
                submittedAt: now - 3 * DAY_MS,
                submissionReference: "SUB-001",
                submissionSequence: 1,
            },
        ],
        plans: [
            {
                categorySummaries: [],
                createdAt: now - 20 * DAY_MS,
                departmentId: "department-finance",
                estimatedBudgetUsed: 100,
                fiscalYear: "2026-2027",
                id: "plan-draft",
                itemCount: 1,
                selectedCategoryIds: [],
                status: "draft",
                updatedAt: now - DAY_MS,
            },
            {
                approvedAt: now - DAY_MS,
                categorySummaries: [],
                createdAt: now - 30 * DAY_MS,
                departmentId: "department-finance",
                estimatedBudgetUsed: 1200,
                fiscalYear: "2026-2027",
                id: "plan-approved",
                itemCount: 3,
                reviewStartedAt: now - 2 * DAY_MS,
                selectedCategoryIds: ["cat-1"],
                status: "approved",
                submittedAt: now - 3 * DAY_MS,
                updatedAt: now - DAY_MS,
            },
            {
                categorySummaries: [],
                createdAt: now - 12 * DAY_MS,
                departmentId: "department-finance-duplicate",
                estimatedBudgetUsed: 800,
                fiscalYear: "2025-2026",
                id: "historical-plan",
                itemCount: 2,
                selectedCategoryIds: [],
                status: "submitted",
                submittedAt: Date.UTC(2026, 5, 29),
                updatedAt: Date.UTC(2026, 5, 29),
            },
        ],
        procurementCategories: [],
        procurementItems: [],
        submissionDeadlines: [
            {
                fiscalYearKey: "2025-2026",
                submissionEndsAt: Date.UTC(2026, 5, 30),
                submissionStartsAt: Date.UTC(2026, 5, 1),
                updatedAt: Date.UTC(2026, 5, 1),
            },
        ],
        tenantId: "tenant-1",
        tenantUsers: [
            {
                id: "tenant-user-po-1",
                isActive: true,
                role: "procurement_officer",
                tenantId: "tenant-1",
                userId: "user-po-1",
            },
            {
                id: "tenant-user-po-inactive",
                isActive: false,
                role: "procurement_officer",
                tenantId: "tenant-1",
                userId: "user-po-inactive",
            },
            {
                id: "tenant-user-du-1",
                isActive: true,
                role: "department_user",
                tenantId: "tenant-1",
                userId: "user-du-1",
            },
            {
                id: "tenant-user-du-duplicate",
                isActive: true,
                role: "department_user",
                tenantId: "tenant-1",
                userId: "user-du-duplicate",
            },
            {
                id: "tenant-user-du-cross-tenant",
                isActive: true,
                role: "department_user",
                tenantId: "tenant-other",
                userId: "user-du-cross-tenant",
            },
        ],
        users: [
            { email: "po@example.com", id: "user-po-1", name: "Pat PO" },
            { email: "inactive-po@example.com", id: "user-po-inactive", name: "Inactive PO" },
            { email: "du@example.com", id: "user-du-1", name: "Dina User" },
            { email: "du@example.com", id: "user-du-duplicate", name: "Duplicate User" },
            { email: "foreign@example.com", id: "user-du-cross-tenant", name: "Foreign User" },
        ],
    });
    strict_1.default.deepEqual(overview.rows.map((row) => row.departmentId), ["department-finance", "department-finance-duplicate", "department-hr"]);
    strict_1.default.equal(overview.rows[0]?.planId, "plan-approved");
    strict_1.default.equal(overview.rows[0]?.status, "approved");
    strict_1.default.equal(overview.rows[0]?.budget.utilizationPercent, 120);
    strict_1.default.equal(overview.rows[0]?.duContacts.length, 1);
    strict_1.default.equal(overview.rows[1]?.status, "not_started");
    strict_1.default.equal(overview.rows[2]?.procurementOfficer.state, "inactive");
    strict_1.default.equal(overview.summary.totalDepartments, 3);
    strict_1.default.equal(overview.summary.totalAllocated, 1400);
    strict_1.default.equal(overview.summary.totalUtilized, 1200);
    strict_1.default.equal(overview.summary.anomalyCount >= 5, true);
    strict_1.default.equal(overview.anomalies.some((anomaly) => anomaly.type === "duplicate_department_code"), true);
    strict_1.default.equal(overview.anomalies.some((anomaly) => anomaly.type === "invalid_budget_allocation"), true);
    completedTests.push("tenant-admin institutional overview shapes every active department once, reuses canonical plan priority, deduplicates safe DU contacts, and reports budget anomalies");
    const filteredRows = (0, institutional_visibility_1.filterInstitutionalOverviewRows)(overview.rows, {
        procurementOfficerId: "tenant-user-po-1",
        query: "fin",
        status: "approved",
    });
    strict_1.default.deepEqual(filteredRows.map((row) => row.departmentId), ["department-finance"]);
    const filteredDepartmentIds = new Set(filteredRows.map((row) => row.departmentId));
    const filteredAnomalies = overview.anomalies.filter((anomaly) => filteredDepartmentIds.has(anomaly.departmentId));
    const filteredSummary = (0, institutional_visibility_1.summarizeInstitutionalOverview)(filteredRows, filteredAnomalies);
    strict_1.default.equal(filteredSummary.totalDepartments, 1);
    strict_1.default.equal(filteredSummary.approvedOrSubmittedLabel, "1 of 1");
    strict_1.default.equal(overview.poRollups[0]?.status, "attention_needed");
    strict_1.default.equal(overview.availableFiscalYears.includes("2025-2026"), true);
    completedTests.push("tenant-admin institutional filters stay aligned with the server-shaped dataset and fiscal years include plan, snapshot, deadline, and audit signals");
    const exportPreview = (0, institutional_visibility_1.buildInstitutionalExportPreview)({
        actorTenantUserId: "tenant-admin-1",
        asOf: now,
        fiscalYear: "2026-2027",
        overview,
        requestId: "export-1",
        tenantId: "tenant-1",
    });
    strict_1.default.equal(exportPreview.metadata.requestId, "export-1");
    strict_1.default.equal(exportPreview.metadata.asOf, now);
    strict_1.default.equal(exportPreview.metadata.fiscalYear, "2026-2027");
    strict_1.default.equal(exportPreview.departments[0]?.plan?.workspaceState, undefined);
    strict_1.default.equal(exportPreview.departments[0]?.plan?.internalReviewComments, undefined);
    strict_1.default.equal(exportPreview.departments[0]?.duContacts.length, 1);
    completedTests.push("tenant-admin institutional export previews are point-in-time, tenant-scoped, and omit sensitive workflow internals");
    return completedTests;
}
exports.runTenantAdminInstitutionalVisibilityTests = runTenantAdminInstitutionalVisibilityTests;
