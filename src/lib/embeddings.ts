import path from 'node:path';
import { createEmbeddingLimiter, readPositiveInt } from '@/lib/embedding-queue';

export { EmbeddingBusyError } from '@/lib/embedding-queue';

// Modelo multilíngue (não o all-MiniLM-L6-v2, inglês-only): todo conteúdo da
// Base de Conhecimento observado é em português, e esse modelo é treinado
// especificamente para identificação de paráfrase entre idiomas — é o que
// resolve buscar "registrar uma venda" e achar um doc que só diz "cadastrar pedido".
const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

/** O cliente já corta em 2000 caracteres (knowledge/api.ts); o servidor não confia nisso. */
export const MAX_EMBED_CHARS = 2000;

/** Inferências simultâneas no processo (o pico de memória do onnxruntime cresce com isso). */
const MAX_CONCURRENT = readPositiveInt(process.env.EMBEDDING_CONCURRENCY, 1);
/** Quantas chamadas esperam na fila antes de a rota recusar (503). */
const MAX_QUEUE = readPositiveInt(process.env.EMBEDDING_MAX_QUEUE, 8);
/** Tempo ocioso até descarregar o modelo e devolver a memória (padrão: 10 minutos). */
const IDLE_UNLOAD_MS = readPositiveInt(process.env.EMBEDDING_IDLE_UNLOAD_MS, 10 * 60 * 1000);

type FeatureExtractionPipeline = ((
  text: string,
  options: { pooling: 'mean'; normalize: true }
) => Promise<{ data: Float32Array }>) & { dispose?: () => Promise<void> | void };

const limiter = createEmbeddingLimiter(MAX_CONCURRENT, MAX_QUEUE);

let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Path explícito (não confia no default implícito da lib) — precisa ser
      // gravável pelo usuário do container (ver Dockerfile, que define
      // EMBEDDING_CACHE_DIR) e está no .gitignore porque o modelo baixado tem ~470MB.
      env.cacheDir =
        process.env.EMBEDDING_CACHE_DIR ||
        path.join(process.cwd(), '.cache', 'transformers-cache');
      return (await pipeline('feature-extraction', MODEL_ID)) as unknown as FeatureExtractionPipeline;
    })();
    // Falha (ex.: download do modelo) não pode ficar em cache: a próxima chamada tenta de novo.
    embedderPromise.catch(() => { embedderPromise = null; });
  }
  return embedderPromise;
}

/** Descarrega o modelo se ninguém estiver usando; o próximo pedido o carrega de novo do cache em disco. */
async function unloadIfIdle(): Promise<void> {
  idleTimer = null;
  if (limiter.pending > 0 || !embedderPromise) return;
  const loading = embedderPromise;
  embedderPromise = null;
  try {
    const embedder = await loading;
    await embedder.dispose?.();
  } catch {
    // Falha ao carregar ou descartar: o estado já foi limpo, o próximo pedido tenta de novo.
  }
}

function scheduleIdleUnload(): void {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { void unloadIfIdle(); }, IDLE_UNLOAD_MS);
  // Não segura o processo vivo só por causa do timer.
  idleTimer.unref?.();
}

/**
 * Gera o vetor do texto (cortado em MAX_EMBED_CHARS). Roda no máximo MAX_CONCURRENT inferências por vez;
 * com a fila cheia lança EmbeddingBusyError (a rota responde 503 com Retry-After).
 */
export async function embedText(text: string): Promise<number[]> {
  const input = text.slice(0, MAX_EMBED_CHARS);
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  try {
    return await limiter.run(async () => {
      const embedder = await getEmbedder();
      const output = await embedder(input, { pooling: 'mean', normalize: true });
      return Array.from(output.data);
    });
  } finally {
    // Reinicia a contagem de ociosidade só quando a fila esvaziar.
    if (limiter.pending === 0) scheduleIdleUnload();
  }
}
