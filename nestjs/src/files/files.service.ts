import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { RequestUser } from "@/common/types/request-user";
import { QueueService } from "@/queue/queue.service";
import { FILE_EXPORT_JOB, FILE_IMPORT_JOB } from "@/queue/queue.constants";
import { ConvexSyncService } from "@/sync/convex-sync.service";
import { CreateExcelExportDto } from "@/files/dto/create-excel-export.dto";
import { CreatePdfDto } from "@/files/dto/create-pdf.dto";
import { ImportExcelDto } from "@/files/dto/import-excel.dto";
import { ExcelService } from "@/files/excel.service";
import { PdfService } from "@/files/pdf.service";

@Injectable()
export class FilesService {
  constructor(
    private readonly excelService: ExcelService,
    private readonly pdfService: PdfService,
    private readonly queueService: QueueService,
    private readonly convexSyncService: ConvexSyncService,
  ) {}

  private buildExportEventKey(dto: CreateExcelExportDto): string {
    return `files-export:${dto.idempotencyKey ?? randomUUID()}`;
  }

  private buildImportEventKey(dto: ImportExcelDto): string {
    return `files-import:${dto.idempotencyKey ?? randomUUID()}`;
  }

  createExcelExport(dto: CreateExcelExportDto): Promise<{ fileName: string; workbookBase64: string }> {
    return this.excelService.createWorkbook(dto);
  }

  async queueExcelExport(
    dto: CreateExcelExportDto,
    actor: RequestUser,
  ): Promise<{ duplicate?: boolean; eventKey: string; jobId: string | undefined; queued: boolean }> {
    const eventKey = this.buildExportEventKey(dto);
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "files.export.requested",
      payload: dto,
      provider: "files",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        eventKey,
        jobId: undefined,
        queued: false,
      };
    }

    let queuedJob: { id: string | undefined };
    try {
      queuedJob = await this.queueService.enqueue(FILE_EXPORT_JOB, {
        actor,
        dto,
        eventKey,
      });
    } catch (error) {
      await this.convexSyncService.failSync({
        error: {
          code: "QUEUE_ENQUEUE_FAILED",
          message: error instanceof Error ? error.message : "Excel export queueing failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw error;
    }

    return {
      eventKey,
      jobId: queuedJob.id,
      queued: true,
    };
  }

  importWorkbook(dto: ImportExcelDto): Promise<{ rows: Record<string, unknown>[] }> {
    return this.excelService.importWorkbook(dto.workbookBase64);
  }

  async queueWorkbookImport(dto: ImportExcelDto, actor: RequestUser): Promise<{ duplicate?: boolean; eventKey: string; jobId: string | undefined; queued: boolean }> {
    const eventKey = this.buildImportEventKey(dto);
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "files.import.requested",
      payload: { workbookPreview: dto.workbookBase64.slice(0, 32) },
      provider: "files",
    });

    if (claim.status === "duplicate") {
      return {
        duplicate: true,
        eventKey,
        jobId: undefined,
        queued: false,
      };
    }

    let queuedJob: { id: string | undefined };
    try {
      queuedJob = await this.queueService.enqueue(FILE_IMPORT_JOB, {
        actor,
        dto,
        eventKey,
      });
    } catch (error) {
      await this.convexSyncService.failSync({
        error: {
          code: "QUEUE_ENQUEUE_FAILED",
          message: error instanceof Error ? error.message : "Excel import queueing failed",
        },
        eventKey,
      }).catch(() => undefined);
      throw error;
    }

    return {
      eventKey,
      jobId: queuedJob.id,
      queued: true,
    };
  }

  createPdf(dto: CreatePdfDto): Promise<{ fileName: string; pdfBase64: string }> {
    return this.pdfService.createPdf(dto);
  }
}
