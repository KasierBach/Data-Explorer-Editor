const CORE_PRODUCTION_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'FRONTEND_URL',
  'API_PUBLIC_URL',
] as const;

const INSECURE_SECRET_VALUES = new Set([
  'super-secret-key',
  'your-secret-key',
  'replace-with-a-random-secret-at-least-32-bytes-long',
  '12345678901234567890123456789012',
  'your-32-char-encryption-key',
]);

function readString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

function requireValue(config: Record<string, unknown>, key: string) {
  const value = readString(config, key);
  if (!value) throw new Error(`${key} environment variable is required.`);
  return value;
}

function validateUrl(value: string, key: string, protocols: string[]) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid URL.`);
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new Error(`${key} must use ${protocols.join(' or ')}.`);
  }
}

function validateSecret(value: string, key: string, exactBytes?: number) {
  const bytes = Buffer.byteLength(value, 'utf8');
  if (INSECURE_SECRET_VALUES.has(value)) {
    throw new Error(`${key} is set to an insecure placeholder value.`);
  }
  if (exactBytes ? bytes !== exactBytes : bytes < 32) {
    throw new Error(
      exactBytes
        ? `${key} must be exactly ${exactBytes} bytes.`
        : `${key} must be at least 32 bytes.`,
    );
  }
}

export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnv = readString(config, 'NODE_ENV') || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, production, or test.');
  }
  const port = Number(readString(config, 'PORT') || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  const trustProxy = Number(readString(config, 'TRUST_PROXY') || 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 10) {
    throw new Error('TRUST_PROXY must be an integer between 0 and 10.');
  }
  if (nodeEnv !== 'production') return config;
  for (const key of CORE_PRODUCTION_VARS) requireValue(config, key);
  validateUrl(requireValue(config, 'DATABASE_URL'), 'DATABASE_URL', [
    'postgres:',
    'postgresql:',
  ]);
  validateUrl(requireValue(config, 'REDIS_URL'), 'REDIS_URL', [
    'redis:',
    'rediss:',
  ]);
  validateUrl(requireValue(config, 'FRONTEND_URL'), 'FRONTEND_URL', [
    'http:',
    'https:',
  ]);
  validateUrl(requireValue(config, 'API_PUBLIC_URL'), 'API_PUBLIC_URL', [
    'http:',
    'https:',
  ]);
  validateSecret(requireValue(config, 'JWT_SECRET'), 'JWT_SECRET');
  validateSecret(requireValue(config, 'ENCRYPTION_KEY'), 'ENCRYPTION_KEY', 32);
  const refreshSecret = readString(config, 'REFRESH_TOKEN_SECRET');
  if (refreshSecret) validateSecret(refreshSecret, 'REFRESH_TOKEN_SECRET');
  const legacyKeys = readString(config, 'LEGACY_ENCRYPTION_KEYS');
  if (legacyKeys) {
    for (const key of legacyKeys.split(',').map((value) => value.trim())) {
      validateSecret(key, 'LEGACY_ENCRYPTION_KEYS entry', 32);
    }
  }
  return config;
}
