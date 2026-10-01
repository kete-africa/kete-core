/**
 * Generates the event catalog as an AsyncAPI 3.1 document (decision 0006, doctrine D-032) from the
 * contracts and the SDK's standard event types: docs/generated/events.asyncapi.json.
 * `--check` regenerates in memory and fails if the committed file differs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { standardEventTypes } from '../../packages/sdk/src/events/standard.js';

const root = join(import.meta.dirname, '..', '..');
const output = join(root, 'docs', 'generated', 'events.asyncapi.json');

type Schema = Record<string, unknown>;
const read = (file: string) =>
  JSON.parse(readFileSync(join(root, 'contracts', file), 'utf8')) as Schema;

/** A contract's schema, without the keywords that only identify the file. */
function inline(schema: Schema): Schema {
  const identifying = new Set(['$schema', '$id', '$defs', 'title']);
  return Object.fromEntries(Object.entries(schema).filter(([key]) => !identifying.has(key)));
}

const envelope = read('event.v1.schema.json');
const data = read('event-data.v1.schema.json');
const definitions = data['$defs'] as Record<string, Schema>;
const envelopeProperties = envelope['properties'] as Record<string, Schema>;

const messages: Record<string, Schema> = {};
for (const [type, definition] of Object.entries(standardEventTypes)) {
  messages[definition] = {
    name: type,
    title: type,
    summary: String(definitions[definition]?.['description'] ?? `The ${type} event.`),
    contentType: 'application/json',
    payload: {
      ...inline(envelope),
      properties: {
        ...envelopeProperties,
        type: { const: type },
        data: inline(definitions[definition] ?? {}),
      },
    },
  };
}

const document = {
  asyncapi: '3.1.0',
  info: {
    title: 'Kete integration events',
    version: '1.0.0',
    description:
      'The standard events a Kete app announces through its outbox (@kete/sdk): immutable facts ' +
      'and counters, never names, e-mails or phone numbers. The relay sends them in signed ' +
      'batches (delivery-request.v1) to a receiver such as Kete Cockpit, which answers with ' +
      'delivery-result.v1. Generated from /contracts by `pnpm events:generate`; do not edit.',
  },
  channels: {
    deliveries: {
      address: '{receiver}',
      title: 'A receiver of Kete events',
      description:
        'An HTTPS endpoint receiving signed batches: headers Kete-Product and Kete-Signature ' +
        '(t=<unix seconds>,kid=<key id>,v1=<hex HMAC-SHA256 of "{t}.{raw body}">).',
      parameters: { receiver: { description: 'The receiver URL registered for the product.' } },
      messages: Object.fromEntries(
        Object.keys(messages).map((name) => [name, { $ref: `#/components/messages/${name}` }]),
      ),
    },
  },
  operations: {
    deliverEvents: {
      action: 'send',
      title: 'Deliver events from the outbox',
      channel: { $ref: '#/channels/deliveries' },
      messages: Object.keys(messages).map((name) => ({
        $ref: `#/channels/deliveries/messages/${name}`,
      })),
    },
  },
  components: { messages },
};

const content = `${JSON.stringify(document, null, 2)}\n`;

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(output, 'utf8');
  } catch {
    // Missing: out of date.
  }
  if (current !== content) {
    console.error(
      'docs/generated/events.asyncapi.json is out of date. Run `pnpm events:generate`.',
    );
    process.exit(1);
  }
  console.log('The event catalog (AsyncAPI) is up to date.');
} else {
  writeFileSync(output, content);
  console.log(`Generated the event catalog: ${Object.keys(messages).length} events.`);
}
