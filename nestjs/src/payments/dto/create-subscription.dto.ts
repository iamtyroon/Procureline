import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  customerReference!: string;

  @ApiProperty()
  @IsString()
  currency!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: "stripe" })
  @Matches(/^(stripe|intasend|bank_transfer)$/)
  provider!: "stripe" | "intasend" | "bank_transfer";

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
