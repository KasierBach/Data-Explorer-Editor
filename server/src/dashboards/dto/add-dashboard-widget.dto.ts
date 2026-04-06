import { IsArray, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddDashboardWidgetDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  chartType!: string;

  @IsOptional()
  @IsString()
  queryText?: string;

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsArray()
  @IsString({ each: true })
  columns!: string[];

  @IsOptional()
  @IsString()
  xAxis?: string;

  @IsArray()
  @IsString({ each: true })
  yAxis!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsArray()
  dataSnapshot!: Record<string, any>[];
}
