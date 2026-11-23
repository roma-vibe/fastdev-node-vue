import { existsSync, readFileSync } from 'node:fs';
import { isIPv6 } from 'node:net';
import { isAbsolute, resolve } from 'node:path';

/** Absolute path of the project root (the folder with the root package.json and .env). */
export const rootDir = resolve(import.meta.dirname, '../..');

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const NODE_ENVS = ['development', 'production', 'test'] as const;
/** A DNS name or an IPv4 address, lowercase, without port. */
const HOST_NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type NodeEnv = (typeof NODE_ENVS)[number];

export interface Config {
  /** Human-readable application name (APP_NAME). The only source of the name. */
  appName: string;
  appSlug: string;
  /** Version from the root package.json. */
  version: string;
  nodeEnv: NodeEnv;
  /** Interface the API binds to (APP_HOST). Loopback by default; only Docker sets 0.0.0.0. */
  host: string;
  port: number;
  /** Public URL of the app (PUBLIC_URL), or undefined. An https URL turns on HSTS. */
  publicUrl: string | undefined;
  /**
   * More host names the app answers to (ALLOWED_HOSTS), besides localhost, 127.0.0.1, [::1] and
   * the PUBLIC_URL host; requests for any other Host get 421 (host-check.ts).
   */
  allowedHosts: string[];
  /** Largest accepted request body in bytes (MAX_BODY_BYTES); larger bodies get 413. */
  maxBodyBytes: number;
  /** Absolute path of the SQLite file, or ":memory:". */
  dbPath: string;
  logLevel: LogLevel;
  /** Serve the built SPA from webDistDir (production only; Vite serves it in development). */
  serveWeb: boolean;
  webDistDir: string;
}

export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/** Loads the root .env into process.env when it exists. Existing variables are not overridden. */
export function loadEnvFile(path: string = resolve(rootDir, '.env')): void {
  if (existsSync(path)) process.loadEnvFile(path);
}

/** Readers for one environment: each records its problems instead of throwing, so all are listed together. */
function createReaders(env: NodeJS.ProcessEnv, problems: string[]) {
  const required = (key: string): string => {
    const value = env[key]?.trim();
    if (!value) {
      problems.push(`${key} is required (see .env.example)`);
      return '';
    }
    return value;
  };

  const port = (key: string, fallback: number): number => {
    const raw = env[key]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 65_535) {
      problems.push(`${key} must be an integer between 1 and 65535, got "${raw}"`);
    }
    return value;
  };

  const positiveInt = (key: string, fallback: number): number => {
    const raw = env[key]?.trim();
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1) {
      problems.push(`${key} must be a positive integer, got "${raw}"`);
    }
    return value;
  };

  const httpUrl = (key: string): string | undefined => {
    const raw = env[key]?.trim();
    if (!raw) return undefined;
    if (!URL.canParse(raw) || !['http:', 'https:'].includes(new URL(raw).protocol)) {
      problems.push(`${key} must be an http:// or https:// URL, got "${raw}"`);
    }
    return raw;
  };

  const hostList = (key: string): string[] => {
    const hosts = (env[key] ?? '')
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
    for (const host of hosts) {
      const ipv6 = host.startsWith('[') && host.endsWith(']') && isIPv6(host.slice(1, -1));
      if (!ipv6 && !HOST_NAME.test(host)) {
        problems.push(`${key} must list host names without scheme, port or path, got "${host}"`);
      }
    }
    return hosts;
  };

  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = env[key]?.trim();
    if (!raw) return fallback;
    if (!(allowed as readonly string[]).includes(raw)) {
      problems.push(`${key} must be one of ${allowed.join(', ')}, got "${raw}"`);
      return fallback;
    }
    return raw as T;
  };

  return { required, port, positiveInt, httpUrl, hostList, oneOf };
}

/** Validates the environment and returns a typed config. Throws ConfigError listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];
  const { required, port, positiveInt, httpUrl, hostList, oneOf } = createReaders(env, problems);

  const appName = required('APP_NAME');
  const appSlug = required('APP_SLUG');
  const dbPath = required('DB_PATH');
  const nodeEnv = oneOf('NODE_ENV', NODE_ENVS, 'production');

  const config: Config = {
    appName,
    appSlug,
    version: readVersion(),
    nodeEnv,
    host: env.APP_HOST?.trim() || '127.0.0.1',
    port: port('APP_PORT', 3000),
    publicUrl: httpUrl('PUBLIC_URL'),
    allowedHosts: hostList('ALLOWED_HOSTS'),
    maxBodyBytes: positiveInt('MAX_BODY_BYTES', 1_048_576),
    dbPath: dbPath === ':memory:' || isAbsolute(dbPath) ? dbPath : resolve(rootDir, dbPath),
    logLevel: oneOf('LOG_LEVEL', LOG_LEVELS, 'info'),
    serveWeb: nodeEnv === 'production',
    webDistDir: resolve(rootDir, 'web/dist'),
  };

  if (problems.length > 0) throw new ConfigError(problems);
  return config;
}

function readVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf8')) as {
    version?: string;
  };
  return pkg.version ?? '0.0.0';
}
