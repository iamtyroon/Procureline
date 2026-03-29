import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { EmailDispatchService } from "@/email/email-dispatch.service";
import type { SendEmailDto } from "@/email/dto/send-email.dto";
import { FilesService } from "@/files/files.service";
import type { CreateExcelExportDto } from "@/files/dto/create-excel-export.dto";
import type { ImportExcelDto } from "@/files/dto/import-excel.dto";
import { AppLogger } from "@/common/logging/app.logger";
import { EMAIL_SEND_JOB, FILE_EXPORT_JOB, FILE_IMPORT_JOB, PLATFORM_QUEUE } from "@/queue/queue.constants";
import { ConvexSyncService } from "@/sync/convex-sync.service";

@Injectable()
@Processor(PLATFORM_QUEUE)
export class PlatformQueueProcessor extends WorkerHost {
  constructor(
    private readonly appLogger: AppLogger,
    private readonly convexSyncService: ConvexSyncService,
    private readonly emailDispatchService: EmailDispatchService,
    private readonly filesService: FilesService,
  ) {
    super();
  }

  async process(job: Job): Promise<Record<string, unknown>> {
    switch (job.name) {
      case EMAIL_SEND_JOB: {
        const { dto, eventKey } = job.data as { dto: SendEmailDto; eventKey: string };
        const result = await this.emailDispatchService.send(dto);
        await this.convexSyncService.completeSync({
          durableChanges: [
            {
              changeType: result.skipped === true ? "email.skipped" : "email.sent",
              reason: result.skipped === true ? result.skipReason : undefined,
              to: dto.to,
            },
          ],
          eventKey,
          result: {
            ...result,
            processed: true,
          },
        });
        await job.updateProgress(100);
        return result;
      }

      case FILE_EXPORT_JOB: {
        const { dto, eventKey } = job.data as { dto: CreateExcelExportDto; eventKey: string };
        const result = await this.filesService.createExcelExport(dto);
        await this.convexSyncService.completeSync({
          durableChanges: [
            {
              changeType: "files.export.completed",
              fileName: result.fileName,
            },
          ],
          eventKey,
          result,
        });
        await job.updateProgress(100);
        return result;
      }

      case FILE_IMPORT_JOB: {
        const { dto, eventKey } = job.data as { dto: ImportExcelDto; eventKey: string };
        const result = await this.filesService.importWorkbook(dto);
        await this.convexSyncService.completeSync({
          durableChanges: [
            {
              changeType: "files.import.completed",
              rowsImported: result.rows.length,
            },
          ],
          eventKey,
          result,
        });
        await job.updateProgress(100);
        return result;
      }

      default:
        throw new Error(`Unsupported queue job: ${job.name}`);
    }
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job | undefined, error: Error): Promise<void> {
    if (job?.data?.eventKey) {
      await this.convexSyncService.failSync({
        durableChanges: [
          {
            changeType: "queue.job.failed",
            jobId: job.id?.toString(),
            name: job.name,
          },
        ],
        error: {
          code: "QUEUE_JOB_FAILED",
          message: error.message,
        },
        eventKey: String(job.data.eventKey),
      }).catch(() => undefined);
    }

    this.appLogger.error(`Queue job failed: ${job?.name ?? "unknown"}`, error.stack, "PlatformQueueProcessor");
  }
}
