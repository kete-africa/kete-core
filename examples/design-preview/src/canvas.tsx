import {
  AgentRunState,
  Button,
  DecisionCard,
  KpiGrid,
  KpiTile,
  CanvasIcon,
  FramePage,
  FramePageHead,
  FrameSource,
  FrameSpark,
  Mention,
  VerificationCard,
} from '@kete/design';
import {
  IntelligencePanel,
  useIntelligence,
  type AskTransport,
  type ComposerFile,
  type IntelligenceWords,
} from '@kete/intelligence';
import type { IntelligenceEvent } from '@kete/sdk';
import { AppFrame, placesFor, type ManifestPlace, type ShellWords } from '@kete/shell';
import type { PlaceExtra } from '@kete/design';
import { useState } from 'react';

// The canvas's frame (kete-core spec 100), as Kete Finance would wear it: its places read from a
// manifest, the drawer beside the page, the first wave of parts. The words are the app's.

// Kete Finance's places, as the validated canvas shows them.
const places: ManifestPlace[] = [
  {
    id: 'home',
    label: { fr: 'Accueil', en: 'Accueil' },
    path: '?frame=canvas-light#home',
    icon: 'home',
  },
  {
    id: 'quotes',
    label: { fr: 'Devis', en: 'Devis' },
    path: '?frame=canvas-light#quotes',
    icon: 'doc',
    section: { fr: 'Ventes', en: 'Ventes' },
  },
  {
    id: 'invoices',
    label: { fr: 'Factures', en: 'Factures' },
    path: '?frame=canvas-light#invoices',
    icon: 'doc',
    section: { fr: 'Ventes', en: 'Ventes' },
  },
  {
    id: 'receipts',
    label: { fr: 'Encaissements', en: 'Encaissements' },
    path: '?frame=canvas-light#receipts',
    icon: 'bank',
    section: { fr: 'Ventes', en: 'Ventes' },
  },
  {
    id: 'requests',
    label: { fr: 'Demandes', en: 'Demandes' },
    path: '?frame=canvas-light#requests',
    icon: 'cart',
    section: { fr: 'Achats et dépenses', en: 'Achats et dépenses' },
  },
  {
    id: 'expenses',
    label: { fr: 'Notes de frais', en: 'Notes de frais' },
    path: '?frame=canvas-light#expenses',
    icon: 'read',
    section: { fr: 'Achats et dépenses', en: 'Achats et dépenses' },
  },
  {
    id: 'advances',
    label: { fr: 'Avances', en: 'Avances' },
    path: '?frame=canvas-light#advances',
    icon: 'folder',
    section: { fr: 'Achats et dépenses', en: 'Achats et dépenses' },
  },
  {
    id: 'treasury',
    label: { fr: 'Comptes et fonds', en: 'Comptes et fonds' },
    path: '?frame=canvas-light#treasury',
    icon: 'bank',
    section: { fr: 'Trésorerie', en: 'Trésorerie' },
  },
  {
    id: 'projects',
    label: { fr: 'Par projet', en: 'Par projet' },
    path: '?frame=canvas-light#projects',
    icon: 'folder',
    section: { fr: 'Trésorerie', en: 'Trésorerie' },
  },
  {
    id: 'tills',
    label: { fr: 'Caisses', en: 'Caisses' },
    path: '?frame=canvas-light#tills',
    icon: 'clock',
    section: { fr: 'Trésorerie', en: 'Trésorerie' },
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
  profile: 'Profil',
  sync: { ok: 'À jour', offline: (n) => `Hors ligne · ${n} en attente`, sending: 'Envoi…' },
};

const intelligenceWords: IntelligenceWords = {
  name: 'Kete Intelligence',
  thread: 'Conversation',
  composer: 'Votre demande',
  placeholder: 'Demandez, ou confiez une tâche… @ pour citer, / pour un geste',
  send: 'Envoyer',
  stop: 'Arrêter',
  hint: 'Agit avec vos droits · prépare, vous décidez · chaque chiffre est calculé, jamais inventé',
  context: 'Contexte',
  removeContext: 'Retirer le contexte',
  suggestions: 'Suggestions',
  thinking: 'Je réfléchis…',
  reading: (tool) => `Je consulte ${tool}…`,
  plan: 'Plan',
  level: (level) => `niveau ${level}`,
  sources: 'Sources',
  draft: 'Brouillon',
  verify: 'Vérifier',
  tally: (steps, gestures, seconds) => `${steps} étapes · ${gestures} gestes · ${seconds} s`,
  seconds: (seconds) => `${seconds} s`,
  stopped: 'Arrêté. Ce qui a été lu est gardé ; rien n’a été modifié.',
  reason: () => 'La réponse n’a pas pu aboutir.',
  copy: 'Copier',
  retry: 'Régénérer',
  ask: 'Demander',
  files: 'Fichiers',
  history: 'Fils',
  newThread: 'Nouveau fil',
  wide: 'Agrandir',
  close: 'Fermer',
  attach: 'Joindre un fichier',
  cite: 'Citer un objet',
  gestures: 'Gestes',
  dictate: 'Dicter',
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
    [
      900,
      {
        type: 'tool',
        id: 't1',
        name: 'quote_get',
        level: 1,
        state: 'done',
        input: '{ "quoteId": "D-2026-0004" }',
        summary: '2 lignes · 660 000 F',
      },
    ],
    [100, { type: 'step', index: 0, state: 'done' }],
    [100, { type: 'step', index: 1, state: 'running' }],
    [100, { type: 'tool', id: 't2', name: 'invoice_list', level: 1, state: 'running' }],
    [
      800,
      {
        type: 'tool',
        id: 't2',
        name: 'invoice_list',
        level: 1,
        state: 'done',
        input: '{ "quote": "D-2026-0004" }',
        summary: 'aucune facture',
      },
    ],
    [100, { type: 'step', index: 1, state: 'done' }],
    [100, { type: 'step', index: 2, state: 'running' }],
    [100, { type: 'tool', id: 't3', name: 'invoices_from_quote', level: 3, state: 'running' }],
    [
      900,
      {
        type: 'tool',
        id: 't3',
        name: 'invoices_from_quote',
        level: 3,
        state: 'done',
        input: '{ "quoteId": "D-2026-0004", "share": 30 }',
        summary: 'brouillon préparé',
      },
    ],
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

const extras: Record<string, PlaceExtra> = {
  quotes: { kind: 'count', value: 5 },
  invoices: { kind: 'count', value: 3 },
  requests: { kind: 'count', value: 1 },
  expenses: { kind: 'word', value: '2 à lire', hot: true },
};

export function CanvasPage() {
  const [beside, setBeside] = useState(false);
  const [tab, setTab] = useState<'ask' | 'files'>('ask');
  const [wide, setWide] = useState(false);
  const [joined, setJoined] = useState<ComposerFile[]>([]);
  const intelligence = useIntelligence(scripted);
  return (
    <AppFrame
      brand={{ name: 'Kete' }}
      org={{ name: 'Soleil d’Afrique' }}
      space={{
        name: 'Kete Finance',
        mark: 'F',
        color: 'var(--color-accent)',
        question: 'Combien ai-je vraiment, projet par projet ?',
        back: { href: '?frame=canvas-light', label: 'Retour au centre' },
      }}
      sections={placesFor(places, { lang: 'fr' }).map((section) => ({
        ...section,
        places: section.places.map((place) => ({
          ...place,
          ...(extras[place.id] ? { extra: extras[place.id] } : {}),
        })),
      }))}
      foot={{
        places: [
          { id: 'catalogue', label: 'Catalogue de prix', href: '#catalogue', icon: 'layers' },
          { id: 'settings', label: 'Réglages', href: '#reglages', icon: 'gear' },
        ],
      }}
      current="home"
      person={{ name: 'Afi Mensah', detail: 'Direction' }}
      words={words}
      onAsk={(question) => {
        setBeside(true);
        if (question) void intelligence.send(question);
      }}
      beside={{
        open: beside,
        wide,
        label: 'Kete Intelligence',
        content: (
          <IntelligencePanel
            turns={intelligence.turns}
            running={intelligence.running}
            onSend={(question) => void intelligence.send(question)}
            onStop={intelligence.stop}
            words={intelligenceWords}
            head={{
              tab,
              onTab: setTab,
              onHistory: () => undefined,
              onNew: () => undefined,
              wide,
              onWide: () => setWide((value) => !value),
              onClose: () => setBeside(false),
            }}
            files={
              <p className="m-4 text-body-sm text-fg-muted">Déposez un fichier : Kete le lit.</p>
            }
            context={{ label: 'Kete Finance', onRemove: () => undefined }}
            scope={{
              value: 'kete',
              label: 'Portée',
              options: [
                { value: 'kete', label: 'Dans tout Kete' },
                { value: 'app', label: 'Dans cette app' },
              ],
              onChange: () => undefined,
            }}
            composer={{
              attach: {
                files: joined,
                onFiles: (chosen) =>
                  setJoined((list) => [
                    ...list,
                    ...chosen.map((file) => ({
                      id: file.name,
                      name: file.name,
                      state: 'ready' as const,
                    })),
                  ]),
                onRemove: (id) => setJoined((list) => list.filter((file) => file.id !== id)),
              },
              mentions: [
                { id: 'colombe', label: 'École La Colombe', hint: 'Tiers · client' },
                { id: 'kossi', label: 'Kossi Adjo', hint: 'Chef de projet' },
                { id: 'devis', label: 'Devis D-2026-0004', hint: 'Kete Finance' },
              ],
              gestures: [
                { id: 'close', label: 'clôturer', hint: 'Clore ma journée' },
                { id: 'summarize', label: 'résumer', hint: 'Résumer ce que je regarde' },
              ],
              dictate: { lang: 'fr-FR' },
            }}
            intro={
              <p className="m-0">
                Bonjour Afi. Je vois la page ouverte et je peux chercher dans tout Kete. Je lis, je
                calcule, je compare et je <b>prépare</b> ; vous décidez de ce qui engage.
              </p>
            }
            suggestions={[
              'Prépare la facture d’acompte de 30 % du devis D-2026-0004.',
              'Pourquoi l’argent disponible baisse ?',
            ]}
            onRetry={(turn) => void intelligence.send(turn.question)}
            renderDraft={() => (
              <VerificationCard
                mark={<FrameSpark />}
                title="Brouillon · facture d’acompte"
                badge="une personne valide"
                state={{ name: 'prepared', label: 'Préparé' }}
                fields={[
                  { label: 'Client', value: 'La Colombe', provenance: 'tiré du devis D-2026-0004' },
                  {
                    label: 'Libellé',
                    value: 'Acompte 30 % — D-2026-0004',
                    provenance: 'rédigé par l’agent',
                  },
                  {
                    label: 'Montant HT',
                    value: '198 000 F CFA',
                    provenance: 'calculé : 30 % de 660 000 F',
                  },
                  { label: 'TVA', value: '0 %', provenance: 'tiré du devis' },
                  {
                    label: 'Projet',
                    value: 'Éclairage — La Colombe',
                    provenance: 'le projet du devis, au centre',
                  },
                  {
                    label: 'Échéance',
                    value: '28 oct. 2026',
                    provenance: 'déduit : 15 jours, l’usage avec ce client — à confirmer',
                    uncertain: true,
                  },
                ]}
                actions={
                  <>
                    <Button>Valider</Button>
                    <Button variant="secondary">Corriger</Button>
                    <Button variant="ghost">Refuser</Button>
                  </>
                }
                lesson="Une correction ici devient une leçon pour le skill « Facturer un acompte » — propriétaire : Mme Lawson. Rien ne change sans elle."
              />
            )}
          />
        ),
      }}
      onNote={async (text) =>
        /jeudi/i.test(text) ? (
          <p className="m-0 text-body-sm">Gardée. Rappel jeudi 9 h dans Planifier.</p>
        ) : undefined
      }
      onFiles={() => {
        setTab('files');
        setBeside(true);
      }}
      sync={{ state: 'ok' }}
      bell={{ href: '#notifications', count: 2 }}
      tabs={['home', 'quotes', 'treasury']}
    >
      <FramePage wide>
        <FramePageHead
          crumbsLabel="Fil d’Ariane"
          crumbs={[<FrameSource key="app">Kete Finance</FrameSource>]}
          title="Kete Finance"
          question="Combien ai-je vraiment, projet par projet ?"
          actions={
            <>
              <Button variant="secondary" onClick={() => setBeside(true)}>
                <CanvasIcon name="spark" size={16} />
                Demander
              </Button>
              <Button>
                <CanvasIcon name="plus" size={16} />
                Nouveau devis
              </Button>
            </>
          }
        />
        <KpiGrid label="Trois chiffres">
          <KpiTile
            label="Réellement disponible"
            value="4 339 500 F"
            hint="banque − réservé − engagé"
          />
          <KpiTile
            label="À encaisser"
            value="768 220 F"
            hint={<span className="text-state-error-fg">177 000 F en retard</span>}
          />
          <KpiTile label="Engagé" value="25 000 F" hint="approuvé, pas encore payé" />
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
      </FramePage>
    </AppFrame>
  );
}
