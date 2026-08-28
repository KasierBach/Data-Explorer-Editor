import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { getAllowedOrigins } from './common/utils/cors.util';
import { Logger as PinoLogger } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create(AppModule, {
    bufferLogs: isProduction,
  });
  // In production use nestjs-pino for structured JSON logs with request IDs;
  // in development keep Nest's default logger output that developers expect.
  if (isProduction) {
    app.useLogger(app.get(PinoLogger));
  }
  const trustProxy = Number(process.env.TRUST_PROXY || 0);
  if (trustProxy > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }
  app.enableShutdownHooks();
  const allowedOrigins = getAllowedOrigins();
  const websocketOrigins = allowedOrigins.flatMap((origin) => {
    if (origin.startsWith('https://'))
      return [origin.replace('https://', 'wss://')];
    if (origin.startsWith('http://'))
      return [origin.replace('http://', 'ws://')];
    return [];
  });
  const connectSrc = Array.from(
    new Set(["'self'", ...allowedOrigins, ...websocketOrigins]),
  );
  const imgSrc = Array.from(
    new Set(["'self'", 'data:', 'blob:', ...allowedOrigins]),
  );
  const scriptSrc = isProduction
    ? ["'self'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'default-src': ["'self'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          'frame-ancestors': ["'none'"],
          'object-src': ["'none'"],
          'img-src': imgSrc,
          'script-src': scriptSrc,
          'connect-src': connectSrc,
          'style-src': [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Increase body size limit for base64 image uploads
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // Attach a correlation ID to every request (honours inbound x-request-id).
  app.use((req: any, res: any, next: () => void) => {
    const incoming = req.headers?.['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.trim()
        ? incoming.trim().slice(0, 128)
        : randomUUID();
    req.id = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Transform Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  // OpenAPI documentation (only outside tests to keep e2e lightweight).
  if (process.env.NODE_ENV !== 'test') {
    const config = new DocumentBuilder()
      .setTitle('Data Explorer API')
      .setDescription('REST API for the Data Explorer web-based database tool')
      .setVersion(process.env.npm_package_version || '3.6.4')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs-json',
      swaggerUiEnabled: process.env.NODE_ENV !== 'production',
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}
bootstrap();
