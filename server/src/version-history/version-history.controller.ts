import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { VersionHistoryService } from './version-history.service';
import { VersionHistoryDetailParamDto } from './dto/version-history-detail-param.dto';
import { VersionHistoryResourceParamDto } from './dto/version-history-resource-param.dto';

@Controller('version-history')
@UseGuards(JwtAuthGuard)
export class VersionHistoryController {
  constructor(private readonly versionHistoryService: VersionHistoryService) {}

  @Get(':resourceType/:resourceId')
  listVersions(
    @Param() params: VersionHistoryResourceParamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.versionHistoryService.listVersions(
      params.resourceType,
      params.resourceId,
      req.user.id,
    );
  }

  @Get(':resourceType/:resourceId/:versionId')
  getVersion(
    @Param() params: VersionHistoryDetailParamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.versionHistoryService.getVersion(
      params.resourceType,
      params.resourceId,
      params.versionId,
      req.user.id,
    );
  }

  @Post(':resourceType/:resourceId/:versionId/restore')
  restoreVersion(
    @Param() params: VersionHistoryDetailParamDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.versionHistoryService.restoreVersion(
      params.resourceType,
      params.resourceId,
      params.versionId,
      req.user.id,
    );
  }
}
