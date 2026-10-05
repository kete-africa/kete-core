import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AgentState,
  AppCard,
  AppGrid,
  Button,
  Chip,
  ChipGroup,
  CommandTrigger,
  ConfirmDialog,
  Dialog,
  EmptyState,
  KeteBand,
  KeteMark,
  Menu,
  NavItem,
  NavSection,
  PageSection,
  PageTitle,
  Panel,
  SearchField,
  Shell,
  Swatches,
  TabBar,
  TabBarItem,
  Tag,
  TextField,
  UndoNotice,
  VerificationCard,
} from '../src/index.js';

const noop = () => undefined;

// The colors of the `kete` design's palette: components never name them, only semantic tokens.
const BASE_COLOR =
  /\b(?:bg|text|border|outline|ring|fill|stroke|divide|shadow)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|rule-strong|success|verify|error|info|night)(?:-[a-z]+)*\b/;

const everyComponent = (
  <Shell
    brand="Atelier"
    navLabel="Navigation"
    showNavLabel="Afficher la navigation"
    hideNavLabel="Réduire le panneau"
    search={<CommandTrigger label="Demandez, cherchez ou agissez…" onOpen={noop} />}
    tabBar={
      <TabBar label="Onglets">
        <TabBarItem href="/" icon="home" current>
          Aujourd’hui
        </TabBarItem>
        <TabBarItem href="/a-faire" icon="check" count={8}>
          À faire
        </TabBarItem>
        <TabBarItem icon="sparkle" primary onClick={noop}>
          Demander
        </TabBarItem>
      </TabBar>
    }
    toolbar={<Menu label="Installer" icon="download" items={[{ label: 'Bureau', href: '#' }]} />}
    footer={
      <Swatches label="Couleurs de la charte" colors={[{ value: '#1ca18c', name: 'Vert' }]} />
    }
    nav={
      <>
        <NavSection>
          <NavItem icon="new" onClick={noop}>
            Nouvelle conversation
          </NavItem>
        </NavSection>
        <NavSection label="Conversations">
          <NavItem href="/c/1" current>
            Devis du jour
          </NavItem>
          <NavItem href="/a-faire" icon="check" count={8}>
            À faire
          </NavItem>
          <NavItem href="https://support.example.test" icon="apps" external>
            Support
          </NavItem>
        </NavSection>
      </>
    }
  >
    <PageTitle>Applications</PageTitle>
    <SearchField label="Rechercher" closeLabel="Fermer la recherche" onClose={noop} />
    <PageSection first>
      <AppGrid label="Applications">
        <AppCard featured name="Devis" description="Préparés par l'agent" onClick={noop} />
        <AppCard name="Stock" href="/apps/stock" />
      </AppGrid>
    </PageSection>
    <PageSection title="Explorer par catégorie">
      <ChipGroup label="Catégories">
        <Chip pressed>Finance</Chip>
        <Menu trigger="chip" label="2 autres" items={[{ label: 'Ventes', onSelect: noop }]} />
      </ChipGroup>
    </PageSection>
    <Dialog open={false} onClose={noop} title="Devis" closeLabel="Fermer">
      Préparés par l’agent.
    </Dialog>
    <Button>Valider</Button>
    <Button variant="secondary">Corriger</Button>
    <Tag tone="verify">À vérifier</Tag>
    <Tag tone="agent">Agent</Tag>
    <Tag>Brouillon</Tag>
    <TextField label="Prix" uncertain hint="Tarif habituel" />
    <TextField label="Téléphone" error="Il manque 2 chiffres" />
    <Panel title="Produits">x</Panel>
    <VerificationCard
      title="Devis pour Ama"
      state={{ name: 'prepared', label: 'Préparé' }}
      fields={[
        { label: 'Client', value: 'Ama', provenance: 'Tiré du message' },
        { label: 'Prix', value: '12 000', provenance: 'Incertain', uncertain: true },
      ]}
      actions={<Button>Valider</Button>}
    />
    <ConfirmDialog
      open={false}
      title="Envoyer les 4 relances ?"
      confirmLabel="Envoyer les 4 relances"
      cancelLabel="Annuler"
      onConfirm={noop}
      onCancel={noop}
    >
      Elles partent par WhatsApp.
    </ConfirmDialog>
    <UndoNotice undoLabel="Annuler" onUndo={noop} placement="bottom">
      Rappel envoyé à Kofi.
    </UndoNotice>
    <EmptyState title="Aucun devis" action={<Button>Nouveau devis</Button>} />
  </Shell>
);

describe('components', () => {
  it('use semantic tokens only, so they wear any design, mode and brand', () => {
    const html = renderToStaticMarkup(everyComponent);
    expect(html).not.toMatch(BASE_COLOR);
    expect(html).toContain('bg-action');
  });

  it('show what waits in a badge, and open another app in a new tab', () => {
    const html = renderToStaticMarkup(everyComponent);
    expect(html).toContain('>8</span>');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('aria-keyshortcuts="Control+K"');
  });

  it('keep the palette on semantic tokens too', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile(new URL('../src/command.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(BASE_COLOR);
  });

  it('render buttons as real buttons, never submitting by accident', () => {
    expect(renderToStaticMarkup(<Button>Valider</Button>)).toContain('<button type="button"');
  });

  it('give every state tag a word and a square marker', () => {
    const html = renderToStaticMarkup(<Tag tone="error">Refusé</Tag>);
    expect(html).toContain('Refusé');
    expect(html).toContain('bg-state-error');
  });

  it('associate a field with its label and its error', () => {
    const html = renderToStaticMarkup(
      <TextField label="Téléphone" error="Il manque 2 chiffres" defaultValue="+228 90" />,
    );
    const id = /<input id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`aria-describedby="${id}-error"`);
  });

  it('keep decorative marks out of the accessibility tree', () => {
    expect(renderToStaticMarkup(<KeteMark />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<KeteBand />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<Panel title="Produits">x</Panel>)).toContain('<h2');
  });

  it('name a dialog by its title and give it a named close button', () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} onClose={noop} title="Devis" closeLabel="Fermer">
        x
      </Dialog>,
    );
    expect(html).toMatch(/<dialog aria-labelledby="([^"]+)"[\s\S]*<h2 id="\1"/);
    expect(html).toContain('aria-label="Fermer"');
    expect(html).toContain('rounded-overlay');
  });
});

describe('the doctrine’s components', () => {
  it('show where every value of a draft comes from, and what is uncertain', () => {
    const html = renderToStaticMarkup(
      <VerificationCard
        title="Devis pour Ama"
        state={{ name: 'prepared', label: 'Préparé' }}
        fields={[
          { label: 'Client', value: 'Ama', provenance: 'Tiré du message' },
          { label: 'Prix', value: '12 000', provenance: 'Incertain', uncertain: true },
        ]}
        decision="Validé par Kofi à 10 h 42"
      />,
    );
    expect(html).toContain('<dl');
    expect(html).toContain('Tiré du message');
    expect(html).toContain('bg-state-verify-surface');
    expect(html).toContain('Validé par Kofi à 10 h 42');
    expect(html).toMatch(/<section aria-labelledby="([^"]+)"[\s\S]*<h2 id="\1"/);
  });

  it('draw a prepared draft with an empty square, a decided one with a filled square', () => {
    const prepared = renderToStaticMarkup(<AgentState state="prepared">Préparé</AgentState>);
    const verified = renderToStaticMarkup(<AgentState state="verified">Vérifié</AgentState>);
    expect(prepared).toContain('border-2');
    expect(verified).toContain('bg-state-success');
    expect(verified).toContain('data-agent-state="verified"');
  });

  it('ask a confirmation in a named modal dialog, and announce what can be undone', () => {
    const dialog = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        title="Supprimer le devis ?"
        confirmLabel="Supprimer"
        cancelLabel="Garder"
        onConfirm={noop}
        onCancel={noop}
      >
        Il ne pourra pas être retrouvé.
      </ConfirmDialog>,
    );
    expect(dialog).toMatch(/<dialog aria-labelledby="([^"]+)"[\s\S]*<h2 id="\1"/);
    expect(dialog).toContain('Garder');
    const notice = renderToStaticMarkup(
      <UndoNotice undoLabel="Annuler" onUndo={noop} placement="bottom">
        Rappel envoyé.
      </UndoNotice>,
    );
    expect(notice).toContain('role="status"');
    expect(notice).toContain('border-notice-line');
    expect(notice).toContain('fixed bottom-6');
  });
});

describe('the workspace frame', () => {
  const html = renderToStaticMarkup(everyComponent);

  it('names its navigation, marks the current page, and hides its sidebar on small screens', () => {
    expect(html).toContain('<nav aria-label="Navigation"');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('aria-label="Afficher la navigation"');
    expect(html).toContain('aria-label="Réduire le panneau"');
    expect(html).toContain('w-[262px]');
    expect(html).toContain('max-[760px]:invisible');
  });

  it('opens its menus from a button that says so, and labels its search and filters', () => {
    expect(html).toMatch(/aria-expanded="false" aria-controls="([^"]+)"[\s\S]*id="\1" hidden=""/);
    expect(html).toContain('type="search" aria-label="Rechercher"');
    expect(html).toContain('role="group" aria-label="Catégories"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('role="group" aria-label="Couleurs de la charte"');
  });

  it('lays out a featured app over two rows, beside 66 px cards', () => {
    expect(html).toContain('grid-cols-[250px_repeat(4,minmax(0,1fr))]');
    expect(html).toContain('row-span-2');
    expect(html).toContain('min-h-[66px]');
  });
});
