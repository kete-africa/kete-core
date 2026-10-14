import {
  AgentRunState,
  Button,
  DecisionCard,
  KpiGrid,
  KpiTile,
  Mention,
  PageHeader,
} from '@kete/design';
import {
  IntelligencePanel,
  useIntelligence,
  type AskTransport,
  type IntelligenceWords,
} from '@kete/intelligence';
import type { IntelligenceEvent } from '@kete/sdk';
import { AppFrame, placesFor, type ManifestPlace, type ShellWords } from '@kete/shell';
import { useState } from 'react';

// The canvas's frame (kete-core spec 100), as Kete Finance would wear it: its places read from a
// manifest, the drawer beside the page, the first wave of parts. The words are the app's.

const places: ManifestPlace[] = [
  { id: 'home', label: { fr: 'Accueil', en: 'Home' }, path: '?frame=canvas-dark', icon: 'home' },
  {
    id: 'quotes',
    label: { fr: 'Devis', en: 'Quotes' },
    path: '?frame=canvas-dark#devis',
    icon: 'list',
    section: { fr: 'Ventes', en: 'Sales' },
  },
  {
    id: 'invoices',
    label: { fr: 'Factures', en: 'Invoices' },
    path: '?frame=canvas-dark#factures',
    icon: 'file',
    section: { fr: 'Ventes', en: 'Sales' },
  },
  {
    id: 'treasury',
    label: { fr: 'Comptes et fonds', en: 'Accounts and funds' },
    path: '?frame=canvas-dark#tresorerie',
    icon: 'chart',
    section: { fr: 'Trésorerie', en: 'Treasury' },
  },
];

const words: ShellWords = {
  nav: 'Navigation principale',
  showNav: 'Afficher le menu',
  hideNav: 'Masquer le menu',
  search: 'Demander ou chercher dans tout Kete…',
  palette: 'Aller, chercher, demander',
  palettePlaceholder: 'Une page, un objet, une question…',
  paletteEmpty: 'Rien ne correspond.',
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
  noteHint: '« jeudi » ou « demain » deviennent un rappel.',
  noteSave: 'Noter',
  close: 'Fermer',
  theme: 'Apparence',
  themes: { dark: 'Sombre', light: 'Clair', auto: 'Automatique' },
  signOut: 'Se déconnecter',
  sync: { ok: 'À jour', offline: (n) => `Hors ligne · ${n} en attente`, sending: 'Envoi…' },
};

const intelligenceWords: IntelligenceWords = {
  thread: 'Conversation',
  you: 'Vous',
  assistant: 'Kete Intelligence',
  composer: 'Votre demande',
  placeholder: 'Demandez, ou confiez une tâche…',
  send: 'Envoyer',
  stop: 'Arrêter',
  hint: 'Agit avec vos droits · prépare, vous décidez',
  context: 'Contexte',
  suggestions: 'Suggestions',
  thinking: 'Je réfléchis…',
  reading: (tool) => `Je consulte ${tool}…`,
  plan: 'Plan',
  level: (level) => `niveau ${level}`,
  toolState: { running: 'en cours', done: 'fait', failed: 'échoué' },
  sources: 'Sources',
  draft: 'Brouillon',
  verify: 'Vérifier',
  done: (tools, seconds) => `${tools} gestes · ${seconds} s`,
  stopped: 'Arrêté : ce qui a été lu est gardé, rien n’a été changé.',
  reason: () => 'La réponse n’a pas pu aboutir.',
};

const toolWords: Record<string, string> = {
  quote_get: 'le devis',
  invoice_list: 'les factures',
  invoices_from_quote: 'la facture d’acompte',
};

/** A turn played as the drawer's address would stream it: the real stream, a scripted model. */
const scripted: AskTransport = (_question, _history, signal) => {
  const turn: [number, IntelligenceEvent][] = [
    [
      300,
      {
        type: 'plan',
        steps: ['Lire le devis', 'Vérifier ce qui est facturé', 'Préparer l’acompte'],
      },
    ],
    [200, { type: 'step', index: 0, state: 'running' }],
    [200, { type: 'tool', id: 't1', name: 'quote_get', level: 1, state: 'running' }],
    [900, { type: 'tool', id: 't1', name: 'quote_get', level: 1, state: 'done' }],
    [100, { type: 'step', index: 0, state: 'done' }],
    [100, { type: 'step', index: 1, state: 'running' }],
    [100, { type: 'tool', id: 't2', name: 'invoice_list', level: 1, state: 'running' }],
    [800, { type: 'tool', id: 't2', name: 'invoice_list', level: 1, state: 'done' }],
    [100, { type: 'step', index: 1, state: 'done' }],
    [100, { type: 'step', index: 2, state: 'running' }],
    [100, { type: 'tool', id: 't3', name: 'invoices_from_quote', level: 3, state: 'running' }],
    [900, { type: 'tool', id: 't3', name: 'invoices_from_quote', level: 3, state: 'done' }],
    [
      100,
      { type: 'draft', draft_id: 'drf_1', title: 'invoices_from_quote', href: '#verification' },
    ],
    [100, { type: 'step', index: 2, state: 'done' }],
    [100, { type: 'source', label: 'Devis D-2026-0004', href: '#devis' }],
    ...'J’ai préparé la **facture d’acompte de 198 000 F CFA** (30 % de 660 000 F). Elle n’est pas encore écrite : vérifiez-la. Il restera **462 000 F CFA** à facturer.'
      .split(/(?<= )/)
      .map((delta): [number, IntelligenceEvent] => [40, { type: 'text', delta }]),
    [100, { type: 'done', tools: 3, ms: 5200 }],
  ];
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [wait, event] of turn) {
        await new Promise((resolve) => setTimeout(resolve, wait));
        if (signal.aborted) {
          controller.error(new DOMException('stopped', 'AbortError'));
          return;
        }
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      controller.close();
    },
  });
  return Promise.resolve(new Response(body));
};

export function CanvasPage() {
  const [beside, setBeside] = useState(false);
  const intelligence = useIntelligence(scripted);
  return (
    <AppFrame
      brand="Kete Finance"
      sections={placesFor(places, { lang: 'fr' })}
      current="home"
      counts={{ quotes: 5 }}
      person={{ name: 'Afi Mensah', detail: 'Direction' }}
      words={words}
      onAsk={(question) => {
        setBeside(true);
        if (question) void intelligence.send(question);
      }}
      beside={{
        open: beside,
        label: 'Kete Intelligence',
        onClose: () => setBeside(false),
        content: (
          <IntelligencePanel
            turns={intelligence.turns}
            running={intelligence.running}
            onSend={(question) => void intelligence.send(question)}
            onStop={intelligence.stop}
            words={intelligenceWords}
            context="Accueil · Kete Finance"
            intro="Bonjour Afi. Je vois la page ouverte ; je lis, je calcule et je prépare — vous décidez."
            suggestions={['Prépare la facture d’acompte de 30 % du devis D-2026-0004.']}
            toolLabel={(name) => toolWords[name] ?? name}
          />
        ),
      }}
      onNote={async () => undefined}
      onFiles={() => setBeside(true)}
      sync={{ state: 'ok' }}
      bell={{ href: '#notifications', count: 2 }}
      tabs={['home', 'quotes', 'invoices', 'treasury']}
    >
      <PageHeader title="Kete Finance" description="Combien ai-je vraiment, projet par projet ?" />
      <KpiGrid label="Trois chiffres">
        <KpiTile
          label="Réellement disponible"
          value="4 339 500 F"
          hint="banque − réservé − engagé"
        />
        <KpiTile label="À encaisser" value="768 220 F" hint="177 000 F en retard" />
        <KpiTile
          label="Marge prévue · La Colombe"
          value="240 000 F"
          why={
            <button type="button" className="font-semibold text-fg-soft underline">
              Pourquoi ?
            </button>
          }
        />
      </KpiGrid>
      <div className="mt-8 grid gap-6">
        <DecisionCard
          title="Achat « Outillage de pose »"
          amount="145 000 F"
          asker={
            <>
              Kossi Adjo le demande pour{' '}
              <Mention
                href="#projet"
                label="Éclairage — La Colombe"
                card="Projet · en préparation · Kossi Adjo · vendu 660 000 F"
              />
            </>
          }
          evidence={[
            { label: 'Budget du projet', detail: 'hors poste' },
            { label: 'Dernier prix payé', detail: '152 000 F', href: '#achats' },
            { label: 'Fonds reçus', detail: '0 F' },
          ]}
          actions={
            <>
              <Button variant="secondary">Refuser</Button>
              <Button>Approuver</Button>
              <Button variant="secondary">Renvoyer</Button>
            </>
          }
          how={
            <button type="button" className="text-body-sm font-semibold text-fg-soft underline">
              Comment ?
            </button>
          }
        >
          Approuvé, la marge prévue passe de 240 000 F à 95 000 F.
        </DecisionCard>
        <div className="flex flex-wrap gap-6">
          <AgentRunState state="working">Agent Achats · compare 3 offres</AgentRunState>
          <AgentRunState state="waiting">Agent Relances · vous attend</AgentRunState>
          <AgentRunState state="blocked">Rapprochement · le relevé manque</AgentRunState>
          <AgentRunState state="asleep">Brief du matin · demain 6 h 55</AgentRunState>
          <AgentRunState state="paused">Agent Qualité · en pause</AgentRunState>
          <AgentRunState state="stopped">Ancien agent · arrêté</AgentRunState>
        </div>
      </div>
    </AppFrame>
  );
}
