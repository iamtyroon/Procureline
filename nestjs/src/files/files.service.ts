import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { RequestUser } from "@/common/types/request-user";
import { QueueService } from "@/queue/queue.service";
import { FILE_EXPORT_JOB, FILE_IMPORT_JOB } from "@/queue/queue.constants";
import { ConvexSyncService } from "@/sync/convex-sync.service";
import { CreateExcelExportDto, QueueConsolidatedPlanExportDto } from "@/files/dto/create-excel-export.dto";
import { CreatePdfDto } from "@/files/dto/create-pdf.dto";
import { ImportExcelDto } from "@/files/dto/import-excel.dto";
import type {
  ConsolidatedCategorySection,
  ConsolidatedComplianceSummary,
  ConsolidatedDepartmentSection,
  ConsolidatedProcurementItem,
  ConsolidatedProcurementPlanExport,
} from "@/files/excel/consolidated-procurement-plan.types";
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

  private buildConsolidatedPlanExportEventKey(dto: QueueConsolidatedPlanExportDto): string {
    return `consolidated-plan-export:${dto.idempotencyKey ?? dto.exportId}`;
  }

  private buildImportEventKey(dto: ImportExcelDto): string {
    return `files-import:${dto.idempotencyKey ?? randomUUID()}`;
  }

  private isQueueUnavailableError(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }

    const response =
      "getResponse" in error && typeof error.getResponse === "function"
        ? error.getResponse()
        : undefined;
    if (!response || typeof response !== "object") {
      return false;
    }

    const errorCode = (response as { error?: { code?: unknown } }).error?.code;
    return errorCode === "QUEUE_UNAVAILABLE";
  }

  private async completeConsolidatedPlanExcelExportSync(
    dto: QueueConsolidatedPlanExportDto,
    eventKey: string,
  ): Promise<{
    checksum: string;
    downloadUrl: string;
    fileName: string;
    fileSizeBytes: number;
    storageId: string;
    workbookBase64: string;
  }> {
    const result = await this.createConsolidatedPlanExcelExport(dto);
    await this.convexSyncService.completeSync({
      durableChanges: [
        {
          changeType: "files.consolidated_plan_export.completed",
          exportId: dto.exportId,
          fileName: result.fileName,
        },
      ],
      eventKey,
      result,
    });
    return result;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private parseAmount(
    value: unknown,
    fieldName: string,
    options: { defaultValue?: number; required?: boolean } = {},
  ): number {
    if (value === undefined || value === null || value === "") {
      if (options.required) {
        throw new Error(`${fieldName} is required for consolidated Excel export`);
      }
      return options.defaultValue ?? 0;
    }

    const normalized = typeof value === "string" ? value.replace(/,/g, "").trim() : value;
    const parsed = typeof normalized === "number" ? normalized : Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${fieldName} must be a finite number`);
    }
    return parsed;
  }

  private getNestedBlock(value: unknown): Record<string, unknown> | null {
    const record = this.asRecord(value);
    const block = this.asRecord(record.block);
    return Object.keys(block).length > 0 ? block : null;
  }

  private parseWorkspaceJson(value: unknown): Record<string, unknown> {
    if (typeof value === "string" && value.trim().length > 0) {
      try {
        return this.asRecord(JSON.parse(value));
      } catch {
        return {};
      }
    }
    return this.asRecord(value);
  }

  private findDepartmentBlock(workspaceState: unknown): Record<string, unknown> | null {
    const workspace = this.asRecord(workspaceState);
    const workspaceJson = this.parseWorkspaceJson(workspace.workspaceJson);
    const blocksRoot = this.asRecord(workspaceJson.blocks);
    const blocks = blocksRoot.blocks;
    if (!Array.isArray(blocks)) {
      return null;
    }
    return blocks
      .map((block) => this.asRecord(block))
      .find((block) => block.type === "department_block") ?? null;
  }

  private readItemsFromCategory(
    categoryBlock: Record<string, unknown>,
    categoryId: string,
    categoryName: string,
  ): ConsolidatedProcurementItem[] {
    const items: ConsolidatedProcurementItem[] = [];
    let currentItem = this.getNestedBlock(this.asRecord(categoryBlock.inputs).ITEMS);

    while (currentItem && currentItem.type === "item_block") {
      const fields = this.asRecord(currentItem.fields);
      const itemLabel = `${categoryName} item ${items.length + 1}`;
      const unitPrice = this.parseAmount(fields.UNIT_PRICE, `${itemLabel}.UNIT_PRICE`, { required: true });
      const q1Quantity = this.parseAmount(fields.Q1_QTY, `${itemLabel}.Q1_QTY`);
      const q2Quantity = this.parseAmount(fields.Q2_QTY, `${itemLabel}.Q2_QTY`);
      const q3Quantity = this.parseAmount(fields.Q3_QTY, `${itemLabel}.Q3_QTY`);
      const q4Quantity = this.parseAmount(fields.Q4_QTY, `${itemLabel}.Q4_QTY`);
      items.push({
        annualTotal: (q1Quantity + q2Quantity + q3Quantity + q4Quantity) * unitPrice,
        category: categoryName,
        estimatedUnitCost: unitPrice,
        itemDescription: String(fields.ITEM_DESC ?? fields.ITEM_DESCRIPTION ?? "Item"),
        procurementMethod: String(fields.PROC_METHOD ?? ""),
        q1Cost: q1Quantity * unitPrice,
        q1Quantity,
        q2Cost: q2Quantity * unitPrice,
        q2Quantity,
        q3Cost: q3Quantity * unitPrice,
        q3Quantity,
        q4Cost: q4Quantity * unitPrice,
        q4Quantity,
        quantity: q1Quantity + q2Quantity + q3Quantity + q4Quantity,
        sourceOfFunds: String(fields.SOURCE_OF_FUNDS ?? ""),
        unitOfMeasure: String(fields.UNIT_OF_MEASUREMENT ?? ""),
        unitPrice,
        voteNumber: String(fields.VOTE_NUMBER ?? ""),
      });
      currentItem = this.getNestedBlock(currentItem.next);
    }

    return items;
  }

  private buildDepartmentSections(sourceDepartments: unknown): ConsolidatedDepartmentSection[] {
    if (!Array.isArray(sourceDepartments)) {
      return [];
    }

    return sourceDepartments.map((source, index) => {
      const sourceRecord = this.asRecord(source);
      const departmentBlock = this.findDepartmentBlock(sourceRecord.workspaceState);
      if (!departmentBlock) {
        throw new Error(
          `Unable to build consolidated Excel export: source department ${String(sourceRecord.departmentId ?? index + 1)} has no department block in its finalized workspace snapshot.`,
        );
      }
      const departmentFields = this.asRecord(departmentBlock?.fields);
      const categories: ConsolidatedCategorySection[] = [];
      let currentCategory = this.getNestedBlock(this.asRecord(departmentBlock?.inputs).CATEGORIES);

      while (currentCategory && currentCategory.type === "category_block") {
        const fields = this.asRecord(currentCategory.fields);
        const categoryName = String(fields.CATEGORY_NAME ?? `Category ${categories.length + 1}`);
        const categoryId = String(fields.CATEGORY_ID ?? categoryName);
        categories.push({
          category: categoryName,
        items: this.readItemsFromCategory(currentCategory, categoryId, categoryName).map((item) => ({
          ...item,
          voteNumber: String(departmentFields.VOTE_NUMBER ?? sourceRecord.voteNumber ?? item.voteNumber),
        })),
        });
        currentCategory = this.getNestedBlock(currentCategory.next);
      }

      const itemCount = categories.reduce((total, category) => total + category.items.length, 0);
      if (itemCount === 0) {
        throw new Error(
          `Unable to build consolidated Excel export: source department ${String(sourceRecord.departmentId ?? index + 1)} has no item rows in its finalized workspace snapshot.`,
        );
      }

      return {
        categories,
        departmentId: String(sourceRecord.departmentId ?? `department-${index + 1}`),
        departmentName: String(sourceRecord.departmentName ?? `Department ${index + 1}`),
        voteNumber: String(departmentFields.VOTE_NUMBER ?? sourceRecord.voteNumber ?? ""),
      };
    });
  }

  private buildComplianceSummary(raw: unknown, totalCost: number): ConsolidatedComplianceSummary {
    const aggregateFields = this.asRecord(this.asRecord(raw).aggregateFields);
    const metric = (prefix: "AGPO" | "LOCAL" | "PWD", targetPercentage: number) => {
      const actualAmount = this.parseAmount(aggregateFields[`${prefix}_CALCULATED`], `compliance.${prefix}_CALCULATED`);
      const targetAmount = totalCost * (targetPercentage / 100);
      const q1Amount = this.parseAmount(aggregateFields[`${prefix}_Q1_TOTAL`], `compliance.${prefix}_Q1_TOTAL`);
      const q2Amount = this.parseAmount(aggregateFields[`${prefix}_Q2_TOTAL`], `compliance.${prefix}_Q2_TOTAL`);
      const q3Amount = this.parseAmount(aggregateFields[`${prefix}_Q3_TOTAL`], `compliance.${prefix}_Q3_TOTAL`);
      const q4Amount = this.parseAmount(aggregateFields[`${prefix}_Q4_TOTAL`], `compliance.${prefix}_Q4_TOTAL`);
      return {
        actualAmount,
        actualPercentage: totalCost > 0 ? (actualAmount / totalCost) * 100 : 0,
        q1Amount,
        q2Amount,
        q3Amount,
        q4Amount,
        targetAmount,
        targetPercentage,
        variance: actualAmount - targetAmount,
      };
    };
    return {
      agpo: metric("AGPO", 30),
      localContent: metric("LOCAL", 40),
      pwd: metric("PWD", 2),
    };
  }

  private sumDepartmentAnnualTotal(department: ConsolidatedDepartmentSection): number {
    return department.categories.reduce(
      (categoryTotal, category) =>
        categoryTotal +
        category.items.reduce((itemTotal, item) => itemTotal + (item.annualTotal ?? 0), 0),
      0,
    );
  }

  private sumQuarterTotals(departments: ConsolidatedDepartmentSection[]): {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  } {
    return departments.reduce(
      (totals, department) => {
        for (const category of department.categories) {
          for (const item of category.items) {
            totals.q1 += item.q1Cost ?? item.q1Quantity * item.unitPrice;
            totals.q2 += item.q2Cost ?? item.q2Quantity * item.unitPrice;
            totals.q3 += item.q3Cost ?? item.q3Quantity * item.unitPrice;
            totals.q4 += item.q4Cost ?? item.q4Quantity * item.unitPrice;
          }
        }
        return totals;
      },
      { q1: 0, q2: 0, q3: 0, q4: 0 },
    );
  }

  private normalizeConsolidatedPlanPayload(dto: QueueConsolidatedPlanExportDto): ConsolidatedProcurementPlanExport {
    const raw = this.asRecord(dto.formatterPayload);
    const calculatedTotals = this.asRecord(raw.calculatedTotals);
    const institution = this.asRecord(raw.institution);
    const sourceSnapshot = this.asRecord(raw.sourceSnapshot);
    const departments = this.buildDepartmentSections(raw.sourceDepartments);
    const rowQuarterTotals = this.sumQuarterTotals(departments);
    const totalCost =
      this.parseAmount(calculatedTotals.totalCost, "calculatedTotals.totalCost") ||
      departments.reduce((total, department) => total + this.sumDepartmentAnnualTotal(department), 0);

    return {
      audit: this.asRecord(raw.audit) as ConsolidatedProcurementPlanExport["audit"],
      compliance: this.buildComplianceSummary(raw.complianceSummary, totalCost),
      consolidationId: String(raw.consolidationId ?? ""),
      departments,
      exportId: String(raw.exportId ?? dto.exportId),
      fiscalYear: String(raw.fiscalYear ?? ""),
      generatedAt: raw.generatedAt instanceof Date || typeof raw.generatedAt === "string"
        ? raw.generatedAt
        : new Date(Number(raw.generatedAt ?? Date.now())),
      generatedBy: String(raw.generatedBy ?? ""),
      institutionName: String(raw.institutionName ?? institution.name ?? "Institution"),
      reportName: String(raw.reportName ?? dto.reportName ?? `Consolidated Plan ${String(raw.fiscalYear ?? "Export")}`),
      selectedDepartmentIds: Array.isArray(raw.selectedSourceDepartmentIds)
        ? raw.selectedSourceDepartmentIds.map(String)
        : [],
      snapshotId: String(raw.snapshotId ?? ""),
      sourcePlanIds: Array.isArray(raw.sourcePlanIds) ? raw.sourcePlanIds.map(String) : [],
      sourceSnapshot: {
        capturedAt:
          sourceSnapshot.capturedAt instanceof Date || typeof sourceSnapshot.capturedAt === "string"
            ? sourceSnapshot.capturedAt
            : new Date(Number(sourceSnapshot.capturedAt ?? Date.now())),
        capturedBy: typeof sourceSnapshot.capturedBy === "string" ? sourceSnapshot.capturedBy : undefined,
        notes: typeof sourceSnapshot.notes === "string" ? sourceSnapshot.notes : undefined,
      },
      summary: {
        annualGrandTotal: totalCost,
        categoryTotals: [],
        departmentTotals: departments.map((department) => ({
          annualTotal: this.sumDepartmentAnnualTotal(department),
          departmentId: department.departmentId,
          departmentName: department.departmentName,
        })),
        quarterlyTotals: {
          q1: rowQuarterTotals.q1,
          q2: rowQuarterTotals.q2,
          q3: rowQuarterTotals.q3,
          q4: rowQuarterTotals.q4,
        },
      },
      tenantId: typeof institution.tenantId === "string" ? institution.tenantId : undefined,
    };
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

  async queueConsolidatedPlanExcelExport(
    dto: QueueConsolidatedPlanExportDto,
    actor: RequestUser,
  ): Promise<{
    duplicate?: boolean;
    eventKey: string;
    fileName?: string;
    jobId: string | undefined;
    queued: boolean;
    workbookBase64?: string;
  }> {
    const eventKey = this.buildConsolidatedPlanExportEventKey(dto);
    const claim = await this.convexSyncService.claimSync({
      actor: {
        role: actor.role,
        tenantId: actor.tenantId,
        userId: actor.sub,
      },
      eventKey,
      eventType: "files.consolidated_plan_export.requested",
      payload: {
        exportId: dto.exportId,
        reportName: dto.reportName,
        snapshotId: dto.formatterPayload.snapshotId,
      },
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
        exportKind: "consolidated_plan",
      });
    } catch (error) {
      if (this.isQueueUnavailableError(error)) {
        try {
          const result = await this.completeConsolidatedPlanExcelExportSync(dto, eventKey);
          return {
            eventKey,
            fileName: result.fileName,
            jobId: undefined,
            queued: false,
            workbookBase64: result.workbookBase64,
          };
        } catch (syncError) {
          await this.convexSyncService.failSync({
            error: {
              code: "CONSOLIDATED_PLAN_EXPORT_FAILED",
              message:
                syncError instanceof Error
                  ? syncError.message
                  : "Consolidated plan export fallback failed",
            },
            eventKey,
          }).catch(() => undefined);
          throw syncError;
        }
      }

      await this.convexSyncService.failSync({
        error: {
          code: "QUEUE_ENQUEUE_FAILED",
          message: error instanceof Error ? error.message : "Consolidated plan export queueing failed",
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

  async createConsolidatedPlanExcelExport(
    dto: QueueConsolidatedPlanExportDto,
  ): Promise<{
    checksum: string;
    downloadUrl: string;
    fileName: string;
    fileSizeBytes: number;
    storageId: string;
    workbookBase64: string;
  }> {
    const workbook = await this.excelService.createConsolidatedProcurementPlanWorkbook(
      this.normalizeConsolidatedPlanPayload(dto),
    );
    const buffer = Buffer.from(workbook.workbookBase64, "base64");
    return {
      checksum: createHash("sha256").update(buffer).digest("hex"),
      downloadUrl: `/api/services/files/exports/consolidated-plan/${encodeURIComponent(dto.exportId)}/download`,
      fileName: workbook.fileName,
      fileSizeBytes: buffer.byteLength,
      storageId: `consolidated-plan:${dto.exportId}`,
      workbookBase64: workbook.workbookBase64,
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
