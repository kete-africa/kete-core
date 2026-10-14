import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FieldFrame, MorningPile, type PileItem } from '../src/index.js';

// Spec 106: Afi's morning — five things wait; Kossi on the site of La Colombe, in full sun.

const items: PileItem[] = [
  {
    key: 'leave',
    title: 'Congé de Yao, du 2 au 6 novembre',
    from: 'Kete Team · demandé hier',
    content: <p>Solde 12 jours ; personne d’autre absent.</p>,
    actions: <button type="button">Approuver</button>,
  },
  {
    key: 'quote',
    title: 'Devis Hôtel Sarakawa',
    content: <p>2 480 000 F</p>,
    actions: <button type="button">Valider</button>,
  },
];
const words = {
  label: 'Ce qui vous attend ce matin',
  progress: (at: number, total: number) => `${at} sur ${total}`,
  next: (title: unknown) => <>Ensuite : {title as string}</>,
};

describe('the phone’s screens', () => {
  it('shows the pile one card at a time: where she is, the card, its gestures, what comes next', () => {
    const html = renderToStaticMarkup(
      <MorningPile items={items} index={0} words={words} done={<p>Tout est réglé</p>} />,
    );
    expect(html).toContain('aria-label="Ce qui vous attend ce matin"');
    expect(html).toContain('aria-valuetext="1 sur 2"');
    expect(html).toContain('Congé de Yao');
    expect(html).toContain('Approuver');
    expect(html).toContain('Ensuite : Devis Hôtel Sarakawa');
    expect(html).not.toContain('2 480 000 F');
  });

  it('says once the pile is empty what her agents go on doing', () => {
    const html = renderToStaticMarkup(
      <MorningPile items={items} index={2} words={words} done={<p>Tout est réglé</p>} />,
    );
    expect(html).toContain('data-pile="done"');
    expect(html).toContain('Tout est réglé');
  });

  it('gives the field the next thing in large, large gestures, « Plein soleil » and the way back', () => {
    const html = renderToStaticMarkup(
      <FieldFrame
        label="Terrain"
        next="10 h · Réception du matériel, La Colombe"
        gestures={<button type="button">Dicter le rapport</button>}
        sun={{ on: false, label: 'Plein soleil' }}
        onSun={() => undefined}
        quit={{ label: 'Quitter', onQuit: () => undefined }}
      />,
    );
    expect(html).toContain('data-field');
    expect(html).toContain('role="switch"');
    expect(html).toContain('Plein soleil');
    expect(html).toContain('Dicter le rapport');
    expect(html).toContain('Quitter');
  });
});
