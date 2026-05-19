import type { ConsolidatedProcurementPlanExport } from "@/files/excel/consolidated-procurement-plan.types";

export function createConsolidatedProcurementPlanFixture(
  overrides: Partial<ConsolidatedProcurementPlanExport> = {},
): ConsolidatedProcurementPlanExport {
  return {
    reportName: "GOK Consolidated Procurement Plan",
    institutionName: "Pwani University",
    fiscalYear: "2026-2027",
    generatedAt: "2026-05-18T08:30:00.000Z",
    generatedBy: "Jane Procurement Officer",
    exportId: "export-7-6",
    consolidationId: "consolidation-123",
    snapshotId: "snapshot-latest-official",
    tenantId: "tenant-pwani",
    sourcePlanIds: ["plan-a", "plan-b"],
    selectedDepartmentIds: ["department-ict"],
    sourceSnapshot: {
      capturedAt: "2026-05-18T08:00:00.000Z",
      capturedBy: "Jane Procurement Officer",
      notes: "Latest finalized snapshot after re-finalization.",
    },
    departments: [
      {
        departmentId: "department-ict",
        departmentName: "ICT Department",
        voteNumber: "ICT-001",
        categories: [
          {
            category: "Goods",
            items: [
              {
                voteNumber: "ICT-001",
                itemDescription: "Laptop computers",
                unitOfMeasure: "Pieces",
                quantity: 10,
                unitPrice: 100_000,
                procurementMethod: "Open Tender",
                sourceOfFunds: "GOK",
                estimatedUnitCost: 100_000,
                q1Quantity: 2,
                q2Quantity: 3,
                q3Quantity: 4,
                q4Quantity: 1,
                annualTotal: 1_000_000,
              },
            ],
          },
          {
            category: "Services",
            items: [],
          },
        ],
      },
    ],
    compliance: {
      agpo: {
        targetPercentage: 30,
        actualPercentage: 32,
        targetAmount: 300_000,
        actualAmount: 320_000,
        variance: 20_000,
        q1Amount: 80_000,
        q2Amount: 90_000,
        q3Amount: 70_000,
        q4Amount: 80_000,
        sourceNotes: "Aggregate block AGPO values.",
      },
      pwd: {
        targetPercentage: 2,
        actualPercentage: 3,
        targetAmount: 20_000,
        actualAmount: 30_000,
        variance: 10_000,
        q1Amount: 5_000,
        q2Amount: 10_000,
        q3Amount: 5_000,
        q4Amount: 10_000,
        sourceNotes: "Aggregate block PWD values.",
      },
      localContent: {
        targetPercentage: 40,
        actualPercentage: 45,
        targetAmount: 400_000,
        actualAmount: 450_000,
        variance: 50_000,
        q1Amount: 120_000,
        q2Amount: 130_000,
        q3Amount: 100_000,
        q4Amount: 100_000,
        sourceNotes: "Aggregate block local content values.",
      },
    },
    audit: {
      source: "unit-test-fixture",
    },
    ...overrides,
  };
}
