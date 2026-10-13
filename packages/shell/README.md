# @kete/shell

The frame every Kete product wears — the center and every app — so that a person never learns two
(spec 100; doctrine D-042, D-045, D-050 to D-054). Its places come from the app's manifest; Ctrl K
goes, finds or asks; « Demander » opens the drawer beside the page; « Noter » works from every page;
the toolbar says whether the gestures reached the center; the phone has its tabs.

```mermaid
flowchart LR
  K[kete.json · manifest.v1 places] --> P[placesFor · her language, her permissions]
  P --> F[AppFrame]
  F --> N[the sidebar]
  F --> C[Ctrl K · places, what she may find, a question]
  F --> T[the phone's tabs · « Demander » in the middle]
  F --> B[Beside · the drawer, filled by @kete/intelligence]
  F --> O[« Noter » · N]
  F --> S[SyncPill · up to date, offline, sending]
```

## Use

```tsx
import { AppFrame, placesFor } from '@kete/shell';
import app from '../kete.json';

const sections = placesFor(app.places, { lang: 'fr', can: (p) => grants.includes(p) });

<AppFrame
  brand="Kete Finance"
  sections={sections}
  current="quotes"
  person={{ name: 'Afi Mensah', detail: 'Direction' }}
  words={words} // every word from the product's catalogs
  onAsk={(question) => openDrawer(question)}
  beside={{ open, label: 'Kete Intelligence', onClose, content: <Drawer /> }}
  onNote={(text) => keepNote({ data: { text } })}
  sync={{ state: 'ok' }}
  tabs={['home', 'quotes', 'treasury']}
>
  {page}
</AppFrame>;
```

- **Places**: `placesFor` keeps the manifest's order and headings; a place with a permission shows
  only when `can` says she holds it.
- **Keys**: Ctrl K opens the palette, Ctrl J asks, N notes (when she is not typing).
- **Words**: no word is written in the package; `ShellWords` lists them all.
- The parts it composes are `@kete/design`'s: `Shell`, `NavItem`, `CommandPalette`, `TabBar`.
