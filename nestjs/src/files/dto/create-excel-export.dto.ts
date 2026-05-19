import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsObject, IsOptional, IsString, IsUUID } from "class-validator";
import type { ConsolidatedProcurementPlanExport } from "@/files/excel/consolidated-procurement-plan.types";

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

export class QueueConsolidatedPlanExportDto {
  @ApiProperty()
  @IsString()
  exportId!: string;

  @ApiProperty()
  @IsString()
  reportName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  formatterPayload!: ConsolidatedProcurementPlanExport | Record<string, unknown>;
}
