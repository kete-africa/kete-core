// Every word the threads' screen says, given by the product in its language (no word is written
// here): a product passes its messages; dates and hours come already formatted for her.

export interface ConversationWords {
  /** « 7 h 41 » */
  time: (iso: string) => string;
  /** « mardi 13 octobre » */
  day: (iso: string) => string;
  someone: string;
  agent: string;
  kete: string;
  newMessages: string;
  /** « 2 nouveaux » */
  jumpToNew: (count: number) => string;
  older: string;
  typing: (names: string[]) => string;
  /** « Lu par Afi 9 h 12 · Yao 9 h 40 » */
  readBy: (readers: string[]) => string;
  sent: string;
  edited: string;
  showOriginal: string;
  movedHere: string;
  movedAway: string;
  deleted: (name: string) => string;
  imported: string;
  onlyForYou: string;
  onlyForYouWhy: string;
  share: string;
  shared: string;
  via: { whatsapp: string; mail: string; telegram: string; form: string };
  toClient: string;
  internal: string;
  forAction: string;
  forInformation: string;
  reply: string;
  react: (emoji: string) => string;
  more: string;
  close: string;
  transcript: string;
  play: string;
  speed: string;
  replyingTo: (name: string, text: string) => string;
  steps: string;
  fold: string;
  stop: string;
  /** « Infos du fil » */
  infos: string;
  state: string;
  searchThread: string;
  notifications: string;
  notifyLevel: { all: string; mentions: string; none: string };
  notifyHint: string;
  categories: {
    pins: string;
    photos: string;
    documents: string;
    links: string;
    voices: string;
    actions: string;
    decisions: string;
    members: string;
  };
  nothingHere: string;
  version: (n: number) => string;
  list: string;
  back: string;
  states: { needs: string; working: string; finished: string; idle: string };
  resolved: string;
  unread: (count: number) => string;
}
