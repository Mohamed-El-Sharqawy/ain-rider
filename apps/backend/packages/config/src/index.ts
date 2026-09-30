export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

export function requireEnvInt(name: string): number {
  const value = requireEnv(name);
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) throw new Error(`Environment variable ${name} must be an integer, got: ${value}`);
  return parsed;
}

export function requireEnvBool(name: string): boolean {
  const value = requireEnv(name);
  return value === 'true' || value === '1';
}
