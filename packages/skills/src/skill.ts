import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { parseFrontmatter, validateMetadata } from 'skills-ref';

// An Agent Skill (agentskills.io): a folder whose SKILL.md carries its name, its description and
// its instructions, beside optional scripts/, references/ and assets/. Read and validated with the
// standard's reference library (skills-ref), so that a skill written for Claude, ChatGPT or Codex
// works here, and one kept here works there.

/** A file of a skill, by its path from the skill's root (`SKILL.md`, `references/tone.md`). */
export interface SkillFile {
  path: string;
  data: Uint8Array;
}

export interface Skill {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  /** Experimental in the standard: the tools the skill may use without asking. */
  allowedTools?: string;
  metadata: Record<string, string>;
  /** SKILL.md's instructions, after its frontmatter. */
  instructions: string;
  /** Every file of the skill, SKILL.md included, sorted by path. */
  files: SkillFile[];
}

export class SkillError extends Error {
  constructor(
    message: string,
    readonly problems: string[] = [message],
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

/** A skill holds at most this much, all files together: it is read by a model, not a disk. */
export const MAX_SKILL_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 500;

const textDecoder = new TextDecoder('utf-8', { fatal: false });
const BOM = String.fromCharCode(0xfeff);
const REPLACEMENT = String.fromCharCode(0xfffd);
const cleanPath = (path: string) => path.replace(/\\/g, '/').replace(/^\.?\//, '');

function checkPath(path: string): string {
  const clean = cleanPath(path);
  if (
    !clean ||
    clean.split('/').some((part) => part === '..' || part === '') ||
    clean.length > 300
  ) {
    throw new SkillError(`Invalid file path: ${path}`);
  }
  return clean;
}

/** The frontmatter and the instructions, the latter whole even when they hold `---` rules. */
function splitSkillMd(content: string): [Record<string, unknown>, string] {
  const text = (content.startsWith(BOM) ? content.slice(1) : content).replace(/\r\n/g, '\n');
  const end = text.startsWith('---\n') ? text.indexOf('\n---', 4) : -1;
  if (end < 0)
    throw new SkillError('SKILL.md must start with a YAML frontmatter between --- lines');
  const [metadata] = parseFrontmatter(`${text.slice(0, end)}\n---\n`);
  const body = text.slice(end + 4).replace(/^[^\n]*\n?/, '');
  return [metadata, body.trim()];
}

/**
 * A skill from its files, validated by the standard's rules: its name (lowercase letters, digits,
 * single hyphens, 64 at most) and description (1024 at most) present, no unknown field, and its
 * name its folder's when a folder is given.
 */
export function parseSkill(files: SkillFile[], options: { folder?: string } = {}): Skill {
  if (files.length > MAX_FILES) throw new SkillError(`A skill holds at most ${MAX_FILES} files`);
  const byPath = new Map<string, Uint8Array>();
  let size = 0;
  for (const file of files) {
    size += file.data.byteLength;
    byPath.set(checkPath(file.path), file.data);
  }
  if (size > MAX_SKILL_BYTES) throw new SkillError('A skill holds at most 10 MB');
  const skillMd = byPath.get('SKILL.md') ?? byPath.get('skill.md');
  if (!skillMd) throw new SkillError('A skill needs a SKILL.md at its root');
  let metadata: Record<string, unknown>;
  let instructions: string;
  try {
    [metadata, instructions] = splitSkillMd(textDecoder.decode(skillMd));
  } catch (error) {
    throw error instanceof SkillError ? error : new SkillError((error as Error).message);
  }
  const problems = validateMetadata(metadata);
  const name = typeof metadata.name === 'string' ? metadata.name.trim() : '';
  if (options.folder !== undefined && options.folder !== name) {
    problems.push(`Folder '${options.folder}' must match skill name '${name}'`);
  }
  if (problems.length) throw new SkillError(problems.join('; '), problems);
  const optional = (key: string) =>
    typeof metadata[key] === 'string'
      ? { [key === 'allowed-tools' ? 'allowedTools' : key]: metadata[key] }
      : {};
  return {
    name,
    description: String(metadata.description).trim(),
    ...optional('license'),
    ...optional('compatibility'),
    ...optional('allowed-tools'),
    metadata: (metadata.metadata as Record<string, string> | undefined) ?? {},
    instructions,
    files: [...byPath]
      .map(([path, data]) => ({ path: path === 'skill.md' ? 'SKILL.md' : path, data }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/** A skill's version: the hash of its files, so the same content is always the same version. */
export function skillVersion(skill: Pick<Skill, 'files'>): string {
  const hash = createHash('sha256');
  for (const file of skill.files) {
    hash.update(file.path).update('\0').update(file.data).update('\0');
  }
  return hash.digest('hex').slice(0, 16);
}

/** A file of the skill as text, or null when it is binary (an image, a template). */
export function skillText(skill: Skill, path: string): string | null {
  const file = skill.files.find((f) => f.path === cleanPath(path));
  if (!file) return null;
  const text = textDecoder.decode(file.data);
  return text.includes(REPLACEMENT) || text.includes('\0') ? null : text;
}

/** Whether the skill carries scripts to run, which only a sandbox may run. */
export const hasScripts = (skill: Skill) => skill.files.some((f) => f.path.startsWith('scripts/'));

/** The skill as a .zip whose root is its folder: what Claude, ChatGPT and providers take. */
export function skillArchive(skill: Skill): Uint8Array {
  return zipSync(Object.fromEntries(skill.files.map((f) => [`${skill.name}/${f.path}`, f.data])), {
    level: 6,
  });
}

/**
 * The skills in a .zip: one folder per skill (as Claude and ChatGPT export them), or a single
 * skill at the archive's root.
 */
export function readSkillArchive(archive: Uint8Array): Skill[] {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(archive, {
      filter: (file) => !file.name.endsWith('/') && !file.name.startsWith('__MACOSX/'),
    });
  } catch {
    throw new SkillError('Not a .zip archive');
  }
  const paths = Object.keys(entries).map(cleanPath);
  if (paths.some((p) => /^skill\.md$/i.test(p))) {
    return [parseSkill(Object.entries(entries).map(([path, data]) => ({ path, data })))];
  }
  const folders = [
    ...new Set(
      paths.filter((p) => /^[^/]+\/skill\.md$/i.test(p)).map((p) => p.split('/')[0] as string),
    ),
  ];
  if (!folders.length) throw new SkillError('No SKILL.md in this archive');
  return folders.map((folder) =>
    parseSkill(
      Object.entries(entries)
        .filter(([path]) => cleanPath(path).startsWith(`${folder}/`))
        .map(([path, data]) => ({ path: cleanPath(path).slice(folder.length + 1), data })),
      { folder },
    ),
  );
}

/** The skills of a folder on disk, one sub-folder each: a product's own skills, shipped with it. */
export async function readSkillsDirectory(directory: string): Promise<Skill[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const skills: Skill[] = [];
  for (const entry of entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const root = join(directory, entry.name);
    const files: SkillFile[] = [];
    for (const path of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (!path.isFile()) continue;
      const full = join(path.parentPath, path.name);
      files.push({ path: relative(root, full).split(sep).join('/'), data: await readFile(full) });
    }
    skills.push(parseSkill(files, { folder: entry.name }));
  }
  return skills;
}

/** A skill written in code: its SKILL.md and files as text (tests, a product's defaults). */
export function skillFromText(files: Record<string, string>): Skill {
  return parseSkill(Object.entries(files).map(([path, text]) => ({ path, data: strToU8(text) })));
}
