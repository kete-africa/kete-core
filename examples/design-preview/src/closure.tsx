import {
  PageHeader,
  Panel,
  ProposalList,
  TextAreaField,
  VoiceCapture,
  type ProposalOutcomeState,
  type ProposalRow,
  type ProposalWords,
} from '@kete/design';
import { useState } from 'react';

// The evening's closure (kete-core spec 104; doctrine D-051), as an app shows it: her note, her
// voice, what the assistant proposes — ticked, applied together, undone together.

const words: ProposalWords = {
  label: 'Ce que je propose pour ce soir',
  apply: (n) => `Appliquer ${n} geste${n > 1 ? 's' : ''}`,
  dismiss: 'Ne rien garder',
  undo: 'Tout annuler',
  level: (l) =>
    l <= 2 ? `Niveau ${l} · réversible` : `Niveau ${l} · ${l === 4 ? 'irréversible' : 'brouillon'}`,
  outcomes: {
    applied: 'fait',
    failed: 'pas fait',
    needs_confirmation: 'à confirmer à part',
    not_ticked: 'laissé',
    undone: 'annulé',
    undo_failed: 'pas annulé',
  },
};

const proposed: ProposalRow[] = [
  {
    key: 'close',
    label: 'Clore « Devis Pharmacie du Port »',
    reason: '« J’ai fini le devis de la Pharmacie. »',
    level: 2,
    ticked: true,
  },
  {
    key: 'remind',
    label: 'Vous rappeler Ecobank jeudi à 9 h',
    reason: '« Rappelle-moi Ecobank jeudi. »',
    level: 1,
    ticked: true,
  },
  {
    key: 'move',
    label: 'Reporter le rapport au Fonds à lundi',
    reason: '« Pas eu le temps pour le rapport, on verra lundi. »',
    level: 2,
    ticked: true,
  },
  {
    key: 'cancel',
    label: 'Annuler la commande BC-0031',
    reason: '« La commande de câbles ne sert plus. »',
    level: 4,
    ticked: false,
  },
];

export function ClosurePage() {
  const [note, setNote] = useState(
    'J’ai fini le devis de la Pharmacie. Rappelle-moi Ecobank jeudi. Pas eu le temps pour le rapport, on verra lundi. La commande de câbles ne sert plus.',
  );
  const [rows, setRows] = useState(proposed);
  const [status, setStatus] = useState<'proposed' | 'applied' | 'dismissed' | 'undone'>('proposed');
  const outcome = (row: ProposalRow): ProposalOutcomeState =>
    !row.ticked ? 'not_ticked' : row.level === 4 ? 'needs_confirmation' : 'applied';

  return (
    <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Ma journée"
        description="Dites ce que votre journée a été ; je propose, vous cochez, vous pouvez tout annuler."
      />
      <Panel>
        <div className="flex flex-col gap-4">
          <TextAreaField
            label="Ma journée en quelques mots"
            value={note}
            rows={4}
            onChange={setNote}
          />
          <VoiceCapture
            onAudio={() => undefined}
            words={{
              start: 'Dire ma journée',
              stop: 'Terminer',
              recording: (s) => `J’écoute… ${s} s`,
              unavailable: 'Le micro n’est pas disponible.',
            }}
          />
        </div>
      </Panel>
      <Panel title="Ce que je propose">
        <ProposalList
          rows={rows}
          status={status}
          words={words}
          onToggle={(key) =>
            setRows(rows.map((row) => (row.key === key ? { ...row, ticked: !row.ticked } : row)))
          }
          onApply={() => {
            setRows(rows.map((row) => ({ ...row, outcome: outcome(row) })));
            setStatus('applied');
          }}
          onDismiss={() => {
            setRows(rows.map((row) => ({ ...row, outcome: 'not_ticked' })));
            setStatus('dismissed');
          }}
          onUndo={() => {
            setRows(
              rows.map((row) => (row.outcome === 'applied' ? { ...row, outcome: 'undone' } : row)),
            );
            setStatus('undone');
          }}
        />
      </Panel>
    </main>
  );
}
