import { ExcelService } from "@/files/excel.service";
import ExcelJS from "exceljs";
import { createConsolidatedProcurementPlanFixture } from "@/../test/fixtures/consolidated-procurement-plan.fixture";

describe("ExcelService", () => {
  const excelService = new ExcelService();

  async function loadWorkbook(base64Payload: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(base64Payload, "base64") as unknown as ExcelJS.Buffer);
    return workbook;
  }

  it("creates a workbook from rows and returns a base64 payload", async () => {
    const result = await excelService.createWorkbook({
      reportName: "Test Report",
      rows: [
        { name: "Alice", amount: 100 },
        { name: "Bob", amount: 200 },
      ],
    });

    expect(result.fileName).toBe("test-report.xlsx");
    expect(result.workbookBase64).toBeTruthy();
    expect(typeof result.workbookBase64).toBe("string");
  });

  it("handles an empty rows array without crashing", async () => {
    const result = await excelService.createWorkbook({
      reportName: "Empty Report",
      rows: [],
    });

    expect(result.fileName).toBe("empty-report.xlsx");
    expect(result.workbookBase64).toBeTruthy();
  });

  it("round-trips workbook data through export and import", async () => {
    const originalRows = [
      { city: "Nairobi", population: 4_000_000 },
      { city: "Mombasa", population: 1_500_000 },
    ];
    const exported = await excelService.createWorkbook({
      reportName: "Cities",
      rows: originalRows,
    });
    const imported = await excelService.importWorkbook(exported.workbookBase64);

    expect(imported.rows).toHaveLength(2);
    expect(imported.rows[0]).toMatchObject({ city: "Nairobi", population: 4_000_000 });
    expect(imported.rows[1]).toMatchObject({ city: "Mombasa", population: 1_500_000 });
  });

  it("creates a formatted consolidated procurement workbook from the finalized snapshot contract", async () => {
    const result = await excelService.createConsolidatedProcurementPlanWorkbook(
      createConsolidatedProcurementPlanFixture(),
    );
    const workbook = await loadWorkbook(result.workbookBase64);
    const consolidated = workbook.worksheets.find((sheet) => sheet.name.includes("Pwani"));
    const cover = workbook.getWorksheet("Cover");
    const summary = workbook.getWorksheet("Summary");
    const audit = workbook.getWorksheet("Audit");

    expect(result.fileName).toMatch(/^gok-consolidated-procurement-plan-pwani-university-2026-2027-export-7-6-20260518-083000\.xlsx$/);
    expect(cover?.getCell("B3").value).toBe("Pwani University");
    expect(summary?.getCell("A4").value).toBe("Annual Grand Total");
    expect(audit?.getCell("B4").value).toBe("snapshot-latest-official");
    expect(consolidated).toBeDefined();
    expect(consolidated?.getCell("A1").value).toBe("Consolidated Procurement Plan Template");
    expect(consolidated?.getCell("A2").value).toBe("Vote Number");
    expect(consolidated?.getCell("B2").value).toBe("Item/Service Description");
    expect(consolidated?.getCell("I2").value).toBe("Timing of Activities (Quarterly Basis)");
    expect(consolidated?.getCell("P3").value).toBe("Total Cost");
    expect(consolidated?.getCell("A4").value).toBe("Department 1: ICT Department");
    expect(consolidated?.getCell("A4").fill).toMatchObject({ fgColor: { argb: "FF4472C4" } });
    expect(consolidated?.getCell("A4").border?.top?.color).toMatchObject({ argb: "FF1F4E79" });
    expect(consolidated?.getCell("A5").value).toBe("Item Category Goods");
    expect(consolidated?.getCell("A5").fill).toMatchObject({ fgColor: { argb: "FF70AD47" } });
    expect(consolidated?.getCell("B6").value).toBe("Laptop computers");
    expect(consolidated?.getCell("H6").value).toMatchObject({ formula: "SUM(J6,L6,N6,P6)", result: 1_000_000 });
    expect(consolidated?.getCell("J6").value).toMatchObject({ formula: "I6*E6", result: 200_000 });
    expect(consolidated?.getCell("P6").value).toMatchObject({ formula: "O6*E6", result: 100_000 });
    expect(consolidated?.getCell("H7").value).toMatchObject({ formula: "SUM(J7,L7,N7,P7)", result: 1_000_000 });
    expect(consolidated?.getCell("P7").value).toMatchObject({ formula: "SUM(P6)", result: 100_000 });
    expect(consolidated?.getCell("A8").value).toBe("Item Category Services");
    expect(consolidated?.getCell("P9").value).toMatchObject({ formula: "0" });
    expect(consolidated?.getCell("H10").value).toMatchObject({ formula: "SUM(J10,L10,N10,P10)", result: 1_000_000 });
    expect(consolidated?.getCell("P10").value).toMatchObject({ formula: "SUM(P7,P9)", result: 100_000 });
    expect(consolidated?.getCell("A11").value).toBe("Department Timing Blocks");
    expect(consolidated?.getCell("A11").fill).toMatchObject({ fgColor: { argb: "FFF6C35B" } });
    expect(consolidated?.getCell("A12").value).toBe("Timing Type");
    expect(consolidated?.getCell("J12").value).toBe("Date of Completion");
    expect(consolidated?.getCell("A13").value).toBe("Planned timing");
    expect(consolidated?.getCell("A13").fill).toMatchObject({ fgColor: { argb: "FFD8C8FF" } });
    expect(consolidated?.getCell("H16").value).toMatchObject({ formula: "SUM(H10)", result: 1_000_000 });
    expect(consolidated?.getCell("A17").numFmt).toBe("0.00%");
    expect(consolidated?.getCell("H17").value).toMatchObject({ formula: "H16*30%", result: 300_000 });
    expect(consolidated?.getCell("J17").value).toMatchObject({ formula: "J16*30%", result: 60_000 });
    expect(consolidated?.getCell("P17").value).toMatchObject({ formula: "P16*30%", result: 30_000 });
    expect(consolidated?.getCell("H18").value).toMatchObject({ formula: "H16*2%", result: 20_000 });
    expect(consolidated?.getCell("J18").value).toMatchObject({ formula: "J16*2%", result: 4_000 });
    expect(consolidated?.getCell("H19").value).toMatchObject({ formula: "H16*40%", result: 400_000 });
    expect(consolidated?.getCell("H17").numFmt).toContain("KES");
    expect(consolidated?.views[0]).toMatchObject({ state: "frozen", ySplit: 3 });
    expect(consolidated?.autoFilter).toBe("A2:P15");
  });

  it("rejects unsupported numeric values before generating the consolidated workbook", async () => {
    const payload = createConsolidatedProcurementPlanFixture();
    payload.departments[0]!.categories[0]!.items[0]!.quantity = Number.NaN;

    await expect(excelService.createConsolidatedProcurementPlanWorkbook(payload)).rejects.toThrow(
      "item.quantity must be a finite number",
    );
  });

  it("rejects official item text above the Excel cell limit", async () => {
    const payload = createConsolidatedProcurementPlanFixture();
    payload.departments[0]!.categories[0]!.items[0]!.itemDescription = "x".repeat(32_768);

    await expect(excelService.createConsolidatedProcurementPlanWorkbook(payload)).rejects.toThrow(
      "item.itemDescription exceeds Excel cell text limit",
    );
  });

  it("rejects finalized snapshot totals that do not match workbook calculation inputs", async () => {
    const payload = createConsolidatedProcurementPlanFixture({
      summary: {
        annualGrandTotal: 999,
      },
    });

    await expect(excelService.createConsolidatedProcurementPlanWorkbook(payload)).rejects.toThrow(
      "calculation-mismatch",
    );
  });

  it("rejects consolidated exports above the story row limit", async () => {
    const payload = createConsolidatedProcurementPlanFixture({
      departments: [
        {
          departmentId: "department-big",
          departmentName: "Big Department",
          categories: [
            {
              category: "Goods",
              items: new Array(1_000_001).fill(null).map(() => ({
                voteNumber: "BIG-001",
                itemDescription: "Bulk item",
                unitOfMeasure: "Each",
                quantity: 1,
                unitPrice: 1,
                procurementMethod: "Open Tender",
                sourceOfFunds: "GOK",
                estimatedUnitCost: 1,
                q1Quantity: 1,
                q2Quantity: 0,
                q3Quantity: 0,
                q4Quantity: 0,
              })),
            },
          ],
        },
      ],
    });

    await expect(excelService.createConsolidatedProcurementPlanWorkbook(payload)).rejects.toThrow(
      "Too many procurement item rows",
    );
  });
});
