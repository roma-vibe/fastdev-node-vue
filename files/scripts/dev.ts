/**
 * `npm run dev`: runs the API (node --watch) and the Vite dev server together with prefixed
 * output. Stops both when either exits or when this process receives SIGINT/SIGTERM.
 */
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { styleText } from 'node:util';

const rootDir = resolve(import.meta.dirname, '..');

if (!existsSync(join(rootDir, '.env'))) {
  console.error('Missing .env in the project root. Create it with: cp .env.example .env');
  process.exit(1);
}

type Color = 'cyan' | 'magenta';

interface Task {
  name: string;
  color: Color;
  cwd: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

const viteBin = join(
  dirname(createRequire(join(rootDir, 'web/package.json')).resolve('vite/package.json')),
  'bin/vite.js',
);

const tasks: Task[] = [
  {
    name: 'api',
    color: 'cyan',
    cwd: join(rootDir, 'server'),
    // Restart the API when its sources, SQL migrations or the root .env change.
    args: ['--watch-path=src', '--watch-path=../.env', '--watch-preserve-output', 'src/index.ts'],
    env: { NODE_ENV: 'development' },
  },
  {
    name: 'web',
    color: 'magenta',
    cwd: join(rootDir, 'web'),
    args: [viteBin],
  },
];

const width = Math.max(...tasks.map((task) => task.name.length));
const children = new Set<ChildProcess>();
let stopping = false;

function pipe(stream: NodeJS.ReadableStream, prefix: string, out: NodeJS.WriteStream): void {
  createInterface({ input: stream, crlfDelay: Infinity }).on('line', (line) => {
    out.write(`${prefix} ${line}\n`);
  });
}

function start(task: Task): void {
  const child = spawn(process.execPath, task.args, {
    cwd: task.cwd,
    env: { ...process.env, ...(process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}), ...task.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);

  const prefix = styleText(task.color, `[${task.name.padEnd(width)}]`, { stream: process.stdout });
  pipe(child.stdout, prefix, process.stdout);
  pipe(child.stderr, prefix, process.stderr);

  // 'close' fires after the output streams are drained, so no log line is lost.
  child.on('close', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.log(`${prefix} exited (${signal ?? `code ${code}`}), stopping the others`);
      stop('SIGTERM', code ?? 1);
    } else if (children.size === 0) {
      process.exit(process.exitCode ?? 0);
    }
  });
}

function stop(signal: NodeJS.Signals, exitCode = 0): void {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  if (children.size === 0) process.exit(exitCode);
  for (const child of children) child.kill(signal);
  // Do not hang forever on a child that ignores the signal.
  setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
    process.exit(exitCode);
  }, 5_000).unref();
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGHUP', () => stop('SIGTERM'));

for (const task of tasks) start(task);
