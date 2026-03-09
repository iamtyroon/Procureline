import { Module } from "@nestjs/common";
import { ConvexSyncService } from "@/sync/convex-sync.service";

@Module({
  providers: [ConvexSyncService],
  exports: [ConvexSyncService],
})
export class ConvexSyncModule {}
