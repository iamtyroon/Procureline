import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";

export class QueueReconciliationDto {
  @ApiProperty({ example: "intasend" })
  @Matches(/^(stripe|intasend)$/)
  provider!: "stripe" | "intasend";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class InitiateRefundDto {
  @ApiProperty()
  @IsString()
  paymentReference!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  serviceStartAt!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  serviceEndAt!: number;

  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}

export class GenerateInvoiceDto {
  @ApiProperty()
  @IsString()
  tenantReference!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty()
  @IsString()
  currency!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
