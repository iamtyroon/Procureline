import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsNumber, IsObject, IsOptional, IsString } from "class-validator";

export class SendEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty({
    enum: [
      "generic-notification",
      "billing-support",
      "access-code-delivery",
      "catalog-request-status",
      "catalog-request-submitted",
      "deadline-extension",
      "deadline-reminder",
    ],
  })
  @IsIn([
    "generic-notification",
    "billing-support",
    "access-code-delivery",
    "catalog-request-status",
    "catalog-request-submitted",
    "deadline-extension",
    "deadline-reminder",
  ])
  template!:
    | "generic-notification"
    | "billing-support"
    | "access-code-delivery"
    | "catalog-request-status"
    | "catalog-request-submitted"
    | "deadline-extension"
    | "deadline-reminder";

  @ApiProperty({ required: false, additionalProperties: true })
  @IsOptional()
  @IsObject()
  templateProps?: Record<string, unknown>;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  deliverAt?: number;

  @ApiProperty()
  @IsString()
  idempotencyKey!: string;
}
