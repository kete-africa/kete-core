import { describe, expect, it } from 'vitest';
import { faceOf, initialsOf } from '../src/actor.js';

// Spec 149 (D-062, R6): one actor model — an agent without a face of its own gets one from its id,
// the same everywhere and every time; a person is her initials.

describe('an actor’s face', () => {
  it('is an agent’s own when it has one, else drawn from its id — always the same', () => {
    expect(faceOf('agt_1', { glyph: 'sun', tint: 'amber' })).toEqual({
      glyph: 'sun',
      tint: 'amber',
    });
    expect(faceOf('agt_relances')).toEqual(faceOf('agt_relances'));
    expect(faceOf('agt_relances')).not.toEqual(faceOf('agt_parc'));
    // A glyph that is not one of the design's icons falls back to one that is.
    expect(faceOf('agt_1', { glyph: 'unicorn' }).glyph).not.toBe('unicorn');
  });

  it('draws a person by two initials, never a sign', () => {
    expect(initialsOf('Abla Nyuiadzi Kpodar')).toBe('AN');
    expect(initialsOf('« Kossi »')).toBe('K');
    expect(initialsOf('élodie')).toBe('É');
  });
});
