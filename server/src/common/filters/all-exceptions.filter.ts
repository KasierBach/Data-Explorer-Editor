import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof exceptionResponse === 'object' && 'message' in exceptionResponse
        ? (exceptionResponse as any).message
        : exceptionResponse;

    // Log the actual error internally for debugging
    if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
       this.logger.error(`Exception: ${exception instanceof Error ? exception.message : exception}`, exception instanceof Error ? exception.stack : undefined);
    }

    const extraDetails =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? {
            reason: (exceptionResponse as any).reason,
            action: (exceptionResponse as any).action,
            details: (exceptionResponse as any).details,
          }
        : {};

    const responseBody = {
      success: false,
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message[0] : message,
      ...Object.fromEntries(
        Object.entries(extraDetails).filter(([, value]) => value !== undefined),
      ),
    };

    // Prevent formatting for SSE streaming connections which need their own abort mechanisms
    if (response.headersSent) {
      return;
    }

    response.status(httpStatus).json(responseBody);
  }
}
