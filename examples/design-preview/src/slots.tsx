import {
  Button,
  ChatMessage,
  ChatThread,
  CommandBar,
  Composer,
  CopyButton,
  DataTable,
  DetailPane,
  Drawer,
  Facts,
  KpiGrid,
  KpiTile,
  Markdown,
  NavItem,
  NavSection,
  OrgChart,
  PageHeader,
  Row,
  RowList,
  Shell,
  SplitView,
  Suggestions,
  Tabs,
  Tag,
  TextField,
  ToolCard,
  VerificationCard,
  ViewSwitcher,
  type ChartNode,
} from '@kete/design';
import { useState, type ReactNode } from 'react';

// The page slots and the chat kit of spec 040, with fictitious content: what a person validates
// before the screens are built with them. Words are literal: a preview, not an app.

function Frame({ current, children }: { current: string; children: ReactNode }) {
  return (
    <Shell
      brand="Kete Enterprise"
      navLabel="Navigation principale"
      showNavLabel="Afficher la navigation"
      hideNavLabel="Réduire le panneau"
      nav={
        <>
          <NavSection label="Moi">
            <NavItem icon="apps" href="?frame=slots-dark" current={current === 'home'}>
              Accueil
            </NavItem>
            <NavItem icon="check" href="?frame=slots-dark">
              À faire
            </NavItem>
            <NavItem icon="agent" href="?frame=chat-dark" current={current === 'chat'}>
              Assistant
            </NavItem>
            <NavItem icon="learn" href="?frame=slots-dark">
              Mes agents
            </NavItem>
            <NavItem icon="library" href="?frame=slots-dark">
              Ressources
            </NavItem>
          </NavSection>
          <NavSection label="Outils">
            <NavItem icon="teach" href="?frame=slots-dark">
              Enquêtes
            </NavItem>
            <NavItem icon="learn" href="?frame=slots-dark">
              Performance
            </NavItem>
            <NavItem icon="library" href="?frame=slots-dark">
              Instances
            </NavItem>
          </NavSection>
          <NavSection label="Apps de l'équipe">
            <NavItem icon="apps" href="?frame=slots-dark">
              Support
            </NavItem>
          </NavSection>
          <NavSection label="Administration">
            <NavItem icon="check" href="?frame=slots-dark" current={current === 'org'}>
              Organisation
            </NavItem>
          </NavSection>
        </>
      }
    >
      {children}
    </Shell>
  );
}

const chart: ChartNode[] = [
  {
    id: 'dg',
    title: 'Directeur Général',
    subtitle: 'Komlan Adjévi',
    children: [
      {
        id: 'dga',
        title: 'Directeur Général Adjoint',
        subtitle: 'Mawuena Kpodar',
        children: [
          { id: 'drh_ap', title: 'Administration du personnel', subtitle: 'Afua Djossou' },
        ],
      },
      {
        id: 'daf',
        title: 'Directeur Administratif et Financier',
        subtitle: 'Kossivi Ahadji',
        children: [
          { id: 'cg', title: 'Contrôle de gestion', subtitle: 'Afi Mawufemo Agbo' },
          { id: 'aa', title: 'Achats', subtitle: 'Kodjovi Fiagan' },
        ],
      },
      {
        id: 'dtp',
        title: 'Directeur Technique & Projets',
        subtitle: 'Folly Ayité',
        children: [
          { id: 'sav', title: 'Chef de service SAV', subtitle: 'Abla Nyuiadzi' },
          { id: 'be', title: "Bureau d'études", subtitle: 'Ablavi Sossou' },
        ],
      },
      {
        id: 'ddc',
        title: 'Directeur Commercial',
        badge: <Tag tone="verify">poste vacant</Tag>,
      },
    ],
  },
];

/** A list page in its slots: the organization, in three formats, with its detail pane. */
export function SlotsPage() {
  const [view, setView] = useState('chart');
  const [selected, setSelected] = useState<string | null>('sav');
  const [drawing, setDrawing] = useState(false);
  return (
    <Frame current="org">
      <PageHeader
        breadcrumbLabel="Fil d'Ariane"
        breadcrumbs={[{ label: 'Administration', href: '?frame=slots-dark' }]}
        title="Organisation"
        description="Les unités, les postes et leurs titulaires à une date."
        actions={<Button onClick={() => setDrawing(true)}>Dessiner l'organisation</Button>}
      />
      <KpiGrid label="Chiffres">
        <KpiTile label="Unités" value="36" />
        <KpiTile label="Postes" value="50" />
        <KpiTile label="Personnes" value="34" />
        <KpiTile label="Postes vacants" value="7" hint="dont 2 directions" />
      </KpiGrid>
      <Tabs
        label="Facettes"
        current="positions"
        items={[
          { key: 'positions', label: 'Postes', count: 50 },
          { key: 'units', label: 'Unités', count: 36 },
          { key: 'history', label: 'Historique' },
        ]}
      />
      <CommandBar
        end={
          <ViewSwitcher
            label="Format"
            value={view}
            onChange={setView}
            options={[
              { key: 'chart', label: 'Organigramme', icon: 'chart' },
              { key: 'list', label: 'Arborescence', icon: 'list' },
              { key: 'table', label: 'Tableau', icon: 'table' },
            ]}
          />
        }
      >
        <TextField
          className="max-w-48"
          label="À la date du"
          type="date"
          defaultValue="2026-10-03"
        />
      </CommandBar>
      <SplitView
        detail={
          selected && (
            <DetailPane
              title="Chef de service SAV & Maintenance"
              subtitle="Direction Technique & Projets"
              closeLabel="Fermer"
              onClose={() => setSelected(null)}
            >
              <Facts
                items={[
                  { label: 'Titulaire', value: 'Abla Nyuiadzi' },
                  { label: 'Rattaché à', value: 'Directeur Technique & Projets' },
                  { label: 'Postes rattachés', value: '4' },
                  { label: 'Profil', value: <Tag tone="info">KYA-KPI-01 · 7 lignes</Tag> },
                ]}
              />
            </DetailPane>
          )
        }
      >
        {view === 'chart' ? (
          <OrgChart
            label="Organigramme"
            root={chart}
            selected={selected}
            onSelect={setSelected}
            foldLabel="Replier"
            unfoldLabel="Déplier"
          />
        ) : view === 'table' ? (
          <DataTable
            caption="Postes"
            rows={[
              {
                id: 'sav',
                title: 'Chef de service SAV',
                unit: 'SAV & Maintenance',
                holder: 'Abla Nyuiadzi',
              },
              { id: 'cg', title: 'Contrôle de gestion', unit: 'DAF', holder: 'Afi Mawufemo Agbo' },
              { id: 'ddc', title: 'Directeur Commercial', unit: 'DDC', holder: '—' },
            ]}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelected(r.id)}
            selected={selected}
            columns={[
              { key: 'title', label: 'Poste' },
              { key: 'unit', label: 'Unité' },
              { key: 'holder', label: 'Titulaire' },
            ]}
          />
        ) : (
          <RowList label="Unités">
            <Row title="Direction Générale" meta="2 postes" onClick={() => setSelected('dg')} />
            <Row
              title="Direction Technique & Projets"
              meta="9 postes"
              onClick={() => setSelected('sav')}
            />
            <Row
              title="Direction Administrative et Financière"
              meta="6 postes"
              onClick={() => setSelected('cg')}
            />
          </RowList>
        )}
      </SplitView>
      <Drawer
        open={drawing}
        onClose={() => setDrawing(false)}
        title="Nouvelle unité"
        closeLabel="Fermer"
        footer={
          <>
            <Button onClick={() => setDrawing(false)}>Créer l'unité</Button>
            <Button variant="secondary" onClick={() => setDrawing(false)}>
              Annuler
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <TextField label="Nom de l'unité" defaultValue="Service Énergie & Climat" />
          <TextField label="Code" defaultValue="EC" />
        </div>
      </Drawer>
    </Frame>
  );
}

/** The assistant's chat: a thread, a tool, a draft to validate, a composer pinned at the bottom. */
export function ChatPage() {
  const [text, setText] = useState('');
  const answer =
    "D'après les relevés envoyés par **Support**, une ligne de revue peut être reprise :\n\n| Revue | Ligne | Relevé |\n|---|---|---|\n| Abla Nyuiadzi · T3 2026 | Respect du délai contractuel (SLA) | 68,8 % |\n\nJ'ai préparé la mesure : **validez-la** pour qu'elle compte.";
  return (
    <Frame current="chat">
      <PageHeader
        title="Assistant"
        description="Il agit avec vos droits et jamais plus : il prépare, vous décidez."
      />
      <div className="grid gap-6 min-[1101px]:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Conversations" className="flex flex-col gap-3">
          <Button variant="secondary">Nouvelle conversation</Button>
          <RowList label="Conversations">
            <Row href="?frame=chat-dark" title="Relevés à reprendre" />
            <Row href="?frame=chat-dark" title="Actions en retard du SAV" />
          </RowList>
        </nav>
        <div className="flex min-w-0 flex-col">
          <ChatThread label="Conversation avec l'assistant">
            <ChatMessage role="user">Quels relevés des apps puis-je reprendre ?</ChatMessage>
            <ChatMessage
              role="assistant"
              author="Assistant"
              tools={
                <>
                  <ToolCard name="Relevés à reprendre" state="done" stateLabel="terminé" />
                  <ToolCard name="Mesure proposée" state="done" stateLabel="terminé" />
                </>
              }
              actions={<CopyButton text={answer} label="Copier" copiedLabel="Copié" />}
            >
              <Markdown text={answer} />
              <div className="mt-3">
                <VerificationCard
                  title="Mesure d'une ligne de revue · brouillon"
                  state={{ name: 'prepared', label: 'Préparé, à valider' }}
                  fields={[
                    {
                      label: 'Revue',
                      value: 'Abla Nyuiadzi · T3 2026',
                      provenance: "préparé par l'assistant",
                    },
                    { label: 'Ligne', value: '1', provenance: "préparé par l'assistant" },
                    {
                      label: 'Relevé',
                      value:
                        "Respect du délai d'intervention contractuel (SLA) : 68,8 (kete-helpdesk)",
                      provenance: "préparé par l'assistant",
                    },
                  ]}
                  actions={
                    <div className="flex gap-2">
                      <Button>Valider</Button>
                      <Button variant="secondary">Refuser</Button>
                    </div>
                  }
                />
              </div>
            </ChatMessage>
          </ChatThread>
          <Suggestions
            label="Suggestions"
            items={['Quelles actions sont en retard ?', 'Où en est mon équipe ce trimestre ?']}
            onSelect={setText}
          />
          <Composer
            label="Votre message"
            placeholder="Demandez, l'assistant prépare : vous décidez."
            value={text}
            onChange={setText}
            onSend={() => setText('')}
            sendLabel="Envoyer"
            stopLabel="Arrêter la réponse"
            hint="gpt-6.1-sol · l'assistant agit avec vos droits et prépare des brouillons que vous validez."
          />
        </div>
      </div>
    </Frame>
  );
}
