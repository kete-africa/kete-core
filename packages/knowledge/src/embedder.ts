import { embedMany, type EmbeddingModel } from 'ai';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

/** What turns passages into vectors: one adapter per model, a fake one in tests. */
export interface Embedder {
  /** The vectors' size; it must match the tables' (`knowledgeMigrationSql({ dimensions })`). */
  readonly dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
}

/**
 * An embedder over an AI SDK embedding model — `embeddingModel(config)` of @kete/ai. Its usage
 * (tokens) is reported so that the product meters it like any model call.
 */
export function aiEmbedder(
  model: EmbeddingModel,
  options: { dimensions: number; onUsage?: (tokens: number) => void },
): Embedder {
  return {
    dimensions: options.dimensions,
    async embed(texts) {
      const { embeddings, usage } = await embedMany({ model, values: texts, maxParallelCalls: 2 });
      options.onUsage?.(usage?.tokens ?? 0);
      return embeddings;
    },
  };
}

export interface Passage {
  text: string;
  /** The page it comes from, when the document has pages. */
  page: number | null;
}

/**
 * A document's passages, page by page so that each passage cites its page: the recursive splitter
 * of LangChain, which cuts at paragraphs, then lines, then sentences, never mid-word.
 */
export async function passagesOf(
  pages: string[],
  options: { size?: number; overlap?: number } = {},
): Promise<Passage[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options.size ?? 1200,
    chunkOverlap: options.overlap ?? 150,
  });
  const paged = pages.length > 1;
  const passages: Passage[] = [];
  for (const [index, page] of pages.entries()) {
    const text = page.trim();
    if (!text) continue;
    for (const chunk of await splitter.splitText(text)) {
      passages.push({ text: chunk, page: paged ? index + 1 : null });
    }
  }
  return passages;
}
