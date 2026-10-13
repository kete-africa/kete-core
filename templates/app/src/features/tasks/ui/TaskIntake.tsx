import { Button, TextAreaField } from '@kete/design';
import { useState } from 'react';
import * as m from '@/paraglide/messages.js';

/** A photo's bytes, as text for the server: what the reading is given. */
function base64Of(file: File): Promise<string> {
  return file.arrayBuffer().then((buffer) => {
    let binary = '';
    for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
}

/**
 * A task from what was received (kete-core spec 098): a message pasted, or a photo of a note. The
 * reading prepares a draft whose every field says where it comes from; she verifies it.
 */
export function TaskIntake({
  onRead,
}: {
  onRead(
    input: { text: string } | { photo: { base64: string; contentType: string } },
  ): Promise<void>;
}) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        const reading = file
          ? base64Of(file).then((base64) =>
              onRead({ photo: { base64, contentType: file.type || 'image/jpeg' } }),
            )
          : onRead({ text });
        void reading.finally(() => setBusy(false));
      }}
    >
      <TextAreaField
        label={m.intake_message()}
        hint={m.intake_message_hint()}
        value={text}
        rows={3}
        maxLength={4000}
        onChange={setText}
      />
      <label className="flex flex-col gap-1.5 text-body-sm font-semibold">
        {m.intake_photo()}
        <input
          type="file"
          accept="image/*"
          className="font-normal"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <div>
        <Button type="submit" variant="secondary" disabled={busy || (!file && text.trim() === '')}>
          {m.intake_read()}
        </Button>
      </div>
    </form>
  );
}
