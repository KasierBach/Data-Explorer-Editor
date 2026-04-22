import { Controller, Get, Post, Query, UseGuards, Req } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Get()
    async search(@Req() req: any, @Query('q') query: string) {
        if (!query || query.length < 2) return [];
        return this.searchService.search(req.user.id, query);
    }

    @Post('sync')
    async sync(@Req() req: any) {
        return this.searchService.syncIndex(req.user.id);
    }
}
