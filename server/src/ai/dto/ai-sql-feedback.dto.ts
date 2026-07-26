import { IsIn, IsUUID } from 'class-validator';

export class AiSqlFeedbackDto {
  @IsUUID()
  generationId: string;

  @IsIn(['up', 'down'])
  rating: 'up' | 'down';
}
