# Feature Specification: An app's identity card in its manifest

**Feature Branch**: `035-manifest-governance`
**Created**: 2026-10-01
**Status**: Delivered
**Input**: Doctrine D-040 (govern once, run anywhere: governance lives in the contract and the
registry; the app's identity card lets a registry deduce the controls that apply).

## Why

An inventory of apps is only useful if each app says who answers for it, what data it handles,
whether it uses AI and what an outage costs. AI will multiply apps (D-028); an app without an owner
is the first thing a registry must catch. The card belongs to the contract every Kete App already
serves (`GET /.well-known/kete`), so kete-core carries it; what a registry does with it lives in
Kete Cockpit and `kete-enterprise`.

## User Scenarios & Testing

### User Story 1 — The card travels in the manifest (P1)

1. **Given** a manifest with `governance` (owner, data categories, AI use, criticality), **Then** it
   validates; **given** a manifest without it, **Then** it still validates (additive within v1).
2. **Given** a card without an owner, with an empty owner name, a malformed contact, no data
   category, `none` mixed with another category, an unknown category, an AI use without `used`, or
   an unknown criticality, **Then** it is refused.

### User Story 2 — Governed from the first commit (P1)

1. **Given** `pnpm create @kete-africa/app nettio --owner="Software team"`, **Then** the new app's
   `kete.json` names that owner; without `--owner`, or with a blank one, the app is not created.
2. **Given** the template and the Compte Kete, **Then** both serve their card at
   `/.well-known/kete`.

## Requirements

- **FR-001**: `manifest.v1` gains the optional `governance` object: `owner` (`name`, optional
  `contact` e-mail), `dataCategories` (`none`, `personal`, `special`, `children`, `financial`,
  `payment`, `location`, `credentials`, `confidential`; `none` alone), `ai` (`used`, optional
  `purpose`), `criticality` (`low`, `medium`, `high`, `critical`). Types regenerated.
- **FR-002**: the template's `kete.json` carries a card served by its manifest; `createApp` and its
  CLI require an owner.
- **FR-003**: the Compte Kete declares its card.

## Out of scope

- Showing the card in Kete Cockpit's registry and flagging apps without one: the Cockpit's lane.
- Deducing controls from the card: `kete-enterprise` (D-040).

## Success Criteria

- **SC-001**: `packages/sdk` contract tests accept a complete card and refuse each incomplete one.
- **SC-002**: `packages/create-app` tests: the owner is written; a blank owner is refused.
