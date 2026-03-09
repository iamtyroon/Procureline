import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Min } from "class-validator";

export class ManualBankTransferVerificationDto {
  @ApiProperty()
  @IsString()
  paymentReference!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
