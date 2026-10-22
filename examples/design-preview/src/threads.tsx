import {
  ConversationFrame,
  MessageItem,
  MessageStream,
  PinBar,
  ThreadHeader,
  ThreadInfo,
  ThreadListPanel,
  type ConversationWords,
  type ShownMessage,
} from '@kete/conversation';
import { CanvasIcon, FieldToggle, MessageField, type FieldPick } from '@kete/design';
import { useState } from 'react';

// The threads of the canvas v6.2 (kete-core spec 140; doctrine D-061), drawn by @kete/conversation
// and the one composer of @kete/design: La Colombe's site, Kete's private answer, the agents in the
// list. Words are literal: a preview, not an app.

const hour = (iso: string) =>
  new Intl.DateTimeFormat('fr', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

const words: ConversationWords = {
  time: hour,
  day: (iso) =>
    new Intl.DateTimeFormat('fr', { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(iso),
    ),
  someone: 'Quelqu’un',
  agent: 'agent',
  kete: 'Kete',
  newMessages: 'Nouveaux messages',
  jumpToNew: (n) => `${n} nouveau${n > 1 ? 'x' : ''}`,
  older: 'Messages plus anciens',
  typing: (names) => `${names.join(', ')} écrit…`,
  readBy: (readers) => `Lu par ${readers.join(' · ')}`,
  sent: 'Envoyé',
  edited: 'modifié',
  showOriginal: 'voir l’original',
  movedHere: 'déplacé ici',
  movedAway: 'Déplacé dans un autre fil',
  deleted: (name) => `Message supprimé par ${name} · l’original reste dans la preuve`,
  imported: 'importé',
  onlyForYou: 'seulement pour vous',
  onlyForYouWhy:
    'La marge n’est lisible que par la direction et la comptabilité ; Yao, deux agents et M. Agbeko lisent ce fil. Cette réponse n’est visible que par vous.',
  share: 'Partager dans le fil',
  shared: 'partagé',
  via: { whatsapp: 'WhatsApp', mail: 'mail', telegram: 'Telegram', form: 'formulaire' },
  toClient: 'parti au client',
  internal: 'Interne',
  forAction: 'Pour action',
  forInformation: 'Pour info',
  reply: 'Répondre',
  react: (emoji) => `Réagir ${emoji}`,
  more: 'Plus de gestes',
  close: 'Fermer',
  transcript: 'Transcription par Kete',
  play: 'Écouter',
  speed: 'Vitesse',
  replyingTo: (name, text) => `Réponse à ${name} : « ${text} »`,
  steps: 'Voir les étapes',
  fold: 'Replier',
  stop: 'Arrêter',
  infos: 'Infos du fil',
  state: 'L’état',
  searchThread: 'Chercher dans ce fil',
  notifications: 'Notifications',
  notifyLevel: { all: 'Toutes', mentions: 'Mentions', none: 'Aucune' },
  notifyHint: 'Le téléphone ne sonne que si l’ordinateur n’a pas vu.',
  categories: {
    pins: 'Épinglés',
    photos: 'Photos et vidéos',
    documents: 'Documents',
    links: 'Liens',
    voices: 'Vocaux',
    actions: 'Actions',
    decisions: 'Décisions',
    members: 'Membres',
  },
  nothingHere: 'Rien pour l’instant',
  version: (n) => `v${n}`,
  list: 'Fils',
  back: 'Retour aux fils',
  states: {
    needs: 'A besoin de vous',
    working: 'Travaille',
    finished: 'A fini',
    idle: 'En veille',
  },
  resolved: 'Rien n’attend',
  unread: (n) => `${n} non lus`,
};

const names: Record<string, string> = {
  usr_afi: 'Afi Mensah',
  usr_kossi: 'Kossi Adjo',
  usr_yao: 'Yao Amegah',
  usr_essi: 'Essi Dogbe',
  agt_achats: 'Agent Achats',
  agt_kete: 'Kete',
  'whatsapp:22890000001': 'M. Agbeko',
};
const nameOf = (who: { id: string }) => names[who.id] ?? '';
const AFI = { kind: 'person', id: 'usr_afi' } as const;
const at = (day: number, h: number, m: number) =>
  new Date(Date.UTC(2026, 9, day, h, m)).toISOString();
let counter = 0;
const message = (
  extra: Partial<ShownMessage> & Pick<ShownMessage, 'author' | 'at'>,
): ShownMessage => {
  const id = `msg_preview${String(++counter).padStart(4, '0')}`;
  return {
    id,
    first: id,
    thread: 'thr_colombe0001',
    text: '',
    for: 'information',
    via: 'kete',
    edits: 0,
    readBy: [],
    reactions: [],
    ...extra,
  };
};

const opening: ShownMessage[] = [
  message({
    author: { kind: 'person', id: 'usr_kossi' },
    at: at(12, 9, 2),
    text: 'Bon de commande signé reçu de l’école. Pose prévue la semaine du 19, Yao la mène.',
    attachments: [
      { id: 'fil_bdc', name: 'Bon de commande signé.pdf', media_type: 'application/pdf' },
    ],
    readBy: [
      { kind: 'person', id: 'usr_afi', at: at(12, 9, 12) },
      { kind: 'person', id: 'usr_yao', at: at(12, 9, 40) },
    ],
    reactions: [{ emoji: '👍', by: [AFI, { kind: 'person', id: 'usr_yao' }] }],
  }),
  message({
    author: { kind: 'agent', id: 'agt_achats' },
    at: at(12, 16, 40),
    text: 'J’ai comparé trois offres. La moins chère dépasse le poste câbles de 45 000 F : il faut l’accord de la direction.',
  }),
  message({
    author: { kind: 'contact', id: 'whatsapp:22890000001' },
    at: at(13, 7, 2),
    via: 'whatsapp',
    visibility: 'outside',
    text: 'Bonjour, quelle date pour la pose ? Les parents demandent.',
  }),
  message({
    author: { kind: 'person', id: 'usr_yao' },
    at: at(13, 7, 41),
    text: 'Les gaines sont posées côté nord. Il me faut les câbles avant vendredi pour tenir lundi.',
    attachments: [
      { id: 'fil_p1', name: 'gaines-nord.jpg', media_type: 'image/jpeg' },
      { id: 'fil_p2', name: 'tableau.jpg', media_type: 'image/jpeg' },
      { id: 'fil_p3', name: 'salle-3.jpg', media_type: 'image/jpeg' },
      { id: 'fil_p4', name: 'salle-4.jpg', media_type: 'image/jpeg' },
    ],
  }),
  message({
    author: { kind: 'person', id: 'usr_yao' },
    at: at(13, 7, 44),
    attachments: [
      {
        id: 'fil_vocal',
        name: 'vocal.ogg',
        media_type: 'audio/ogg',
        duration_ms: 42000,
        transcript:
          'Bon, pour jeudi : si Kossi n’est pas là, je réceptionne moi-même le matériel à 10 h.',
      },
    ],
  }),
  message({
    author: { kind: 'person', id: 'usr_essi' },
    at: at(13, 7, 52),
    text: 'Le fournisseur annonce un nouveau tarif au 1er novembre, à prendre en compte pour #D-2026-0031. https://elecpro.tg/cable-2-5',
    references: [{ kind: 'quote', id: 'D-2026-0031', app: 'finance' }],
  }),
  message({
    author: { kind: 'person', id: 'usr_kossi' },
    at: at(13, 7, 55),
    deleted: { by: { kind: 'person', id: 'usr_kossi' }, at: at(13, 7, 56) },
  }),
  message({
    author: { kind: 'agent', id: 'agt_kete' },
    at: at(13, 8, 6),
    only_for: { kind: 'person', id: 'usr_afi' },
    text: 'Avec ElecPro, la marge prévue passe de **240 000 F** à **195 000 F** (29,5 %). Elle reste au-dessus de votre seuil de 25 %.',
  }),
];

const people: FieldPick[] = [
  { id: 'usr_kossi', label: 'Kossi', hint: 'chef de projet · tient le fil' },
  { id: 'usr_yao', label: 'Yao', hint: 'technicien' },
  { id: 'agt_kete', label: 'Kete', hint: 'répond avec vos droits' },
];
const objects: FieldPick[] = [
  { id: 'D-2026-0031', label: 'D-2026-0031', hint: 'devis · validé · 660 000 F' },
  { id: 'F-2026-0007', label: 'F-2026-0007', hint: 'facture · à valider' },
];

export function ThreadsPage() {
  const [messages, setMessages] = useState(opening);
  const [infos, setInfos] = useState(false);
  const [outside, setOutside] = useState(false);
  const [action, setAction] = useState(false);
  const [level, setLevel] = useState<'all' | 'mentions' | 'none'>('all');
  const [reply, setReply] = useState<ShownMessage | null>(null);
  const react = (target: ShownMessage, emoji: string) =>
    setMessages((all) =>
      all.map((m) => {
        if (m.first !== target.first) return m;
        const found = m.reactions.find((r) => r.emoji === emoji);
        const mine = found?.by.some((who) => who.id === AFI.id);
        const reactions = found
          ? m.reactions
              .map((r) =>
                r.emoji !== emoji
                  ? r
                  : { ...r, by: mine ? r.by.filter((w) => w.id !== AFI.id) : [...r.by, AFI] },
              )
              .filter((r) => r.by.length > 0)
          : [...m.reactions, { emoji, by: [AFI] }];
        return { ...m, reactions };
      }),
    );
  const byId = new Map(messages.map((m) => [m.first, m]));
  return (
    <div className="h-screen bg-canvas text-fg">
      <ConversationFrame
        words={words}
        asideShown={infos}
        onAsideClose={() => setInfos(false)}
        list={
          <ThreadListPanel
            words={words}
            hidden
            current="thr_colombe0001"
            sections={[
              {
                label: 'Actifs',
                items: [
                  {
                    id: 'thr_colombe0001',
                    href: '#',
                    title: 'Éclairage — La Colombe',
                    badge: { text: 'PR' },
                    unread: 2,
                    last: 'Yao : 🎤 vocal · 0:42',
                  },
                  {
                    id: 'thr_kete',
                    href: '#',
                    title: 'Kete',
                    badge: { text: '', tone: 'agent' },
                    last: 'le point du matin',
                  },
                  {
                    id: 'thr_direction',
                    href: '#',
                    title: 'Direction',
                    badge: { text: '#', tone: 'group' },
                    unread: 1,
                    last: 'Essi : l’ordinateur de Phébé a un souci',
                  },
                ],
              },
              {
                label: 'Agents',
                items: [
                  {
                    id: 'thr_relances',
                    href: '#',
                    title: 'Agent Relances',
                    badge: { text: '', tone: 'agent' },
                    state: 'needs',
                    last: '3 relances attendent votre accord',
                  },
                  {
                    id: 'thr_achats',
                    href: '#',
                    title: 'Agent Achats',
                    badge: { text: '', tone: 'agent' },
                    state: 'working',
                    last: 'compare les délais · étape 4 sur 5',
                  },
                ],
              },
            ]}
          />
        }
        aside={
          infos ? (
            <ThreadInfo
              words={words}
              media={{
                photos: [1, 2, 3, 4].map((n) => ({
                  file: `fil_p${n}`,
                  name: `photo-${n}.jpg`,
                  mediaType: 'video/mp4',
                  message: 'msg_preview0004',
                  at: at(13, 7, 41),
                })),
                documents: [
                  {
                    file: 'fil_bdc',
                    name: 'Bon de commande signé.pdf',
                    message: 'msg_preview0001',
                    at: at(12, 9, 2),
                    version: 1,
                  },
                ],
                links: [
                  {
                    url: 'https://elecpro.tg/cable-2-5',
                    message: 'msg_preview0006',
                    at: at(13, 7, 52),
                  },
                ],
                voices: [
                  {
                    file: 'fil_vocal',
                    name: 'vocal.ogg',
                    message: 'msg_preview0005',
                    at: at(13, 7, 44),
                    durationMs: 42000,
                    transcript: '…je réceptionne moi-même le matériel à 10 h.',
                  },
                ],
                pins: [{ message: 'msg_preview0001', at: at(12, 9, 3) }],
              }}
              fileHref={() => '#'}
              messageHref={(id) => `#${id}`}
              level={level}
              onLevel={setLevel}
              onSearch={() => undefined}
              actions={{
                count: '3 / 11',
                node: (
                  <p className="text-[12.5px] text-fg-muted">
                    Commander les câbles · Kossi, déléguée à l’Agent Achats · rendre à Kossi
                  </p>
                ),
              }}
              decisions={{
                count: '5',
                node: (
                  <p className="text-[12.5px] text-fg-muted">
                    Devis D-2026-0031 validé · Afi · 2 oct.
                  </p>
                ),
              }}
              members={{
                count: '8',
                node: (
                  <p className="text-[12.5px] text-fg-muted">
                    Kossi tient le fil · Agent Achats, délégué
                  </p>
                ),
              }}
              onState={() => setInfos(false)}
            />
          ) : (
            <div className="grid gap-3 text-[13px]">
              <button
                type="button"
                onClick={() => setInfos(true)}
                className="justify-self-start rounded-[5px] border border-line-control px-2 py-1 text-[12px] font-semibold"
              >
                Infos du fil
              </button>
              <h4 className="text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
                Le projet
              </h4>
              <p>École La Colombe · vendu 660 000 F · encaissé 198 000 F</p>
              <h4 className="text-[11px] font-semibold tracking-[0.06em] text-fg-muted uppercase">
                Qui tient quoi
              </h4>
              <p>Commander les câbles · Kossi · délégué à l’Agent Achats · rendre à Kossi</p>
            </div>
          )
        }
      >
        <section className="flex min-h-0 min-w-0 flex-col bg-canvas">
          <ThreadHeader
            words={words}
            title="Éclairage — La Colombe"
            subtitle="Projet · tenu par Kossi Adjo · 6 membres, 2 abonnés"
            badge={
              <span className="grid size-[30px] place-items-center rounded-[5px] bg-accent text-[10px] font-bold text-on-action">
                PR
              </span>
            }
            onTitle={() => setInfos(true)}
            backHref="#"
            actions={
              <button
                type="button"
                onClick={() => setInfos(true)}
                className="inline-flex h-[26px] items-center gap-1 rounded-[5px] border border-line-control px-2 text-[12px] font-semibold"
              >
                <CanvasIcon name="more" size={13} /> Infos du fil
              </button>
            }
          />
          <PinBar
            pins={[
              { id: 'p1', label: 'Devis D-2026-0031 v2 · validé', href: '#msg_preview0001' },
              { id: 'p2', label: 'Adresse du chantier : rue 245, Bè-Kpota', href: '#' },
            ]}
          />
          <MessageStream
            label="Messages"
            words={words}
            messages={messages}
            unreadFrom="msg_preview0004"
            typing={['Yao']}
            older
            onOlder={() => undefined}
            renderMessage={(m) => (
              <MessageItem
                key={m.first}
                message={m}
                words={words}
                me={AFI}
                nameOf={nameOf}
                quoted={m.reply_to ? byId.get(m.reply_to) : undefined}
                fileHref={() => '#'}
                renderReference={(reference) => (
                  <span className="inline-flex h-[22px] items-center gap-1 rounded-[5px] bg-state-info-surface px-1.5 text-[12.5px] font-semibold text-state-info-fg">
                    <CanvasIcon name="hash" size={12} />
                    {reference.id}{' '}
                    <span className="font-normal text-fg-soft">validé · 660 000 F</span>
                  </span>
                )}
                preview={(url) =>
                  url.includes('elecpro')
                    ? {
                        title: 'Câble 2,5 mm², rouleau de 100 m',
                        detail: 'ElecPro Lomé · 48 500 F TTC · disponible',
                      }
                    : null
                }
                run={
                  m.author.id === 'agt_achats'
                    ? {
                        title: 'Offres de câbles',
                        meta: 'a travaillé 3 min · 5 étapes',
                        steps: [
                          {
                            state: 'done',
                            label: 'Lire le besoin dans le fil du projet',
                            tag: 'lire',
                          },
                          {
                            state: 'done',
                            label: 'Lire les tarifs de 4 fournisseurs habituels',
                            tag: 'lire',
                          },
                          {
                            state: 'done',
                            label: 'Demander à l’Agent Facturation le reste du poste câbles',
                            tag: 'entre agents',
                          },
                          { state: 'done', label: 'Comparer prix et délais', tag: 'calculer' },
                          { state: 'done', label: 'Préparer la demande d’achat', tag: 'brouillon' },
                        ],
                      }
                    : m.author.id === 'agt_kete'
                      ? {
                          title: 'A lu 2 sources',
                          meta: '4 s',
                          steps: [
                            { state: 'done', label: 'Lire Kete Finance', tag: 'lire' },
                            { state: 'done', label: 'Lire la politique de marge', tag: 'lire' },
                          ],
                        }
                      : null
                }
                quickEmojis={['👍', '✅', '👀']}
                onReact={(emoji) => react(m, emoji)}
                onReply={() => setReply(m)}
                onAction={() => setAction(true)}
                onShare={() => undefined}
                menu={[
                  {
                    id: 'pin',
                    label: 'Épingler dans le fil',
                    icon: 'pin',
                    onSelect: () => undefined,
                  },
                  {
                    id: 'create',
                    label: 'Créer… un brouillon',
                    icon: 'spark',
                    onSelect: () => undefined,
                  },
                  {
                    id: 'move',
                    label: 'Déplacer vers un fil',
                    icon: 'ext',
                    onSelect: () => undefined,
                  },
                ]}
              />
            )}
          />
          <div className="flex-none border-t border-line bg-surface px-4 pt-2 pb-3 max-[860px]:px-2.5">
            <MessageField
              words={{
                field: 'Écrire dans le fil',
                placeholder: 'Écrire dans « Éclairage — La Colombe »…',
                send: 'Envoyer',
                stop: 'Arrêter',
                add: 'Ajouter',
                attach: 'Photo, vidéo ou document',
                mention: 'Mentionner quelqu’un',
                cite: 'Citer un objet',
                emoji: 'Emoji',
                moreEmoji: 'Tous les emojis…',
                remove: 'Retirer',
                cancelReply: 'Ne plus répondre',
                record: 'Enregistrer un vocal',
                recording: '‹ glisser pour annuler',
                cancelRecording: 'Annuler',
                sendRecording: 'Envoyer le vocal',
                dictate: 'Dicter',
              }}
              draftKey="preview-colombe"
              triggers={['@', '#']}
              search={(trigger, query) =>
                (trigger === '@' ? people : objects).filter((p) =>
                  p.label.toLowerCase().includes(query.toLowerCase()),
                )
              }
              emojis={['👍', '✅', '🙏', '👀', '😂', '❤️', '🎉', '⚠️']}
              voice={{ onRecorded: () => undefined }}
              files={{ items: [], onFiles: () => undefined, onRemove: () => undefined }}
              reply={
                reply
                  ? {
                      text: `Réponse à ${nameOf(reply.author)} : « ${reply.text} »`,
                      onCancel: () => setReply(null),
                    }
                  : null
              }
              tone={outside ? 'alert' : 'plain'}
              below={
                <>
                  {action && (
                    <p className="flex flex-wrap items-center gap-1.5 px-3 pb-1.5 text-[12.5px] font-semibold text-state-verify-fg">
                      <CanvasIcon name="ok" size={13} /> Pour action → Yao Amegah · jeudi 15 ·
                      urgente
                    </p>
                  )}
                  {outside && (
                    <p className="flex items-start gap-1.5 px-3 pb-1.5 text-[12px] font-semibold text-state-verify-fg">
                      <CanvasIcon name="whatsapp" size={13} /> Part au client · M. Agbeko par
                      WhatsApp · fenêtre ouverte jusqu’à demain 7 h 02
                    </p>
                  )}
                </>
              }
              toggles={
                <>
                  <FieldToggle
                    pressed={outside}
                    onToggle={() => setOutside((o) => !o)}
                    icon={outside ? 'whatsapp' : 'lock'}
                  >
                    {outside ? 'Au client' : 'Interne'}
                  </FieldToggle>
                  <FieldToggle pressed={action} onToggle={() => setAction((o) => !o)} icon="ok">
                    {action ? 'Pour action' : 'Pour info'}
                  </FieldToggle>
                </>
              }
              onSend={(text) => {
                setMessages((all) => [
                  ...all,
                  message({
                    author: AFI,
                    at: new Date().toISOString(),
                    text,
                    ...(reply ? { reply_to: reply.first } : {}),
                  }),
                ]);
                setReply(null);
                setOutside(false);
                setAction(false);
              }}
              hint="Entrée envoie · Maj+Entrée va à la ligne · glissez des fichiers n’importe où"
            />
          </div>
        </section>
      </ConversationFrame>
    </div>
  );
}
