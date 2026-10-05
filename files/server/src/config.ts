import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/** Absolute path of the project root (the folder with the root package.json and .env). */
export const rootDir = resolve(import.meta.dirname, '../..');

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
const NODE_ENVS = ['development', 'production', 'test'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];
export type NodeEnv = (typeof NODE_ENVS)[number];

export interface Config {
  /** Human-readable application name (APP_NAME). The only source of the name. */
  appName: string;
  appSlug: string;
  /** Version from the root package.json. */
  version: string;
  nodeEnv: NodeEnv;
  host: string;
  port: number;
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

/** Validates the environment and returns a typed config. Throws ConfigError listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];

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

  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const raw = env[key]?.trim();
    if (!raw) return fallback;
    if (!(allowed as readonly string[]).includes(raw)) {
      problems.push(`${key} must be one of ${allowed.join(', ')}, got "${raw}"`);
      return fallback;
    }
    return raw as T;
  };

  const appName = required('APP_NAME');
  const appSlug = required('APP_SLUG');
  const dbPath = required('DB_PATH');
  const nodeEnv = oneOf('NODE_ENV', NODE_ENVS, 'production');

  const config: Config = {
    appName,
    appSlug,
    version: readVersion(),
    nodeEnv,
    host: env.APP_HOST?.trim() || 'localhost',
    port: port('APP_PORT', 3000),
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
