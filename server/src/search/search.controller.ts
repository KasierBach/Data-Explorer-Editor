import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(@Req() req: AuthenticatedRequest, @Query('q') query: unknown) {
    if (typeof query !== 'string') {
      throw new BadRequestException('q must be a string');
    }
    if (!query || query.length < 2) return [];
    return this.searchService.search(req.user.id, query);
  }

  @Post('sync')
  async sync(@Req() req: AuthenticatedRequest) {
    return this.searchService.syncIndex(req.user.id);
  }
}
