import { Injectable } from "@nestjs/common";
import type { ManualBankTransferVerificationDto } from "@/payments/dto/manual-bank-transfer.dto";

@Injectable()
export class BankTransferProvider {
  // TODO: Implement real bank transfer verification logic.
  // This placeholder always returns verified: true — later stories should add
  // reference validation, admin review workflow, and duplicate-transfer checks.
  async verifyTransfer(dto: ManualBankTransferVerificationDto): Promise<Record<string, unknown>> {
    return {
      paymentReference: dto.paymentReference,
      provider: "bank_transfer",
      verified: true,
    };
  }
}
