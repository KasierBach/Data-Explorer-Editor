import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];
  const connectSrc = Array.from(new Set(["'self'", ...allowedOrigins, 'https:']));
  const scriptSrc = isProduction
    ? ["'self'"]
    : ["'self'", "'unsafe-inline'", "'unsafe-eval'"];

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "default-src": ["'self'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "img-src": ["'self'", "data:", "https:"],
        "script-src": scriptSrc,
        "connect-src": connectSrc,
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // Increase body size limit for base64 image uploads
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix('api');

  // Global Validation Pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Global Exception Filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global Transform Interceptor
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}
bootstrap();
