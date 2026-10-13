import {
  AgentRunState,
  Button,
  DecisionCard,
  KpiGrid,
  KpiTile,
  Mention,
  PageHeader,
} from '@kete/design';
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

export function CanvasPage() {
  const [beside, setBeside] = useState(false);
  const [asked, setAsked] = useState<string | undefined>();
  return (
    <AppFrame
      brand="Kete Finance"
      sections={placesFor(places, { lang: 'fr' })}
      current="home"
      counts={{ quotes: 5 }}
      person={{ name: 'Afi Mensah', detail: 'Direction' }}
      words={words}
      onAsk={(question) => {
        setAsked(question);
        setBeside(true);
      }}
      beside={{
        open: beside,
        label: 'Kete Intelligence',
        onClose: () => setBeside(false),
        content: (
          <div className="p-4 text-fg-soft">
            {asked ? `« ${asked} »` : 'Le tiroir de Kete Intelligence s’ouvre ici (étape L3).'}
          </div>
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
