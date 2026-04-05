import { PartialType } from '@nestjs/mapped-types';
import { CreateSavedQueryDto } from './create-saved-query.dto';

export class UpdateSavedQueryDto extends PartialType(CreateSavedQueryDto) {}
