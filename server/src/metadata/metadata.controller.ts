import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@UseGuards(JwtAuthGuard)
@Controller('metadata')
export class MetadataController {
    constructor(private readonly metadataService: MetadataService) { }

    @Post('hierarchy')
    getHierarchy(
        @Body('connectionId') connectionId: string,
        @Body('parentId') parentId: string | null,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.metadataService.getHierarchy(connectionId, parentId, req.user.id);
    }

    @Get('columns')
    getColumns(
        @Query('connectionId') connectionId: string,
        @Query('tableId') tableId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.metadataService.getColumns(connectionId, tableId, req.user.id);
    }

    @Get('metrics')
    getMetrics(
        @Query('connectionId') connectionId: string,
        @Query('database') database: string | undefined,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.metadataService.getDatabaseMetrics(connectionId, req.user.id, database);
    }

    @Get('databases')
    getDatabases(@Query('connectionId') connectionId: string, @Req() req: AuthenticatedRequest) {
        return this.metadataService.getDatabases(connectionId, req.user.id);
    }

    @Get('relationships')
    getRelationships(
        @Query('connectionId') connectionId: string,
        @Query('database') database: string | undefined,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.metadataService.getRelationships(connectionId, req.user.id, database);
    }

    @Get('full')
    getFullMetadata(
        @Query('connectionId') connectionId: string,
        @Query('tableId') tableId: string,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.metadataService.getFullMetadata(connectionId, tableId, req.user.id);
    }

    @Post('refresh')
    refresh(
        @Body('connectionId') connectionId: string,
        @Body('database') database: string | undefined,
        @Req() req: AuthenticatedRequest,
    ) {
        return this.metadataService.refresh(connectionId, req.user.id, database);
    }
}
