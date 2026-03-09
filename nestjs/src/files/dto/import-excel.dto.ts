import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";

export class ImportExcelDto {
  @ApiProperty({ description: "Base64-encoded workbook payload" })
  @IsString()
  workbookBase64!: string;

  @ApiProperty({ required: false, description: "Optional idempotency key for queued imports" })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
