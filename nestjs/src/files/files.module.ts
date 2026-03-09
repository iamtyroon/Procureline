import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { ExcelService } from "@/files/excel.service";
import { FilesController } from "@/files/files.controller";
import { FilesService } from "@/files/files.service";
import { PdfService } from "@/files/pdf.service";
import { QueueModule } from "@/queue/queue.module";
import { ConvexSyncModule } from "@/sync/convex-sync.module";

@Module({
  imports: [AuthModule, QueueModule, ConvexSyncModule],
  controllers: [FilesController],
  providers: [FilesService, ExcelService, PdfService],
  exports: [FilesService, ExcelService, PdfService],
})
export class FilesModule {}
