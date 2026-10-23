# Spec 149 — One actor model

Doctrine D-062 (R6): person, agent, Kete, contact — name, face, shape, provenance — drawn alike
everywhere: an agent and Kete a rounded square, a person and a contact a circle. Until now each
screen drew its own: the threads a square with a robot for every agent, the agents' screens their
own tile.

## Requirements

- **FR-001 — A contract.** `actor.v1`: kind (`person`, `agent`, `kete`, `contact`), id, name, an
  agent's face (glyph, tint), where a contact speaks from.
- **FR-002 — One face.** `@kete/design`'s `ActorAvatar`: a person and a contact a circle with two
  initials, never a sign; Kete a square with its spark; an agent a square with its glyph and tint —
  its own, or one drawn from its id (`faceOf`), the same everywhere and every time.
- **FR-003 — The threads draw it.** `@kete/conversation` draws every author with `ActorAvatar`: Kete
  as Kete, each agent with its face.

## Proof

`@kete/design` tests: an agent's own face kept, else drawn from its id, stable, different from
another's, an unknown glyph falling back; initials. Contract tests: the four kinds, a face, a
contact's channel; an unknown kind or tint refused.

Kete Enterprise (its spec 107) gives agents their faces from the catalogue and draws them on its
screens; its attention and an object's life follow there.
