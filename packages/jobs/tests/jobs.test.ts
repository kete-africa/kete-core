import { randomBytes } from 'node:crypto';
import { EmailError, memorySender, type OutgoingEmail } from '@kete/notify';
import { testDatabaseUrls } from '@kete/testing';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createJobs, defineJob, queuedSender, sendEmailJob, type Jobs } from '../src/index.js';

const schema = `kete_jobs_${randomBytes(4).toString('hex')}`;
let ownerUrl = '';
let jobs: Jobs | undefined;

const email: OutgoingEmail = {
  from: 'Kete <compte@kete.africa>',
  to: 'ama@example.com',
  subject: 'Bonjour',
  html: '<p>Bonjour</p>',
  text: 'Bonjour',
};

async function until(condition: () => boolean, seconds = 30): Promise<void> {
  const deadline = Date.now() + seconds * 1000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('The job did not run in time.');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

const sender = memorySender();
let flakyAttempts = 0;
let refusedAttempts = 0;

beforeAll(async () => {
  ({ ownerUrl } = await testDatabaseUrls());
  const refusing = sendEmailJob({
    name: 'refusing',
    async send() {
      refusedAttempts += 1;
      throw new EmailError('provider_refused', 'The provider refused it.');
    },
  });
  const flaky = defineJob<{ n: number }>({
    name: 'flaky',
    retryLimit: 2,
    retryDelay: 1,
    retryBackoff: false,
    async handle() {
      flakyAttempts += 1;
      if (flakyAttempts === 1) throw new Error('The provider is down.');
    },
  });
  jobs = createJobs({
    connectionString: ownerUrl,
    schema,
    jobs: [sendEmailJob(sender), { ...refusing, name: 'send-email-refused' }, flaky] as never,
  });
  await jobs.start();
});

afterAll(async () => {
  await jobs?.stop();
  const owner = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  await owner.query(`drop schema if exists ${schema} cascade`);
  await owner.end();
});

describe('background jobs', () => {
  it('send the e-mails queued by the web process, through the real sender', async () => {
    const queued = queuedSender(jobs as Jobs);
    const sent = await queued.send(email);
    expect(sent.id).toBeTruthy();
    await until(() => sender.sent.length === 1);
    expect(sender.sent[0]).toMatchObject({ to: 'ama@example.com', subject: 'Bonjour' });
  });

  it('never retry an e-mail the provider refused', async () => {
    await (jobs as Jobs).send('send-email-refused', email);
    await until(() => refusedAttempts === 1);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(refusedAttempts).toBe(1);
  });

  it('retry a job that failed for a passing reason', async () => {
    await (jobs as Jobs).send('flaky', { n: 1 });
    await until(() => flakyAttempts === 2, 45);
    expect(flakyAttempts).toBe(2);
  });

  it('refuse a job nobody declared, and a badly named one', async () => {
    await expect((jobs as Jobs).send('nope', {})).rejects.toThrow(/Unknown job/);
    expect(() => defineJob({ name: 'Bad Name', handle: async () => undefined })).toThrow();
  });
});
