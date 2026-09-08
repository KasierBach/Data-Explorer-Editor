import { IsString, MaxLength } from 'class-validator';

export class ToggleReactionDto {
  @IsString()
  @MaxLength(32)
  emoji: string;
}
