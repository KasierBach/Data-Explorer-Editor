const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
];

export function getAllowedOrigins(
  nodeEnv = process.env.NODE_ENV,
  configuredOrigins = process.env.FRONTEND_URL,
): string[] {
  const explicitOrigins = (configuredOrigins || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const defaults = nodeEnv === 'production' ? [] : LOCAL_DEVELOPMENT_ORIGINS;

  return Array.from(new Set([...defaults, ...explicitOrigins]));
}
