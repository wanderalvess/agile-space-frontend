import path from 'node:path';

// Modelo multilíngue (não o all-MiniLM-L6-v2, inglês-only): todo conteúdo da
// Base de Conhecimento observado é em português, e esse modelo é treinado
// especificamente para identificação de paráfrase entre idiomas — é o que
// resolve buscar "registrar uma venda" e achar um doc que só diz "cadastrar pedido".
const MODEL_ID = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';

type FeatureExtractionPipeline = (
  text: string,
  options: { pooling: 'mean'; normalize: true }
) => Promise<{ data: Float32Array }>;

let embedderPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getEmbedder(): Promise<FeatureExtractionPipeline> {
  if (!embedderPromise) {
    embedderPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      // Path explícito (não confia no default implícito da lib) — precisa ser
      // gravável pelo usuário do container (ver Dockerfile) e está no .gitignore
      // porque o modelo baixado tem ~470MB.
      env.cacheDir = path.join(process.cwd(), '.cache', 'transformers-cache');
      return (await pipeline('feature-extraction', MODEL_ID)) as unknown as FeatureExtractionPipeline;
    })();
  }
  return embedderPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const output = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
