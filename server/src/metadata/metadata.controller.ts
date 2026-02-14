import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// @UseGuards(JwtAuthGuard)
@Controller('metadata')
export class MetadataController {
    constructor(private readonly metadataService: MetadataService) { }

    @Post('hierarchy')
    getHierarchy(
        @Body('connectionId') connectionId: string,
        @Body('parentId') parentId: string | null,
    ) {
        return this.metadataService.getHierarchy(connectionId, parentId);
    }

    @Get('columns')
    getColumns(
        @Query('connectionId') connectionId: string,
        @Query('tableId') tableId: string,
    ) {
        return this.metadataService.getColumns(connectionId, tableId);
    }

    @Get('metrics')
    getMetrics(
        @Query('connectionId') connectionId: string,
        @Query('database') database?: string,
    ) {
        return this.metadataService.getDatabaseMetrics(connectionId, database);
    }

    @Get('databases')
    getDatabases(@Query('connectionId') connectionId: string) {
        return this.metadataService.getDatabases(connectionId);
    }

    @Get('relationships')
    getRelationships(
        @Query('connectionId') connectionId: string,
        @Query('database') database?: string,
    ) {
        return this.metadataService.getRelationships(connectionId, database);
    }
}
