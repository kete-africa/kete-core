import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, type LanguageModel, type ToolSet } from 'ai';
import type { Metering } from './ask.js';
import { usageOf } from './ask.js';
import type { ModelConfig } from './providers.js';

// The web search port (spec 129): what the web says of a question, with its sources. It is the
// model provider's own search — no search service of ours, no other account — reached by
// configuration, never named in business code. A search sends the question outside the
// organization: the host gives it to an agent only under its policies, and what comes back is
// outside content (spec 090).

/** A page the search found. */
export interface Found {
  title: string;
  url: string;
}

export interface Searched {
  /** What the pages say, in a few sentences, by the model that read them. */
  summary: string;
  sources: Found[];
}

export interface WebSearchPort {
  search(query: string, options?: { limit?: number; signal?: AbortSignal }): Promise<Searched>;
}

/** A model and the provider's search tool it calls. */
export interface SearchingModel {
  model: LanguageModel;
  tools: ToolSet;
}

const settings = (config: ModelConfig) => ({
  ...(config.apiKey ? { apiKey: config.apiKey } : {}),
  ...(config.baseURL ? { baseURL: config.baseURL } : {}),
});

/** The provider's model with its search tool; null when the configured provider offers none. */
export function searchingModel(config: ModelConfig): SearchingModel | null {
  if (config.provider === 'openai') {
    const provider = createOpenAI(settings(config));
    return {
      model: provider(config.model),
      tools: { web_search: provider.tools.webSearch({ searchContextSize: 'low' }) },
    };
  }
  if (config.provider === 'anthropic') {
    const provider = createAnthropic(settings(config));
    return {
      model: provider(config.model),
      tools: { web_search: provider.tools.webSearch_20260318({ maxUses: 2 }) },
    };
  }
  return null;
}

const modelName = (model: LanguageModel) =>
  typeof model === 'string' ? model : `${model.provider}:${model.modelId}`;

/** The web search port on a model that searches, metered. */
export function webSearch(searching: SearchingModel, metering?: Metering): WebSearchPort {
  return {
    async search(query, options = {}) {
      await metering?.store.check(metering.context);
      const result = await generateText({
        model: searching.model,
        tools: searching.tools,
        system:
          'Search the web for the question. Answer in a few sentences, in the language of the question, saying only what the pages say.',
        prompt: query.slice(0, 500),
        ...(options.signal ? { abortSignal: options.signal } : {}),
      });
      await metering?.store.record(
        { ...metering.context, model: modelName(searching.model) },
        usageOf(result.totalUsage, result.steps.length),
      );
      const seen = new Set<string>();
      const sources = result.sources.flatMap((source): Found[] => {
        if (source.sourceType !== 'url' || seen.has(source.url)) return [];
        seen.add(source.url);
        return [{ title: source.title ?? source.url, url: source.url }];
      });
      return { summary: result.text.trim(), sources: sources.slice(0, options.limit ?? 8) };
    },
  };
}
