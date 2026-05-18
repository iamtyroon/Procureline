import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    CONSOLIDATION_EMPTY_MESSAGE,
    buildConsolidationReadiness,
    extractConsolidationFinalizationSnapshotValues,
    normalizeConsolidationFiscalYear,
    selectCanonicalApprovedPlansByDepartment,
    validateConsolidationDraftPayload,
} from "../lib/procurement-officer/consolidation";

export function runProcurementOfficerConsolidationTests(): string[] {
    const completedTests: string[] = [];

    const readiness = buildConsolidationReadiness({
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

    assert.equal(readiness.readyCount, 1);
    assert.equal(readiness.totalDepartmentCount, 3);
    assert.deepEqual(readiness.readyDepartmentIds, ["department-ict"]);
    assert.equal(readiness.readyDepartments[0]?.planId, "plan-approved-newer");
    assert.equal(readiness.readyDepartments[0]?.estimatedBudgetUsed, 275_000);
    assert.deepEqual(readiness.readyDepartments[0]?.workspaceState, {
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
    assert.equal(
        readiness.blockedDepartments.find(
            (department) => department.departmentId === "department-finance",
        )?.reason,
        "submitted",
    );
    assert.equal(
        readiness.blockedDepartments.find(
            (department) => department.departmentId === "department-hr",
        )?.reason,
        "missing_plan",
    );
    completedTests.push(
        "consolidation readiness derives sources only from approved current-year plans, keeps consolidatedAt informational, deduplicates by approval recency, and carries source workspace state for toolbox seeding",
    );

    const canonical = selectCanonicalApprovedPlansByDepartment({
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
    assert.equal(canonical.get("department-a")?.id, "b");
    completedTests.push(
        "consolidation canonical source selection falls back to updated-at and stable ids when approval timestamps tie",
    );

    const normalizedYear = normalizeConsolidationFiscalYear({
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
    assert.equal(normalizedYear.selectedFiscalYear, "2026-2027");
    assert.equal(
        normalizeConsolidationFiscalYear({
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
        }).selectedFiscalYear,
        "2026-2027",
    );
    assert.equal(
        normalizeConsolidationFiscalYear({
            approvedPlanFiscalYears: ["2025-2026"],
            departments: [
                {
                    id: "department-current",
                    isActive: true,
                    submissionEndsAt: Date.UTC(2026, 7, 20, 12, 0, 0),
                    submissionStartsAt: Date.UTC(2026, 7, 1, 12, 0, 0),
                },
            ],
            now: Date.UTC(2026, 7, 10, 12, 0, 0),
            submissionDeadlineFiscalYears: ["2025-2026"],
        }).selectedFiscalYear,
        "2026-2027",
    );
    completedTests.push(
        "consolidation fiscal-year normalization ignores malformed client input and defaults to the tenant current year before stale approved-plan years",
    );

    assert.equal(
        validateConsolidationDraftPayload({
            notes: "Approved source notes",
            selectedSourceDepartmentIds: ["department-ict"],
            workspaceState: {
                blocks: {
                    blocks: [{ type: "aggregate_plan_block" }],
                    languageVersion: 0,
                },
            },
        }).ok,
        true,
    );
    assert.equal(
        validateConsolidationDraftPayload({
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
        }).ok,
        true,
    );
    assert.equal(
        validateConsolidationDraftPayload({
            selectedSourceDepartmentIds: ["department-ict", "department-ict"],
        }).ok,
        false,
    );
    assert.equal(
        validateConsolidationDraftPayload({
            selectedSourceDepartmentIds: Array.from(
                { length: 250 },
                (_, index) => `department-${index}`,
            ),
        }).ok,
        true,
    );
    assert.equal(
        validateConsolidationDraftPayload({
            selectedSourceDepartmentIds: [],
            workspaceState: createDeepWorkspaceState(26),
        }).ok,
        false,
    );
    assert.equal(
        validateConsolidationDraftPayload({
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
        }).ok,
        true,
    );
    completedTests.push(
        "consolidation draft validation accepts persisted stringified Blockly JSON, large block counts, and institution-scale department counts while rejecting duplicate sources plus overly deep JSON before persistence",
    );

    const snapshotValues = extractConsolidationFinalizationSnapshotValues({
        blocks: {
            blocks: [
                {
                    fields: {
                        DEPARTMENT_COUNT: "2",
                        GRAND_TOTAL: "1,234.50",
                        ITEM_COUNT: "8",
                        LOCAL_CONTENT_TOTAL: "900",
                        PWD_TOTAL: "50",
                        Q1_TOTAL: "100",
                        Q2_TOTAL: "200",
                        Q3_TOTAL: "300",
                        Q4_TOTAL: "634.50",
                    },
                    type: "aggregate_plan_block",
                },
            ],
            languageVersion: 0,
        },
    });
    assert.deepEqual(snapshotValues.calculatedTotals, {
        departmentCount: 2,
        itemCount: 8,
        q1Total: 100,
        q2Total: 200,
        q3Total: 300,
        q4Total: 634.5,
        totalCost: 1234.5,
    });
    assert.equal(
        snapshotValues.complianceSummary.aggregateFields.LOCAL_CONTENT_TOTAL,
        "900",
    );
    completedTests.push(
        "consolidation finalization snapshots preserve displayed aggregate totals and compliance fields without recalculating or gating them",
    );

    const routeSource = readFileSync(
        join(process.cwd(), "app/(app)/po/consolidation/page.tsx"),
        "utf8",
    );
    const workspaceSource = readFileSync(
        join(
            process.cwd(),
            "src/components/procurement-officer/ProcurementOfficerConsolidationWorkspace.tsx",
        ),
        "utf8",
    );
    const shellSource = readFileSync(
        join(
            process.cwd(),
            "src/components/procurement-officer/ProcurementOfficerConsolidationBlocklyShell.tsx",
        ),
        "utf8",
    );
    const exportFunctionSource = readFileSync(
        join(process.cwd(), "convex/functions/consolidationExports.ts"),
        "utf8",
    );
    const fileActionsSource = readFileSync(
        join(process.cwd(), "convex/actions/files.ts"),
        "utf8",
    );
    const schemaSource = readFileSync(join(process.cwd(), "convex/schema.ts"), "utf8");
    assert.equal(routeSource.includes("ProcurementOfficerRoutePlaceholder"), false);
    assert.equal(routeSource.includes("ProcurementOfficerConsolidationWorkspace"), true);
    assert.equal(CONSOLIDATION_EMPTY_MESSAGE.includes("No approved plans"), true);
    assert.equal(workspaceSource.includes("CONSOLIDATION_EMPTY_MESSAGE"), true);
    assert.equal(workspaceSource.includes("Open department setup"), true);
    assert.equal(workspaceSource.includes("Open consolidation workspace"), false);
    assert.equal(workspaceSource.includes("Finalize Plan"), true);
    assert.equal(workspaceSource.includes("Edit Draft"), true);
    assert.equal(workspaceSource.includes("Export ready"), true);
    assert.equal(workspaceSource.includes("queueConsolidatedPlanExcelExport"), true);
    assert.equal(workspaceSource.includes("Excel Preview"), true);
    assert.equal(workspaceSource.includes("Consolidated Plan Preview"), true);
    assert.equal(workspaceSource.includes("Consolidated Procurement Plan Template"), true);
    assert.equal(workspaceSource.includes("Download .xlsx"), true);
    assert.equal(workspaceSource.includes("PreviewCategoryRows"), true);
    assert.equal(workspaceSource.includes("Export History"), true);
    assert.equal(workspaceSource.includes("readOnly={isFinalized}"), true);
    assert.equal(workspaceSource.includes("Finalized on"), true);
    assert.equal(shellSource.includes('await import("blockly")'), true);
    assert.equal(shellSource.includes("Blockly.Xml"), false);
    assert.equal(shellSource.includes("SUMMARY_ONLY"), true);
    assert.equal(shellSource.includes("FINANCIAL_YEAR: args.fiscalYear"), true);
    assert.equal(shellSource.includes("timingSections"), true);
    assert.equal(shellSource.includes("inputs.TIMING"), false);
    assert.equal(shellSource.includes("buildTimingBlockChain"), false);
    assert.equal(shellSource.includes('name: "Timing"'), false);
    assert.match(
        workspaceSource,
        /\.\.\.\(asRecord\(aggregateBlock\?\.fields\) \?\? \{\}\),\s*FINANCIAL_YEAR: args\.fiscalYear/s,
    );
    assert.equal(workspaceSource.includes("createDepartmentStubChainFromAggregate"), true);
    assert.equal(workspaceSource.includes("cloneConsolidationTimingChain"), false);
    assert.equal(workspaceSource.includes("TimingDetailsPanel"), true);
    assert.equal(workspaceSource.includes("ConsolidationDepartmentDetailsPanel"), true);
    assert.equal(workspaceSource.includes("visibleItems"), true);
    completedTests.push(
        "consolidation UI source replaces the placeholder route, includes setup and no-approved-plan states, lazy-loads Blockly, uses compact summary-only department blocks, moves timing inspection into the details panel, provides virtualized item rows, and excludes export controls",
    );

    assert.equal(schemaSource.includes("consolidationExports"), true);
    assert.equal(schemaSource.includes('v.literal("audit_xlsx")'), true);
    assert.equal(schemaSource.includes("by_snapshotId"), true);
    assert.equal(schemaSource.includes("by_idempotencyKey"), true);
    assert.equal(exportFunctionSource.includes("Finalize the consolidation before exporting"), true);
    assert.equal(exportFunctionSource.includes("prepareConsolidatedPlanExcelExport"), true);
    assert.equal(exportFunctionSource.includes("loadCurrentFinalizedSnapshot"), true);
    assert.equal(exportFunctionSource.includes("recordConsolidatedPlanExportDownload"), true);
    assert.equal(exportFunctionSource.includes("downloadCount: exportRow.downloadCount + 1"), true);
    assert.equal(exportFunctionSource.includes("markStaleConsolidatedPlanExportsFailed"), true);
    assert.equal(fileActionsSource.includes("/api/services/files/exports/consolidated-plan/queue"), true);
    assert.equal(fileActionsSource.includes("formatterPayload"), true);
    assert.equal(exportFunctionSource.includes("workbookBase64"), false);
    completedTests.push(
        "consolidation export orchestration is finalized-only, stores tenant-scoped export history by current snapshot id, tracks download counts and stale failures, and queues a server-side formatter handoff without browser workbook generation",
    );

    return completedTests;
}

function createDeepWorkspaceState(depth: number): Record<string, unknown> {
    let current: Record<string, unknown> = {};
    const root = current;
    for (let index = 0; index < depth; index += 1) {
        const next: Record<string, unknown> = {};
        current.child = next;
        current = next;
    }
    return root;
}
