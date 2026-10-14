import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BoardGrid, KpiTile, SummaryCard } from '../src/index.js';

// Spec 103: Afi's board « Direction », looked at and frozen.

const BASE_COLOR =
  /\b(?:bg|text|border|ring)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|success|verify|error|info|night|gray-\d+)\b/;

describe('the board’s parts', () => {
  it('lays the cards on twelve columns, in reading order for a phone, a proposal dashed', () => {
    const html = renderToStaticMarkup(
      <BoardGrid
        label="Direction"
        cards={[
          {
            id: 'sales',
            place: { x: 4, y: 0, w: 8, h: 2 },
            children: <KpiTile label="Facturé" value="1 404 000 F" />,
          },
          {
            id: 'cash',
            place: { x: 0, y: 0, w: 4, h: 2 },
            children: <KpiTile label="Argent disponible" value="6 480 000 F" />,
          },
          {
            id: 'margin',
            place: { x: 0, y: 2, w: 4, h: 2 },
            children: <KpiTile label="Marge" value="18 %" />,
            proposed: <button type="button">Garder</button>,
          },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Direction"');
    expect(html.indexOf('Argent disponible')).toBeLessThan(html.indexOf('Facturé'));
    expect(html).toContain('--board-col:5 / span 8');
    expect(html).toContain('data-proposed="true"');
    expect(html).not.toMatch(BASE_COLOR);
  });

  it('tones a trend by whether it is good news, not by its arrow', () => {
    const html = renderToStaticMarkup(
      <KpiTile label="Absences" value="2" trend={{ direction: 'up', tone: 'bad', label: '+1' }} />,
    );
    expect(html).toContain('data-tone="bad"');
    expect(html).toContain('text-state-error-fg');
    expect(html).toContain('▲');
  });

  it('keeps a summary as it was: what changed, each figure, her words', () => {
    const html = renderToStaticMarkup(
      <SummaryCard
        title="Direction"
        at="mardi 14 octobre, 7 h"
        changed="L’argent disponible baisse de 35 % depuis hier."
        lines={[
          {
            key: 'cash',
            label: 'Argent disponible',
            value: '4 200 000 F',
            trend: { direction: 'down', tone: 'bad', label: '35 %' },
            flag: 'sous le seuil',
          },
          { key: 'due', label: 'Échéances', value: '—', flag: 'sans réponse' },
        ]}
        note="Kossi absent jeudi."
        actions={<a href="/tableaux/direction">Ouvrir le tableau</a>}
      />,
    );
    expect(html).toContain('<dl');
    expect(html).toContain('sous le seuil');
    expect(html).toContain('<blockquote');
    expect(html).toContain('Ouvrir le tableau');
    expect(html).not.toMatch(BASE_COLOR);
  });
});
