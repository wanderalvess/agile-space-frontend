import { buildImportResult, extractDocx } from '@/lib/knowledge-import';
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/verify-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { PDFParse } from 'pdf-parse';
import path from 'path';
import { pathToFileURL } from 'url';
import { isPdfBuffer, isZipBuffer, looksLikeText } from '@/lib/file-sniff';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const TEXT_EXTENSIONS = ['.txt', '.json', '.md', '.csv'];
const PARSE_TIMEOUT_MS = 60_000;

function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tempo esgotado ao ler ${label}. Tente um arquivo menor.`)), PARSE_TIMEOUT_MS);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Sob o bundler do Next.js (Turbopack) a resolução automática do worker do
// pdfjs-dist falha ("Setting up fake worker failed: Cannot find module...")
// porque o import dinâmico do worker não é rastreado pelo bundler. Apontamos
// explicitamente para o arquivo físico em disco via file:// URL.
let workerConfigured = false;
function ensurePdfWorkerConfigured() {
  if (workerConfigured) return;
  const workerPath = path.join(
    process.cwd(), 'node_modules', 'pdf-parse', 'dist', 'pdf-parse', 'cjs', 'pdf.worker.mjs'
  );
  PDFParse.setWorker(pathToFileURL(workerPath).href);
  workerConfigured = true;
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (!checkRateLimit(`ingest-file:${auth.uid}`, 10, 60_000)) {
    return Response.json({ error: 'Muitas requisições. Tente novamente em instantes.' }, { status: 429 });
  }
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return Response.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: `Arquivo excede o limite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.` }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = file.name.toLowerCase();
    let text = "";
    let html: string | undefined;

    if (fileName.endsWith('.docx')) {
      // O tipo vale pelo conteúdo, não pelo nome: docx é um zip.
      if (!isZipBuffer(buffer)) {
        return Response.json({ error: 'O arquivo não parece ser um documento Word (.docx) válido.' }, { status: 415 });
      }
      const result = await withTimeout(extractDocx(buffer), 'o documento Word');
      text = result.text;
      html = result.html;
    } else if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      if (!isPdfBuffer(buffer)) {
        return Response.json({ error: 'O arquivo não parece ser um PDF válido.' }, { status: 415 });
      }
      ensurePdfWorkerConfigured();
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await withTimeout(parser.getText(), 'o PDF');
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (file.type.startsWith('text/') || TEXT_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
      if (!looksLikeText(buffer)) {
        return Response.json({ error: 'O arquivo parece ser binário, não texto.' }, { status: 415 });
      }
      text = buffer.toString('utf-8');
    } else {
      return Response.json({ error: `Tipo de arquivo não suportado: ${file.type || fileName}. Envie PDF, DOCX, TXT, JSON, MD ou CSV.` }, { status: 415 });
    }

    const result = buildImportResult(text, html);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(result.html === undefined ? { text: result.text } : { text: result.text, html: result.html });

  } catch (error: any) {
    console.error("Ingestion Error:", error?.message);
    return Response.json({ error: 'Não foi possível ler o arquivo. Confira se ele não está corrompido ou protegido por senha.' }, { status: 500 });
  }
}
