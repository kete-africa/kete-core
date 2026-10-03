import { advance } from './pipeline.js';
import type { Ports } from './ports.js';
import type { RequestStatus } from './request.js';
import type { RequestStore } from './store.js';

// One run of a request (spec 048): its steps, one after another, the progress saved after each.
// A step that waits (the coding agent at work) schedules the next run; an error fails the request
// and is reported — the job runs again only if the failure was passing (retries of the queue).

export type Schedule = (
  requestId: string,
  organizationId: string,
  afterSeconds: number,
) => Promise<void>;

const statusOf = (done: string[]): RequestStatus =>
  done.includes('pull-request')
    ? 'review'
    : done.includes('deploy')
      ? 'coding'
      : done.length > 0
        ? 'building'
        : 'queued';

export async function work(
  input: { requestId: string; organizationId: string },
  store: RequestStore,
  ports: Ports,
  schedule: Schedule,
): Promise<void> {
  const stored = await store.get(input.organizationId, input.requestId);
  if (!stored || stored.status === 'review' || stored.status === 'failed') return;
  let progress = stored.progress;
  try {
    for (let guard = 0; guard < 20; guard += 1) {
      const step = await advance(stored.request, progress, ports);
      progress = step.progress;
      await store.save(input.organizationId, input.requestId, statusOf(progress.done), progress);
      if (step.next === 'done') return;
      if (step.next === 'wait') {
        await schedule(input.requestId, input.organizationId, step.seconds);
        return;
      }
    }
  } catch (error) {
    const failed = { ...progress, error: (error as Error).message.slice(0, 2000) };
    await store.save(input.organizationId, input.requestId, 'failed', failed);
    await ports.report(stored.request, 'failed', failed).catch(() => undefined);
  }
}
