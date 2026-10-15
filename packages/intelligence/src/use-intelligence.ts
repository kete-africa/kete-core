import { useCallback, useRef, useState } from 'react';
import { newTurn, readEvents, reduceTurn, type Turn } from './turn.js';

// The drawer's state (spec 101): one question at a time, its answer drawn as its events come,
// « Arrêter » that stops it — what was read stays, nothing more is done.

export interface PastTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** Sends a question to the product's address and answers its stream (`intelligenceResponse`). */
export type AskTransport = (
  question: string,
  history: PastTurn[],
  signal: AbortSignal,
) => Promise<Response>;

/** A transport to the product's own address: a POST of the question and the conversation so far. */
export function postTo(endpoint: string, extra: Record<string, unknown> = {}): AskTransport {
  return (question, history, signal) =>
    fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question, history, ...extra }),
      signal,
    });
}

export function useIntelligence(ask: AskTransport) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const past = useRef<Turn[]>([]);
  past.current = turns;

  const send = useCallback(
    async (question: string) => {
      const asked = question.trim();
      if (!asked || controller.current) return;
      const id = crypto.randomUUID();
      const history = past.current.flatMap((turn): PastTurn[] => [
        { role: 'user', text: turn.question },
        ...(turn.text ? [{ role: 'assistant' as const, text: turn.text }] : []),
      ]);
      setTurns((list) => [...list, newTurn(id, asked, Date.now())]);
      setRunning(true);
      const abort = new AbortController();
      controller.current = abort;
      const change = (update: (turn: Turn) => Turn) =>
        setTurns((list) => list.map((turn) => (turn.id === id ? update(turn) : turn)));
      try {
        const response = await ask(asked, history.slice(-24), abort.signal);
        if (!response.ok || !response.body) {
          change((turn) => ({ ...turn, state: 'failed', reason: 'unavailable' }));
          return;
        }
        for await (const event of readEvents(response.body))
          change((turn) => reduceTurn(turn, event));
        // A stream that ends without its last word still ends the turn.
        change((turn) => (turn.state === 'running' ? { ...turn, state: 'done' } : turn));
      } catch {
        change((turn) =>
          abort.signal.aborted
            ? { ...turn, state: 'stopped' }
            : { ...turn, state: 'failed', reason: 'unavailable' },
        );
      } finally {
        controller.current = null;
        setRunning(false);
      }
    },
    [ask],
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const clear = useCallback(() => {
    if (!controller.current) setTurns([]);
  }, []);

  return { turns, running, send, stop, clear };
}
