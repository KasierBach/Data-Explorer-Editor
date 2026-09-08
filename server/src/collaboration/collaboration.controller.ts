import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CollaborationService } from './collaboration.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListActivityDto } from './dto/list-activity.dto';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ResourceType } from '../permissions/enums/resource-type.enum';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('collaboration')
@UseGuards(JwtAuthGuard)
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get('organizations/:organizationId/activity')
  listActivity(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Query() query: ListActivityDto,
  ) {
    return this.collaborationService.listActivity(
      organizationId,
      req.user.id,
      query.limit ?? 50,
    );
  }

  @Get(
    'organizations/:organizationId/resources/:resourceType/:resourceId/comments',
  )
  listResourceComments(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('resourceType', new ParseEnumPipe(ResourceType))
    resourceType: ResourceType,
    @Param('resourceId') resourceId: string,
  ) {
    return this.collaborationService.listResourceComments(
      organizationId,
      req.user.id,
      resourceType,
      resourceId,
    );
  }

  @Post(
    'organizations/:organizationId/resources/:resourceType/:resourceId/comments',
  )
  createComment(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('resourceType', new ParseEnumPipe(ResourceType))
    resourceType: ResourceType,
    @Param('resourceId') resourceId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.collaborationService.createComment(
      organizationId,
      req.user.id,
      resourceType,
      resourceId,
      dto,
    );
  }

  @Post('organizations/:organizationId/comments/:commentId/replies')
  replyToComment(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('commentId') commentId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.collaborationService.replyToComment(
      organizationId,
      req.user.id,
      commentId,
      dto,
    );
  }

  @Post('organizations/:organizationId/comments/:commentId/resolve')
  resolveComment(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('commentId') commentId: string,
  ) {
    return this.collaborationService.resolveComment(
      organizationId,
      req.user.id,
      commentId,
    );
  }

  @Post('organizations/:organizationId/comments/:commentId/reactions')
  toggleReaction(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('commentId') commentId: string,
    @Body() dto: ToggleReactionDto,
  ) {
    return this.collaborationService.toggleReaction(
      organizationId,
      req.user.id,
      commentId,
      dto.emoji,
    );
  }

  @Patch('organizations/:organizationId/comments/:commentId')
  editComment(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.collaborationService.editComment(
      organizationId,
      req.user.id,
      commentId,
      dto,
    );
  }

  @Delete('organizations/:organizationId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Req() req: AuthenticatedRequest,
    @Param('organizationId') organizationId: string,
    @Param('commentId') commentId: string,
  ) {
    await this.collaborationService.deleteComment(
      organizationId,
      req.user.id,
      commentId,
    );
  }
}
