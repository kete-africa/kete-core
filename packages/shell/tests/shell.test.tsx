import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AppFrame,
  placesFor,
  SyncPill,
  type ManifestPlace,
  type ShellWords,
} from '../src/index.js';

// Spec 100: the frame every Kete product wears, built from the app's manifest.

const places: ManifestPlace[] = [
  { id: 'home', label: { fr: 'Accueil', en: 'Home' }, path: '/', icon: 'home' },
  {
    id: 'quotes',
    label: { fr: 'Devis', en: 'Quotes' },
    path: '/devis',
    icon: 'list',
    section: { fr: 'Ventes', en: 'Sales' },
  },
  {
    id: 'invoices',
    label: { fr: 'Factures', en: 'Invoices' },
    path: '/factures',
    icon: 'file',
    section: { fr: 'Ventes', en: 'Sales' },
    permission: 'sales:issue',
  },
  {
    id: 'treasury',
    label: { fr: 'Trésorerie', en: 'Treasury' },
    path: '/tresorerie',
    icon: 'chart',
    section: { fr: 'Trésorerie', en: 'Treasury' },
  },
];

const words: ShellWords = {
  nav: 'Navigation',
  showNav: 'Afficher le menu',
  hideNav: 'Masquer le menu',
  search: 'Demander ou chercher…',
  palette: 'Aller, chercher, demander',
  palettePlaceholder: 'Une page, un objet, une question',
  paletteEmpty: 'Rien ne correspond',
  palettePlaces: 'Places',
  paletteFound: 'Trouvé',
  paletteAsk: 'Kete Intelligence',
  paletteAskItem: (q) => `Demander : « ${q} »`,
  ask: 'Demander',
  files: 'Fichiers',
  note: 'Noter',
  bell: 'Notifications',
  tabs: 'Onglets',
  menu: 'Menu',
  noteTitle: 'Noter',
  noteField: 'Votre note',
  noteHint: '« jeudi » ou « demain » deviennent un rappel',
  noteSave: 'Noter',
  close: 'Fermer',
  theme: 'Apparence',
  themes: { dark: 'Sombre', light: 'Clair', auto: 'Automatique' },
  signOut: 'Se déconnecter',
  sync: { ok: 'À jour', offline: (n) => `Hors ligne · ${n} en attente`, sending: 'Envoi…' },
};

describe('the places of an app', () => {
  it('keeps the manifest’s order and headings, in her language', () => {
    const sections = placesFor(places, {
      lang: 'fr',
      can: () => true,
      base: 'https://finance.kete.africa/',
    });
    expect(sections.map((s) => s.label)).toEqual([undefined, 'Ventes', 'Trésorerie']);
    expect(sections[1]?.places.map((p) => p.label)).toEqual(['Devis', 'Factures']);
    expect(sections[0]?.places[0]?.href).toBe('https://finance.kete.africa/');
    expect(placesFor(places, { lang: 'en', can: () => true })[1]?.label).toBe('Sales');
  });

  it('shows a place behind a permission only to who holds it', () => {
    const without = placesFor(places, { lang: 'fr', can: (p) => p !== 'sales:issue' });
    expect(without.flatMap((s) => s.places).map((p) => p.id)).toEqual([
      'home',
      'quotes',
      'treasury',
    ]);
    // Without a way to check, a protected place stays hidden.
    expect(placesFor(places, { lang: 'fr' }).flatMap((s) => s.places)).toHaveLength(3);
  });
});

describe('the frame', () => {
  it('draws the sidebar, Ctrl K, « Demander », « Noter », the bell and the phone’s tabs', () => {
    const html = renderToStaticMarkup(
      <AppFrame
        brand="Kete Finance"
        sections={placesFor(places, { lang: 'fr', can: () => true })}
        current="quotes"
        counts={{ quotes: 5 }}
        person={{ name: 'Afi Mensah', detail: 'Direction' }}
        words={words}
        onAsk={() => undefined}
        onNote={async () => undefined}
        onFiles={() => undefined}
        sync={{ state: 'offline', pending: 2 }}
        bell={{ href: '/notifications', count: 2 }}
        tabs={['home', 'quotes', 'treasury']}
        signOutHref="/auth/sortie"
      >
        <h1>Devis</h1>
      </AppFrame>,
    );
    expect(html).toContain('aria-label="Navigation"');
    expect(html).toMatch(/aria-current="page"[^>]*>.*Devis/);
    expect(html).toContain('Ventes');
    expect(html).toContain('Demander ou chercher…');
    expect(html).toContain('aria-keyshortcuts="Control+J"');
    expect(html).toContain('aria-label="Noter"');
    expect(html).toContain('aria-label="Fichiers"');
    expect(html).toContain('Notifications (2)');
    expect(html).toContain('Hors ligne · 2 en attente');
    expect(html).toContain('aria-label="Onglets"');
    expect(html).toContain('>AM<');
    expect(html).toContain('<h1>Devis</h1>');
  });

  it('leaves out what the product does not offer', () => {
    const html = renderToStaticMarkup(
      <AppFrame
        brand="Kete"
        sections={placesFor(places, { lang: 'fr', can: () => true })}
        person={{ name: 'Yao' }}
        words={words}
      >
        <p>page</p>
      </AppFrame>,
    );
    expect(html).not.toContain('aria-keyshortcuts="Control+J"');
    expect(html).not.toContain('aria-label="Noter"');
    expect(html).not.toContain('aria-label="Onglets"');
  });

  it('says where the gestures stand', () => {
    expect(renderToStaticMarkup(<SyncPill sync={{ state: 'ok' }} words={words.sync} />)).toContain(
      'data-sync="ok"',
    );
    expect(
      renderToStaticMarkup(<SyncPill sync={{ state: 'sending' }} words={words.sync} />),
    ).toContain('Envoi…');
  });
});
