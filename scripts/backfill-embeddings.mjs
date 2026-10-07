// Re-embed completo (não incremental) de todos os docs da Base de Conhecimento.
// Precisa: `npm run dev` rodando (usa a própria rota /api/knowledge/embed do
// servidor Next — não importa src/lib/embeddings.ts direto, evitando duplicar
// ou misturar resolução de módulo TS/ESM nesse script standalone).
//
// Uso:
//   AUTH_TOKEN=<token do localStorage 'agileSpace_auth_token'> npm run backfill-embeddings
//
// Idempotente por natureza (recalcula tudo, não "só quem falta"): como o campo
// embedding é write-only na API, um script batendo em HTTP não teria como saber
// quem já tem; e é o mesmo script que se rodaria de novo se o modelo mudasse
// algum dia (vetores de modelos diferentes não são comparáveis, mesmo com a
// mesma dimensão).

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:9002';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8002/api';
const AUTH_TOKEN = process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('Faltou AUTH_TOKEN. Copie de localStorage.getItem(\'agileSpace_auth_token\') no browser já logado.');
  process.exit(1);
}

const authHeaders = {
  'Authorization': `Bearer ${AUTH_TOKEN}`,
  'Content-Type': 'application/json',
};

async function embedText(text) {
  const res = await fetch(`${FRONTEND_URL}/api/knowledge/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 2000) }),
  });
  if (!res.ok) throw new Error(`Falha ao gerar embedding: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

async function fetchPage(page) {
  const res = await fetch(`${API_BASE_URL}/knowledge?size=100&page=${page}`, { headers: authHeaders });
  if (!res.ok) throw new Error(`Falha ao listar docs (page ${page}): ${res.status}`);
  return res.json();
}

async function main() {
  console.log(`Backfill de embeddings — frontend: ${FRONTEND_URL}, backend: ${API_BASE_URL}`);

  let page = 0;
  let totalPages = 1;
  let processed = 0;
  let failed = 0;

  while (page < totalPages) {
    const pageData = await fetchPage(page);
    totalPages = pageData.totalPages;

    for (const doc of pageData.content) {
      try {
        const embedding = await embedText(`${doc.title}\n\n${doc.content}`);
        const res = await fetch(`${API_BASE_URL}/knowledge/${doc.id}`, {
          method: 'PUT',
          headers: authHeaders,
          // PUT substitui a linha inteira (não é patch parcial) — manda o doc
          // completo de volta, só acrescentando o embedding novo.
          body: JSON.stringify({ ...doc, embedding, updatedBy: 'backfill-embeddings-script' }),
        });
        if (!res.ok) throw new Error(`PUT falhou: ${res.status}`);
        processed++;
        console.log(`  ok  (${processed}) ${doc.title}`);
      } catch (e) {
        failed++;
        console.error(`  falhou: ${doc.title} — ${e.message}`);
      }
    }

    page++;
  }

  console.log(`Concluído. ${processed} embedados, ${failed} falharam.`);
  if (failed > 0) process.exit(1);
}

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
