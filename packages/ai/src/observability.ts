import { OpenTelemetry } from '@ai-sdk/otel';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { BasicTracerProvider, type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerTelemetry } from 'ai';
import { z } from 'zod';
import type { Usage } from './budget.js';

// Observing model calls (spec 058) with what exists: the AI SDK's OpenTelemetry integration emits
// a span per call and per step, by the GenAI semantic conventions (model, tokens, duration);
// Langfuse's span processor sends them to Langfuse when it is configured — no service of ours.
// What people wrote stays out of the traces unless the product says otherwise.

let recordContent = false;

/** Whether traces carry the prompts and answers (off unless `observeModels` turned it on). */
export const tracesContent = () => recordContent;

export interface ObservedModels {
  /** Whether a destination receives the traces. */
  enabled: boolean;
  /** Sends what is pending and stops (on shutdown). */
  shutdown(): Promise<void>;
}

/**
 * Traces every AI SDK call, once at startup: to Langfuse when `LANGFUSE_PUBLIC_KEY` and
 * `LANGFUSE_SECRET_KEY` are set (`LANGFUSE_BASE_URL` for a region or one's own instance), or to the
 * span processors given. Prompts and answers are traced only with `KETE_AI_TRACE_CONTENT=true`.
 */
export function observeModels(
  options: { spanProcessors?: SpanProcessor[]; env?: NodeJS.ProcessEnv } = {},
): ObservedModels {
  const env = options.env ?? process.env;
  const processors = [...(options.spanProcessors ?? [])];
  if (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY) {
    processors.push(
      new LangfuseSpanProcessor({
        publicKey: env.LANGFUSE_PUBLIC_KEY,
        secretKey: env.LANGFUSE_SECRET_KEY,
        ...(env.LANGFUSE_BASE_URL ? { baseUrl: env.LANGFUSE_BASE_URL } : {}),
      }),
    );
  }
  recordContent = env.KETE_AI_TRACE_CONTENT === 'true';
  if (!processors.length) return { enabled: false, shutdown: async () => {} };
  const provider = new BasicTracerProvider({ spanProcessors: processors });
  registerTelemetry(new OpenTelemetry({ tracer: provider.getTracer('kete-ai') }));
  return { enabled: true, shutdown: () => provider.shutdown() };
}

/** What a model costs, in US dollars per million tokens. */
export const modelPrice = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
});
export type ModelPrice = z.infer<typeof modelPrice>;
/** Prices by model, as usage names it (`openai.responses:gpt-6.1-sol`) or by its id alone. */
export type ModelPrices = Record<string, ModelPrice>;

/** The prices `KETE_AI_PRICES` gives (JSON: `{ "gpt-6.1-sol": { "input": 1.25, "output": 10 } }`). */
export function modelPricesFromEnv(env: NodeJS.ProcessEnv = process.env): ModelPrices {
  const raw = env.KETE_AI_PRICES?.trim();
  if (!raw) return {};
  return z.record(z.string().min(1), modelPrice).parse(JSON.parse(raw));
}

/** What a call cost, in millionths of a dollar; null when its model has no price. */
export function costOf(model: string, usage: Usage, prices: ModelPrices): number | null {
  const price = prices[model] ?? prices[model.slice(model.indexOf(':') + 1)];
  if (!price) return null;
  return Math.round(usage.inputTokens * price.input + usage.outputTokens * price.output);
}
