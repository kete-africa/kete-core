import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { EmbeddingModel, LanguageModel, ToolSet, TranscriptionModel } from 'ai';

/**
 * The model providers Kete can use (doctrine D-029: the model is chosen by configuration, never
 * written in code). `openai-compatible` reaches any host of open models — DeepSeek's weights served
 * elsewhere, a local server — when the data must not leave a given place.
 */
export const modelProviders = [
  'deepseek',
  'openai',
  'anthropic',
  'mistral',
  'openai-compatible',
] as const;
export type ModelProvider = (typeof modelProviders)[number];

export interface ModelConfig {
  provider: ModelProvider;
  /** The provider's model identifier, e.g. `deepseek-chat`. */
  model: string;
  /** Default: the provider's usual environment variable. */
  apiKey?: string;
  /** Required for `openai-compatible`; optional otherwise (a proxy, a regional endpoint). */
  baseURL?: string;
}

export class ModelConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelConfigError';
  }
}

function checkConfig(config: ModelConfig): void {
  if (!modelProviders.includes(config.provider)) {
    throw new ModelConfigError(`Unknown model provider: ${String(config.provider)}`);
  }
  if (!config.model) throw new ModelConfigError('A model identifier is required.');
  if (config.provider === 'openai-compatible' && !config.baseURL) {
    throw new ModelConfigError('An openai-compatible provider needs its baseURL.');
  }
}

const settings = (config: ModelConfig) => ({
  ...(config.apiKey ? { apiKey: config.apiKey } : {}),
  ...(config.baseURL ? { baseURL: config.baseURL } : {}),
});

/** The language model a configuration names. */
export function languageModel(config: ModelConfig): LanguageModel {
  checkConfig(config);
  switch (config.provider) {
    case 'deepseek':
      return createDeepSeek(settings(config))(config.model);
    case 'openai':
      return createOpenAI(settings(config))(config.model);
    case 'anthropic':
      return createAnthropic(settings(config))(config.model);
    case 'mistral':
      return createMistral(settings(config))(config.model);
    case 'openai-compatible':
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: config.baseURL ?? '',
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      })(config.model);
  }
}

/** The embedding model a configuration names (for search and knowledge). */
export function embeddingModel(config: ModelConfig): EmbeddingModel {
  checkConfig(config);
  switch (config.provider) {
    case 'openai':
      return createOpenAI(settings(config)).embedding(config.model);
    case 'mistral':
      return createMistral(settings(config)).embedding(config.model);
    case 'openai-compatible':
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: config.baseURL ?? '',
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      }).embeddingModel(config.model);
    default:
      throw new ModelConfigError(`${config.provider} offers no embedding model here.`);
  }
}

/** The transcription model a configuration names (voice notes). */
export function transcriptionModel(config: ModelConfig): TranscriptionModel {
  checkConfig(config);
  if (config.provider !== 'openai') {
    throw new ModelConfigError(`${config.provider} offers no transcription model here.`);
  }
  return createOpenAI(settings(config)).transcription(config.model);
}

/** A skill a provider's sandbox installs: its name, description and .zip (`@kete/skills`). */
export interface HostedSkill {
  name: string;
  description: string;
  archive: Uint8Array;
}

/**
 * The provider's own sandbox, where a model runs commands and skills' scripts — Word, Excel,
 * PowerPoint, PDF made there — with no container of ours. Its network is off unless domains are
 * allowed. Null when the configured provider offers none here.
 */
export function hostedShell(
  config: ModelConfig,
  options: { skills?: readonly HostedSkill[]; allowedDomains?: string[] } = {},
): ToolSet | null {
  checkConfig(config);
  if (config.provider !== 'openai') return null;
  const skills = (options.skills ?? []).map((s) => ({
    type: 'inline' as const,
    name: s.name,
    description: s.description,
    source: {
      type: 'base64' as const,
      mediaType: 'application/zip' as const,
      data: Buffer.from(s.archive).toString('base64'),
    },
  }));
  return {
    shell: createOpenAI(settings(config)).tools.shell({
      environment: {
        type: 'containerAuto',
        networkPolicy: options.allowedDomains?.length
          ? { type: 'allowlist', allowedDomains: options.allowedDomains }
          : { type: 'disabled' },
        ...(skills.length ? { skills } : {}),
      },
    }),
  };
}

/**
 * A configuration from the environment: `<PREFIX>_PROVIDER`, `<PREFIX>_MODEL`, and optionally
 * `<PREFIX>_API_KEY` and `<PREFIX>_BASE_URL` (prefix `KETE_AI` by default). Secrets stay in the
 * environment, never in code.
 */
export function modelConfigFromEnv(prefix = 'KETE_AI'): ModelConfig {
  const provider = process.env[`${prefix}_PROVIDER`] as ModelProvider | undefined;
  const model = process.env[`${prefix}_MODEL`];
  if (!provider || !model) {
    throw new ModelConfigError(`${prefix}_PROVIDER and ${prefix}_MODEL are not set.`);
  }
  const apiKey = process.env[`${prefix}_API_KEY`];
  const baseURL = process.env[`${prefix}_BASE_URL`];
  const config: ModelConfig = {
    provider,
    model,
    ...(apiKey ? { apiKey } : {}),
    ...(baseURL ? { baseURL } : {}),
  };
  checkConfig(config);
  return config;
}
