// Pré-baixa o modelo de embedding para o cache (usado no estágio "model" do Dockerfile).
// Mantenha MODEL_ID igual ao de src/lib/embeddings.ts.
import { pipeline, env } from '@huggingface/transformers';

const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

if (!process.env.EMBEDDING_CACHE_DIR) {
  console.error('EMBEDDING_CACHE_DIR não definido.');
  process.exit(1);
}
env.cacheDir = process.env.EMBEDDING_CACHE_DIR;

const embedder = await pipeline('feature-extraction', MODEL_ID);
const out = await embedder('teste', { pooling: 'mean', normalize: true });
console.log(`Modelo ${MODEL_ID} em ${env.cacheDir} (dimensão ${out.data.length}).`);
