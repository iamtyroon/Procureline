import { Module } from "@nestjs/common";
import { AppLogger } from "@/common/logging/app.logger";
import { EmailModule } from "@/email/email.module";
import { FilesModule } from "@/files/files.module";
import { QueueModule } from "@/queue/queue.module";
import { PlatformQueueProcessor } from "@/queue/platform-queue.processor";
import { ConvexSyncModule } from "@/sync/convex-sync.module";

@Module({
  imports: [QueueModule, FilesModule, EmailModule, ConvexSyncModule],
  providers: [PlatformQueueProcessor, AppLogger],
})
export class PlatformWorkersModule {}
