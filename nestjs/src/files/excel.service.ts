import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { CreateExcelExportDto } from "@/files/dto/create-excel-export.dto";
import type {
  ComplianceMetric,
  ConsolidatedCategorySection,
  ConsolidatedComplianceSummary,
  ConsolidatedDepartmentSection,
  ConsolidatedPlanSummary,
  ConsolidatedProcurementItem,
  ConsolidatedProcurementPlanExport,
  GeneratedWorkbook,
} from "@/files/excel/consolidated-procurement-plan.types";

const EXCEL_MAX_ROWS = 1_048_576;
const STORY_MAX_ITEM_ROWS = 1_000_000;
const EXCEL_CELL_TEXT_LIMIT = 32_767;
const SERVICE_VERSION = "procureline-gok-excel-v1";
const MONEY_FORMAT = '"KES" #,##0.00;[Red]("KES" #,##0.00)';
const INTEGER_FORMAT = "#,##0";
const PERCENT_FORMAT = "0.00%";
const DATE_FORMAT = "dd mmm yyyy hh:mm";
const PREVIEW_COLUMNS = 16;
const PREVIEW_LAST_COLUMN = "P";
const PREVIEW_BORDER_COLOR = "FF475569";
const PREVIEW_HEADER_FILL = "FFE2E8F0";
const DEPARTMENT_FILL = "FF4472C4";
const DEPARTMENT_BORDER = "FF1F4E79";
const CATEGORY_FILL = "FF70AD47";
const CATEGORY_BORDER = "FF375623";
const TIMING_HEADER_FILL = "FFF6C35B";
const TIMING_LABEL_FILL = "FFFFF2CC";
const TIMING_BORDER = "FFB8860B";
const TIMING_ROW_FILLS = {
  planned: "FFD8C8FF",
  actual: "FFFFC7DC",
  variance: "FFFFD0A8",
} as const;
const PROCESS_LABELS = [
  "Time process days",
  "Invite/Advertisement",
  "Bid Opening",
  "Bid Evaluation",
  "Tender Award",
  "Notification of Award",
  "Contract Signing",
  "Total Time for Contract",
  "Date of Completion",
] as const;

type WorkbookCellValue = string | number | Date | null;

@Injectable()
export class ExcelService {
  async createWorkbook(dto: CreateExcelExportDto): Promise<{ fileName: string; workbookBase64: string }> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(dto.reportName);

    const firstRow = dto.rows[0];
    const headers = firstRow ? Object.keys(firstRow) : [];

    if (headers.length > 0) {
      worksheet.addRow(headers);
    }

    for (const row of dto.rows) {
      worksheet.addRow(headers.map((header) => row[header]));
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: `${dto.reportName.replace(/\s+/g, "-").toLowerCase()}.xlsx`,
      workbookBase64: Buffer.from(buffer).toString("base64"),
    };
  }

  async createConsolidatedProcurementPlanWorkbook(
    payload: ConsolidatedProcurementPlanExport,
  ): Promise<GeneratedWorkbook> {
    this.validatePayload(payload);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Procureline";
    workbook.created = new Date(payload.generatedAt);
    workbook.modified = new Date(payload.generatedAt);

    this.addCoverSheet(workbook, payload);
    this.addSummarySheet(workbook, payload, this.buildSummary(payload));
    this.addConsolidatedSheet(workbook, payload);
    this.addAuditSheet(workbook, payload);

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      fileName: this.buildConsolidatedFileName(payload),
      workbookBase64: Buffer.from(buffer).toString("base64"),
    };
  }

  async importWorkbook(base64Payload: string): Promise<{ rows: Record<string, unknown>[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      Buffer.from(base64Payload, "base64") as unknown as ExcelJS.Buffer,
    );
    const worksheet = workbook.worksheets[0];
    const headerRow = worksheet?.getRow(1);
    const headerValues = Array.isArray(headerRow?.values)
      ? headerRow.values.slice(1)
      : [];
    const headers = headerValues.map((value) => String(value));
    const rows: Record<string, unknown>[] = [];

    worksheet?.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(
        headers.reduce<Record<string, unknown>>((accumulator, header, index) => {
          accumulator[header] = values[index];
          return accumulator;
        }, {}),
      );
    });

    return { rows };
  }

  private validatePayload(payload: ConsolidatedProcurementPlanExport): void {
    this.requireText(payload.reportName, "reportName");
    this.requireText(payload.institutionName, "institutionName");
    this.requireText(payload.fiscalYear, "fiscalYear");
    this.requireText(payload.generatedBy, "generatedBy");
    this.requireText(payload.exportId, "exportId");
    this.requireText(payload.consolidationId, "consolidationId");
    this.requireText(payload.snapshotId, "snapshotId");
    this.validateDate(payload.sourceSnapshot?.capturedAt, "sourceSnapshot.capturedAt");

    const itemCount = payload.departments.reduce(
      (total, department) => total + department.categories.reduce((categoryTotal, category) => categoryTotal + category.items.length, 0),
      0,
    );
    if (itemCount > STORY_MAX_ITEM_ROWS) {
      throw new Error(`Too many procurement item rows for Excel export: ${itemCount}. Maximum supported item rows is ${STORY_MAX_ITEM_ROWS}.`);
    }

    for (const department of payload.departments) {
      this.requireText(department.departmentId, "department.departmentId");
      this.requireText(department.departmentName, "department.departmentName");
      this.validateText(department.voteNumber, "department.voteNumber", true);
      for (const category of department.categories) {
        this.requireText(category.category, "category.category");
        for (const item of category.items) {
          this.validateItem(item);
        }
      }
    }

    this.validateCompliance(payload.compliance);
  }

  private validateItem(item: ConsolidatedProcurementItem): void {
    this.requireText(item.voteNumber, "item.voteNumber");
    this.requireText(item.itemDescription, "item.itemDescription");
    this.requireText(item.unitOfMeasure, "item.unitOfMeasure");
    this.requireText(item.procurementMethod, "item.procurementMethod");
    this.requireText(item.sourceOfFunds, "item.sourceOfFunds");
    this.validateNonNegativeNumber(item.quantity, "item.quantity");
    this.validateNonNegativeNumber(item.unitPrice, "item.unitPrice");
    this.validateNonNegativeNumber(item.estimatedUnitCost, "item.estimatedUnitCost");
    this.validateNonNegativeNumber(item.q1Quantity, "item.q1Quantity");
    this.validateNonNegativeNumber(item.q2Quantity, "item.q2Quantity");
    this.validateNonNegativeNumber(item.q3Quantity, "item.q3Quantity");
    this.validateNonNegativeNumber(item.q4Quantity, "item.q4Quantity");
    this.validateOptionalMoney(item.q1Cost, "item.q1Cost");
    this.validateOptionalMoney(item.q2Cost, "item.q2Cost");
    this.validateOptionalMoney(item.q3Cost, "item.q3Cost");
    this.validateOptionalMoney(item.q4Cost, "item.q4Cost");
    this.validateOptionalMoney(item.annualTotal, "item.annualTotal");
  }

  private validateCompliance(compliance: ConsolidatedComplianceSummary): void {
    const entries: Array<[string, ComplianceMetric]> = [
      ["agpo", compliance.agpo],
      ["pwd", compliance.pwd],
      ["localContent", compliance.localContent],
    ];
    for (const [key, metric] of entries) {
      this.validateNonNegativeNumber(metric.targetPercentage, `compliance.${key}.targetPercentage`);
      this.validateNonNegativeNumber(metric.actualPercentage, `compliance.${key}.actualPercentage`);
      this.validateNonNegativeNumber(metric.targetAmount, `compliance.${key}.targetAmount`);
      this.validateNonNegativeNumber(metric.actualAmount, `compliance.${key}.actualAmount`);
      this.validateOptionalMoney(metric.q1Amount, `compliance.${key}.q1Amount`);
      this.validateOptionalMoney(metric.q2Amount, `compliance.${key}.q2Amount`);
      this.validateOptionalMoney(metric.q3Amount, `compliance.${key}.q3Amount`);
      this.validateOptionalMoney(metric.q4Amount, `compliance.${key}.q4Amount`);
      this.validateFiniteNumber(metric.variance, `compliance.${key}.variance`);
      this.validateText(metric.sourceNotes, `compliance.${key}.sourceNotes`, true);
    }
  }

  private addCoverSheet(workbook: ExcelJS.Workbook, payload: ConsolidatedProcurementPlanExport): void {
    const sheet = workbook.addWorksheet("Cover");
    sheet.columns = [{ width: 28 }, { width: 84 }];
    sheet.mergeCells("A1:B1");
    sheet.getCell("A1").value = "Consolidated Annual Procurement Plan";
    sheet.getCell("A1").font = { bold: true, size: 16 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    const rows: Array<[string, WorkbookCellValue]> = [
      ["Institution", payload.institutionName],
      ["Fiscal Year", payload.fiscalYear],
      ["Generated At", new Date(payload.generatedAt)],
      ["Generated By", payload.generatedBy],
      ["Export ID", payload.exportId],
      ["Consolidation ID", payload.consolidationId],
      ["Snapshot ID", payload.snapshotId],
      ["Snapshot Captured At", new Date(payload.sourceSnapshot.capturedAt)],
      ["Source Snapshot Notes", payload.sourceSnapshot.notes ?? ""],
    ];
    rows.forEach(([label, value], index) => {
      const row = sheet.getRow(index + 3);
      row.getCell(1).value = label;
      row.getCell(2).value = value;
      row.getCell(1).font = { bold: true };
      if (value instanceof Date) {
        row.getCell(2).numFmt = DATE_FORMAT;
      }
    });
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, payload: ConsolidatedProcurementPlanExport, summary: ConsolidatedPlanSummary): void {
    const sheet = workbook.addWorksheet("Summary");
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.columns = [{ width: 34 }, { width: 22 }, { width: 22 }, { width: 44 }];
    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").value = "Annual Procurement Plan Summary";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getRow(3).values = ["Metric", "Value", "Target", "Notes"];
    sheet.getRow(3).font = { bold: true };
    sheet.addRow(["Annual Grand Total", summary.annualGrandTotal, "", ""]);
    sheet.getCell("B4").numFmt = MONEY_FORMAT;

    let rowNumber = 6;
    sheet.getCell(`A${rowNumber}`).value = "Department Totals";
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    rowNumber += 1;
    for (const department of summary.departmentTotals) {
      sheet.addRow([department.departmentName, department.annualTotal, "", department.departmentId]);
      sheet.getCell(`B${rowNumber}`).numFmt = MONEY_FORMAT;
      rowNumber += 1;
    }

    rowNumber += 1;
    sheet.getCell(`A${rowNumber}`).value = "Category Totals";
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    rowNumber += 1;
    for (const category of summary.categoryTotals) {
      sheet.addRow([category.category, category.annualTotal, "", ""]);
      sheet.getCell(`B${rowNumber}`).numFmt = MONEY_FORMAT;
      rowNumber += 1;
    }

    rowNumber += 1;
    sheet.getCell(`A${rowNumber}`).value = "Quarterly Totals";
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    rowNumber += 1;
    for (const [quarter, amount] of Object.entries(summary.quarterlyTotals)) {
      sheet.addRow([quarter.toUpperCase(), amount, "", ""]);
      sheet.getCell(`B${rowNumber}`).numFmt = MONEY_FORMAT;
      rowNumber += 1;
    }

    rowNumber += 1;
    this.writeComplianceSummaryRows(sheet, rowNumber, payload.compliance);
  }

  private addConsolidatedSheet(workbook: ExcelJS.Workbook, payload: ConsolidatedProcurementPlanExport): void {
    const tabName = this.buildConsolidatedTabName(payload);
    const sheet = workbook.addWorksheet(tabName);
    sheet.views = [{ state: "frozen", ySplit: 3 }];
    sheet.columns = [
      { width: 18 }, { width: 34 }, { width: 18 }, { width: 12 }, { width: 14 }, { width: 15 }, { width: 18 }, { width: 20 },
      { width: 12 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 12 }, { width: 16 }, { width: 12 }, { width: 16 },
    ];
    sheet.mergeCells(`A1:${PREVIEW_LAST_COLUMN}1`);
    sheet.getCell("A1").value = "Consolidated Procurement Plan Template";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };
    this.applyCellStyle(sheet.getCell("A1"), { borderColor: PREVIEW_BORDER_COLOR, fillColor: "FFFFFFFF" });

    this.writeProcurementHeaders(sheet);

    let rowNumber = 4;
    const departmentTotalRows: number[] = [];
    for (const [index, department] of payload.departments.entries()) {
      rowNumber = this.writeDepartmentSection(sheet, rowNumber, department, departmentTotalRows, index + 1);
    }

    if (rowNumber + 6 > EXCEL_MAX_ROWS) {
      throw new Error(`Too many worksheet rows for Excel export: ${rowNumber + 6}. Excel limit is ${EXCEL_MAX_ROWS}.`);
    }

    this.writeGrandTotalRows(sheet, rowNumber, departmentTotalRows, payload.compliance);
    sheet.autoFilter = { from: "A2", to: `${PREVIEW_LAST_COLUMN}${Math.max(3, rowNumber - 1)}` };
  }

  private addAuditSheet(workbook: ExcelJS.Workbook, payload: ConsolidatedProcurementPlanExport): void {
    const sheet = workbook.addWorksheet("Audit");
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns = [{ width: 32 }, { width: 96 }];
    sheet.getRow(1).values = ["Field", "Value"];
    sheet.getRow(1).font = { bold: true };
    const auditRows: Array<[string, WorkbookCellValue]> = [
      ["exportId", payload.exportId],
      ["consolidationId", payload.consolidationId],
      ["snapshotId", payload.snapshotId],
      ["tenantId", payload.tenantId ?? ""],
      ["institution", payload.institutionName],
      ["fiscalYear", payload.fiscalYear],
      ["generatedBy", payload.generatedBy],
      ["generatedAt", new Date(payload.generatedAt)],
      ["sourcePlanIds", payload.sourcePlanIds.join(", ")],
      ["selectedDepartmentIds", payload.selectedDepartmentIds.join(", ")],
      ["generationServiceVersion", payload.serviceVersion ?? SERVICE_VERSION],
    ];
    for (const [key, value] of Object.entries(payload.audit ?? {})) {
      auditRows.push([key, value == null ? "" : String(value)]);
    }
    auditRows.forEach(([field, value], index) => {
      const row = sheet.getRow(index + 2);
      row.getCell(1).value = field;
      row.getCell(2).value = value;
      if (value instanceof Date) {
        row.getCell(2).numFmt = DATE_FORMAT;
      }
    });
  }

  private writeProcurementHeaders(sheet: ExcelJS.Worksheet): void {
    sheet.getRow(2).values = [
      "Vote Number", "Item/Service Description", "Unit Of Measurement", "Qty", "Unit Price", "Proc Method", "Source Of Funds", "Estimated Unit Cost (Kes)",
    ];
    sheet.mergeCells("I2:P2");
    sheet.getCell("I2").value = "Timing of Activities (Quarterly Basis)";
    sheet.getRow(3).values = ["", "", "", "", "", "", "", "", "Qty", "Total Cost", "Qty", "Total Cost", "Qty", "Total Cost", "Qty", "Total Cost"];

    for (const rowNumber of [2, 3]) {
      const row = sheet.getRow(rowNumber);
      row.font = { bold: true };
      row.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      this.styleRange(sheet, rowNumber, 1, rowNumber, PREVIEW_COLUMNS, {
        borderColor: PREVIEW_BORDER_COLOR,
        fillColor: PREVIEW_HEADER_FILL,
      });
    }
  }

  private writeDepartmentSection(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    department: ConsolidatedDepartmentSection,
    departmentTotalRows: number[],
    departmentNumber: number,
  ): number {
    let rowNumber = startRow;
    sheet.mergeCells(`A${rowNumber}:${PREVIEW_LAST_COLUMN}${rowNumber}`);
    sheet.getCell(`A${rowNumber}`).value = `Department ${departmentNumber}: ${department.departmentName}`;
    sheet.getCell(`A${rowNumber}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${rowNumber}`).alignment = { horizontal: "center" };
    this.styleRange(sheet, rowNumber, 1, rowNumber, PREVIEW_COLUMNS, {
      borderColor: DEPARTMENT_BORDER,
      fillColor: DEPARTMENT_FILL,
    });
    rowNumber += 1;

    const categoryTotalRows: number[] = [];
    for (const category of department.categories) {
      rowNumber = this.writeCategorySection(sheet, rowNumber, category, department, categoryTotalRows);
    }

    const departmentTotalRow = rowNumber;
    departmentTotalRows.push(departmentTotalRow);
    sheet.mergeCells(`A${departmentTotalRow}:G${departmentTotalRow}`);
    sheet.getCell(`A${departmentTotalRow}`).value = "Department Total";
    sheet.getCell(`A${departmentTotalRow}`).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getCell(`A${departmentTotalRow}`).alignment = { horizontal: "right" };
    this.writeFormulaCell(sheet, `J${departmentTotalRow}`, this.sumFormula("J", categoryTotalRows), this.sumRows(sheet, "J", categoryTotalRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `L${departmentTotalRow}`, this.sumFormula("L", categoryTotalRows), this.sumRows(sheet, "L", categoryTotalRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `N${departmentTotalRow}`, this.sumFormula("N", categoryTotalRows), this.sumRows(sheet, "N", categoryTotalRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `P${departmentTotalRow}`, this.sumFormula("P", categoryTotalRows), this.sumRows(sheet, "P", categoryTotalRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `H${departmentTotalRow}`, `SUM(J${departmentTotalRow},L${departmentTotalRow},N${departmentTotalRow},P${departmentTotalRow})`, this.sumQuarterRows(sheet, [departmentTotalRow]), MONEY_FORMAT);
    this.styleRange(sheet, departmentTotalRow, 1, departmentTotalRow, PREVIEW_COLUMNS, {
      borderColor: DEPARTMENT_BORDER,
      fillColor: DEPARTMENT_FILL,
      fontColor: "FFFFFFFF",
    });
    rowNumber += 1;
    return this.writeProcessSections(sheet, rowNumber, department.processSections);
  }

  private writeCategorySection(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    category: ConsolidatedCategorySection,
    department: ConsolidatedDepartmentSection,
    categoryTotalRows: number[],
  ): number {
    let rowNumber = startRow;
    sheet.mergeCells(`A${rowNumber}:${PREVIEW_LAST_COLUMN}${rowNumber}`);
    sheet.getCell(`A${rowNumber}`).value = `Item Category ${category.category}`;
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    sheet.getCell(`A${rowNumber}`).alignment = { horizontal: "center" };
    this.styleRange(sheet, rowNumber, 1, rowNumber, PREVIEW_COLUMNS, {
      borderColor: CATEGORY_BORDER,
      fillColor: CATEGORY_FILL,
    });
    rowNumber += 1;

    const itemRows: number[] = [];
    for (const item of category.items) {
      itemRows.push(rowNumber);
      this.writeItemRow(sheet, rowNumber, item, department.voteNumber);
      rowNumber += 1;
    }

    const totalRow = rowNumber;
    categoryTotalRows.push(totalRow);
    sheet.mergeCells(`A${totalRow}:G${totalRow}`);
    sheet.getCell(`A${totalRow}`).value = "Total";
    sheet.getCell(`A${totalRow}`).font = { bold: true };
    sheet.getCell(`A${totalRow}`).alignment = { horizontal: "right" };
    this.writeFormulaCell(sheet, `J${totalRow}`, this.sumFormula("J", itemRows), this.sumRows(sheet, "J", itemRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `L${totalRow}`, this.sumFormula("L", itemRows), this.sumRows(sheet, "L", itemRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `N${totalRow}`, this.sumFormula("N", itemRows), this.sumRows(sheet, "N", itemRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `P${totalRow}`, this.sumFormula("P", itemRows), this.sumRows(sheet, "P", itemRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `H${totalRow}`, `SUM(J${totalRow},L${totalRow},N${totalRow},P${totalRow})`, this.sumQuarterRows(sheet, [totalRow]), MONEY_FORMAT);
    this.styleRange(sheet, totalRow, 1, totalRow, PREVIEW_COLUMNS, {
      borderColor: CATEGORY_BORDER,
      fillColor: CATEGORY_FILL,
    });
    return totalRow + 1;
  }

  private writeItemRow(sheet: ExcelJS.Worksheet, rowNumber: number, item: ConsolidatedProcurementItem, departmentVoteNumber?: string): void {
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = item.voteNumber || departmentVoteNumber || "";
    row.getCell(2).value = item.itemDescription;
    row.getCell(3).value = item.unitOfMeasure;
    row.getCell(4).value = item.quantity;
    row.getCell(5).value = item.unitPrice;
    row.getCell(6).value = item.procurementMethod;
    row.getCell(7).value = item.sourceOfFunds;
    this.writeFormulaCell(
      sheet,
      `H${rowNumber}`,
      `SUM(J${rowNumber},L${rowNumber},N${rowNumber},P${rowNumber})`,
      item.annualTotal ?? (item.q1Cost ?? item.q1Quantity * item.unitPrice) + (item.q2Cost ?? item.q2Quantity * item.unitPrice) + (item.q3Cost ?? item.q3Quantity * item.unitPrice) + (item.q4Cost ?? item.q4Quantity * item.unitPrice),
      MONEY_FORMAT,
    );
    row.getCell(9).value = item.q1Quantity;
    this.writeFormulaCell(sheet, `J${rowNumber}`, `I${rowNumber}*E${rowNumber}`, item.q1Cost ?? item.q1Quantity * item.unitPrice, MONEY_FORMAT);
    row.getCell(11).value = item.q2Quantity;
    this.writeFormulaCell(sheet, `L${rowNumber}`, `K${rowNumber}*E${rowNumber}`, item.q2Cost ?? item.q2Quantity * item.unitPrice, MONEY_FORMAT);
    row.getCell(13).value = item.q3Quantity;
    this.writeFormulaCell(sheet, `N${rowNumber}`, `M${rowNumber}*E${rowNumber}`, item.q3Cost ?? item.q3Quantity * item.unitPrice, MONEY_FORMAT);
    row.getCell(15).value = item.q4Quantity;
    this.writeFormulaCell(sheet, `P${rowNumber}`, `O${rowNumber}*E${rowNumber}`, item.q4Cost ?? item.q4Quantity * item.unitPrice, MONEY_FORMAT);

    for (const cellNumber of [4, 9, 11, 13, 15]) {
      row.getCell(cellNumber).numFmt = INTEGER_FORMAT;
    }
    for (const cellNumber of [5, 8, 10, 12, 14, 16]) {
      row.getCell(cellNumber).numFmt = MONEY_FORMAT;
    }
    this.styleRange(sheet, rowNumber, 1, rowNumber, PREVIEW_COLUMNS, {
      borderColor: PREVIEW_BORDER_COLOR,
    });
  }

  private writeProcessSections(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    processSections: ConsolidatedDepartmentSection["processSections"],
  ): number {
    let rowNumber = startRow;
    sheet.mergeCells(`A${rowNumber}:${PREVIEW_LAST_COLUMN}${rowNumber}`);
    sheet.getCell(`A${rowNumber}`).value = "Department Timing Blocks";
    sheet.getCell(`A${rowNumber}`).font = { bold: true };
    sheet.getCell(`A${rowNumber}`).alignment = { horizontal: "center" };
    this.styleRange(sheet, rowNumber, 1, rowNumber, PREVIEW_COLUMNS, {
      borderColor: TIMING_BORDER,
      fillColor: TIMING_HEADER_FILL,
    });
    rowNumber += 1;

    sheet.getCell(`A${rowNumber}`).value = "Timing Type";
    PROCESS_LABELS.slice(0, 8).forEach((label, index) => {
      sheet.getCell(rowNumber, index + 2).value = label;
    });
    sheet.mergeCells(`J${rowNumber}:P${rowNumber}`);
    sheet.getCell(`J${rowNumber}`).value = PROCESS_LABELS[8];
    sheet.getRow(rowNumber).font = { bold: true };
    this.styleRange(sheet, rowNumber, 1, rowNumber, PREVIEW_COLUMNS, {
      borderColor: TIMING_BORDER,
      fillColor: TIMING_LABEL_FILL,
    });
    rowNumber += 1;

    for (const sectionName of ["planned", "actual", "variance"] as const) {
      const label = sectionName === "planned" ? "Planned timing" : sectionName === "actual" ? "Actual timing" : "Variance timing";
      sheet.getCell(`A${rowNumber}`).value = label;
      PROCESS_LABELS.slice(0, 8).forEach((processLabel, index) => {
        sheet.getCell(rowNumber, index + 2).value = this.getProcessValue(processSections?.[sectionName], processLabel);
      });
      sheet.mergeCells(`J${rowNumber}:P${rowNumber}`);
      sheet.getCell(`J${rowNumber}`).value = this.getProcessValue(processSections?.[sectionName], PROCESS_LABELS[8]);
      this.styleRange(sheet, rowNumber, 1, rowNumber, PREVIEW_COLUMNS, {
        borderColor: TIMING_BORDER,
        fillColor: TIMING_ROW_FILLS[sectionName],
      });
      sheet.getCell(`A${rowNumber}`).font = { bold: true };
      rowNumber += 1;
    }
    return rowNumber;
  }

  private writeGrandTotalRows(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    departmentTotalRows: number[],
    compliance: ConsolidatedComplianceSummary,
  ): void {
    const annualTotal = this.sumRows(sheet, "H", departmentTotalRows);
    sheet.getCell(`A${startRow}`).value = 1;
    sheet.getCell(`A${startRow}`).numFmt = PERCENT_FORMAT;
    sheet.getCell(`B${startRow}`).value = "ANNUAL GRAND Total";
    sheet.mergeCells(`C${startRow}:G${startRow}`);
    this.writeFormulaCell(
      sheet,
      `H${startRow}`,
      this.sumFormula("H", departmentTotalRows),
      annualTotal,
      MONEY_FORMAT,
    );
    this.writeFormulaCell(sheet, `J${startRow}`, this.sumFormula("J", departmentTotalRows), this.sumRows(sheet, "J", departmentTotalRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `L${startRow}`, this.sumFormula("L", departmentTotalRows), this.sumRows(sheet, "L", departmentTotalRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `N${startRow}`, this.sumFormula("N", departmentTotalRows), this.sumRows(sheet, "N", departmentTotalRows), MONEY_FORMAT);
    this.writeFormulaCell(sheet, `P${startRow}`, this.sumFormula("P", departmentTotalRows), this.sumRows(sheet, "P", departmentTotalRows), MONEY_FORMAT);
    this.styleRange(sheet, startRow, 1, startRow + 3, PREVIEW_COLUMNS, {
      borderColor: PREVIEW_BORDER_COLOR,
      fillColor: "FFFCE4D6",
    });

    this.writeComplianceRow(sheet, startRow + 1, "AGPO", compliance.agpo, {
      amountFormula: `H${startRow}*30%`,
      q1Formula: `J${startRow}*30%`,
      q2Formula: `L${startRow}*30%`,
      q3Formula: `N${startRow}*30%`,
      q4Formula: `P${startRow}*30%`,
      q1Result: this.sumRows(sheet, "J", [startRow]) * 0.3,
      q2Result: this.sumRows(sheet, "L", [startRow]) * 0.3,
      q3Result: this.sumRows(sheet, "N", [startRow]) * 0.3,
      q4Result: this.sumRows(sheet, "P", [startRow]) * 0.3,
    });
    this.writeComplianceRow(sheet, startRow + 2, "PWD", compliance.pwd, {
      amountFormula: `H${startRow + 1}*2%`,
      q1Formula: `J${startRow + 1}*2%`,
      q2Formula: `L${startRow + 1}*2%`,
      q3Formula: `N${startRow + 1}*2%`,
      q4Formula: `P${startRow + 1}*2%`,
      q1Result: this.sumRows(sheet, "J", [startRow + 1]) * 0.02,
      q2Result: this.sumRows(sheet, "L", [startRow + 1]) * 0.02,
      q3Result: this.sumRows(sheet, "N", [startRow + 1]) * 0.02,
      q4Result: this.sumRows(sheet, "P", [startRow + 1]) * 0.02,
    });
    this.writeComplianceRow(sheet, startRow + 3, "LOCAL CONTENT", compliance.localContent, {
      amountFormula: `H${startRow}*40%`,
      q1Formula: `J${startRow}*40%`,
      q2Formula: `L${startRow}*40%`,
      q3Formula: `N${startRow}*40%`,
      q4Formula: `P${startRow}*40%`,
      q1Result: this.sumRows(sheet, "J", [startRow]) * 0.4,
      q2Result: this.sumRows(sheet, "L", [startRow]) * 0.4,
      q3Result: this.sumRows(sheet, "N", [startRow]) * 0.4,
      q4Result: this.sumRows(sheet, "P", [startRow]) * 0.4,
    });
  }

  private writeComplianceRow(
    sheet: ExcelJS.Worksheet,
    rowNumber: number,
    label: string,
    metric: ComplianceMetric,
    formulas: {
      amountFormula: string;
      q1Formula: string;
      q2Formula: string;
      q3Formula: string;
      q4Formula: string;
      q1Result: number;
      q2Result: number;
      q3Result: number;
      q4Result: number;
    },
  ): void {
    sheet.getCell(`A${rowNumber}`).value = metric.targetPercentage / 100;
    sheet.getCell(`A${rowNumber}`).numFmt = PERCENT_FORMAT;
    sheet.getCell(`B${rowNumber}`).value = label;
    sheet.mergeCells(`C${rowNumber}:G${rowNumber}`);
    sheet.getCell(`I${rowNumber}`).value = "";
    sheet.getCell(`K${rowNumber}`).value = "";
    sheet.getCell(`M${rowNumber}`).value = "";
    sheet.getCell(`O${rowNumber}`).value = "";
    this.writeFormulaCell(sheet, `J${rowNumber}`, formulas.q1Formula, formulas.q1Result, MONEY_FORMAT);
    this.writeFormulaCell(sheet, `L${rowNumber}`, formulas.q2Formula, formulas.q2Result, MONEY_FORMAT);
    this.writeFormulaCell(sheet, `N${rowNumber}`, formulas.q3Formula, formulas.q3Result, MONEY_FORMAT);
    this.writeFormulaCell(sheet, `P${rowNumber}`, formulas.q4Formula, formulas.q4Result, MONEY_FORMAT);
    this.writeFormulaCell(sheet, `H${rowNumber}`, formulas.amountFormula, formulas.q1Result + formulas.q2Result + formulas.q3Result + formulas.q4Result, MONEY_FORMAT);
  }

  private writeComplianceSummaryRows(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    compliance: ConsolidatedComplianceSummary,
  ): void {
    sheet.getRow(startRow).values = ["Compliance Metric", "Actual %", "Target %", "Source Notes"];
    sheet.getRow(startRow).font = { bold: true };
    const rows: Array<[string, ComplianceMetric]> = [
      ["AGPO", compliance.agpo],
      ["PWD", compliance.pwd],
      ["Local Content", compliance.localContent],
    ];
    rows.forEach(([label, metric], index) => {
      const rowNumber = startRow + index + 1;
      sheet.getRow(rowNumber).values = [label, metric.actualPercentage / 100, metric.targetPercentage / 100, metric.sourceNotes ?? ""];
      sheet.getCell(`B${rowNumber}`).numFmt = PERCENT_FORMAT;
      sheet.getCell(`C${rowNumber}`).numFmt = PERCENT_FORMAT;
    });
  }

  private buildSummary(payload: ConsolidatedProcurementPlanExport): ConsolidatedPlanSummary {
    const departmentTotals = payload.departments.map((department) => ({
      departmentId: department.departmentId,
      departmentName: department.departmentName,
      annualTotal: department.categories.reduce((total, category) => total + this.categoryAnnualTotal(category), 0),
    }));
    const categoryMap = new Map<string, number>();
    const quarterlyTotals = { q1: 0, q2: 0, q3: 0, q4: 0 };
    for (const department of payload.departments) {
      for (const category of department.categories) {
        categoryMap.set(category.category, (categoryMap.get(category.category) ?? 0) + this.categoryAnnualTotal(category));
        for (const item of category.items) {
          quarterlyTotals.q1 += item.q1Cost ?? item.q1Quantity * item.unitPrice;
          quarterlyTotals.q2 += item.q2Cost ?? item.q2Quantity * item.unitPrice;
          quarterlyTotals.q3 += item.q3Cost ?? item.q3Quantity * item.unitPrice;
          quarterlyTotals.q4 += item.q4Cost ?? item.q4Quantity * item.unitPrice;
        }
      }
    }
    const calculated: ConsolidatedPlanSummary = {
      annualGrandTotal: departmentTotals.reduce((total, department) => total + department.annualTotal, 0),
      departmentTotals,
      categoryTotals: Array.from(categoryMap.entries()).map(([category, annualTotal]) => ({ category, annualTotal })),
      quarterlyTotals,
    };
    if (payload.summary) {
      this.assertSummaryMatchesCalculatedInputs(payload.summary, calculated);
    }
    return {
      ...calculated,
      ...payload.summary,
      departmentTotals: payload.summary?.departmentTotals ?? calculated.departmentTotals,
      categoryTotals: payload.summary?.categoryTotals ?? calculated.categoryTotals,
      quarterlyTotals: payload.summary?.quarterlyTotals ?? calculated.quarterlyTotals,
    };
  }

  private categoryAnnualTotal(category: ConsolidatedCategorySection): number {
    return category.items.reduce(
      (total, item) => total + (item.annualTotal ?? (item.q1Cost ?? item.q1Quantity * item.unitPrice) + (item.q2Cost ?? item.q2Quantity * item.unitPrice) + (item.q3Cost ?? item.q3Quantity * item.unitPrice) + (item.q4Cost ?? item.q4Quantity * item.unitPrice)),
      0,
    );
  }

  private assertSummaryMatchesCalculatedInputs(
    snapshotSummary: Partial<ConsolidatedPlanSummary>,
    calculated: ConsolidatedPlanSummary,
  ): void {
    const comparisons: Array<[string, number | undefined, number]> = [
      ["annualGrandTotal", snapshotSummary.annualGrandTotal, calculated.annualGrandTotal],
      ["quarterlyTotals.q1", snapshotSummary.quarterlyTotals?.q1, calculated.quarterlyTotals.q1],
      ["quarterlyTotals.q2", snapshotSummary.quarterlyTotals?.q2, calculated.quarterlyTotals.q2],
      ["quarterlyTotals.q3", snapshotSummary.quarterlyTotals?.q3, calculated.quarterlyTotals.q3],
      ["quarterlyTotals.q4", snapshotSummary.quarterlyTotals?.q4, calculated.quarterlyTotals.q4],
    ];

    for (const [field, expected, actual] of comparisons) {
      if (expected === undefined) {
        continue;
      }
      if (Math.abs(expected - actual) > 0.01) {
        throw new Error(`calculation-mismatch: ${field} snapshot value ${expected} does not match Excel seed ${actual}`);
      }
    }
  }

  private writeFormulaCell(sheet: ExcelJS.Worksheet, address: string, formula: string, result: number, numberFormat: string): void {
    const cell = sheet.getCell(address);
    cell.value = { formula, result };
    cell.numFmt = numberFormat;
  }

  private getProcessValue(
    section: Record<string, string | number | Date | null | undefined> | undefined,
    label: string,
  ): WorkbookCellValue {
    const legacyKeys = this.getLegacyProcessKeys(label);
    for (const key of [label, ...legacyKeys]) {
      const value = section?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "" && String(value).trim() !== "_") {
        return value instanceof Date ? value : value;
      }
    }
    return "-";
  }

  private getLegacyProcessKeys(label: string): string[] {
    const aliases: Record<string, string[]> = {
      "Invite/Advertisement": ["invite /advertisement of tender", "Invite/Advertisement of tender", "Invite Advertisement"],
      "Bid Opening": ["bid opening"],
      "Bid Evaluation": ["bid evaluation"],
      "Tender Award": ["tender award"],
      "Notification of Award": ["notification of award"],
      "Contract Signing": ["contract signing"],
      "Total Time for Contract": ["Total time for contract signing", "Total time for Contract"],
      "Date of Completion": ["date of completion of contract"],
    };
    return aliases[label] ?? [];
  }

  private styleRange(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    startColumn: number,
    endRow: number,
    endColumn: number,
    options: { borderColor: string; fillColor?: string; fontColor?: string },
  ): void {
    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      for (let columnNumber = startColumn; columnNumber <= endColumn; columnNumber += 1) {
        this.applyCellStyle(row.getCell(columnNumber), options);
      }
    }
  }

  private applyCellStyle(
    cell: ExcelJS.Cell,
    options: { borderColor: string; fillColor?: string; fontColor?: string },
  ): void {
    cell.border = {
      top: { style: "medium", color: { argb: options.borderColor } },
      left: { style: "medium", color: { argb: options.borderColor } },
      bottom: { style: "medium", color: { argb: options.borderColor } },
      right: { style: "medium", color: { argb: options.borderColor } },
    };
    if (options.fillColor) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: options.fillColor },
      };
    }
    if (options.fontColor) {
      cell.font = { ...(cell.font ?? {}), color: { argb: options.fontColor } };
    }
    cell.alignment = { ...(cell.alignment ?? {}), vertical: "middle", wrapText: true };
  }

  private sumFormula(column: string, rows: number[]): string {
    if (rows.length === 0) {
      return "0";
    }
    return `SUM(${rows.map((row) => `${column}${row}`).join(",")})`;
  }

  private sumRows(sheet: ExcelJS.Worksheet, column: string, rows: number[]): number {
    return rows.reduce((total, rowNumber) => {
      const value = sheet.getCell(`${column}${rowNumber}`).value;
      if (typeof value === "number") {
        return total + value;
      }
      if (value && typeof value === "object" && "result" in value && typeof value.result === "number") {
        return total + value.result;
      }
      return total;
    }, 0);
  }

  private sumQuarterRows(sheet: ExcelJS.Worksheet, rows: number[]): number {
    return ["J", "L", "N", "P"].reduce((total, column) => total + this.sumRows(sheet, column, rows), 0);
  }

  private buildConsolidatedFileName(payload: ConsolidatedProcurementPlanExport): string {
    const timestamp = new Date(payload.generatedAt).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "-").slice(0, 15);
    return `${this.slugify(payload.reportName)}-${this.slugify(payload.institutionName)}-${this.slugify(payload.fiscalYear)}-${this.slugify(payload.exportId)}-${timestamp}.xlsx`;
  }

  private buildConsolidatedTabName(payload: ConsolidatedProcurementPlanExport): string {
    const identity = `${payload.institutionName} ${payload.fiscalYear}`.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
    const suffix = this.slugify(payload.fiscalYear).slice(0, 9);
    const prefix = identity.slice(0, Math.max(1, 30 - suffix.length)).trim();
    return `${prefix}-${suffix}`.slice(0, 31);
  }

  private slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "export";
  }

  private requireText(value: unknown, fieldName: string): void {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`${fieldName} is required for consolidated Excel export`);
    }
    this.validateText(value, fieldName, false);
  }

  private validateText(value: unknown, fieldName: string, optional: boolean): void {
    if ((value === undefined || value === null || value === "") && optional) {
      return;
    }
    if (typeof value !== "string") {
      throw new Error(`${fieldName} must be text`);
    }
    if (value.length > EXCEL_CELL_TEXT_LIMIT) {
      throw new Error(`${fieldName} exceeds Excel cell text limit of ${EXCEL_CELL_TEXT_LIMIT} characters`);
    }
  }

  private validateDate(value: unknown, fieldName: string): void {
    const date = value instanceof Date || typeof value === "string" ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new Error(`${fieldName} must be a valid date`);
    }
  }

  private validateOptionalMoney(value: number | undefined, fieldName: string): void {
    if (value === undefined) {
      return;
    }
    this.validateNonNegativeNumber(value, fieldName);
  }

  private validateNonNegativeNumber(value: unknown, fieldName: string): void {
    this.validateFiniteNumber(value, fieldName);
    if (typeof value === "number" && value < 0) {
      throw new Error(`${fieldName} cannot be negative`);
    }
  }

  private validateFiniteNumber(value: unknown, fieldName: string): void {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`${fieldName} must be a finite number`);
    }
  }
}
