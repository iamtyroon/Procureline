import { PlatformQueueProcessor } from "@/queue/platform-queue.processor";

describe("PlatformQueueProcessor", () => {
  const appLogger = {
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
  };
  const convexSyncService = {
    completeSync: jest.fn().mockResolvedValue({ status: "completed" }),
    failSync: jest.fn().mockResolvedValue({ status: "failed" }),
  };
  const emailDispatchService = {
    send: jest.fn().mockResolvedValue({ accepted: true, to: "user@example.com" }),
  };
  const filesService = {
    createExcelExport: jest.fn().mockResolvedValue({
      fileName: "report.xlsx",
      workbookBase64: "base64data",
    }),
    importWorkbook: jest.fn().mockResolvedValue({
      rows: [{ name: "Alice" }],
    }),
  };

  let processor: PlatformQueueProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new PlatformQueueProcessor(
      appLogger as never,
      convexSyncService as never,
      emailDispatchService as never,
      filesService as never,
    );
  });

  it("processes an email send job and completes the sync", async () => {
    const job = {
      name: "email.send",
      data: {
        dto: {
          idempotencyKey: "key-1",
          subject: "Hello",
          template: "generic-notification",
          to: "user@example.com",
        },
        eventKey: "email:key-1",
      },
      updateProgress: jest.fn(),
    };

    await processor.process(job as never);

    expect(emailDispatchService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Hello",
        to: "user@example.com",
      }),
    );
    expect(convexSyncService.completeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "email:key-1",
      }),
    );
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it("processes a file export job and completes the sync", async () => {
    const job = {
      name: "files.export",
      data: {
        dto: {
          reportName: "Vendors",
          rows: [{ name: "Vendor A" }],
        },
        eventKey: "files-export:vendors",
      },
      updateProgress: jest.fn(),
    };

    await processor.process(job as never);

    expect(filesService.createExcelExport).toHaveBeenCalled();
    expect(convexSyncService.completeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "files-export:vendors",
      }),
    );
  });

  it("processes a file import job and completes the sync", async () => {
    const job = {
      name: "files.import",
      data: {
        dto: {
          workbookBase64: "base64data",
        },
        eventKey: "files-import:key-1",
      },
      updateProgress: jest.fn(),
    };

    await processor.process(job as never);

    expect(filesService.importWorkbook).toHaveBeenCalledWith(
      expect.objectContaining({
        workbookBase64: "base64data",
      }),
    );
    expect(convexSyncService.completeSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "files-import:key-1",
      }),
    );
  });

  it("throws on unsupported job names", async () => {
    const job = {
      name: "unknown.job",
      data: {},
      updateProgress: jest.fn(),
    };

    await expect(processor.process(job as never)).rejects.toThrow("Unsupported queue job");
  });

  it("calls failSync when a job fails via onFailed", async () => {
    const job = {
      name: "email.send",
      data: {
        eventKey: "email:key-1",
      },
      attemptsMade: 3,
      id: "job-123",
    };

    await processor.onFailed(job as never, new Error("SMTP failure"));

    expect(convexSyncService.failSync).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: "email:key-1",
        error: expect.objectContaining({
          code: "QUEUE_JOB_FAILED",
          message: "SMTP failure",
        }),
      }),
    );
    expect(appLogger.error).toHaveBeenCalled();
  });
});
