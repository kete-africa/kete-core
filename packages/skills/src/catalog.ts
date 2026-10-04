import { tool, type ToolSet } from 'ai';
import { z } from 'zod';
import { hasScripts, skillArchive, skillText, type Skill } from './skill.js';

// A model reads skills progressively (agentskills.io): every skill's name and description in its
// instructions, a skill's whole SKILL.md when it uses it, a reference file only when it needs it.

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** What the model knows of each skill before using one: the part of its instructions to add. */
export function skillsCatalog(skills: readonly Skill[]): string {
  if (!skills.length) return '';
  return [
    'Skills are instructions written for tasks of this organization. When a request matches a',
    "skill's description, load it with skill_load before answering, then follow it; read its",
    'reference files with skill_read only when its instructions point to them.',
    '<available_skills>',
    ...skills.map(
      (s) =>
        `<skill><name>${escape(s.name)}</name><description>${escape(s.description)}</description></skill>`,
    ),
    '</available_skills>',
  ].join('\n');
}

const MAX_READ_CHARACTERS = 60_000;

/**
 * The tools that read skills: `skill_load` gives a skill's instructions and the list of its files,
 * `skill_read` one of its text files. `onLoad` hears which skill was used (usage, evaluation).
 */
export function skillTools(
  skills: readonly Skill[],
  options: { onLoad?: (skill: Skill) => void } = {},
): ToolSet {
  const byName = new Map(skills.map((s) => [s.name, s]));
  if (!byName.size) return {};
  const names = [...byName.keys()] as [string, ...string[]];
  return {
    skill_load: tool({
      description: "Loads a skill's instructions, to follow them for the current request.",
      inputSchema: z.object({ name: z.enum(names).describe('The name of the skill to load') }),
      execute: async ({ name }) => {
        const skill = byName.get(name) as Skill;
        options.onLoad?.(skill);
        return {
          name: skill.name,
          instructions: skill.instructions,
          files: skill.files.map((f) => f.path).filter((p) => p !== 'SKILL.md'),
          ...(hasScripts(skill)
            ? { scripts: 'Its scripts run only in the shell tool, where the skill is installed.' }
            : {}),
        };
      },
    }),
    skill_read: tool({
      description:
        "Reads one of a skill's text files (references/…, assets/…), when its instructions point to it.",
      inputSchema: z.object({
        name: z.enum(names),
        path: z.string().min(1).max(300).describe('The path from the skill root'),
      }),
      execute: async ({ name, path }) => {
        const text = skillText(byName.get(name) as Skill, path);
        if (text === null) return { error: `No text file ${path} in skill ${name}.` };
        return { path, text: text.slice(0, MAX_READ_CHARACTERS) };
      },
    }),
  };
}

/** A skill as a provider's sandbox takes it inline: its name, description and .zip. */
export interface InlineSkill {
  name: string;
  description: string;
  archive: Uint8Array;
}

/** The skills whose scripts must run, ready for `@kete/ai`'s `hostedShell`. */
export function inlineSkills(skills: readonly Skill[]): InlineSkill[] {
  return skills
    .filter(hasScripts)
    .map((s) => ({ name: s.name, description: s.description, archive: skillArchive(s) }));
}
