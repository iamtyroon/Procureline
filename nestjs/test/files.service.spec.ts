import { FilesService } from "@/files/files.service";
import { ServiceUnavailableException } from "@nestjs/common";

describe("FilesService", () => {
  const excelService = {
    createConsolidatedProcurementPlanWorkbook: jest.fn(),
    createWorkbook: jest.fn(),
    importWorkbook: jest.fn(),
  };
  const pdfService = {
    createPdf: jest.fn(),
  };
  const queueService = {
    enqueue: jest.fn(),
  };
  const convexSyncService = {
    claimSync: jest.fn(),
    completeSync: jest.fn(),
    failSync: jest.fn(),
  };

  let filesService: FilesService;

  beforeEach(() => {
    jest.clearAllMocks();
    convexSyncService.claimSync.mockResolvedValue({ status: "claimed" });
    convexSyncService.failSync.mockResolvedValue({ status: "failed" });
    queueService.enqueue.mockResolvedValue({ id: "job-1" });

    filesService = new FilesService(
      excelService as never,
      pdfService as never,
      queueService as never,
      convexSyncService as never,
    );
  });

  it("fails the sync claim when export queueing throws", async () => {
    queueService.enqueue.mockRejectedValueOnce(new Error("redis down"));

    await expect(
      filesService.queueExcelExport(
        {
          reportName: "Monthly Report",
          rows: [{ total: 1 }],
        },
        {
          role: "tenant_admin",
          sub: "user_1",
          tenantId: "tenant_1",
        } as never,
      ),
    ).rejects.toThrow("redis down");

    expect(convexSyncService.failSync).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "QUEUE_ENQUEUE_FAILED",
        }),
      }),
    );
  });

  it("does not use the report name as the implicit idempotency key", async () => {
    await filesService.queueExcelExport(
      {
        reportName: "Monthly Report",
        rows: [{ total: 1 }],
      },
      {
        role: "tenant_admin",
        sub: "user_1",
        tenantId: "tenant_1",
      } as never,
    );

    const claimArgs = convexSyncService.claimSync.mock.calls[0]?.[0];
    expect(claimArgs.eventKey).toMatch(/^files-export:/);
    expect(claimArgs.eventKey).not.toBe("files-export:Monthly Report");
  });

  it("queues consolidated plan exports with snapshot-only formatter metadata", async () => {
    await filesService.queueConsolidatedPlanExcelExport(
      {
        exportId: "export_1",
        formatterPayload: {
          consolidationId: "consolidation_1",
          snapshotId: "snapshot_1",
        },
        idempotencyKey: "idempotency-1",
        reportName: "Consolidated Plan 2026-2027",
      },
      {
        role: "procurement_officer",
        sub: "user_1",
        tenantId: "tenant_1",
      } as never,
    );

    expect(convexSyncService.claimSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "consolidated-plan-export:idempotency-1",
        eventType: "files.consolidated_plan_export.requested",
        payload: expect.objectContaining({
          exportId: "export_1",
          snapshotId: "snapshot_1",
        }),
      }),
    );
    expect(queueService.enqueue).toHaveBeenCalledWith(
      "files.export",
      expect.objectContaining({
        exportKind: "consolidated_plan",
      }),
    );
  });

  it("completes consolidated plan exports synchronously when Redis is unavailable", async () => {
    queueService.enqueue.mockRejectedValueOnce(
      new ServiceUnavailableException({
        error: {
          code: "QUEUE_UNAVAILABLE",
          message: "Redis is unavailable. Retryable work was not accepted.",
        },
      }),
    );
    excelService.createConsolidatedProcurementPlanWorkbook.mockResolvedValueOnce({
      fileName: "Consolidated Plan 2026-2027.xlsx",
      workbookBase64: Buffer.from("workbook").toString("base64"),
    });

    const result = await filesService.queueConsolidatedPlanExcelExport(
      {
        exportId: "export_1",
        formatterPayload: {
          consolidationId: "consolidation_1",
          snapshotId: "snapshot_1",
        },
        idempotencyKey: "idempotency-1",
        reportName: "Consolidated Plan 2026-2027",
      },
      {
        role: "procurement_officer",
        sub: "user_1",
        tenantId: "tenant_1",
      } as never,
    );

    expect(result).toEqual({
      eventKey: "consolidated-plan-export:idempotency-1",
      fileName: "Consolidated Plan 2026-2027.xlsx",
      jobId: undefined,
      queued: false,
      workbookBase64: Buffer.from("workbook").toString("base64"),
    });
    expect(convexSyncService.completeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        durableChanges: [
          expect.objectContaining({
            changeType: "files.consolidated_plan_export.completed",
            exportId: "export_1",
          }),
        ],
      }),
    );
    expect(convexSyncService.failSync).not.toHaveBeenCalled();
  });

  it("normalizes serialized source workspaces before generating consolidated plan exports", async () => {
    queueService.enqueue.mockRejectedValueOnce(
      new ServiceUnavailableException({
        error: {
          code: "QUEUE_UNAVAILABLE",
          message: "Redis is unavailable. Retryable work was not accepted.",
        },
      }),
    );
    excelService.createConsolidatedProcurementPlanWorkbook.mockResolvedValueOnce({
      fileName: "Consolidated Plan 2026-2027.xlsx",
      workbookBase64: Buffer.from("workbook").toString("base64"),
    });

    await filesService.queueConsolidatedPlanExcelExport(
      {
        exportId: "export_1",
        formatterPayload: {
          calculatedTotals: {
            q1Total: 0,
            q2Total: 0,
            q3Total: 0,
            q4Total: 0,
            totalCost: 25000,
          },
          complianceSummary: { aggregateFields: { GRAND_TOTAL: "25000" } },
          consolidationId: "consolidation_1",
          fiscalYear: "2026-2027",
          generatedAt: Date.now(),
          generatedBy: "user_1",
          institutionName: "Tyroon University",
          selectedSourceDepartmentIds: ["department_1"],
          snapshotId: "snapshot_1",
          sourceDepartments: [
            {
              departmentId: "department_1",
              departmentName: "Botanical Garden Activities",
              voteNumber: "111708",
              workspaceState: {
                format: "blockly_json",
                workspaceJson: JSON.stringify({
                  blocks: {
                    blocks: [
                      {
                        fields: { VOTE_NUMBER: "111708" },
                        inputs: {
                          CATEGORIES: {
                            block: {
                              fields: { CATEGORY_ID: "ict", CATEGORY_NAME: "ICT" },
                              inputs: {
                                ITEMS: {
                                  block: {
                                    fields: {
                                      ITEM_DESC: "printer",
                                      PROC_METHOD: "RFQ",
                                      Q1_QTY: "2",
                                      Q2_QTY: "0",
                                      Q3_QTY: "0",
                                      Q4_QTY: "0",
                                      SOURCE_OF_FUNDS: "GOK",
                                      UNIT_OF_MEASUREMENT: "each",
                                      UNIT_PRICE: "12500",
                                    },
                                    type: "item_block",
                                  },
                                },
                              },
                              type: "category_block",
                            },
                          },
                        },
                        type: "department_block",
                      },
                    ],
                  },
                }),
              },
            },
          ],
          sourcePlanIds: ["plan_1"],
          sourceSnapshot: { capturedAt: Date.now() },
        },
        idempotencyKey: "idempotency-1",
        reportName: "Consolidated Plan 2026-2027",
      },
      {
        role: "procurement_officer",
        sub: "user_1",
        tenantId: "tenant_1",
      } as never,
    );

    expect(excelService.createConsolidatedProcurementPlanWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({
        reportName: "Consolidated Plan 2026-2027",
        summary: expect.objectContaining({
          annualGrandTotal: 25000,
          quarterlyTotals: {
            q1: 25000,
            q2: 0,
            q3: 0,
            q4: 0,
          },
        }),
        departments: [
          expect.objectContaining({
            categories: [
              expect.objectContaining({
                items: [
                  expect.objectContaining({
                    annualTotal: 25000,
                    itemDescription: "printer",
                    q1Cost: 25000,
                    voteNumber: "111708",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    );
  });

  it("rejects non-numeric source item values instead of exporting them as zero", async () => {
    queueService.enqueue.mockRejectedValueOnce(
      new ServiceUnavailableException({
        error: {
          code: "QUEUE_UNAVAILABLE",
          message: "Redis is unavailable. Retryable work was not accepted.",
        },
      }),
    );

    await expect(
      filesService.queueConsolidatedPlanExcelExport(
        {
          exportId: "export_1",
          formatterPayload: {
            complianceSummary: { aggregateFields: { GRAND_TOTAL: "25000" } },
            consolidationId: "consolidation_1",
            fiscalYear: "2026-2027",
            generatedAt: Date.now(),
            generatedBy: "user_1",
            institutionName: "Tyroon University",
            selectedSourceDepartmentIds: ["department_1"],
            snapshotId: "snapshot_1",
            sourceDepartments: [
              {
                departmentId: "department_1",
                departmentName: "ICT",
                voteNumber: "111708",
                workspaceState: {
                  workspaceJson: JSON.stringify({
                    blocks: {
                      blocks: [
                        {
                          fields: { VOTE_NUMBER: "111708" },
                          inputs: {
                            CATEGORIES: {
                              block: {
                                fields: { CATEGORY_NAME: "ICT" },
                                inputs: {
                                  ITEMS: {
                                    block: {
                                      fields: {
                                        ITEM_DESC: "printer",
                                        Q1_QTY: "not-a-number",
                                        UNIT_PRICE: "12500",
                                      },
                                      type: "item_block",
                                    },
                                  },
                                },
                                type: "category_block",
                              },
                            },
                          },
                          type: "department_block",
                        },
                      ],
                    },
                  }),
                },
              },
            ],
            sourcePlanIds: ["plan_1"],
            sourceSnapshot: { capturedAt: Date.now() },
          },
          idempotencyKey: "idempotency-1",
          reportName: "Consolidated Plan 2026-2027",
        },
        {
          role: "procurement_officer",
          sub: "user_1",
          tenantId: "tenant_1",
        } as never,
      ),
    ).rejects.toThrow("ICT item 1.Q1_QTY must be a finite number");
  });

  it("rejects source workspaces that cannot be parsed into export item rows", async () => {
    queueService.enqueue.mockRejectedValueOnce(
      new ServiceUnavailableException({
        error: {
          code: "QUEUE_UNAVAILABLE",
          message: "Redis is unavailable. Retryable work was not accepted.",
        },
      }),
    );

    await expect(
      filesService.queueConsolidatedPlanExcelExport(
        {
          exportId: "export_1",
          formatterPayload: {
            complianceSummary: { aggregateFields: { GRAND_TOTAL: "25000" } },
            consolidationId: "consolidation_1",
            fiscalYear: "2026-2027",
            generatedAt: Date.now(),
            generatedBy: "user_1",
            institutionName: "Tyroon University",
            selectedSourceDepartmentIds: ["department_1"],
            snapshotId: "snapshot_1",
            sourceDepartments: [
              {
                departmentId: "department_1",
                departmentName: "ICT",
                workspaceState: {
                  workspaceJson: JSON.stringify({ blocks: { blocks: [] } }),
                },
              },
            ],
            sourcePlanIds: ["plan_1"],
            sourceSnapshot: { capturedAt: Date.now() },
          },
          idempotencyKey: "idempotency-1",
          reportName: "Consolidated Plan 2026-2027",
        },
        {
          role: "procurement_officer",
          sub: "user_1",
          tenantId: "tenant_1",
        } as never,
      ),
    ).rejects.toThrow("has no department block");
  });
});
