export function isLocalDatabaseHost(host: string): boolean {
  return ['localhost', '127.0.0.1', '::1'].includes(host.trim().toLowerCase());
}

export function allowInsecureDatabaseTls(): boolean {
  return process.env.ALLOW_INSECURE_DATABASE_TLS === 'true';
}
