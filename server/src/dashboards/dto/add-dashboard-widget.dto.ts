import {
  IsArray,
  ArrayMaxSize,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class AddDashboardWidgetDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  chartType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  queryText?: string;

  @IsOptional()
  @IsString()
  connectionId?: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  columns!: string[];

  @IsOptional()
  @IsString()
  xAxis?: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  yAxis!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsArray()
  @ArrayMaxSize(200)
  dataSnapshot!: Record<string, any>[];
}
