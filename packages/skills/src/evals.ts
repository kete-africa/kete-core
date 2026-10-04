import { extract, usageOf, type Metering } from '@kete/ai';
import { generateText, isStepCount, type LanguageModel } from 'ai';
import { z } from 'zod';
import { skillsCatalog, skillTools } from './catalog.js';
import { skillText, type Skill } from './skill.js';

// A skill's test cases, in the file its authors already write (`evals/evals.json`, as Anthropic's
// skill-creator does): a request, and what a good answer does. Each case is asked to a model that
// has the skill, then a judge says which expectations the answer meets.

export interface SkillCase {
  prompt: string;
  expectations: string[];
}

const caseShape = z
  .object({
    prompt: z.string().min(1),
    expectations: z.array(z.string().min(1)).optional(),
    expected_output: z.string().min(1).optional(),
  })
  .refine((c) => c.expectations?.length || c.expected_output, 'A case needs expectations');

/** The skill's cases, from `evals/evals.json` (a list, or `{ evals: [...] }`); none without it. */
export function skillCases(skill: Skill): SkillCase[] {
  const text = skillText(skill, 'evals/evals.json');
  if (!text) return [];
  const raw: unknown = JSON.parse(text);
  const list = Array.isArray(raw) ? raw : ((raw as { evals?: unknown[] }).evals ?? []);
  return z
    .array(caseShape)
    .parse(list)
    .map((c) => ({
      prompt: c.prompt,
      expectations: c.expectations?.length ? c.expectations : [c.expected_output as string],
    }));
}

export interface CaseResult {
  prompt: string;
  /** Whether the model loaded the skill to answer. */
  loaded: boolean;
  answer: string;
  expectations: { expectation: string; met: boolean; reason: string }[];
  passed: boolean;
}

const verdicts = z.object({
  verdicts: z.array(z.object({ expectation: z.string(), met: z.boolean(), reason: z.string() })),
});

const modelName = (model: LanguageModel) =>
  typeof model === 'string' ? model : `${model.provider}:${model.modelId}`;

/**
 * Runs a skill's cases: each request asked to `model` with the skill offered, the answer judged
 * by `judge` (the same model by default). Metered like any call.
 */
export async function evaluateSkill(options: {
  skill: Skill;
  model: LanguageModel;
  judge?: LanguageModel;
  cases?: SkillCase[];
  metering?: Metering;
}): Promise<{ cases: CaseResult[]; passed: number; total: number }> {
  const cases = options.cases ?? skillCases(options.skill);
  const results: CaseResult[] = [];
  for (const c of cases) {
    let loaded = false;
    await options.metering?.store.check(options.metering.context);
    const answer = await generateText({
      model: options.model,
      system: skillsCatalog([options.skill]),
      prompt: c.prompt,
      tools: skillTools([options.skill], { onLoad: () => (loaded = true) }),
      stopWhen: isStepCount(6),
    });
    if (options.metering) {
      await options.metering.store.record(
        { ...options.metering.context, model: modelName(options.model) },
        usageOf(answer.totalUsage, answer.steps.length),
      );
    }
    const { value } = await extract({
      model: options.judge ?? options.model,
      schema: verdicts,
      system:
        'You judge an answer against expectations. For each expectation, say whether the answer ' +
        'meets it, strictly, with a one-sentence reason. Keep the expectations in their order.',
      prompt: `Request:\n${c.prompt}\n\nAnswer:\n${answer.text}\n\nExpectations:\n${c.expectations
        .map((e, i) => `${i + 1}. ${e}`)
        .join('\n')}`,
      ...(options.metering ? { metering: options.metering } : {}),
    });
    const expectations = c.expectations.map((expectation, i) => ({
      expectation,
      met: value.verdicts[i]?.met ?? false,
      reason: value.verdicts[i]?.reason ?? '',
    }));
    results.push({
      prompt: c.prompt,
      loaded,
      answer: answer.text,
      expectations,
      passed: expectations.every((e) => e.met),
    });
  }
  return {
    cases: results,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
  };
}
