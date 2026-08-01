import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth-request.types';
import { AiProviderConnectionService } from './ai-provider-connection.service';
import {
  SaveAiProviderConnectionDto,
  TestAiProviderConnectionDto,
} from './dto/ai-provider-connection.dto';

@Controller('ai/providers')
@UseGuards(JwtAuthGuard)
export class AiProviderConnectionController {
  constructor(private readonly providers: AiProviderConnectionService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.providers.list(req.user.id);
  }

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SaveAiProviderConnectionDto,
  ) {
    return this.providers.create(req.user.id, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: SaveAiProviderConnectionDto,
  ) {
    return this.providers.update(req.user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.providers.remove(req.user.id, id);
  }

  @Post('test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  testUnsaved(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TestAiProviderConnectionDto,
  ) {
    return this.providers.test(req.user.id, undefined, dto);
  }

  @Post(':id/test')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  testSaved(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.providers.test(req.user.id, id);
  }
}
