interface RequiredSecretOptions {
  minLength?: number;
  exactLength?: number;
  disallowValues?: string[];
}

function byteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function buildTestFallback(name: string, exactLength?: number) {
  if (exactLength) {
    return 't'.repeat(exactLength);
  }

  return `${name.toLowerCase()}-test-secret-material-32`;
}

function validateSecret(
  name: string,
  value: string,
  options: RequiredSecretOptions,
) {
  if (options.disallowValues?.includes(value)) {
    throw new Error(`${name} is set to an insecure placeholder value.`);
  }

  if (options.exactLength && byteLength(value) !== options.exactLength) {
    throw new Error(`${name} must be exactly ${options.exactLength} bytes.`);
  }

  if (options.minLength && byteLength(value) < options.minLength) {
    throw new Error(`${name} must be at least ${options.minLength} bytes.`);
  }
}

export function getRequiredSecret(
  name: string,
  options: RequiredSecretOptions = {},
): string {
  const configuredValue = (process.env[name] || '').trim();

  if (configuredValue) {
    validateSecret(name, configuredValue, options);
    return configuredValue;
  }

  if (process.env.NODE_ENV === 'test') {
    const fallback = buildTestFallback(name, options.exactLength);
    validateSecret(name, fallback, options);
    return fallback;
  }

  throw new Error(`${name} environment variable is required.`);
}
