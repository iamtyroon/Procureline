import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { EmailController } from "@/email/email.controller";
import { EmailDispatchService } from "@/email/email-dispatch.service";
import { EmailService } from "@/email/email.service";
import { ResendProvider } from "@/email/resend.provider";
import { EmailTemplateRendererService } from "@/email/template-renderer.service";
import { QueueModule } from "@/queue/queue.module";
import { ConvexSyncModule } from "@/sync/convex-sync.module";

@Module({
  imports: [AuthModule, QueueModule, ConvexSyncModule],
  controllers: [EmailController],
  providers: [EmailService, EmailDispatchService, ResendProvider, EmailTemplateRendererService],
  exports: [EmailDispatchService, EmailService],
})
export class EmailModule {}
