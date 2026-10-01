---
version: alpha
name: Kete Workspace
description: The design of Kete Enterprise, taken from the copilot-demo workspace — dark first, dense and quiet; a sidebar to start and find, cards for the company's apps, pills to filter; the client's colors for the accent.
colors:
  primary: '#1CA18C'
  primary-strong: '#177969'
  primary-deep: '#125F52'
  primary-light-mode: '#15897A'
  orange: '#F99D32'
  orange-light-mode: '#B35F00'
  yellow: '#E8E748'
  coffee: '#875028'
  white: '#FFFFFF'
  gray-130: '#DEDEDE'
  gray-270: '#BBBBBB'
  gray-380: '#9D9D9D'
  gray-400: '#999999'
  gray-670: '#555555'
  gray-710: '#494949'
  gray-740: '#424242'
  gray-800: '#343434'
  gray-810: '#303030'
  gray-850: '#282828'
  gray-870: '#242424'
  light-canvas: '#F7F7F6'
  light-hover: '#ECECEA'
  light-selected: '#E2E2DF'
  light-text: '#1F1F1F'
  light-text-soft: '#4A4A48'
  light-text-muted: '#5F5F5B'
  light-line: '#DCDCD8'
  light-line-strong: '#8A8A85'
  light-line-control: '#C9C9C4'
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
  dark-success: '#4FA873'
  dark-success-ink: '#A6DDBA'
  dark-success-surface: '#1C3025'
  dark-verify: '#D9A04A'
  dark-verify-ink: '#F2CC8A'
  dark-verify-surface: '#3A2A12'
  dark-error: '#D0546F'
  dark-error-ink: '#F4B0BF'
  dark-error-surface: '#3E1620'
  dark-info: '#5C8FC2'
  dark-info-ink: '#AFCDEB'
  dark-info-surface: '#172A3D'
typography:
  display:
    fontFamily: Segoe UI
    fontSize: 40px
    fontWeight: 650
    lineHeight: 48px
  headline:
    fontFamily: Segoe UI
    fontSize: 34px
    fontWeight: 650
    lineHeight: 42px
  title:
    fontFamily: Segoe UI
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
  label-caps:
    fontFamily: Segoe UI
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: Segoe UI
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.4
  body-sm:
    fontFamily: Segoe UI
    fontSize: 12px
    fontWeight: 400
    lineHeight: 17px
  number:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    fontFeature: "'tnum' 1"
rounded:
  control: 5px
  box: 5px
  menu: 7px
  overlay: 10px
  pill: 24px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '6': 24px
  '8': 32px
  '12': 48px
components:
  page:
    backgroundColor: '{colors.gray-850}'
    textColor: '{colors.gray-130}'
    typography: '{typography.body}'
  sidebar:
    backgroundColor: '{colors.gray-870}'
    textColor: '{colors.gray-130}'
    width: 262px
    padding: 14px 16px
  sidebar-border:
    backgroundColor: '{colors.gray-710}'
    width: 1px
  sidebar-brand:
    textColor: '{colors.gray-130}'
    typography: '{typography.title}'
    height: 34px
  nav-item:
    backgroundColor: '{colors.gray-870}'
    textColor: '{colors.gray-130}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    height: 34px
  nav-item-hover:
    backgroundColor: '{colors.gray-800}'
    textColor: '{colors.gray-130}'
  nav-label:
    backgroundColor: '{colors.gray-870}'
    textColor: '{colors.gray-400}'
    typography: '{typography.label-caps}'
  icon-button:
    textColor: '{colors.gray-130}'
    rounded: '{rounded.control}'
    size: 29px
  page-title:
    textColor: '{colors.gray-130}'
    typography: '{typography.headline}'
  section-title:
    textColor: '{colors.gray-130}'
    typography: '{typography.title}'
  app-card:
    backgroundColor: '{colors.gray-870}'
    textColor: '{colors.gray-130}'
    typography: '{typography.body}'
    rounded: '{rounded.box}'
    padding: 16px 22px
    height: 66px
  app-card-hover:
    backgroundColor: '{colors.gray-810}'
    textColor: '{colors.gray-130}'
  app-card-border:
    backgroundColor: '{colors.gray-710}'
    width: 1px
  app-card-hover-border:
    backgroundColor: '{colors.primary}'
    width: 1px
  app-card-description:
    backgroundColor: '{colors.gray-870}'
    textColor: '{colors.gray-130}'
    typography: '{typography.body-sm}'
  chip:
    backgroundColor: '{colors.gray-850}'
    textColor: '{colors.gray-130}'
    typography: '{typography.body}'
    rounded: '{rounded.pill}'
    height: 43px
    padding: 0 17px
  chip-border:
    backgroundColor: '{colors.gray-740}'
    width: 1px
  chip-selected:
    backgroundColor: '{colors.gray-740}'
    textColor: '{colors.gray-130}'
    rounded: '{rounded.pill}'
  chip-selected-border:
    backgroundColor: '{colors.gray-380}'
    width: 2px
  button-primary:
    backgroundColor: '{colors.primary-strong}'
    textColor: '{colors.white}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    padding: 10px 16px
  button-primary-hover:
    backgroundColor: '{colors.primary-deep}'
    textColor: '{colors.white}'
  button-secondary:
    backgroundColor: '{colors.gray-850}'
    textColor: '{colors.gray-130}'
    typography: '{typography.body}'
    rounded: '{rounded.control}'
    height: 33px
    padding: 0 12px
  search-field:
    backgroundColor: '{colors.gray-850}'
    textColor: '{colors.gray-130}'
    rounded: '{rounded.control}'
    padding: 8px 12px
  search-field-border:
    backgroundColor: '{colors.primary}'
    width: 1px
  menu:
    backgroundColor: '{colors.gray-810}'
    textColor: '{colors.gray-130}'
    rounded: '{rounded.menu}'
    padding: 6px
  menu-border:
    backgroundColor: '{colors.gray-670}'
    width: 1px
  menu-item-hover:
    backgroundColor: '{colors.gray-740}'
    textColor: '{colors.gray-130}'
  dialog:
    backgroundColor: '{colors.gray-870}'
    textColor: '{colors.gray-130}'
    rounded: '{rounded.overlay}'
    padding: 32px
  dialog-body:
    backgroundColor: '{colors.gray-870}'
    textColor: '{colors.gray-270}'
  toast:
    backgroundColor: '{colors.gray-800}'
    textColor: '{colors.gray-130}'
    rounded: '{rounded.overlay}'
    padding: 12px 20px
  toast-border:
    backgroundColor: '{colors.primary}'
    width: 1px
  focus-ring:
    backgroundColor: '{colors.orange}'
    width: 2px
  link:
    backgroundColor: '{colors.gray-850}'
    textColor: '{colors.gray-130}'
  caption:
    backgroundColor: '{colors.gray-850}'
    textColor: '{colors.gray-400}'
    typography: '{typography.body-sm}'
  tag-agent:
    backgroundColor: '{colors.gray-130}'
    textColor: '{colors.gray-870}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
  tag-verify:
    backgroundColor: '{colors.dark-verify-surface}'
    textColor: '{colors.dark-verify-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
  tag-validated:
    backgroundColor: '{colors.dark-success-surface}'
    textColor: '{colors.dark-success-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
  tag-error:
    backgroundColor: '{colors.dark-error-surface}'
    textColor: '{colors.dark-error-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
  tag-info:
    backgroundColor: '{colors.dark-info-surface}'
    textColor: '{colors.dark-info-ink}'
    typography: '{typography.body-sm}'
    rounded: '{rounded.control}'
  marker-success:
    backgroundColor: '{colors.dark-success}'
    size: 8px
  marker-verify:
    backgroundColor: '{colors.dark-verify}'
    size: 8px
  marker-error:
    backgroundColor: '{colors.dark-error}'
    size: 8px
  marker-info:
    backgroundColor: '{colors.dark-info}'
    size: 8px
  swatch-primary:
    backgroundColor: '{colors.primary}'
    size: 10px
  swatch-orange:
    backgroundColor: '{colors.orange}'
    size: 10px
  swatch-white:
    backgroundColor: '{colors.white}'
    size: 10px
  swatch-yellow:
    backgroundColor: '{colors.yellow}'
    size: 10px
  swatch-coffee:
    backgroundColor: '{colors.coffee}'
    size: 10px
  light-page:
    backgroundColor: '{colors.light-canvas}'
    textColor: '{colors.light-text}'
  light-card:
    backgroundColor: '{colors.white}'
    textColor: '{colors.light-text}'
    rounded: '{rounded.box}'
  light-card-hover:
    backgroundColor: '{colors.light-hover}'
    textColor: '{colors.light-text}'
  light-chip-selected:
    backgroundColor: '{colors.light-selected}'
    textColor: '{colors.light-text}'
  light-caption:
    backgroundColor: '{colors.white}'
    textColor: '{colors.light-text-muted}'
  light-dialog-body:
    backgroundColor: '{colors.white}'
    textColor: '{colors.light-text-soft}'
  light-card-border:
    backgroundColor: '{colors.light-line}'
    width: 1px
  light-field-border:
    backgroundColor: '{colors.light-line-strong}'
    width: 1px
  light-chip-border:
    backgroundColor: '{colors.light-line-control}'
    width: 1px
  light-accent:
    backgroundColor: '{colors.primary-light-mode}'
    width: 1px
  light-focus-ring:
    backgroundColor: '{colors.orange-light-mode}'
    width: 2px
  light-tag-verify:
    backgroundColor: '{colors.verify-surface}'
    textColor: '{colors.verify-ink}'
  light-tag-validated:
    backgroundColor: '{colors.success-surface}'
    textColor: '{colors.success-ink}'
  light-tag-error:
    backgroundColor: '{colors.error-surface}'
    textColor: '{colors.error-ink}'
  light-tag-info:
    backgroundColor: '{colors.info-surface}'
    textColor: '{colors.info-ink}'
  light-marker-success:
    backgroundColor: '{colors.success}'
    size: 8px
  light-marker-verify:
    backgroundColor: '{colors.verify}'
    size: 8px
  light-marker-error:
    backgroundColor: '{colors.error}'
    size: 8px
  light-marker-info:
    backgroundColor: '{colors.info}'
    size: 8px
---

# Kete Workspace

## Overview

The design of Kete Enterprise (doctrine D-035), taken from the `copilot-demo` workspace the author
chose: the place where the people of a company and their agents work, all day. **Dark first**,
dense and quiet: charcoal surfaces one step apart, light gray text, 1 px lines. A **sidebar** to
start a conversation, search, reach the library, teach the company a know-how, find assistants and
agents, and return to recent conversations; a **main area** with a page title, the company's apps
as cards, and pills to explore them by category.

It keeps the demo's system — its values, its sizes, its behavior — and nothing of another brand: no
third-party name, logo, app icon or licensed font file.

## Colors

- **Charcoals** carry the page: `gray-850` (#282828) for the page and controls, `gray-870`
  (#242424) for the sidebar, cards and dialogs, `gray-810` for menus and a card under the pointer,
  `gray-800` for a navigation item under the pointer and notifications, `gray-740` for a pressed
  filter.
- **Lines**: `gray-710` (#494949) for cards and the sidebar, `gray-740` for buttons and filters,
  `gray-670` for menus, dialogs and fields, `gray-380` (2 px) for the pressed filter.
- **Text**: `gray-130` (#DEDEDE), `gray-270` for a dialog's body, `gray-400` (#999) for labels and
  captions. Links are text, underlined.
- **The client's colors** (the demo's charter: green, orange, white, yellow, coffee). **Green**
  (`primary`, #1CA18C) guides without words: a card or filter under the pointer, the search field,
  a notification's border. The primary button uses its darker green (`primary-strong`, #177969),
  because white text on #1CA18C reads at 3.2:1 only; `primary-deep` is its hover. **Orange** is the
  focus ring. A client brand replaces these (`defineBrand`).
- **States** keep the doctrine's meaning everywhere in Kete (success, verify, error, info), in deep
  surfaces with light inks.
- **Light mode**, which the demo did not draw, keeps the same structure on light grays; the green
  and the orange darken to read on them.

## Typography

- **Segoe UI** where the system has it, else **Inter** (free, self-hosted): the font file of Segoe
  UI is licensed and never shipped. 14 px body.
- Page title 34/42 px, weight 650; section titles 20/28 px, weight 600; cards and buttons 14 px,
  weight 600; labels and descriptions 12 px.
- JetBrains Mono, tabular, for amounts.

## Layout

- **Sidebar 262 px** (230 px under 1,100 px), padding 14 × 16 px, a 1 px line on its right; its
  header 34 px high with the name (20 px, 600) and icon buttons (29 px); sections labeled 12 px,
  25 px above and 10 px below; items 34 px high, icon 20 px, 10 px gap; the client's colors at the
  bottom.
- **Main area**: a 54 px toolbar with its actions on the right; content up to 1,050 px; the page
  title 51 px above the first block; sections 50 px apart.
- **Apps**: a featured card over two rows (250 px) beside four columns of 66 px cards; gaps 12 × 10
  px.
- Under 760 px the sidebar becomes a panel opened from the toolbar; on a wide screen it can be
  collapsed. A target is at least 44 px on a touch screen.

## Elevation & Depth

Flat: surfaces one step apart and 1 px lines. Menus float with a shadow (0 8 px 24 px, black at
33 %); dialogs over a page darkened at 60 %.

## Shapes

- 5 px for buttons, fields, navigation items and cards; 7 px for menus; 10 px for dialogs and
  notifications.
- **Pills** (24 px) for filters only.

## Components

- **Navigation item**: under the pointer, a lighter surface and the label slides 5 px right.
- **App card**: icon, name (600); featured with a description (12/17 px); under the pointer, a
  lighter surface and a green line.
- **Filter pill**: 43 px, 1 px line; pressed, a 2 px light line on a lighter surface, weight 600.
- **Buttons**: primary green with white text; secondary outlined, 33 px, weight 600, with a chevron
  when it opens a menu.
- **Search field**: a green 1 px line, a search icon, a close button.
- **Menu**: 220 px at least, 6 px padding, items 12 px padding.
- **Dialog**: 440 px at most, 32 px padding, a close button in its corner.
- **Notification**: bottom center, a green line.
- **The doctrine's components** (verification card, agent states, confirmation, notification with
  undo, empty page) keep their meaning and rules, drawn in these tokens.

## Do's and Don'ts

- Do keep the surfaces dark and one step apart; let green guide and orange show the focus.
- Do check both modes at 375 px and at 1,440 px; respect reduced motion (transitions 150 ms).
- Do show where every agent-filled value comes from, as everywhere in Kete.
- Don't put white text on the light green: use the primary button's darker green.
- Don't copy a third-party product: no name, logo, app icon or licensed font file.
- Don't hard-code a user-visible string: every text goes through the translation catalogs.
