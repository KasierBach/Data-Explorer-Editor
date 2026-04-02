import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Do not transform if it's SSE (Server-Sent Events) or a stream.
    // Check Content-Type OR the specific migration progress path
    const contentType = response.getHeader ? response.getHeader('Content-Type') : '';
    const isSsePath = request.url && request.url.includes('/migration/progress');

    if (isSsePath || (contentType && (contentType as string).includes('text/event-stream'))) {
        return next.handle();
    }

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode: response.statusCode,
        timestamp: new Date().toISOString(),
        data,
      })),
    );
  }
}
