import { Controller, Get, Post, Body, Query, UseGuards, Req } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('metadata')
export class MetadataController {
    constructor(private readonly metadataService: MetadataService) { }

    @Post('hierarchy')
    getHierarchy(
        @Body('connectionId') connectionId: string,
        @Body('parentId') parentId: string | null,
        @Req() req: any,
    ) {
        return this.metadataService.getHierarchy(connectionId, parentId, req.user.id);
    }

    @Get('columns')
    getColumns(
        @Query('connectionId') connectionId: string,
        @Query('tableId') tableId: string,
        @Req() req: any,
    ) {
        return this.metadataService.getColumns(connectionId, tableId, req.user.id);
    }

    @Get('metrics')
    getMetrics(
        @Query('connectionId') connectionId: string,
        @Query('database') database: string | undefined, // Fixed to inject Request after optional param safely
        @Req() req: any,
    ) {
        return this.metadataService.getDatabaseMetrics(connectionId, req.user.id, database);
    }

    @Get('databases')
    getDatabases(@Query('connectionId') connectionId: string, @Req() req: any) {
        return this.metadataService.getDatabases(connectionId, req.user.id);
    }

    @Get('relationships')
    getRelationships(
        @Query('connectionId') connectionId: string,
        @Query('database') database: string | undefined,
        @Req() req: any,
    ) {
        return this.metadataService.getRelationships(connectionId, req.user.id, database);
    }
}
