import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only check for mutation methods
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    const csrfExemptPaths = new Set([
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/verify-email',
      '/api/auth/resend-verification',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/exchange-oauth-code',
    ]);

    if (
      mutationMethods.includes(req.method) &&
      !csrfExemptPaths.has(req.originalUrl)
    ) {
      const requestedWith = req.headers['x-requested-with'];

      // Simple custom header check (Defense in Depth)
      // Since browser-based CSRF attacks cannot set custom headers easily
      // (due to CORS Preflight), this is a common and effective protection.
      if (requestedWith !== 'XMLHttpRequest') {
        throw new ForbiddenException(
          'Yêu cầu bị từ chối do thiếu header bảo mật (CSRF Protection).',
        );
      }
    }

    next();
  }
}
