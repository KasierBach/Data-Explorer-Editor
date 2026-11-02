function createE2eEnvironment(source) {
  for (const [key, protocols, pathname] of [
    ['E2E_DATABASE_URL', ['postgres:', 'postgresql:'], '/data_explorer_e2e'],
    ['E2E_REDIS_URL', ['redis:'], '/15'],
  ]) {
    let url;
    try {
      url = new URL(source[key]);
    } catch {
      throw new Error(`${key} must explicitly name the local E2E fixture.`);
    }
    if (
      !protocols.includes(url.protocol) ||
      !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.pathname !== pathname ||
      url.search ||
      url.hash
    ) {
      throw new Error(`${key} must explicitly name the local E2E fixture.`);
    }
  }

  const env = {};
  for (const key of [
    'PATH',
    'Path',
    'SystemRoot',
    'SYSTEMROOT',
    'ComSpec',
    'COMSPEC',
    'TEMP',
    'TMP',
    'TMPDIR',
    'HOME',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
    'CI',
  ]) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  return {
    ...env,
    NODE_ENV: 'test',
    E2E_DATABASE_URL: source.E2E_DATABASE_URL,
    E2E_REDIS_URL: source.E2E_REDIS_URL,
    DATABASE_URL: source.E2E_DATABASE_URL,
    REDIS_URL: source.E2E_REDIS_URL,
    JWT_SECRET: 'e2e-fixture-only-jwt-secret-32-bytes-minimum',
    REFRESH_TOKEN_SECRET: 'e2e-fixture-only-refresh-secret-32-bytes-minimum',
    ENCRYPTION_KEY: 'e'.repeat(32),
    FRONTEND_URL: 'http://127.0.0.1:4173',
    API_PUBLIC_URL: 'http://127.0.0.1:3001/api',
    ALLOW_INTERNAL_IPS: 'true',
    LOG_LEVEL: 'silent',
  };
}

module.exports = { createE2eEnvironment };
