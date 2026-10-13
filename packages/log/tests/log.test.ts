import { context, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { describe, expect, it } from 'vitest';
import { memoryLogger, scrub, silentLogger } from '../src/index.js';

// Spec 091: one JSON line per event, nothing that must not be read, tied to its trace.

// What a service's OpenTelemetry setup does at startup: the active span follows the request.
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

describe('a log line', () => {
  it('is JSON with its service, level, time and message, and the fields given', () => {
    const log = memoryLogger('nettio');
    log.info('deposit received', { organizationId: 'org_bleu', pieces: 3 });
    expect(log.lines).toEqual([
      {
        level: 'info',
        time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as string,
        service: 'nettio',
        message: 'deposit received',
        organizationId: 'org_bleu',
        pieces: 3,
      },
    ]);
  });

  it('never carries a secret, a token, an e-mail or a phone number, at any depth', () => {
    const log = memoryLogger();
    log.warn('provider refused, call +228 90 11 22 33 or ama@example.test', {
      headers: { authorization: 'Bearer abcdefghijklmnop', 'x-request-id': 'req_1' },
      sender: { accessToken: 'EAAG-token', phone: '22890112233', label: 'Pressing Bleu' },
      note: 'key sk-proj-ABCDEFGHIJKLMNOPQRST was used',
      list: [{ password: 'hunter2' }],
    });
    const line = JSON.stringify(log.lines[0]);
    for (const secret of [
      'abcdefghijklmnop',
      'EAAG-token',
      '22890112233',
      '90 11 22 33',
      'ama@example',
      'sk-proj',
      'hunter2',
    ]) {
      expect(line).not.toContain(secret);
    }
    expect(log.lines[0]).toMatchObject({
      message: 'provider refused, call [redacted] or [redacted]',
      headers: { authorization: '[redacted]', 'x-request-id': 'req_1' },
      sender: { accessToken: '[redacted]', phone: '[redacted]', label: 'Pressing Bleu' },
    });
  });

  it('says what an error was, with its stack, and scrubs its message', () => {
    const log = memoryLogger();
    const error = new TypeError(
      'cannot reach https://api.example.test with Bearer abcdefghijklmnopqrst',
    );
    log.error('delivery failed', { error, messageId: 'chm_1' });
    expect(log.lines[0]).toMatchObject({
      level: 'error',
      messageId: 'chm_1',
      error: {
        type: 'TypeError',
        message: 'cannot reach https://api.example.test with Bearer [redacted]',
      },
    });
    expect(String((log.lines[0]?.error as { stack: string }).stack)).toContain('log.test.ts');
  });

  it('carries the fields of its child, and the trace it belongs to', () => {
    const log = memoryLogger();
    const request = log.child({ requestId: 'req_9', organizationId: 'org_bleu' });
    const tracer = new BasicTracerProvider().getTracer('test');
    const span = tracer.startSpan('request');
    context.with(trace.setSpan(context.active(), span), () => request.info('answered'));
    span.end();
    expect(log.lines[0]).toMatchObject({
      requestId: 'req_9',
      organizationId: 'org_bleu',
      trace_id: span.spanContext().traceId,
      span_id: span.spanContext().spanId,
    });
  });

  it('keeps under its level what is below it, and writes nothing when silent', () => {
    const log = memoryLogger();
    log.debug('detail');
    expect(log.lines).toHaveLength(1);
    expect(() => silentLogger.child({ a: 1 }).error('x')).not.toThrow();
    expect(scrub('nothing to hide here: order A-0412')).toBe('nothing to hide here: order A-0412');
  });
});
