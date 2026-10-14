import { Button, DecisionCard } from '@kete/design';
import { FieldFrame, MorningPile, type PileItem } from '@kete/shell';
import { useState } from 'react';

// The phone's own screens (kete-core spec 106; doctrine D-051, D-054): Afi's morning pile, one
// decision at a time with a thumb; then Kossi on the site of La Colombe, « Terrain », in full sun.

export function PhonePage() {
  const [index, setIndex] = useState(0);
  const [field, setField] = useState(false);
  const [sun, setSun] = useState(false);
  const decide = (
    <>
      <Button onClick={() => setIndex(index + 1)}>Approuver</Button>
      <Button variant="secondary" onClick={() => setIndex(index + 1)}>
        Plus tard
      </Button>
    </>
  );
  const items: PileItem[] = [
    {
      key: 'leave',
      title: 'Congé de Yao, du 2 au 6 novembre',
      from: 'Kete Team · demandé hier',
      content: (
        <p className="m-0 text-body text-fg-soft">
          Solde 12 jours ; aucun chantier de Yao ces jours-là ; personne d’autre absent.
        </p>
      ),
      actions: decide,
    },
    {
      key: 'quote',
      title: 'Devis Hôtel Sarakawa · 2 480 000 F',
      from: 'Kete Finance · préparé par l’Agent Devis',
      content: (
        <p className="m-0 text-body text-fg-soft">
          Marge prévue 18 % ; trois lignes vérifiées, une incertaine.
        </p>
      ),
      actions: decide,
    },
    {
      key: 'reminders',
      title: '3 relances prêtes',
      from: 'Agent Relances · cette nuit',
      content: (
        <p className="m-0 text-body text-fg-soft">
          Pharmacie du Port, Imprimerie Nouvelle, Hôtel Sarakawa — 1 640 000 F en retard.
        </p>
      ),
      actions: decide,
    },
  ];

  if (field) {
    return (
      <FieldFrame
        label="Terrain"
        next="10 h · Réception du matériel, La Colombe"
        sun={{ on: sun, label: 'Plein soleil' }}
        onSun={setSun}
        quit={{ label: 'Quitter', onQuit: () => setField(false) }}
        gestures={
          <>
            <Button>Dicter le rapport</Button>
            <Button variant="secondary">Photo</Button>
            <Button variant="secondary">Appeler Kossi</Button>
          </>
        }
      >
        <DecisionCard
          title="Il manque deux protections de câbles"
          asker="Votre rapport d’hier, relu"
          actions={<Button>Demander l’achat</Button>}
        >
          Une demande d’achat est prête, pour Décider.
        </DecisionCard>
      </FieldFrame>
    );
  }
  return (
    <main className="mx-auto flex max-w-[560px] flex-col gap-6 px-4 py-6">
      <MorningPile
        items={items}
        index={index}
        words={{
          label: 'Ce qui vous attend ce matin',
          progress: (at, total) => `${at} sur ${total}`,
          next: (title) => <>Ensuite : {title}</>,
        }}
        done={
          <div className="flex flex-col gap-3 rounded-box border border-line bg-surface p-4">
            <h2 className="m-0 text-title font-semibold">Tout est réglé</h2>
            <p className="m-0 text-body text-fg-soft">
              Trois décisions en deux minutes. Vos agents continuent : les relances partent à 9 h.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setField(true)}>Mode Terrain</Button>
              <Button variant="secondary" onClick={() => setIndex(0)}>
                Revoir la pile
              </Button>
            </div>
          </div>
        }
      />
    </main>
  );
}
