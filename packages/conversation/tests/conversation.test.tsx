import { MessageField, type MessageFieldWords } from '@kete/design';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AgentRun,
  ConversationFrame,
  MessageItem,
  MessageStream,
  PinBar,
  ThreadHeader,
  ThreadInfo,
  ThreadListPanel,
  type ConversationWords,
  type ShownMessage,
} from '../src/index.js';

// Spec 140, FR-018 and FR-019: the one composer and the threads' screen, as the canvas v6.2 draws
// them — every word given here, as a product gives them.

const words: ConversationWords = {
  time: (iso) => iso.slice(11, 16),
  day: (iso) => iso.slice(0, 10),
  someone: 'Quelqu’un',
  agent: 'agent',
  kete: 'Kete',
  newMessages: 'Nouveaux messages',
  jumpToNew: (n) => `${n} nouveaux`,
  older: 'Plus anciens',
  typing: (names) => `${names.join(', ')} écrit…`,
  readBy: (readers) => `Lu par ${readers.join(' · ')}`,
  sent: 'Envoyé',
  edited: 'modifié',
  showOriginal: 'voir l’original',
  movedHere: 'déplacé ici',
  movedAway: 'Déplacé',
  deleted: (name) => `Message supprimé par ${name}`,
  imported: 'importé',
  onlyForYou: 'seulement pour vous',
  onlyForYouWhy: 'Tous les membres ne peuvent pas le lire.',
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
  nothingHere: 'Rien ici',
  version: (n) => `v${n}`,
  list: 'Fils',
  back: 'Retour',
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
  usr_yao: 'Yao Amegah',
  usr_afi: 'Afi Mensah',
  agt_kete: 'Kete',
};
const nameOf = (who: { id: string }) => names[who.id] ?? '';
const afi = { kind: 'person', id: 'usr_afi' } as const;

const base = (extra: Partial<ShownMessage>): ShownMessage => ({
  id: 'msg_0000000001',
  first: 'msg_0000000001',
  thread: 'thr_0000000001',
  author: { kind: 'person', id: 'usr_yao' },
  text: '',
  for: 'information',
  via: 'kete',
  at: '2026-10-13T07:41:00.000Z',
  edits: 0,
  readBy: [],
  reactions: [],
  ...extra,
});

describe('a message as the canvas v6.2 draws it', () => {
  it('shows photos, a voice note with its transcript, a citation, reactions and who read it', () => {
    const html = renderToStaticMarkup(
      <MessageItem
        message={base({
          text: 'Les gaines sont posées pour #D-2026-0031',
          references: [{ kind: 'quote', id: 'D-2026-0031', app: 'finance' }],
          attachments: [
            { id: 'fil_1', name: 'gaines.jpg', media_type: 'image/jpeg' },
            {
              id: 'fil_2',
              name: 'vocal.ogg',
              media_type: 'audio/ogg',
              duration_ms: 42000,
              transcript: 'je réceptionne à 10 h',
            },
            { id: 'fil_3', name: 'plan.pdf', media_type: 'application/pdf' },
          ],
          reactions: [{ emoji: '👍', by: [afi] }],
          readBy: [{ kind: 'person', id: 'usr_afi', at: '2026-10-13T07:45:00.000Z' }],
        })}
        words={words}
        me={afi}
        nameOf={nameOf}
        fileHref={(id) => `/files/${id}`}
        renderReference={(reference) => <b data-ref={reference.id}>devis validé</b>}
        quickEmojis={['👍', '✅', '👀']}
        onReact={() => undefined}
        onReply={() => undefined}
        menu={[{ id: 'pin', label: 'Épingler', icon: 'pin', onSelect: () => undefined }]}
      />,
    );
    expect(html).toContain('src="/files/fil_1"');
    expect(html).toContain('0:42');
    expect(html).toContain('je réceptionne à 10 h');
    expect(html).toContain('data-ref="D-2026-0031"');
    expect(html).toContain('Lu par Afi Mensah 07:45');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Réagir ✅');
    expect(html).not.toMatch(/border-l-[2-9]|border-left/);
  });

  it('says a message was taken back, and offers to share one only for her', () => {
    const gone = renderToStaticMarkup(
      <MessageItem
        message={base({
          text: '',
          deleted: { by: { kind: 'person', id: 'usr_yao' }, at: '2026-10-13T07:55:00.000Z' },
        })}
        words={words}
        me={afi}
        nameOf={nameOf}
        fileHref={(id) => id}
      />,
    );
    expect(gone).toContain('Message supprimé par Yao Amegah');
    const mine = renderToStaticMarkup(
      <MessageItem
        message={base({
          author: { kind: 'agent', id: 'agt_kete' },
          text: 'La marge passe à **195 000 F**.',
          only_for: { kind: 'person', id: 'usr_afi' },
        })}
        words={words}
        me={afi}
        nameOf={nameOf}
        fileHref={(id) => id}
        run={{
          title: 'A lu 3 sources',
          meta: '6 s',
          steps: [{ state: 'done', label: 'Lire ce fil', tag: 'lire' }],
        }}
        onShare={() => undefined}
      />,
    );
    expect(mine).toContain('seulement pour vous');
    expect(mine).toContain('Partager dans le fil');
    expect(mine).toContain('<strong>195 000 F</strong>');
    expect(mine).toContain('A lu 3 sources');
  });

  it('tags an agent’s words « agent », never Kete’s own (D-061)', () => {
    const said = (id: string) =>
      renderToStaticMarkup(
        <MessageItem
          message={base({ author: { kind: 'agent', id }, text: 'Voici les factures.' })}
          words={words}
          me={afi}
          nameOf={nameOf}
          fileHref={(file) => file}
        />,
      );
    expect(said('agt_relances')).toContain('>agent</span>');
    expect(said('agt_assistant')).not.toContain('>agent</span>');
  });
});

describe('the frame, the stream and « Infos du fil »', () => {
  it('draws days, the line of new messages, who is writing, and the agents’ states in the list', () => {
    const messages = [
      base({ text: 'un' }),
      base({
        id: 'msg_0000000002',
        first: 'msg_0000000002',
        text: 'deux',
        at: '2026-10-14T08:00:00.000Z',
      }),
    ];
    const html = renderToStaticMarkup(
      <ConversationFrame
        words={words}
        asideShown={false}
        onAsideClose={() => undefined}
        list={
          <ThreadListPanel
            words={words}
            current="thr_0000000001"
            sections={[
              {
                label: 'Actifs',
                items: [
                  { id: 'thr_0000000001', href: '#', title: 'Éclairage — La Colombe', unread: 2 },
                ],
              },
              {
                label: 'Agents',
                items: [
                  {
                    id: 'thr_0000000002',
                    href: '#',
                    title: 'Agent Relances',
                    badge: { text: '', tone: 'agent' },
                    state: 'needs',
                  },
                ],
              },
            ]}
          />
        }
        aside={
          <ThreadInfo
            words={words}
            media={{
              photos: [],
              documents: [
                {
                  file: 'fil_3',
                  name: 'plan.pdf',
                  message: 'msg_0000000001',
                  at: '2026-10-13T07:41:00.000Z',
                  version: 2,
                },
              ],
              links: [],
              voices: [],
              pins: [],
            }}
            fileHref={(id) => id}
            messageHref={(id) => `#${id}`}
            level="mentions"
            onLevel={() => undefined}
            actions={{ count: '3 / 11', node: <p>actions</p> }}
          />
        }
      >
        <section>
          <ThreadHeader title="Éclairage — La Colombe" words={words} onTitle={() => undefined} />
          <PinBar pins={[{ id: 'p', label: 'Devis v2', href: '#msg_0000000001' }]} />
          <MessageStream
            label="Messages"
            messages={messages}
            words={words}
            unreadFrom="msg_0000000002"
            typing={['Yao']}
            renderMessage={(message) => <li key={message.first}>{message.text}</li>}
          />
        </section>
      </ConversationFrame>,
    );
    expect(html).toContain('2026-10-13');
    expect(html).toContain('2026-10-14');
    expect(html).toContain('Nouveaux messages');
    expect(html).toContain('Yao écrit…');
    expect(html).toContain('title="A besoin de vous"');
    expect(html).toContain('2 non lus');
    expect(html).toContain('Infos du fil');
    expect(html).toContain('3 / 11');
    expect(html).toContain('Devis v2');
  });

  it('folds an agent’s work once finished, and shows it open while it works', () => {
    const working = renderToStaticMarkup(
      <AgentRun
        words={words}
        run={{
          title: 'Gaines',
          meta: 'travaille',
          steps: [{ state: 'now', label: 'Comparer' }],
          live: 'compare…',
          onStop: () => undefined,
        }}
      />,
    );
    expect(working).toContain('Comparer');
    expect(working).toContain('Arrêter');
    const done = renderToStaticMarkup(
      <AgentRun
        words={words}
        run={{ title: 'Gaines', meta: '2 min', steps: [{ state: 'done', label: 'Comparer' }] }}
      />,
    );
    expect(done).not.toContain('Comparer');
    expect(done).toContain('Voir les étapes');
  });
});

describe('the one composer (FR-018)', () => {
  const fieldWords: MessageFieldWords = {
    field: 'Écrire dans le fil',
    placeholder: 'Écrire…',
    send: 'Envoyer',
    stop: 'Arrêter',
    add: 'Ajouter',
    attach: 'Photo, document',
    mention: 'Mentionner',
    cite: 'Citer',
    emoji: 'Emoji',
    moreEmoji: 'Tous les emojis',
    remove: 'Retirer',
    cancelReply: 'Ne plus répondre',
    record: 'Enregistrer un vocal',
    recording: 'glisser pour annuler',
    cancelRecording: 'Annuler',
    sendRecording: 'Envoyer le vocal',
    dictate: 'Dicter',
  };

  it('starts with 🎤, offers @ and #, and frames a message to the outside', () => {
    const html = renderToStaticMarkup(
      <MessageField
        words={fieldWords}
        onSend={() => undefined}
        triggers={['@', '#']}
        voice={{ onRecorded: () => undefined }}
        files={{
          items: [{ id: 'f', name: 'dalle.jpg', state: 'ready', kind: 'image' }],
          onFiles: () => undefined,
          onRemove: () => undefined,
        }}
        reply={{ text: 'Réponse à Yao', onCancel: () => undefined }}
        tone="alert"
        toggles={<span>Au client</span>}
      />,
    );
    expect(html).toContain('aria-label="Mentionner"');
    expect(html).toContain('aria-label="Citer"');
    expect(html).toContain('data-tone="alert"');
    expect(html).toContain('Réponse à Yao');
    expect(html).toContain('dalle.jpg');
    // A file is ready: ➤, not 🎤.
    expect(html).toContain('aria-label="Envoyer"');
  });
});
