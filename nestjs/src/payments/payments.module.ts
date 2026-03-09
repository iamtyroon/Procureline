import { Module } from "@nestjs/common";
import { AuthModule } from "@/auth/auth.module";
import { PaymentsController } from "@/payments/payments.controller";
import { PaymentsService } from "@/payments/payments.service";
import { BankTransferProvider } from "@/payments/providers/bank-transfer.provider";
import { IntaSendProvider } from "@/payments/providers/intasend.provider";
import { StripeProvider } from "@/payments/providers/stripe.provider";
import { ConvexSyncModule } from "@/sync/convex-sync.module";

@Module({
  imports: [AuthModule, ConvexSyncModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeProvider, IntaSendProvider, BankTransferProvider],
})
export class PaymentsModule {}
