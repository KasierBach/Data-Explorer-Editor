import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { pickLocalizedText, resolveRequestLanguage } from '../utils/i18n.util';

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
      '/api/billing/webhooks/momo',
      '/api/billing/webhooks/zalopay',
    ]);

    if (
      mutationMethods.includes(req.method) &&
      !csrfExemptPaths.has(req.originalUrl)
    ) {
      const requestedWith = req.headers['x-requested-with'];

      // Defense in depth: browsers cannot set custom headers cross-site.
      if (requestedWith !== 'XMLHttpRequest') {
        const lang = resolveRequestLanguage(req.headers['accept-language']);
        throw new ForbiddenException(
          pickLocalizedText(
            lang,
            'Yêu cầu bị từ chối do thiếu header bảo mật (CSRF Protection).',
            'Request rejected: missing the security header (CSRF Protection).',
          ),
        );
      }
    }

    next();
  }
}
