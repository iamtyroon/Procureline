import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";

export class CreateExcelExportDto {
  @ApiProperty()
  @IsString()
  reportName!: string;

  @ApiProperty({ type: [Object] })
  @IsArray()
  rows!: Record<string, unknown>[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  idempotencyKey?: string;
}
