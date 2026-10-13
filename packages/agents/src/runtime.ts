import './quiet.js';
import { BudgetExceededError, type Metering, type Usage } from '@kete/ai';
import type { CapabilityTool, InvocationResult } from '@kete/capabilities';
import { Agent } from '@mastra/core/agent';
import { tool, type LanguageModel, type ModelMessage } from 'ai';
import type { AgentConversations } from './conversations.js';
import { memoryInstructions, type AgentMemory } from './memory.js';

// A turn of an agent (spec 089, decision 0010). The loop — model, tools, steps, stream — is the
// runtime's; what makes it a Kete agent stays here and is small: its only tools are the
// capabilities its caller may use, so its rights, its mandate, the drafts and the journal come
// with them (@kete/capabilities); its usage is measured and its budget enforced (@kete/ai); and
// what a page shows of it is a short list of events, not the runtime's own.

type AgentConfig = ConstructorParameters<typeof Agent>[0];

export interface AgentTurn {
  /** The agent's identifier (`agt_…`), as its actor carries it. */
  agent: string;
  name?: string;
  model: LanguageModel;
  /** What the agent is, knows and must not do. */
  instructions: string;
  /** The conversation so far — or only what she just said, when the conversation is kept. */
  messages: ModelMessage[];
  /**
   * The capabilities its caller may use (`registry.tools(caller)`), offered as its only tools.
   * The caller is the agent acting for a person: it never has more rights than her.
   */
  tools?: readonly CapabilityTool[];
  /** How many model steps a turn may take, tool calls included (default 5). */
  maxSteps?: number;
  /** Budgets checked before the turn, usage recorded after it. */
  metering?: Metering;
  /** Where the conversation is kept, and whose it is. */
  conversation?: { store: AgentConversations; threadId: string; personId: string };
  /**
   * What she asked to be remembered (`memoriesFor`): given to the model after its instructions,
   * as context that never outranks them.
   */
  remembered?: readonly Pick<AgentMemory, 'text'>[];
  /**
   * Outside content (spec 090): words nobody of the organization wrote — a message from someone
   * outside it, a web page, an e-mail, a document dropped in. `input`: the turn starts with
   * some. `tools`: the capabilities whose results bring some. Once outside content is in the
   * turn, a capability that would act at once is not run: it waits for a person. Drafts are
   * prepared as always, since a person decides them anyway.
   */
  outside?: { input?: boolean; tools?: readonly string[] };
  abortSignal?: AbortSignal;
}

/** A capability the agent called, and what became of it. */
export interface AgentCall {
  name: string;
  /**
   * `done`: it read, or acted within its autonomy. `draft`: it prepared a gesture that waits for
   * a person. `confirmation_required`, `refused`: nothing happened. `failed`: it broke.
   */
  status: InvocationResult['status'] | 'failed';
  /** The draft that waits for a person, when one was prepared. */
  draftId?: string;
  /** The view a page shows with the result. */
  view?: string;
  output: unknown;
}

export interface AgentAnswer {
  text: string;
  usage: Usage;
  calls: AgentCall[];
}

/** What happens while an agent works, for a page that shows it as it comes. */
export type AgentEvent =
  | { type: 'text'; delta: string }
  | ({ type: 'call' } & AgentCall)
  | { type: 'done'; usage: Usage }
  | { type: 'stopped'; reason: 'budget_spent' | 'failed' };

const statuses = new Set(['done', 'draft', 'confirmation_required', 'refused']);

function callOf(tools: readonly CapabilityTool[], name: string, output: unknown): AgentCall {
  const result = (output ?? {}) as { status?: string; draftId?: unknown };
  const view = tools.find((capability) => capability.name === name)?.view;
  return {
    name,
    status: statuses.has(result.status ?? '') ? (result.status as AgentCall['status']) : 'failed',
    ...(result.status === 'draft' && typeof result.draftId === 'string'
      ? { draftId: result.draftId }
      : {}),
    ...(view ? { view } : {}),
    output,
  };
}

function modelId(model: LanguageModel): string {
  return typeof model === 'string' ? model : `${model.provider}:${model.modelId}`;
}

/** What a capability that acts at once answers once outside content is in the turn. */
export const WAITS_FOR_A_PERSON =
  'Not run: this turn read content from outside the organization, so this gesture waits for a person to do it or ask for it herself.';

function agentOf(turn: AgentTurn): Agent {
  // Whether outside content entered the turn: from the start, or from a tool that brought some.
  let tainted = turn.outside?.input === true;
  const bringsOutside = new Set(turn.outside?.tools ?? []);
  const tools = Object.fromEntries(
    (turn.tools ?? []).map((capability) => [
      capability.name,
      tool({
        description: capability.description,
        inputSchema: capability.input,
        execute: async (input: unknown): Promise<InvocationResult> => {
          // Levels 3 and 4 only prepare: a person decides them. Level 2 acts at once: not here.
          if (tainted && capability.autonomy === 2) {
            return { status: 'confirmation_required', message: WAITS_FOR_A_PERSON };
          }
          const result = await capability.execute(input);
          if (bringsOutside.has(capability.name)) tainted = true;
          return result;
        },
      }),
    ]),
  );
  return new Agent({
    id: turn.agent,
    name: turn.name ?? turn.agent,
    instructions: turn.instructions + memoryInstructions(turn.remembered ?? []),
    // The runtime accepts the models and the tools of the AI SDK as they are; its types do not
    // say so for every version (decision 0010). These two casts are the whole seam.
    model: turn.model as unknown as AgentConfig['model'],
    tools: tools as unknown as NonNullable<AgentConfig['tools']>,
    ...(turn.conversation ? { memory: turn.conversation.store.memory } : {}),
  });
}

function optionsOf(turn: AgentTurn) {
  return {
    maxSteps: turn.maxSteps ?? 5,
    ...(turn.abortSignal ? { abortSignal: turn.abortSignal } : {}),
    ...(turn.conversation
      ? {
          memory: {
            thread: turn.conversation.threadId,
            resource: turn.conversation.store.resourceOf(turn.conversation.personId),
          },
        }
      : {}),
  };
}

async function meter(turn: AgentTurn, usage: Usage): Promise<void> {
  if (!turn.metering) return;
  await turn.metering.store.record({ ...turn.metering.context, model: modelId(turn.model) }, usage);
}

const usageOf = (
  total: { inputTokens?: number | undefined; outputTokens?: number | undefined },
  modelCalls: number,
): Usage => ({
  inputTokens: total.inputTokens ?? 0,
  outputTokens: total.outputTokens ?? 0,
  modelCalls,
});

/**
 * One turn of an agent, in one piece: for a message, a task, a test. Throws `BudgetExceededError`
 * when a budget of the call is spent — no model is called then.
 */
export async function runAgent(turn: AgentTurn): Promise<AgentAnswer> {
  await turn.metering?.store.check(turn.metering.context);
  const answer = await agentOf(turn).generate(turn.messages, optionsOf(turn));
  const usage = usageOf(answer.totalUsage, answer.steps.length);
  await meter(turn, usage);
  return {
    text: answer.text,
    usage,
    calls: answer.toolResults.map((result) =>
      callOf(turn.tools ?? [], result.payload.toolName, result.payload.result),
    ),
  };
}

/**
 * The same turn as it happens: its words as they come, each capability it calls with what became
 * of it. It never throws: a spent budget or a failure ends the stream with `stopped`.
 */
export async function* streamAgent(turn: AgentTurn): AsyncGenerator<AgentEvent> {
  try {
    await turn.metering?.store.check(turn.metering.context);
    const stream = await agentOf(turn).stream(turn.messages, optionsOf(turn));
    let steps = 0;
    for await (const part of stream.fullStream) {
      if (part.type === 'text-delta') {
        if (part.payload.text) yield { type: 'text', delta: part.payload.text };
      } else if (part.type === 'tool-result') {
        yield {
          type: 'call',
          ...callOf(turn.tools ?? [], part.payload.toolName, part.payload.result),
        };
      } else if (part.type === 'tool-error') {
        yield { type: 'call', name: part.payload.toolName, status: 'failed', output: null };
      } else if (part.type === 'step-finish') {
        steps += 1;
      } else if (part.type === 'error') {
        throw part.payload.error instanceof Error ? part.payload.error : new Error('stream');
      }
    }
    const usage = usageOf(await stream.totalUsage, steps);
    await meter(turn, usage);
    yield { type: 'done', usage };
  } catch (error) {
    yield {
      type: 'stopped',
      reason: error instanceof BudgetExceededError ? 'budget_spent' : 'failed',
    };
  }
}
