import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, path } = request;
    const incomingRequestId = request.get('x-request-id') || '';
    const requestId = /^[A-Za-z0-9._-]{1,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();
    const startTime = Date.now();
    request.headers['x-request-id'] = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      const { statusCode } = response;
      const contentLength = response.get('content-length');
      const delay = Date.now() - startTime;

      this.logger.log(
        JSON.stringify({
          requestId,
          method,
          path,
          statusCode,
          bytes: Number(contentLength || 0),
          durationMs: delay,
        }),
      );
    });

    next();
  }
}
