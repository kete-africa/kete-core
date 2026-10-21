import type { SqlExecutor } from '@kete/tenancy';
import { pinsOf } from './comfort.js';
import { filesOf } from './files.js';
import { messagesOf, type Viewer } from './messages.js';

// What a thread holds (spec 140, FR-008), as « Infos du fil » shows it: photos and videos,
// documents with their versions, links, voice notes, pins — each naming the message where it was
// posted. A message taken back, or only for someone else, gives nothing.

export interface PostedFile {
  file: string;
  name: string;
  mediaType: string | null;
  message: string;
  by: { kind: string; id: string };
  at: string;
}

export interface ThreadMedia {
  photos: PostedFile[];
  documents: (PostedFile & { version: number })[];
  links: { url: string; message: string; by: { kind: string; id: string }; at: string }[];
  voices: (PostedFile & { durationMs: number | null; transcript: string | null })[];
  pins: { message: string; by: { kind: string; id: string }; at: string }[];
}

const URL = /\bhttps?:\/\/[^\s<>()«»"']+[^\s<>()«»"'.,;:!?]/g;

/** Everything a thread holds, the latest first. */
export async function mediaOf(
  db: SqlExecutor,
  threadId: string,
  options: { viewer?: Viewer } = {},
): Promise<ThreadMedia> {
  const messages = (await messagesOf(db, threadId, options)).filter((m) => !m.deleted).reverse();
  const versions = new Map((await filesOf(db, threadId)).map((file) => [file.id, file.version]));
  const media: ThreadMedia = { photos: [], documents: [], links: [], voices: [], pins: [] };
  for (const message of messages) {
    const posted = { message: message.first, by: message.author, at: message.at };
    for (const file of message.attachments ?? []) {
      const type = file.media_type ?? null;
      const item = { file: file.id, name: file.name, mediaType: type, ...posted };
      if (type?.startsWith('image/') || type?.startsWith('video/')) media.photos.push(item);
      else if (type?.startsWith('audio/')) {
        media.voices.push({
          ...item,
          durationMs: file.duration_ms ?? null,
          transcript: file.transcript ?? null,
        });
      } else media.documents.push({ ...item, version: versions.get(file.id) ?? 1 });
    }
    for (const url of new Set(message.text.match(URL) ?? [])) media.links.push({ url, ...posted });
  }
  media.pins = await pinsOf(db, threadId);
  return media;
}
