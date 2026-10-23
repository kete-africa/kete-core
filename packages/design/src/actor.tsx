import { CanvasIcon, isCanvasIconName } from './canvas-icon.js';

// One actor model (spec 149; doctrine D-062, R6): a person, an agent, Kete, a contact from outside —
// each drawn alike everywhere, by its kind: a person and a contact a circle with their initials, an
// agent and Kete a rounded square with their glyph. An agent without a face of its own gets one from
// its id, the same everywhere and every time.

export type ActorKind = 'person' | 'agent' | 'kete' | 'contact';
export type ActorTint = 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'teal' | 'slate';

export interface ActorFace {
  glyph: string;
  tint?: ActorTint;
}

const TINTS: Record<ActorTint, { surface: string; ink: string }> = {
  blue: { surface: 'var(--color-state-info-surface)', ink: 'var(--color-state-info-fg)' },
  green: { surface: 'var(--color-state-success-surface)', ink: 'var(--color-state-success-fg)' },
  amber: { surface: 'var(--color-state-verify-surface)', ink: 'var(--color-state-verify-fg)' },
  red: { surface: 'var(--color-state-error-surface)', ink: 'var(--color-state-error-fg)' },
  violet: {
    surface: 'color-mix(in oklab, var(--color-accent) 22%, var(--color-surface))',
    ink: 'var(--color-fg)',
  },
  teal: {
    surface: 'color-mix(in oklab, var(--color-primary) 22%, var(--color-surface))',
    ink: 'var(--color-fg)',
  },
  slate: { surface: 'var(--color-surface-selected)', ink: 'var(--color-fg-soft)' },
};
const GLYPHS = ['bot', 'spark', 'bell', 'board', 'folder', 'chat', 'cal', 'doc', 'shield', 'sun'];
const ORDER = Object.keys(TINTS) as ActorTint[];

/** An agent's face when it has none of its own: from its id, the same everywhere. */
export function faceOf(id: string, face?: ActorFace | null): Required<ActorFace> {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return {
    glyph:
      face?.glyph && isCanvasIconName(face.glyph)
        ? face.glyph
        : (GLYPHS[hash % GLYPHS.length] ?? 'bot'),
    tint: face?.tint ?? ORDER[(hash >>> 4) % ORDER.length] ?? 'slate',
  };
}

/** A person's or a contact's initials: two letters at most, never a sign. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w.charAt(0)))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** The face of an actor, as R6 draws it everywhere. */
export function ActorAvatar({
  kind,
  id,
  name,
  face,
  size = 28,
}: {
  kind: ActorKind;
  id: string;
  name: string;
  face?: ActorFace | null;
  size?: number;
}) {
  const square = kind === 'agent' || kind === 'kete';
  const style: Record<string, string | number> = {
    width: size,
    height: size,
    borderRadius: square ? Math.round(size / 4.5) : '50%',
    fontSize: Math.round(size * 0.4),
  };
  if (kind === 'agent') {
    const { glyph, tint } = faceOf(id, face);
    const colours = TINTS[tint];
    return (
      <span
        aria-hidden="true"
        data-kind={kind}
        className="inline-grid flex-none place-items-center font-bold"
        style={{ ...style, background: colours.surface, color: colours.ink }}
      >
        {isCanvasIconName(glyph) && <CanvasIcon name={glyph} size={Math.round(size * 0.5)} />}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-kind={kind}
      className="inline-grid flex-none place-items-center bg-surface-selected font-bold text-fg data-[kind=contact]:bg-state-success-fg data-[kind=contact]:text-surface data-[kind=kete]:bg-agent data-[kind=kete]:text-on-agent"
      style={style}
    >
      {kind === 'kete' ? (
        <CanvasIcon name="spark" size={Math.round(size * 0.5)} />
      ) : (
        initialsOf(name) || '·'
      )}
    </span>
  );
}
