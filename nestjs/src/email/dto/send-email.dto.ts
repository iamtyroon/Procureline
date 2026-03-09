import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID } from "class-validator";

export class SendEmailDto {
  @ApiProperty()
  @IsEmail()
  to!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiProperty({ enum: ["generic-notification", "billing-support"] })
  @IsIn(["generic-notification", "billing-support"])
  template!: "generic-notification" | "billing-support";

  @ApiProperty({ required: false, additionalProperties: true })
  @IsOptional()
  @IsObject()
  templateProps?: Record<string, unknown>;

  @ApiProperty()
  @IsUUID()
  idempotencyKey!: string;
}
