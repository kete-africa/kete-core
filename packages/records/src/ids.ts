import { uuidv7 } from '@kete/sdk';

const prefixPattern = /^[a-z]{2,5}$/;
const idPattern =
  /^([a-z]{2,5})_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * A stable identifier readable by an AI (CONCEPTION 11): a short prefix naming what it is, then a
 * time-ordered UUID v7 — `dep_0199…`, `cli_0199…`. Like the SDK's event identifiers (`evt_`).
 */
export function newId(prefix: string): string {
  if (!prefixPattern.test(prefix)) {
    throw new TypeError(`A prefix has 2 to 5 lowercase letters: ${JSON.stringify(prefix)}`);
  }
  return `${prefix}_${uuidv7()}`;
}

/** The prefix of an identifier made by `newId`, or null. */
export function prefixOf(id: string): string | null {
  return idPattern.exec(id)?.[1] ?? null;
}

/** Whether `id` is an identifier of this kind: `isId('dep', value)`. */
export function isId(prefix: string, id: string): boolean {
  return prefixOf(id) === prefix;
}
