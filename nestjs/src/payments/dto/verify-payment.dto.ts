import { ApiProperty } from "@nestjs/swagger";
import { IsObject, IsOptional, IsString } from "class-validator";

export class VerifyPaymentDto {
  @ApiProperty()
  @IsString()
  paymentReference!: string;

  @ApiProperty()
  @IsString()
  provider!: string;

  @ApiProperty({ required: false, additionalProperties: true })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
