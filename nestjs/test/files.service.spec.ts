import { FilesService } from "@/files/files.service";

describe("FilesService", () => {
  const excelService = {
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
});
