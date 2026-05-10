let debugEnabled = false;
let verboseEnabled = false;

export function initLogger(opts: { debug?: boolean; verbose?: boolean }) {
  debugEnabled = opts.debug ?? process.env.RECMP3_DEBUG === '1';
  verboseEnabled = opts.verbose ?? debugEnabled;
}

export const log = {
  debug(msg: string, ...args: unknown[]) {
    if (debugEnabled) {
      process.stderr.write(`[debug] ${msg} ${args.length ? JSON.stringify(args) : ''}\n`);
    }
  },
  info(msg: string, ...args: unknown[]) {
    if (verboseEnabled) {
      process.stderr.write(`[info]  ${msg} ${args.length ? JSON.stringify(args) : ''}\n`);
    }
  },
  warn(msg: string) {
    process.stderr.write(`[warn]  ${msg}\n`);
  },
  error(msg: string) {
    process.stderr.write(`[error] ${msg}\n`);
  },
};

export function redactKey(key: string): string {
  if (!key || key.length < 8) return '***';
  return `${key.slice(0, 3)}***${key.slice(-4)}`;
}
