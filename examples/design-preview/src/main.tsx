import {
  AgentState,
  AppCard,
  AppGrid,
  brandCss,
  Button,
  Chip,
  ChipGroup,
  defineBrand,
  Dialog,
  EmptyState,
  Icon,
  IconButton,
  KeteBand,
  Menu,
  NavItem,
  NavSection,
  PageSection,
  PageTitle,
  Panel,
  SearchField,
  Shell,
  Swatches,
  Tag,
  TextField,
  UndoNotice,
  VerificationCard,
  type Brand,
} from '@kete/design';
import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './app.css';

// The workspace page of copilot-demo, rebuilt with @kete/design: same structure and behavior,
// Kete's own content (no third-party name or icon). Words are literal: a preview, not an app.

/** The demo's charter: the workspace's own colors. */
const charter = [
  { value: '#1ca18c', name: 'Vert' },
  { value: '#f99d32', name: 'Orange' },
  { value: '#ffffff', name: 'Blanc' },
  { value: '#e8e748', name: 'Jaune' },
  { value: '#875028', name: 'Café' },
];

// A fictitious client, to show a brand replacing the workspace's colors (doctrine D-035).
const brand = defineBrand({
  id: 'atelier-bleu',
  name: 'Atelier Bleu',
  accent: '#3B82F6',
  action: '#1D4ED8',
  palette: [
    { value: '#3b82f6', name: 'Bleu' },
    { value: '#1d4ed8', name: 'Bleu nuit' },
    { value: '#ffffff', name: 'Blanc' },
  ],
});

interface App {
  name: string;
  letter: string;
  color: string;
  description?: string;
}

const apps: App[] = [
  {
    name: 'Devis',
    letter: 'D',
    color: '#1f7a5c',
    description: 'Préparés par l’agent à partir d’un message, validés par vous.',
  },
  { name: 'Factures', letter: 'F', color: '#2b5c8a' },
  { name: 'Stock', letter: 'S', color: '#8a5a1f' },
  { name: 'Congés', letter: 'C', color: '#7a3b8a' },
  { name: 'Paie', letter: 'P', color: '#9b1c3c' },
  { name: 'Achats', letter: 'A', color: '#2f7d4f' },
  { name: 'Clients', letter: 'K', color: '#5c4a99' },
  { name: 'Agenda', letter: 'G', color: '#1e6b87' },
  { name: 'Rapports', letter: 'R', color: '#87501e' },
];

const integrations: App[] = [
  { name: 'Annuaire', letter: 'N', color: '#2b5c8a' },
  { name: 'Planification', letter: 'L', color: '#7a3b8a' },
  { name: 'Tableaux de bord', letter: 'T', color: '#8a6d00' },
];

const categories: Record<string, string[]> = {
  Productivité: ['Devis', 'Factures', 'Agenda'],
  'Ressources humaines': ['Congés', 'Paie'],
  Ventes: ['Devis', 'Clients'],
  Finance: ['Factures', 'Paie', 'Achats'],
  Logistique: ['Stock', 'Achats'],
  Analyse: ['Rapports', 'Tableaux de bord'],
};
const moreCategories = ['Logistique', 'Analyse'];

/** A letter tile, drawn for the preview. */
function AppIcon({ app }: { app: App }) {
  return (
    <svg viewBox="0 0 40 40">
      <rect x="4" y="4" width="32" height="32" rx="7" fill={app.color} />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Segoe UI, Inter, Arial"
        fontWeight="700"
        fontSize="16"
      >
        {app.letter}
      </text>
    </svg>
  );
}

function Workspace({ branded }: { branded?: Brand }) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [category, setCategory] = useState('Productivité');
  const [detail, setDetail] = useState<{ title: string; body: string; app?: App } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visible = apps.filter((app) => app.name.toLowerCase().includes(query.toLowerCase()));
  const open = (app: App) =>
    setDetail({
      title: app.name,
      body: app.description ?? `Ouvrez ${app.name} dans un nouvel onglet.`,
      app,
    });
  const demo = (title: string) =>
    setDetail({ title, body: 'Cette fonction n’est pas connectée dans cette prévisualisation.' });

  return (
    <Shell
      brand={branded?.name ?? 'Kete'}
      navLabel="Navigation principale"
      showNavLabel="Afficher la navigation"
      hideNavLabel="Réduire le panneau"
      tools={
        <>
          <IconButton label="Toutes les applications" onClick={() => setCategory('Productivité')}>
            <Icon name="apps" />
          </IconButton>
          <IconButton label="Bibliothèque" onClick={() => demo('Bibliothèque')}>
            <Icon name="check" />
          </IconButton>
        </>
      }
      toolbar={
        <Menu
          icon="download"
          label="Installer des applications"
          items={[
            { label: 'Kete pour le bureau', href: '#', external: true },
            { label: 'Kete sur téléphone', href: '#', external: true },
          ]}
        />
      }
      nav={
        <>
          <NavSection>
            <NavItem icon="new" onClick={() => demo('Nouvelle conversation')}>
              Nouvelle conversation
            </NavItem>
            <NavItem icon="search" onClick={() => setSearching(true)}>
              Rechercher
            </NavItem>
            <NavItem icon="library" onClick={() => demo('Bibliothèque')}>
              Bibliothèque
            </NavItem>
            <NavItem icon="teach" onClick={() => demo('Enseigner')}>
              Enseigner
            </NavItem>
          </NavSection>
          <NavSection label="Assistants">
            <NavItem icon="learn" accent onClick={() => demo('Étudier et apprendre')}>
              Étudier et apprendre
            </NavItem>
            <NavItem icon="agent" onClick={() => demo('Nouvel agent')}>
              Nouvel agent
            </NavItem>
            <NavItem icon="more" onClick={() => demo('Plus d’assistants')}>
              Plus d’assistants
            </NavItem>
          </NavSection>
          <NavSection label="Conversations">
            <NavItem onClick={() => demo('Relances de septembre')}>Relances de septembre</NavItem>
            <NavItem onClick={() => demo('Devis pour Ama Mensah')}>Devis pour Ama Mensah</NavItem>
            <NavItem onClick={() => demo('Inventaire du dépôt')}>Inventaire du dépôt</NavItem>
          </NavSection>
        </>
      }
      footer={
        <Swatches label="Couleurs de la charte" colors={branded ? branded.palette : charter} />
      }
    >
      <PageTitle>Applications</PageTitle>
      {searching && (
        <SearchField
          className="-mt-[27px] mb-6 max-[760px]:mt-0"
          label="Rechercher une application"
          placeholder="Rechercher une application…"
          closeLabel="Fermer la recherche"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClose={() => {
            setSearching(false);
            setQuery('');
          }}
          autoFocus
        />
      )}
      <PageSection first>
        {visible.length > 0 ? (
          <AppGrid label="Applications de l’entreprise">
            {visible.map((app, index) => (
              <AppCard
                key={app.name}
                featured={index === 0 && !query}
                icon={<AppIcon app={app} />}
                name={app.name}
                description={app.description}
                onClick={() => open(app)}
              />
            ))}
          </AppGrid>
        ) : (
          <EmptyState title="Aucune application ne correspond à votre recherche." />
        )}
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={() => setCategory('Productivité')}
            className="flex items-center gap-2 text-[16px] font-semibold text-link underline underline-offset-[3px]"
          >
            Toutes les applications <Icon name="arrow" />
          </button>
        </div>
      </PageSection>
      <PageSection title="Utiliser dans vos outils de travail">
        <AppGrid layout="row">
          {integrations.map((app) => (
            <AppCard
              key={app.name}
              icon={<AppIcon app={app} />}
              name={app.name}
              onClick={() => open(app)}
            />
          ))}
        </AppGrid>
      </PageSection>
      <PageSection title="Explorer par catégorie">
        <ChipGroup label="Catégories">
          {Object.keys(categories)
            .filter((name) => !moreCategories.includes(name))
            .map((name) => (
              <Chip key={name} pressed={category === name} onClick={() => setCategory(name)}>
                {name}
              </Chip>
            ))}
          <Menu
            trigger="chip"
            label={`${moreCategories.length} autres`}
            items={moreCategories.map((name) => ({
              label: name,
              onSelect: () => setCategory(name),
            }))}
          />
        </ChipGroup>
        <h3 className="mt-[25px] mb-3 text-[16px] font-semibold">{category}</h3>
        <AppGrid layout="list">
          {[...apps, ...integrations]
            .filter((app) => categories[category]?.includes(app.name))
            .map((app) => (
              <AppCard
                key={app.name}
                icon={<AppIcon app={app} />}
                name={app.name}
                onClick={() => open(app)}
              />
            ))}
        </AppGrid>
      </PageSection>
      <PageSection title="Préparé par l’agent">
        <VerificationCard
          title="Devis pour Ama Mensah"
          state={{ name: 'prepared', label: 'Préparé par l’agent' }}
          fields={[
            { label: 'Client', value: 'Ama Mensah', provenance: 'Tiré du message WhatsApp' },
            { label: 'Articles', value: '12 chemises', provenance: 'Tiré du message WhatsApp' },
            {
              label: 'Prix',
              value: <span className="font-number">18 000 F CFA</span>,
              provenance: 'Incertain : tarif habituel appliqué',
              uncertain: true,
            },
          ]}
          actions={
            <>
              <Button variant="secondary">Corriger</Button>
              <Button onClick={() => setToast('Devis validé et envoyé à Ama Mensah.')}>
                Valider le devis
              </Button>
            </>
          }
        />
      </PageSection>
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.title}
        closeLabel="Fermer"
      >
        <p>{detail?.body}</p>
        {detail?.app && (
          <Button className="mt-3" onClick={() => setDetail(null)}>
            Ouvrir {detail.app.name} ↗
          </Button>
        )}
      </Dialog>
      {toast && (
        <UndoNotice placement="bottom" undoLabel="Annuler" onUndo={() => setToast(null)}>
          {toast}
        </UndoNotice>
      )}
    </Shell>
  );
}

function KetePage() {
  return (
    <>
      <KeteBand />
      <div className="mx-auto grid max-w-5xl gap-6 p-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Panel title="Commande">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <Tag tone="agent">Agent</Tag>
                <Tag tone="verify">À vérifier</Tag>
                <Tag tone="validated">Validé</Tag>
                <Tag tone="error">Refusé</Tag>
                <Tag tone="info">Info</Tag>
                <Tag>Brouillon</Tag>
              </div>
              <div className="flex flex-wrap gap-4">
                <AgentState state="prepared">Préparé</AgentState>
                <AgentState state="corrected">Corrigé</AgentState>
                <AgentState state="verified">Vérifié</AgentState>
                <AgentState state="refused">Refusé</AgentState>
              </div>
              <TextField
                label="Montant"
                uncertain
                hint="Tiré du message · à vérifier"
                defaultValue="18 000"
              />
              <TextField label="Téléphone" error="Il manque 2 chiffres" defaultValue="+228 90 00" />
              <div className="flex flex-wrap gap-3">
                <Button>Envoyer les 4 relances</Button>
                <Button variant="secondary">Plus tard</Button>
              </div>
            </div>
          </Panel>
          <Panel>
            <EmptyState title="Aucune facture" action={<Button>Nouvelle facture</Button>}>
              Vos factures apparaîtront ici.
            </EmptyState>
          </Panel>
        </div>
        <div className="flex flex-col gap-6">
          <VerificationCard
            title="Devis pour Ama Mensah"
            state={{ name: 'verified', label: 'Vérifié' }}
            fields={[
              { label: 'Client', value: 'Ama Mensah', provenance: 'Tiré du message WhatsApp' },
              { label: 'Prix', value: '18 000 F CFA', provenance: 'Tarif habituel' },
            ]}
            decision="Validé par Kofi à 10 h 42"
          />
          <UndoNotice undoLabel="Annuler" onUndo={() => undefined}>
            L’agent a relancé Kofi pour sa facture.
          </UndoNotice>
        </div>
      </div>
    </>
  );
}

const frames: Record<
  string,
  { label: string; attributes: Record<string, string>; page: ReactNode }
> = {
  'workspace-dark': {
    label: 'workspace · sombre',
    attributes: { 'data-design': 'workspace' },
    page: <Workspace />,
  },
  'workspace-light': {
    label: 'workspace · clair',
    attributes: { 'data-design': 'workspace', 'data-theme': 'light' },
    page: <Workspace />,
  },
  'brand-dark': {
    label: `workspace · ${brand.name} · sombre`,
    attributes: { 'data-design': 'workspace', 'data-brand': brand.id },
    page: <Workspace branded={brand} />,
  },
  'brand-light': {
    label: `workspace · ${brand.name} · clair`,
    attributes: { 'data-design': 'workspace', 'data-brand': brand.id, 'data-theme': 'light' },
    page: <Workspace branded={brand} />,
  },
  'kete-light': { label: 'kete · clair', attributes: {}, page: <KetePage /> },
  'kete-dark': {
    label: 'kete · sombre',
    attributes: { 'data-theme': 'dark' },
    page: <KetePage />,
  },
};

/** One frame at a time (`?frame=`), its design and mode on <html>, as an app sets them. */
function Preview() {
  const key = new URLSearchParams(window.location.search).get('frame') ?? 'workspace-dark';
  const frame = frames[key] ?? frames['workspace-dark'];
  useEffect(() => {
    const html = document.documentElement;
    for (const name of ['data-design', 'data-theme', 'data-brand']) html.removeAttribute(name);
    for (const [name, value] of Object.entries(frame?.attributes ?? {})) {
      html.setAttribute(name, value);
    }
  }, [frame]);
  return (
    <>
      <style>{brandCss(brand)}</style>
      {frame?.page}
      <nav
        aria-label="Prévisualisations"
        className="fixed right-3 bottom-3 z-30 flex flex-wrap gap-1 rounded-control border border-line bg-surface-raised p-1 text-body-sm"
      >
        {Object.entries(frames).map(([name, item]) => (
          <a
            key={name}
            href={`?frame=${name}`}
            aria-current={name === key ? 'page' : undefined}
            className="rounded-control px-2 py-1 text-fg hover:bg-surface-hover aria-[current=page]:bg-surface-selected"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Preview />
    </StrictMode>,
  );
}
