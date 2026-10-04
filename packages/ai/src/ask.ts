import type { CapabilityTool } from '@kete/capabilities';
import {
  generateText,
  isStepCount,
  Output,
  streamText,
  tool,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from 'ai';
import type { z } from 'zod';
import type { BudgetStore, Usage, UsageContext } from './budget.js';
import { tracesContent } from './observability.js';

/** Who pays for a call, and where its usage is recorded. */
export interface Metering {
  store: BudgetStore;
  context: UsageContext;
}

/**
 * A product's capabilities as model tools: the model calls them, and each call goes through the
 * capability registry — the caller's rights, the autonomy scale, drafts for what commits.
 */
export function toolsFrom(capabilities: readonly CapabilityTool[]): ToolSet {
  return Object.fromEntries(
    capabilities.map((capability) => [
      capability.name,
      tool({
        description: capability.description,
        inputSchema: capability.input,
        execute: (input: unknown) => capability.execute(input),
      }),
    ]),
  );
}

function modelId(model: LanguageModel): string {
  return typeof model === 'string' ? model : `${model.provider}:${model.modelId}`;
}

export function usageOf(total: LanguageModelUsage, modelCalls: number): Usage {
  return {
    inputTokens: total.inputTokens ?? 0,
    outputTokens: total.outputTokens ?? 0,
    modelCalls,
  };
}

interface Conversation {
  model: LanguageModel;
  /** What the model is, knows and must not do. */
  system?: string;
  /** The conversation so far; or a single `prompt`. */
  messages?: ModelMessage[];
  prompt?: string;
  /** Capabilities the caller may use (`registry.tools(caller)`), offered to the model as tools. */
  tools?: readonly CapabilityTool[];
  /** How many model steps a turn may take, tool calls included (default 5). */
  maxSteps?: number;
  /** Budgets checked before the call, usage recorded after it. */
  metering?: Metering;
  abortSignal?: AbortSignal;
}

function input(conversation: Conversation) {
  const { messages, prompt } = conversation;
  if (messages && prompt) throw new TypeError('Give either messages or a prompt, not both.');
  if (messages) return { messages };
  if (prompt !== undefined) return { prompt };
  throw new TypeError('Give messages or a prompt.');
}

/** How a call appears in the traces: its purpose, and its content only when allowed. */
const telemetryOf = (metering: Metering | undefined) => ({
  telemetry: {
    ...(metering ? { functionId: metering.context.purpose } : {}),
    recordInputs: tracesContent(),
    recordOutputs: tracesContent(),
  },
});

function shared(conversation: Conversation) {
  return {
    model: conversation.model,
    ...telemetryOf(conversation.metering),
    ...(conversation.system ? { system: conversation.system } : {}),
    ...input(conversation),
    ...(conversation.tools?.length ? { tools: toolsFrom(conversation.tools) } : {}),
    stopWhen: isStepCount(conversation.maxSteps ?? 5),
    ...(conversation.abortSignal ? { abortSignal: conversation.abortSignal } : {}),
  };
}

async function meter(metering: Metering | undefined, usage: Usage, model: LanguageModel) {
  if (!metering) return;
  await metering.store.record({ ...metering.context, model: modelId(model) }, usage);
}

export interface Answer {
  text: string;
  usage: Usage;
  /** The capabilities the model called, with what they returned. */
  toolResults: { name: string; output: unknown }[];
}

/** One turn of a conversation, with tools, metered. */
export async function ask(conversation: Conversation): Promise<Answer> {
  await conversation.metering?.store.check(conversation.metering.context);
  const result = await generateText(shared(conversation));
  const usage = usageOf(result.totalUsage, result.steps.length);
  await meter(conversation.metering, usage, conversation.model);
  return {
    text: result.text,
    usage,
    toolResults: result.steps.flatMap((step) =>
      step.toolResults.map((r) => ({ name: r.toolName, output: r.output })),
    ),
  };
}

/**
 * The same turn, streamed for a chat screen: `askStream(…).toUIMessageStreamResponse()` answers the
 * chat's request. Usage is recorded when the stream ends.
 */
export async function askStream(conversation: Conversation) {
  await conversation.metering?.store.check(conversation.metering.context);
  return streamText({
    ...shared(conversation),
    onFinish: async ({ totalUsage, steps }) => {
      await meter(conversation.metering, usageOf(totalUsage, steps.length), conversation.model);
    },
  });
}

/**
 * Structured output: what the model reads in a text, a message or a transcript, as a value of
 * `schema` — typically a record's schema (@kete/records), then prepared as a draft (@kete/drafts).
 */
export async function extract<T>(options: {
  model: LanguageModel;
  schema: z.ZodType<T>;
  system?: string;
  prompt?: string;
  messages?: ModelMessage[];
  metering?: Metering;
}): Promise<{ value: T; usage: Usage }> {
  await options.metering?.store.check(options.metering.context);
  const result = await generateText({
    model: options.model,
    ...(options.system ? { system: options.system } : {}),
    ...input(options),
    output: Output.object({ schema: options.schema }),
    ...telemetryOf(options.metering),
  });
  const usage = usageOf(result.totalUsage, result.steps.length);
  await meter(options.metering, usage, options.model);
  return { value: result.output as T, usage };
}
