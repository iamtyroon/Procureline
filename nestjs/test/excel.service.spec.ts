import { ExcelService } from "@/files/excel.service";

describe("ExcelService", () => {
  const excelService = new ExcelService();

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
});
