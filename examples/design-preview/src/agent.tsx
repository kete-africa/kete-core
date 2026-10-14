import { AgentCard, Button, LessonCard, PageHeader, Panel, TierLadder } from '@kete/design';
import {
  autonomyProof,
  budgetOf,
  CASES_FOR,
  nextState,
  nextWake,
  type AgentState,
  type Decision,
  type Trigger,
} from '@kete/lifecycle';
import { useState } from 'react';

// Déléguer (kete-core spec 105; doctrine D-045, D-053), as the center shows it: the Agent Relances'
// card computed by @kete/lifecycle — its state, budget, next wake, the proof that it may write its
// reminders alone — a lesson from Essi's correction, and the skill « Relance polie » on its tiers.

const triggers: Trigger[] = [
  { kind: 'routine', routine: { every: 'week', at: '08:00', weekday: 1 } },
  { kind: 'event', type: 'finance.invoice_overdue', when: { days: 7 } },
];
const decisions: Decision[] = [
  ...Array.from({ length: 19 }, (): Decision => ({ gesture: 'write', outcome: 'accepted' })),
  { gesture: 'write', outcome: 'corrected' },
];
const stateWords: Record<AgentState, string> = {
  asleep: 'Endormi · se réveille lundi à 8 h',
  working: 'Au travail · prépare 3 relances',
  waiting: 'Attend votre décision · 3 relances prêtes',
  blocked: 'Bloqué · le relevé d’octobre manque',
  paused: 'En pause',
  stopped: 'Arrêté',
};
const tiers = [
  { key: 'me', label: 'Moi' },
  { key: 'team', label: 'Mon équipe' },
  { key: 'unit', label: 'Mon unité' },
  { key: 'organization', label: 'Toute l’organisation' },
];

export function AgentPage() {
  const [state, setState] = useState<AgentState>('waiting');
  const [lesson, setLesson] = useState<'waiting' | 'kept' | 'dropped'>('waiting');
  const budget = budgetOf(4100, 5000);
  const proof = autonomyProof(decisions, 'write');
  const wake = nextWake(triggers, Date.parse('2026-10-14T09:00:00Z'));
  const day = wake
    ? new Intl.DateTimeFormat('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }).format(wake)
    : '—';

  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Déléguer"
        description="Vos agents, ce qu’ils font, jusqu’où, et ce qu’ils ont appris."
      />
      <AgentCard
        name="Agent Relances"
        state={state}
        stateLabel={stateWords[state]}
        mission="Faire payer les factures en retard sans abîmer la relation."
        facts={[
          { label: 'Lit', value: 'Kete Finance : factures, encaissements · Tiers : contacts' },
          { label: 'Jamais', value: 'Accorder une remise, annuler une facture.' },
          {
            label: 'Se réveille',
            value: `Chaque lundi à 8 h (prochain : ${day}) · quand une facture passe 7 jours de retard`,
          },
          { label: 'Savoir-faire', value: 'Relance polie v1.1' },
        ]}
        budget={{
          spent: 4100,
          limit: 5000,
          label: `4 100 sur 5 000 jetons ce mois · ${budget.state === 'low' ? 'bientôt épuisé' : 'dans le budget'}`,
        }}
        gesturesLabel="Ce qu’il fait, et jusqu’où"
        gestures={[
          { key: 'read', label: 'Lire les factures et les tiers', level: 'seul' },
          {
            key: 'write',
            label: 'Écrire une relance',
            level: 'je valide',
            ...(proof.eligible
              ? {
                  proof: `${proof.accepted} acceptées telles quelles sur ${proof.weighed} — peut écrire seul si vous le décidez`,
                }
              : {}),
          },
          { key: 'send', label: 'Envoyer une relance par WhatsApp', level: 'je valide' },
          { key: 'cancel', label: 'Annuler une facture', level: 'jamais' },
        ]}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setState(nextState(state, state === 'paused' ? 'resume' : 'pause'))}
            >
              {state === 'paused' ? 'Reprendre' : 'Mettre en pause'}
            </Button>
            <Button variant="secondary" onClick={() => setState(nextState(state, 'trigger'))}>
              Lancer maintenant
            </Button>
          </>
        }
      />
      <Panel title="Ce qu’il a appris">
        {lesson === 'waiting' ? (
          <LessonCard
            source="Correction d’Essi Dossou · mardi 13 octobre"
            observed="« Dernier rappel » retiré d’une première relance à la Pharmacie du Port."
            proposal="Ne jamais écrire « dernier rappel » avant la troisième relance."
            testCase="Première relance, facture de 412 000 F en retard de 9 jours."
            labels={{
              proposal: 'Ce qui pourrait changer',
              testCase: 'Le cas, qui deviendra un test',
            }}
            actions={
              <>
                <Button onClick={() => setLesson('kept')}>Garder</Button>
                <Button variant="secondary" onClick={() => setLesson('dropped')}>
                  Écarter
                </Button>
              </>
            }
          />
        ) : (
          <p className="m-0 text-body-sm text-fg-muted">
            {lesson === 'kept'
              ? 'Gardée : le cas est devenu le 5ᵉ test de « Relance polie ».'
              : 'Écartée.'}
          </p>
        )}
      </Panel>
      <Panel title="Relance polie · v1.1">
        <TierLadder
          label="Qui peut l’utiliser"
          tiers={tiers}
          current="team"
          next={`Mon unité : ${CASES_FOR.unit} cas réussis (${lesson === 'kept' ? 5 : 4} aujourd’hui), revue par le chef d’unité.`}
        />
      </Panel>
    </main>
  );
}
