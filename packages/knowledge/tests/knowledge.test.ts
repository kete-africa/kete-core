import { inOrganization } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createSource,
  indexDocument,
  KnowledgeError,
  knowledgeMigrationSql,
  listDocuments,
  listSources,
  passagesOf,
  removeDocument,
  search,
  updateSource,
  type Embedder,
} from '../src/index.js';

// Spec 052: an organization's documents, searched by words and by meaning, only where the reader
// may read, each hit with what its citation needs.

const DIMENSIONS = 16;

/** A deterministic embedder: words hashed into a few dimensions. Nothing leaves the test. */
const fake: Embedder & { calls: number } = {
  dimensions: DIMENSIONS,
  calls: 0,
  async embed(texts) {
    this.calls += 1;
    return texts.map((text) => {
      const v = new Array<number>(DIMENSIONS).fill(0);
      for (const word of text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\W+/)) {
        if (word.length < 3) continue;
        let h = 0;
        for (const c of word) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        v[h % DIMENSIONS] = (v[h % DIMENSIONS] ?? 0) + 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  },
};

let db: TestSchema;
const as = <T>(organizationId: string, fn: Parameters<typeof inOrganization<T>>[2]) =>
  inOrganization(db.app, organizationId, fn);

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(knowledgeMigrationSql({ schema, appRole, dimensions: DIMENSIONS }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

const procedure = [
  'Procédure de maîtrise des non-conformités. Toute réclamation client ouvre une fiche de non-conformité dans les 48 heures.',
  'Analyse des causes : le responsable qualité réunit l’équipe et applique la méthode des cinq pourquoi.',
  'Vérification de l’efficacité : l’action corrective est vérifiée sous 30 jours, puis la fiche est close.',
];

describe('passages', () => {
  it('cuts a document page by page, so that each passage cites its page', async () => {
    const passages = await passagesOf(procedure);
    expect(passages.map((p) => p.page)).toEqual([1, 2, 3]);
    expect(await passagesOf(['Une seule page sans numéro.'])).toEqual([
      { text: 'Une seule page sans numéro.', page: null },
    ]);
  });
});

describe('the knowledge of an organization', () => {
  let quality = '';
  let sav = '';

  it('indexes documents in sources, each readable by its audience', async () => {
    await as('org_kya', async (client) => {
      quality = (
        await createSource(client, 'org_kya', {
          name: 'Procédures qualité',
          audience: ['everyone'],
        })
      ).sourceId;
      sav = (
        await createSource(client, 'org_kya', { name: 'Rapports SAV', audience: ['unit:sav'] })
      ).sourceId;
      const doc = await indexDocument(
        client,
        {
          organizationId: 'org_kya',
          sourceId: quality,
          title: 'Procédure NC v3',
          uri: 'https://docs.example/nc-v3.pdf',
          pages: procedure,
        },
        fake,
      );
      expect(doc).toMatchObject({ chunks: 3, unchanged: false });
      await indexDocument(
        client,
        {
          organizationId: 'org_kya',
          sourceId: sav,
          title: 'Rapport de visite Agoè',
          pages: [
            'Les batteries du site d’Agoè sont en fin de vie, autonomie de deux à trois semaines.',
          ],
        },
        fake,
      );
      expect((await listSources(client)).map((s) => [s.name, s.documents])).toEqual([
        ['Procédures qualité', 1],
        ['Rapports SAV', 1],
      ]);
    });
  });

  it('finds a passage by its words, with its title, page and source to cite', async () => {
    const hits = await as('org_kya', (client) =>
      search(client, { query: 'action corrective vérifiée', audience: ['everyone'] }, fake),
    );
    expect(hits[0]).toMatchObject({
      title: 'Procédure NC v3',
      page: 3,
      sourceName: 'Procédures qualité',
      uri: 'https://docs.example/nc-v3.pdf',
    });
  });

  it('shows a reader only the sources her keys open, and none that is switched off', async () => {
    const quality_only = await as('org_kya', (client) =>
      search(
        client,
        { query: 'batteries Agoè autonomie', audience: ['everyone', 'unit:qualite'] },
        fake,
      ),
    );
    expect(quality_only.every((h) => h.sourceName === 'Procédures qualité')).toBe(true);
    const with_sav = await as('org_kya', (client) =>
      search(
        client,
        { query: 'batteries Agoè autonomie', audience: ['everyone', 'unit:sav'] },
        fake,
      ),
    );
    expect(with_sav[0]).toMatchObject({ title: 'Rapport de visite Agoè' });
    await as('org_kya', (client) => updateSource(client, sav, { enabled: false }));
    const off = await as('org_kya', (client) =>
      search(
        client,
        { query: 'batteries Agoè autonomie', audience: ['everyone', 'unit:sav'] },
        fake,
      ),
    );
    expect(off.some((h) => h.sourceName === 'Rapports SAV')).toBe(false);
    expect(
      await as('org_kya', (client) => listSources(client, { audience: ['unit:sav'] })),
    ).toEqual([]);
  });

  it('keeps an unchanged document as it is, and replaces a new version', async () => {
    await as('org_kya', async (client) => {
      const [doc] = await listDocuments(client, quality);
      if (!doc) throw new Error('The procedure is indexed.');
      const calls = fake.calls;
      const same = await indexDocument(
        client,
        {
          organizationId: 'org_kya',
          sourceId: quality,
          documentId: doc.documentId,
          title: 'Procédure NC v3',
          pages: procedure,
        },
        fake,
      );
      expect(same.unchanged).toBe(true);
      expect(fake.calls).toBe(calls);
      const next = await indexDocument(
        client,
        {
          organizationId: 'org_kya',
          sourceId: quality,
          documentId: doc.documentId,
          title: 'Procédure NC v4',
          pages: ['Nouvelle version : la fiche est ouverte dans les 24 heures.'],
        },
        fake,
      );
      expect(next).toMatchObject({ documentId: doc.documentId, chunks: 1, unchanged: false });
      const hits = await search(client, { query: 'fiche 24 heures', audience: ['everyone'] }, fake);
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ title: 'Procédure NC v4', page: null });
      expect(await removeDocument(client, doc.documentId)).toBe(true);
      expect(
        await search(client, { query: 'fiche 24 heures', audience: ['everyone'] }, fake),
      ).toEqual([]);
    });
  });

  it('refuses a document without text, and keeps each organization alone', async () => {
    await expect(
      as('org_kya', (client) =>
        indexDocument(
          client,
          { organizationId: 'org_kya', sourceId: quality, title: 'Vide', pages: ['  '] },
          fake,
        ),
      ),
    ).rejects.toBeInstanceOf(KnowledgeError);
    await as('org_kya', (client) =>
      indexDocument(
        client,
        {
          organizationId: 'org_kya',
          sourceId: quality,
          title: 'Charte',
          pages: ['Charte qualité de KYA.'],
        },
        fake,
      ),
    );
    expect(
      await as('org_other', (client) =>
        search(client, { query: 'charte qualité', audience: ['everyone'] }, fake),
      ),
    ).toEqual([]);
    expect(await as('org_other', (client) => listSources(client))).toEqual([]);
  });
});
