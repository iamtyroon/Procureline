import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    CONSOLIDATION_EMPTY_MESSAGE,
    buildConsolidationReadiness,
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
        "consolidation readiness derives sources only from approved current-year plans, keeps consolidatedAt informational, and deduplicates approved plans by approval recency",
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
    completedTests.push(
        "consolidation fiscal-year normalization ignores malformed client input and falls back to safe dashboard-backed options",
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
            selectedSourceDepartmentIds: ["department-ict", "department-ict"],
        }).ok,
        false,
    );
    assert.equal(
        validateConsolidationDraftPayload({
            selectedSourceDepartmentIds: [],
            workspaceState: createDeepWorkspaceState(26),
        }).ok,
        false,
    );
    completedTests.push(
        "consolidation draft validation rejects duplicate sources and overly deep JSON before persistence",
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
    assert.equal(routeSource.includes("ProcurementOfficerRoutePlaceholder"), false);
    assert.equal(routeSource.includes("ProcurementOfficerConsolidationWorkspace"), true);
    assert.equal(CONSOLIDATION_EMPTY_MESSAGE.includes("No approved plans"), true);
    assert.equal(workspaceSource.includes("CONSOLIDATION_EMPTY_MESSAGE"), true);
    assert.equal(workspaceSource.includes("Open department setup"), true);
    assert.equal(workspaceSource.includes("Open consolidation workspace"), false);
    assert.equal(workspaceSource.includes("Excel"), false);
    assert.equal(shellSource.includes('await import("blockly")'), true);
    assert.equal(shellSource.includes("Blockly.Xml"), false);
    completedTests.push(
        "consolidation UI source replaces the placeholder route, includes setup and no-approved-plan states, lazy-loads Blockly, and excludes export controls",
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
