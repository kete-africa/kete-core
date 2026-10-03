# Spec 048 — The app factory

## Why

« Each one can launch an app that integrates fully. » Until now an app was created by hand: its
repository, its database, its sign-in, its hosting, its registration. The factory does it from an
approved request, and an agent codes the first version in a sandbox; a person reviews it.

## What it is

- **`apps/factory`**: a service of its own, holding the keys no other service holds (a GitHub App
  installed on the organization, a hosting token reserved to it, the databases' key, its Compte
  Kete client). Kete Enterprise calls it, signed with a shared key (`kete-signature`); it reports
  each milestone back, signed (`prd_kete_factory`).
- **The Compte Kete** registers the apps it creates at `POST /api/apps/clients`: only for the
  factory's own client (`client_credentials`, scope `kete:factory`, granted by an operator with
  `pnpm clients create --factory`), as the operator named in `KETE_FACTORY_OPERATOR`, on an https
  callback of the hosts in `KETE_FACTORY_HOSTS`.
- **The coding agent**: Codex (with the author's ChatGPT subscription, or an API key) or Claude Code
  (an API key), in a sandbox (`@kete/sandbox`, spec 047), on a branch `factory/first-version`.

See [apps/factory/README.md](../../apps/factory/README.md) for the sequence.

## Requirements

- **FR-001**: a request is recorded once (its id); each step is done once and resumes after a
  failure; the status is `queued`, `building`, `ready`, `coding`, `review` or `failed`.
- **FR-002**: no secret is kept by the factory nor written in a command line; the app's secrets go
  to its hosting.
- **FR-003**: the repository is private, created from the template; the first version arrives as
  a pull request to `dev`; nothing is merged by the factory.
- **FR-004**: the Compte Kete refuses a registration from any other client, on another host, on a
  plain http callback, or when the factory is not configured.
