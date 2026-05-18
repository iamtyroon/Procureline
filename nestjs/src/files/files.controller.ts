import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { ServiceAuthGuard } from "@/auth/service-auth.guard";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import type { RequestUser } from "@/common/types/request-user";
import { CreateExcelExportDto, QueueConsolidatedPlanExportDto } from "@/files/dto/create-excel-export.dto";
import { CreatePdfDto } from "@/files/dto/create-pdf.dto";
import { ImportExcelDto } from "@/files/dto/import-excel.dto";
import { FilesService } from "@/files/files.service";

@ApiTags("files")
@ApiBearerAuth()
@Controller("files")
@UseGuards(ThrottlerGuard, ServiceAuthGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("exports/excel")
  @ApiOperation({ summary: "Generate an Excel workbook synchronously for smoke testing and light workloads" })
  createExcelExport(@Body() dto: CreateExcelExportDto): Promise<{ fileName: string; workbookBase64: string }> {
    return this.filesService.createExcelExport(dto);
  }

  @Post("exports/excel/queue")
  queueExcelExport(
    @Body() dto: CreateExcelExportDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ duplicate?: boolean; eventKey: string; jobId: string | undefined; queued: boolean }> {
    return this.filesService.queueExcelExport(dto, user);
  }

  @Post("exports/consolidated-plan/queue")
  queueConsolidatedPlanExcelExport(
    @Body() dto: QueueConsolidatedPlanExportDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ duplicate?: boolean; eventKey: string; jobId: string | undefined; queued: boolean }> {
    return this.filesService.queueConsolidatedPlanExcelExport(dto, user);
  }

  @Post("imports/excel")
  importExcel(@Body() dto: ImportExcelDto): Promise<{ rows: Record<string, unknown>[] }> {
    return this.filesService.importWorkbook(dto);
  }

  @Post("imports/excel/queue")
  queueExcelImport(
    @Body() dto: ImportExcelDto,
    @CurrentUser() user: RequestUser,
  ): Promise<{ duplicate?: boolean; eventKey: string; jobId: string | undefined; queued: boolean }> {
    return this.filesService.queueWorkbookImport(dto, user);
  }

  @Post("exports/pdf")
  createPdf(@Body() dto: CreatePdfDto): Promise<{ fileName: string; pdfBase64: string }> {
    return this.filesService.createPdf(dto);
  }
}
