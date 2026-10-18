# @kete/ai

One **model port** for every Kete product: the provider is configuration, never code (doctrine
D-029), a product's **capabilities become the model's tools** (under the same rights and autonomy
rules as the screens), and every call's **usage is measured** against monthly **budgets** per
organization and per agent. Built on the Vercel AI SDK.

```mermaid
flowchart LR
    CHAT[chat · extraction · agent] --> ASK["ask · askStream · extract"]
    ASK -->|before| CHECK{budgets: organization, agent}
    CHECK -->|spent| REFUSE[BudgetExceededError, no call]
    CHECK -->|ok| MODEL["languageModel(config)<br/>DeepSeek · OpenAI · Anthropic · Mistral · OpenAI-compatible"]
    MODEL -->|tool calls| CAPS["registry.tools(caller)<br/>@kete/capabilities"]
    MODEL -->|after| USAGE[(kete_ai_usage)]
```

## Use

```ts
import {
  ask,
  askStream,
  extract,
  languageModel,
  modelConfigFromEnv,
  postgresBudgetStore,
} from '@kete/ai';

const model = languageModel(modelConfigFromEnv()); // KETE_AI_PROVIDER, KETE_AI_MODEL, KETE_AI_API_KEY
const metering = {
  store: postgresBudgetStore(pool),
  context: { organizationId, actor, purpose: 'chat', model: '' },
};

// The chat: the caller's capabilities as tools, streamed to the screen.
const stream = await askStream({
  model,
  system,
  messages,
  tools: await registry.tools(caller),
  metering,
});
return stream.toUIMessageStreamResponse();

// Reading a message, a transcript or a photo's text into a record, then a draft for a person.
const { value } = await extract({ model, schema: quote.schema, prompt: message, metering });
```

| Export                                                                | What it does                                                                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `languageModel`, `embeddingModel`, `transcriptionModel`               | A model from a `ModelConfig` (`modelConfigFromEnv` reads it from the environment)                                                                      |
| `ask`, `askStream`                                                    | A conversation turn with tools (at most `maxSteps` model steps), metered                                                                               |
| `extract`                                                             | A structured value of a Zod schema, metered                                                                                                            |
| `scanReader`                                                          | A scan (image, PDF without text) read page by page: `@kete/files`' transcriber                                                                         |
| `intake`                                                              | What was received — a message, a photo, a voice note, a document — read into a record's fields, each with its source, certainty and passage (spec 098) |
| `toolsFrom`                                                           | Capabilities (`registry.tools(caller)`) as AI SDK tools                                                                                                |
| `postgresBudgetStore`, `aiMigrationSql`                               | Usage (append-only) and monthly token budgets in the product's Postgres, under RLS                                                                     |
| `observeModels`, `aiCostMigrationSql`, `modelPricesFromEnv`, `costOf` | Traces (OpenTelemetry, Langfuse), each call's cost, `store.report`                                                                                     |

## Observing models: traces and costs (spec 058)

```mermaid
flowchart LR
  C[ask · askStream · extract · any AI SDK call] --> O[@ai-sdk/otel · GenAI spans]
  O -->|LANGFUSE_* set| L[LangfuseSpanProcessor → Langfuse]
  O -->|spanProcessors| X[any OpenTelemetry processor]
  C --> R[BudgetStore.record]
  P[KETE_AI_PRICES] --> R
  R --> U[(kete_ai_usage · tokens · cost_micro_usd)]
  U --> Q[report · by purpose, model, actor]
```

```ts
import { modelPricesFromEnv, observeModels, postgresBudgetStore } from '@kete/ai';

// Once at startup: traces to Langfuse when LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY are set.
const observed = observeModels();
// Each call's cost, in millionths of a dollar (migration: aiCostMigrationSql after aiMigrationSql).
const store = postgresBudgetStore(pool, { prices: modelPricesFromEnv() });
const thisMonth = await store.report(organizationId);
```

- **Traces** follow OpenTelemetry's GenAI conventions (model, tokens, duration, purpose as
  `functionId`), through the AI SDK's own integration. **What people wrote is not traced** unless
  `KETE_AI_TRACE_CONTENT=true`: Langfuse is a third party.
- **Costs** come from `KETE_AI_PRICES` (US dollars per million tokens, by model id), recorded with
  each call, so a later price change does not rewrite history. A model without a price costs `null`.
- No service of ours: Langfuse Cloud, one's own Langfuse, or any OpenTelemetry processor.

## Dictation (spec 090)

What a person said, written down, through one port: any transcription model of the AI SDK —
OpenAI's, or Mistral's **Voxtral**, whose weights are open and which a deployment may host itself.
The budget is checked before the call; the call is counted after it, heard or not; a silent
recording is heard as nothing, not as a failure.

```ts
const port = dictation(transcriptionModel({ provider: 'mistral', model: 'voxtral-mini-latest' }), {
  store: budgets,
  context: { organizationId, actor, purpose: 'dictation', model: '' },
});
const { text } = await port.dictate(audio);
```

## Said aloud, and the web searched (spec 129)

**Speech**: an answer said aloud through one port, any speech model of the AI SDK — OpenAI's, or
Mistral's Voxtral (open weights). `sayable` keeps what a voice says — no links' addresses, no code —
and cuts a long answer at a sentence; the budget is checked before and the call counted after.

**Web search**: the model provider's own search tool (OpenAI's, Anthropic's), so no search
service nor account is added; `searchingModel(config)` is null for a provider without one. The
answer is a short summary and each source once; the call is metered like any model call.

```ts
const voice = speech(
  speechModel({ provider: 'mistral', model: 'voxtral-mini-tts-latest' }),
  metering,
);
const { audio, mediaType } = await voice.speak(answer.text, { language: 'fr' });

const searching = searchingModel(config);
const found = searching
  ? await webSearch(searching, metering).search('tarif du kWh au Togo')
  : null;
```

## Understanding a note (spec 104)

What a person wrote or said at the end of her day becomes gestures proposed to her — **on the
objects the app knows and with the gestures it offers**, never guessed. Their level and capability
come from the app's offer, not from the model; up to level 2 an item comes ticked. What the model
could not place is said back to her (`unclear`).

```ts
const { items, unclear } = await understand({
  model,
  text: transcript,
  today: '2026-10-14',
  known: openTasks.map((t) => ({ key: t.taskId, kind: 'task', label: t.title })),
  offers: [
    {
      gesture: 'close',
      describe: 'close a task she says is done',
      level: 2,
      capability: 'tasks_complete',
      inputOf: ({ object }) => ({ taskId: object?.key }),
    },
  ],
});
// items → proposeSet of @kete/drafts
```

## Choosing the provider (doctrine D-029)

The provider is chosen by the **sensitivity of the data**, per product or per task. DeepSeek's own
API processes data in China; its open-weight models can be served elsewhere through
`openai-compatible` (a European host, or the client's own servers). Nothing in a product's code
names a provider.

## Rules

- A budget is checked **before** the call; a scope without a budget row is not limited.
- Usage is recorded in its own transaction: the tokens were spent, whatever happens next.
- The model never sees data the caller may not see: tools go through the capability registry.
