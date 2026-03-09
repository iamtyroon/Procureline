import { Injectable } from "@nestjs/common";
import ExcelJS from "exceljs";
import { CreateExcelExportDto } from "@/files/dto/create-excel-export.dto";

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
}
