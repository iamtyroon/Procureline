import { PdfService } from "@/files/pdf.service";

describe("PdfService", () => {
  const pdfService = new PdfService();

  it("creates a PDF with the given title and body", async () => {
    const result = await pdfService.createPdf({
      title: "Invoice 001",
      body: "Amount due: KES 50,000",
    });

    expect(result.fileName).toBe("invoice-001.pdf");
    expect(result.pdfBase64).toBeTruthy();
    expect(typeof result.pdfBase64).toBe("string");
    // Verify it's valid base64
    const buffer = Buffer.from(result.pdfBase64, "base64");
    // PDF magic bytes: %PDF
    expect(buffer.toString("ascii", 0, 4)).toBe("%PDF");
  });

  it("sanitizes the title for the file name", async () => {
    const result = await pdfService.createPdf({
      title: "Q1  2026  Report",
      body: "Revenue summary",
    });

    expect(result.fileName).toBe("q1-2026-report.pdf");
  });
});
