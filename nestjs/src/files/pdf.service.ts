import { Injectable } from "@nestjs/common";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { CreatePdfDto } from "@/files/dto/create-pdf.dto";

@Injectable()
export class PdfService {
  async createPdf(dto: CreatePdfDto): Promise<{ fileName: string; pdfBase64: string }> {
    const document = await PDFDocument.create();
    const page = document.addPage();
    const font = await document.embedFont(StandardFonts.Helvetica);

    page.drawText(dto.title, {
      font,
      size: 18,
      x: 50,
      y: 750,
    });
    page.drawText(dto.body, {
      font,
      size: 12,
      x: 50,
      y: 710,
    });

    const bytes = await document.save();
    return {
      fileName: `${dto.title.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      pdfBase64: Buffer.from(bytes).toString("base64"),
    };
  }
}
