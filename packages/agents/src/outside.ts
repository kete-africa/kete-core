import type { CapabilityTool, InvocationResult } from '@kete/capabilities';

// Outside content in a turn (spec 090; hardened by spec 134). Words nobody of the organization
// wrote — a stranger's message, a web page, a computer's output — may carry instructions. Once
// some entered the turn, nothing that acts at once runs (level 2), and nothing that could carry the
// organization's data out does either: the agent's computer, which has the network, waits for a
// person; a page is read only at an address the outside content itself gave (a search's source),
// never at one the agent made up — where data could hide. Drafts are prepared as always.

/** What a capability that acts at once answers once outside content is in the turn. */
export const WAITS_FOR_A_PERSON =
  'Not run: this turn read content from outside the organization, so this gesture waits for a person to do it or ask for it herself.';

/** What a page at an address nobody gave answers once outside content is in the turn. */
export const UNSEEN_ADDRESS =
  'Not read: this turn read content from outside the organization, so only an address that content gave can be read now — ask the person to open it herself.';

/** Tools that could carry data out of the organization: once outside content is in, they wait. */
const CARRIES_OUT = new Set(['computer_run', 'computer_write']);

const ADDRESS = /https:\/\/[^\s"'<>\\)\]]+/g;

export interface OutsideTurn {
  readonly tainted: boolean;
  /** Null when the tool may run now; otherwise what it answers instead. */
  before(tool: Pick<CapabilityTool, 'name' | 'autonomy'>, input: unknown): InvocationResult | null;
  /** After a tool ran: outside content entered when it brings some; the addresses it gave kept. */
  after(tool: Pick<CapabilityTool, 'name'>, result: unknown): void;
}

/** One turn's watch over outside content; shared by an agent and its sub-agents. */
export function outsideTurn(options: {
  /** The tools whose results bring outside content. */
  tools: readonly string[];
  /** The turn starts with some. */
  tainted?: boolean;
}): OutsideTurn {
  const bringing = new Set(options.tools);
  const given = new Set<string>();
  let tainted = options.tainted === true;
  return {
    get tainted() {
      return tainted;
    },
    before(tool, input) {
      if (!tainted) return null;
      if (tool.autonomy === 2 || CARRIES_OUT.has(tool.name)) {
        return { status: 'confirmation_required', message: WAITS_FOR_A_PERSON };
      }
      if (tool.name === 'web_read') {
        const url = (input as { url?: unknown } | null)?.url;
        if (typeof url !== 'string' || !given.has(url)) {
          return { status: 'confirmation_required', message: UNSEEN_ADDRESS };
        }
      }
      return null;
    },
    after(tool, result) {
      if (!bringing.has(tool.name)) return;
      tainted = true;
      for (const address of JSON.stringify(result ?? null).match(ADDRESS) ?? []) {
        given.add(address);
      }
    },
  };
}
