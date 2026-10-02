import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ChatMessage,
  ChatThread,
  CommandBar,
  Composer,
  DataTable,
  DetailPane,
  Drawer,
  Facts,
  KpiGrid,
  KpiTile,
  Markdown,
  OrgChart,
  PageHeader,
  Row,
  RowList,
  SplitView,
  Suggestions,
  Tabs,
  ToolCard,
  ViewSwitcher,
} from '../src/index.js';

const noop = () => undefined;

// The colors of the `kete` design's palette: components never name them, only semantic tokens.
const BASE_COLOR =
  /\b(?:bg|text|border|outline|ring|fill|stroke|divide|shadow)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|rule-strong|success|verify|error|info|night)(?:-[a-z]+)*\b/;

const listPage = (
  <>
    <PageHeader
      breadcrumbLabel="Fil d'Ariane"
      breadcrumbs={[
        { label: 'Administration', href: '/administration' },
        { label: 'Organisation' },
      ]}
      title="Organisation"
      description="36 unités, 50 postes"
      actions={<button type="button">Nouvelle unité</button>}
    />
    <Tabs
      label="Facettes"
      current="chart"
      items={[
        { key: 'chart', label: 'Unités', href: '?onglet=unites', count: 36 },
        { key: 'positions', label: 'Postes', href: '?onglet=postes' },
      ]}
    />
    <CommandBar
      end={
        <ViewSwitcher
          label="Format"
          value="chart"
          options={[
            { key: 'chart', label: 'Organigramme', icon: 'chart', href: '?vue=organigramme' },
            { key: 'table', label: 'Tableau', icon: 'table', href: '?vue=tableau' },
          ]}
        />
      }
    />
    <KpiGrid label="Chiffres">
      <KpiTile label="Postes vacants" value="7" hint="sur 50" />
    </KpiGrid>
    <SplitView
      detail={
        <DetailPane title="Direction générale" closeLabel="Fermer" onClose={noop}>
          <Facts items={[{ label: 'Titulaire', value: 'Komlan Adjévi' }]} />
        </DetailPane>
      }
    >
      <OrgChart
        label="Organigramme"
        foldLabel="Replier"
        unfoldLabel="Déplier"
        selected="dg"
        root={[
          {
            id: 'dg',
            title: 'Direction générale',
            subtitle: 'Komlan Adjévi',
            children: [{ id: 'daf', title: 'DAF', children: [{ id: 'cg', title: 'Contrôle' }] }],
          },
        ]}
      />
      <DataTable
        caption="Postes"
        rows={[{ id: 'p1', title: 'Chef SAV', holders: 1 }]}
        rowKey={(r) => r.id}
        rowHref={(r) => `/postes/${r.id}`}
        selected="p1"
        columns={[
          { key: 'title', label: 'Poste' },
          { key: 'holders', label: 'Titulaires', align: 'end' },
        ]}
      />
      <RowList label="Actions">
        <Row href="/actions/1" title="Relancer le fournisseur" meta="Abla · 15 oct." />
      </RowList>
    </SplitView>
    <Drawer open={false} onClose={noop} title="Nouvelle unité" closeLabel="Fermer" footer="x">
      x
    </Drawer>
  </>
);

describe('the page slots (spec 040)', () => {
  it('use semantic tokens only', () => {
    expect(renderToStaticMarkup(listPage)).not.toMatch(BASE_COLOR);
  });

  it('name the breadcrumb, mark the current tab and format, and keep one page title', () => {
    const html = renderToStaticMarkup(listPage);
    expect(html).toContain('aria-label="Fil d&#x27;Ariane"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*>Unités/);
    expect(html).toMatch(/aria-current="true"[^>]*><svg[\s\S]*?Organigramme/);
  });

  it('draw the chart as a tree, the first levels unfolded and the selected box marked', () => {
    const html = renderToStaticMarkup(listPage);
    expect(html).toContain('role="tree"');
    expect(html).toContain('Direction générale');
    expect(html).toContain('>DAF<');
    expect(html).not.toContain('>Contrôle<');
    expect(html).toContain('aria-selected="true"');
  });

  it('give tables a caption and open a row by its first cell', () => {
    const html = renderToStaticMarkup(listPage);
    expect(html).toContain('<caption class="sr-only">Postes</caption>');
    expect(html).toContain('href="/postes/p1"');
  });

  it('open forms in a named side panel', () => {
    const html = renderToStaticMarkup(listPage);
    expect(html).toMatch(/<dialog aria-labelledby="([^"]+)"[\s\S]*<h2 id="\1"/);
  });
});

describe('the chat (spec 040)', () => {
  it('announce the thread, and pin a labelled composer that can stop an answer', () => {
    const html = renderToStaticMarkup(
      <>
        <ChatThread label="Conversation">
          <ChatMessage role="user">Mes priorités ?</ChatMessage>
          <ChatMessage
            role="assistant"
            author="Assistant"
            tools={<ToolCard name="my_day" state="done" stateLabel="terminé" />}
          >
            <Markdown text={'## Aujourd’hui\n- **Revue** T3\n- Voir [la revue](/performance)'} />
          </ChatMessage>
        </ChatThread>
        <Suggestions label="Suggestions" items={['Ma journée']} onSelect={noop} />
        <Composer
          label="Message"
          value="x"
          onChange={noop}
          onSend={noop}
          onStop={noop}
          busy
          sendLabel="Envoyer"
          stopLabel="Arrêter"
        />
      </>,
    );
    expect(html).not.toMatch(BASE_COLOR);
    expect(html).toContain('role="log"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Arrêter"');
    expect(html).toMatch(/<label for="([^"]+)" class="sr-only">Message<\/label><textarea id="\1"/);
  });

  it('render Markdown as elements, never as HTML, and keep only safe links', () => {
    const html = renderToStaticMarkup(
      <Markdown
        text={
          '<img src=x onerror=alert(1)>\n\n| A | B |\n|---|---|\n| 1 | **2** |\n\n[x](javascript:alert(1)) [ok](https://kete.africa)'
        }
      />,
    );
    expect(html).toContain('&lt;img');
    expect(html).not.toContain('<img');
    expect(html).toContain('<table');
    expect(html).toContain('<strong>2</strong>');
    expect(html).not.toContain('href="javascript');
    expect(html).toContain('href="https://kete.africa"');
  });
});
