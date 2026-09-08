import {
  ArrayMaxSize,
  IsArray,
  IsDataURI,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Max total attachment payload per comment (base64 data URLs). */
export const MAX_COMMENT_ATTACHMENTS_BYTES = 2_000_000;

export class CreateCommentDto {
  @IsString()
  @MaxLength(2000)
  body: string;

  @IsOptional()
  @IsString()
  parentCommentId?: string;

  /** Optional attachments as data URLs (images, PDF, text). Max 3, 2MB total. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsDataURI({ each: true })
  attachments?: string[];
}
