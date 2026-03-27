import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class SendEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty({ enum: ["generic-notification", "billing-support", "access-code-delivery"] })
  @IsIn(["generic-notification", "billing-support", "access-code-delivery"])
  template!: "generic-notification" | "billing-support" | "access-code-delivery";

  @ApiProperty({ required: false, additionalProperties: true })
  @IsOptional()
  @IsObject()
  templateProps?: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  idempotencyKey!: string;
}
