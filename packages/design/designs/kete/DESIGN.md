---
version: alpha
name: Kete
description: Warm rigor for Kete apps — living roots inside a rectangular structure. Design system v1 "rectangle".
colors:
  primary: '#B83A1B'
  primary-strong: '#962E14'
  ember: '#E2572D'
  ochre: '#C98A2B'
  root: '#5A1E12'
  ink: '#2A1610'
  bark: '#6B4E43'
  clay: '#F4E6DA'
  sand: '#FBF6F0'
  paper: '#FFFDF9'
  rule: '#D9C4B4'
  rule-strong: '#B9A294'
  success: '#2F7D4F'
  success-ink: '#1F5C38'
  success-surface: '#E3F1E8'
  verify: '#C98A2B'
  verify-ink: '#7A4A0B'
  verify-surface: '#FBEBD0'
  error: '#9B1C3C'
  error-ink: '#7D1330'
  error-surface: '#F7E1E7'
  info: '#2B5C8A'
  info-ink: '#1E4466'
  info-surface: '#E2ECF5'
  night: '#17100C'
  night-surface: '#221813'
  night-rule: '#4A382E'
  night-text: '#F4E6DA'
  night-text-muted: '#BFA799'
  night-link: '#F08A63'
  night-surface-quiet: '#2C2019'
  night-rule-strong: '#7A6356'
  night-success: '#4FA873'
  night-success-ink: '#A6DDBA'
  night-success-surface: '#1C3025'
  night-verify: '#D9A04A'
  night-verify-ink: '#F2CC8A'
  night-verify-surface: '#3A2A12'
  night-error: '#D0546F'
  night-error-ink: '#F4B0BF'
  night-error-surface: '#3E1620'
  night-info: '#5C8FC2'
  night-info-ink: '#AFCDEB'
  night-info-surface: '#172A3D'
typography:
  display:
    fontFamily: Archivo
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: -0.015em
    fontVariation: "'wdth' 118"
  headline:
    fontFamily: Archivo
    fontSize: 36px
    fontWeight: 600
    lineHeight: 1.1
    fontVariation: "'wdth' 118"
  title:
    fontFamily: Archivo
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.25
    fontVariation: "'wdth' 118"
  label-caps:
    fontFamily: Archivo
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.12em
    fontVariation: "'wdth' 118"
  body:
    fontFamily: Instrument Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.55
  body-lg:
    fontFamily: Instrument Sans
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: Instrument Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  number:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
rounded:
  none: 0px
  control: 2px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '6': 24px
  '8': 32px
  '12': 48px
  '20': 80px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.sand}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    height: 48px
    padding: 0 24px
  button-secondary:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    height: 48px
    padding: 0 24px
  field:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    height: 46px
    padding: 0 14px
  field-uncertain:
    backgroundColor: '{colors.verify-surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.control}'
  tag-agent:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.sand}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  tag-verify:
    backgroundColor: '{colors.verify-surface}'
    textColor: '{colors.verify-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  tag-validated:
    backgroundColor: '{colors.success-surface}'
    textColor: '{colors.success-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  tag-error:
    backgroundColor: '{colors.error-surface}'
    textColor: '{colors.error-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  tag-info:
    backgroundColor: '{colors.info-surface}'
    textColor: '{colors.info-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  panel:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.none}'
    padding: 24px
  page:
    backgroundColor: '{colors.sand}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
  night-page:
    backgroundColor: '{colors.night}'
    textColor: '{colors.night-text}'
    typography: '{typography.body}'
  night-panel:
    backgroundColor: '{colors.night-surface}'
    textColor: '{colors.night-text}'
    rounded: '{rounded.none}'
  night-caption:
    textColor: '{colors.night-text-muted}'
    typography: '{typography.body-sm}'
  night-link:
    textColor: '{colors.night-link}'
  night-section-quiet:
    backgroundColor: '{colors.night-surface-quiet}'
    textColor: '{colors.night-text}'
  night-field-border:
    backgroundColor: '{colors.night-rule-strong}'
    height: 1px
  night-tag-verify:
    backgroundColor: '{colors.night-verify-surface}'
    textColor: '{colors.night-verify-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  night-tag-validated:
    backgroundColor: '{colors.night-success-surface}'
    textColor: '{colors.night-success-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  night-tag-error:
    backgroundColor: '{colors.night-error-surface}'
    textColor: '{colors.night-error-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  night-tag-info:
    backgroundColor: '{colors.night-info-surface}'
    textColor: '{colors.night-info-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
    padding: 4px 10px
  night-marker-success:
    backgroundColor: '{colors.night-success}'
    size: 8px
  night-marker-verify:
    backgroundColor: '{colors.night-verify}'
    size: 8px
  night-marker-error:
    backgroundColor: '{colors.night-error}'
    size: 8px
  night-marker-info:
    backgroundColor: '{colors.night-info}'
    size: 8px
  night-divider:
    backgroundColor: '{colors.night-rule}'
    height: 1px
  link:
    textColor: '{colors.primary}'
  link-hover:
    textColor: '{colors.primary-strong}'
  caption:
    textColor: '{colors.bark}'
    typography: '{typography.body-sm}'
  section-quiet:
    backgroundColor: '{colors.clay}'
    textColor: '{colors.ink}'
  divider:
    backgroundColor: '{colors.rule}'
    height: 1px
  field-border:
    backgroundColor: '{colors.rule-strong}'
    height: 1px
  marker-success:
    backgroundColor: '{colors.success}'
    size: 8px
  marker-verify:
    backgroundColor: '{colors.verify}'
    size: 8px
  marker-error:
    backgroundColor: '{colors.error}'
    size: 8px
  marker-info:
    backgroundColor: '{colors.info}'
    size: 8px
  band-laterite:
    backgroundColor: '{colors.primary}'
  band-ochre:
    backgroundColor: '{colors.ochre}'
  band-earth:
    backgroundColor: '{colors.ink}'
  band-root:
    backgroundColor: '{colors.root}'
  band-ember:
    backgroundColor: '{colors.ember}'
---

# Kete

## Overview

Kete builds tools of tomorrow for everyday businesses, from the market stall to the head office.
The visual language is **warm rigor**: the warmth of red earth (laterite) and of hand-woven kete
cloth, held in a precise rectangular structure. The logo — a K whose leg becomes a root — says the
same thing: something living, anchored in a solid frame.

Screens are **purpose-built for each trade**, never generated. They are calm so that content,
numbers and decisions stand out. The brand red is rare and strong. Every screen works on a
low-end phone, in sunlight, on a weak network.

Voice: simple, true, warm. "Your quote is ready", not "The document was generated successfully".

## Colors

- **Laterite (`primary`)** is the brand: primary buttons, links, the logo. About 10% of a surface
  at most, so it keeps its strength.
- **Earth (`ink`)** for text, **bark** for secondary text, **sand** for pages, **paper** for
  panels, **clay** for quiet sections, **rule** for 1 px separators.
- **Ember** and **root** are illustration and band colors; ember is never used for text.
- **States** each have an ink (text), a surface (background) and a base color: success, verify
  ("to be checked", ochre), error (**wine**), info (indigo).
- **Night** tokens form the dark theme: the primary button keeps laterite; states use lighter inks
  on deep surfaces so they stay readable.
- The brand is red, so **an error is never shown in laterite**: always wine, with an icon and a
  word. A negative amount or a debt is never shown in laterite either ("being in the red").

## Typography

- **Archivo, expanded (`'wdth' 118`)** for display, headlines, titles and small caps labels: an
  engineered, architectural voice.
- **Instrument Sans** for body text and controls.
- **JetBrains Mono** with tabular figures for every number, aligned right, so amounts compare at a
  glance.
- Sentence case everywhere; small section labels in spaced capitals (`label-caps`).

## Layout

- A **12-column grid**, 16 px gutters in apps and 24 px on the site; mobile first.
- Spacing steps: 4, 8, 12, 16, 24, 32, 48, 80 px.
- Touch targets are **at least 44 px** high.
- Every screen has its states: loading, empty, error, restricted, available.

## Elevation & Depth

Flat. Depth comes from **1 px rules**, surface changes (sand, paper, clay) and the kete band — never
from shadows or blur. Dialogs sit on a dimmed page with a 1 px ink border.

## Shapes

- **Rectangles**: radius 0 for sections, panels and cards; 2 px for buttons, fields and tags. The
  app icon alone uses a rounded square.
- **The kete band**: a strip of rectangular blocks (laterite, ochre, earth, root, ember). Thin (6 to
  10 px) at the top of a page or an important card, wide on print and covers. Never behind text.
- **Roots** (organic lines) for the logo, separators, loading (roots grow) and empty states (a
  seed) — the living contrast to the rectangular frame.
- State tags carry a small **square marker** of their color, so they read without color.

## Components

- **Buttons**: primary (laterite fill, sand text), secondary (paper, 1 px ink border), text link
  with an arrow. The label says exactly what happens, with the count when there is one ("Send the
  4 reminders").
- **Fields**: label above, 1 px border, 2 px radius. A field filled by the agent and not yet
  certain uses the `field-uncertain` surface and says where the value came from.
- **Tags**: agent (ink), to be checked (ochre), validated (green), error (wine), info (indigo).
- **Panels**: paper, 1 px rule, no radius, 24 px padding; a label-caps title.
- **Agent states**: prepared (empty square), corrected, verified, refused (filled square: decided by
  a human).
- **Verification card** (signature component): a draft prepared by the agent, each field with its
  provenance ("from the message", "uncertain", "usual price"), with Correct and Validate; the
  validation is traced.
- **Confirmation** for irreversible actions; **notification with Undo** for reversible ones.

## Do's and Don'ts

- Do keep laterite rare; do use wine, an icon and a word for errors.
- Do align numbers right in JetBrains Mono.
- Do show where every agent-filled value comes from.
- Do design each screen for its trade and test it at 375 px wide.
- Don't use shadows, gradients, blur or rounded cards.
- Don't show a negative amount or a debt in the brand red.
- Don't place the kete band or roots behind text.
- Don't hard-code a user-visible string: every text goes through the translation catalogs.
