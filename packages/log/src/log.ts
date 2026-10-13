import { trace } from '@opentelemetry/api';
import { pino, stdSerializers, type DestinationStream, type Logger as Pino } from 'pino';

// Logs of a Kete service (spec 091): one JSON line per event, read by whatever collects the
// container's output — no service of ours. The business code speaks to the port (`Logger`); pino
// is its adapter. What must never be read in a log is taken out before the line is written: a
// secret, a token, a password, a person's e-mail or phone. Each line carries the trace it belongs
// to, so a log and a trace of the same request are found together.

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

/** The port: what business code calls. A message is a fact in English; the details are fields. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  /** An error, with what it happened to: its kind, its message, its stack — never its secrets. */
  error(message: string, fields?: LogFields & { error?: unknown }): void;
  /** A logger whose every line carries these fields: a request, an organization, a job. */
  child(fields: LogFields): Logger;
}

/** The keys whose value is never written, at any depth. */
export const REDACTED_KEYS = [
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'passcode',
  'pin',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'appSecret',
  'botToken',
  'credentials',
  'privateKey',
  'email',
  'phone',
  'iban',
] as const;

const CENSORED = '[redacted]';
const keys = new Set(REDACTED_KEYS.map((key) => key.toLowerCase()));

/** What looks like a secret or a person inside a free text: taken out, whatever its key. */
const patterns: [RegExp, string][] = [
  [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${CENSORED}`],
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, CENSORED],
  [/\b(?:sk|pk|rk|ghp|gho|github_pat|xox[bp])[-_][A-Za-z0-9_-]{12,}\b/g, CENSORED],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, CENSORED],
  [/\+?\d[\d ().-]{7,}\d/g, CENSORED],
];

/** A text with what looks like a secret or a person taken out. */
export function scrub(text: string): string {
  return patterns.reduce((out, [pattern, by]) => out.replace(pattern, by), text);
}

/** A value with every redacted key censored and every text scrubbed, to a bounded depth. */
export function redact(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrub(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 6) return '[deep]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));
  if (value instanceof Error) return redact(stdSerializers.err(value), depth);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      keys.has(key.toLowerCase()) ? CENSORED : redact(item, depth + 1),
    ]),
  );
}

/** The trace a line belongs to, when one is active (OpenTelemetry). */
function traceFields(): LogFields {
  const context = trace.getActiveSpan()?.spanContext();
  return context && trace.isSpanContextValid(context)
    ? { trace_id: context.traceId, span_id: context.spanId }
    : {};
}

function wrap(base: Pino): Logger {
  const write =
    (level: LogLevel) =>
    (message: string, fields: LogFields = {}): void => {
      const { error, ...rest } = fields as LogFields & { error?: unknown };
      const line = redact({
        ...rest,
        ...(error !== undefined
          ? {
              error:
                error instanceof Error ? stdSerializers.err(error) : { message: String(error) },
            }
          : {}),
      }) as LogFields;
      base[level](line, scrub(message));
    };
  return {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    child: (fields) => wrap(base.child(redact(fields) as LogFields)),
  };
}

export interface LoggerOptions {
  /** The service that writes: `account`, `nettio`, `nettio-worker`. */
  service: string;
  /** Default: `KETE_LOG_LEVEL`, else `info`. */
  level?: LogLevel;
  /** Default: the process's standard output. Tests give their own. */
  destination?: DestinationStream;
}

/** The logger of a service: JSON lines, redacted, tied to their trace. */
export function createLogger(options: LoggerOptions): Logger {
  const level = options.level ?? (process.env.KETE_LOG_LEVEL as LogLevel | undefined) ?? 'info';
  const base = pino(
    {
      level,
      base: { service: options.service },
      messageKey: 'message',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) },
      mixin: traceFields,
    },
    options.destination,
  );
  return wrap(base);
}

export interface MemoryLogger extends Logger {
  /** The lines written, as JSON objects. */
  readonly lines: LogFields[];
}

/** Keeps the lines it would have written, redacted as for real: for tests. */
export function memoryLogger(service = 'test'): MemoryLogger {
  const lines: LogFields[] = [];
  const destination = {
    write(chunk: string) {
      for (const text of chunk.split('\n')) if (text) lines.push(JSON.parse(text) as LogFields);
    },
  };
  return Object.assign(createLogger({ service, level: 'debug', destination }), { lines });
}

/** A logger that writes nothing: where a port is required and nothing is to be kept. */
export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
};
