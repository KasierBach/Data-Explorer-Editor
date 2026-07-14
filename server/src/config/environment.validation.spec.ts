import { validateEnvironment } from './environment.validation';

const productionConfig = {
  NODE_ENV: 'production',
  PORT: '3001',
  DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  REDIS_URL: 'redis://redis:6379',
  JWT_SECRET: 'j'.repeat(32),
  ENCRYPTION_KEY: 'e'.repeat(32),
  FRONTEND_URL: 'https://example.com',
  API_PUBLIC_URL: 'https://api.example.com/api',
};

describe('validateEnvironment', () => {
  it('accepts a complete production configuration', () => {
    expect(validateEnvironment({ ...productionConfig })).toEqual(
      productionConfig,
    );
  });
  it('derives the public API URL from Render when no override is set', () => {
    const config: Record<string, unknown> = {
      ...productionConfig,
      RENDER_EXTERNAL_URL: 'https://data-explorer.onrender.com/',
    };
    delete config.API_PUBLIC_URL;

    expect(validateEnvironment(config).API_PUBLIC_URL).toBe(
      'https://data-explorer.onrender.com/api',
    );
  });
  it('fails fast when production infrastructure is missing', () => {
    expect(() =>
      validateEnvironment({ ...productionConfig, REDIS_URL: '' }),
    ).toThrow('REDIS_URL environment variable is required');
  });
  it('rejects weak production secrets', () => {
    expect(() =>
      validateEnvironment({ ...productionConfig, JWT_SECRET: 'short' }),
    ).toThrow('JWT_SECRET must be at least 32 bytes');
  });
  it('keeps local and test configuration lightweight', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toEqual({
      NODE_ENV: 'test',
    });
  });
});
