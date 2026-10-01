# Kete Core — project context

> The single place where this repository's context lives. `AGENTS.md` points here.

## What this repository is

The shared foundation of every Kete app: contracts, shared packages, the **Compte Kete** service
(identity, organizations, subscriptions, generic settings — Better Auth) with **Mon espace Kete**
(the customer's single center), and the app template.

## Read before any action

1. `.specify/memory/constitution.md` — the rules of this repository.
2. The Kete doctrine, repository `kete-africa/kete` (local: `../kete`), in this order:
   `docs/PRINCIPES.md`, `docs/CONCEPTION.md`, `docs/ARCHITECTURE.md`,
   `docs/ARCHITECTURE_APP.md`, `docs/FLUX.md`, `docs/DECISIONS.md`.
3. `docs/ROADMAP.md` — the phases of this repository and their proofs.
4. `docs/decisions/` — technical decisions of this repository.

The doctrine is written in French; everything in this repository is written in English.

## Planned layout

```
contracts/        versioned JSON Schema contracts (source of truth)
packages/         sdk · auth · identity · tenancy · records · commands · drafts ·
                  capabilities · views · admin · payments · notify · jobs · files · ai ·
                  feedback · design · testing · create-app (later: sequences · offline)
apps/account/     Compte Kete + Mon espace Kete
apps/docs/        the documentation site, built from this repository (decision 0006)
templates/app/    the template of a new Kete app (pnpm create @kete-africa/app)
tooling/          shared TypeScript, lint and code generation configuration
docs/             architecture, decisions, flows, generated references
specs/            Spec Kit features
```

## Branches

```
main       production — the human gesture only, through Pono's guards
dev        integration — green CI required before merging
NNN-slug   one Spec Kit feature, branched from dev
```

## Work lanes (doctrine D-034)

- The consolidation specs 020 to 030 are merged (`docs/ROADMAP.md`): the workshop (this
  repository), the apps (Firmo, `kete-africa/kete-cockpit`, …) and Kete Enterprise run in parallel,
  one owner each, consuming the published packages.
- Two sessions never share a working directory: a second one uses its own `git worktree`.
- A need that crosses lanes is an issue; only the author merges.

## Releases and documentation (decision 0006)

- A change to a published package carries a changeset: `pnpm changeset`.
- `pnpm docs:dev` reads the documentation site locally; `pnpm docs:build` builds it.
- Technical decisions follow MADR: `docs/decisions/template.md`.

## Forbidden to agents

- Pushing to `main` or `dev` directly, or bypassing a branch protection.
- Writing a vendor name in a domain or application layer.
- Creating a table without its RLS policy in the same migration.
- Writing a secret in a file, a message or a commit.
- Hard-coding a user-visible string.
- Shipping a behavior change without its documentation and diagram.

## Tooling

- Node 22 · pnpm · TypeScript strict
- Spec Kit `v0.16.0`, run through `uvx`, never from a global install. Procedures are available as
  the `speckit-*` skills.
