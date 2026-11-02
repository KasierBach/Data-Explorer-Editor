import { Test } from '@nestjs/testing';
import {
  ConsoleLogger,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { createHash, randomUUID } from 'node:crypto';

export async function createE2eApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
    .setLogger(new ConsoleLogger({ logLevels: [] }))
    .compile();
  const app = moduleFixture.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  try {
    await app.init();
    const storage = app.get<ThrottlerStorageRedisService>(ThrottlerStorage);
    const increment = storage.increment.bind(storage);
    const namespace = randomUUID();
    storage.increment = (key, ttl, limit, blockDuration, throttlerName) =>
      increment(
        createHash('sha256').update(namespace).update(key).digest('hex'),
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    return app;
  } catch (error) {
    await closeE2eApp(app);
    throw error;
  }
}

export async function closeE2eApp(app: INestApplication): Promise<void> {
  await app.close();
}
