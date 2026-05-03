import { PartialType } from '@nestjs/mapped-types';
import { CreateTeamspaceDto } from './create-teamspace.dto';

export class UpdateTeamspaceDto extends PartialType(CreateTeamspaceDto) {}
