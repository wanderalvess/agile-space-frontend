import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import path from 'path';
import { pathToFileURL } from 'url';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const TEXT_EXTENSIONS = ['.txt', '.json', '.md', '.csv'];

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

export async function POST(req: Request) {
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

    if (file.type.includes('officedocument') || fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      ensurePdfWorkerConfigured();
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (file.type.startsWith('text/') || TEXT_EXTENSIONS.some(ext => fileName.endsWith(ext))) {
      text = buffer.toString('utf-8');
    } else {
      return Response.json({ error: `Tipo de arquivo não suportado: ${file.type || fileName}. Envie PDF, DOCX, TXT, JSON, MD ou CSV.` }, { status: 415 });
    }

    const cleanedText = text.replace(/\n\s*\n/g, '\n\n').trim();
    return Response.json({ text: cleanedText });

  } catch (error: any) {
    console.error("Ingestion Error:", error);
    return Response.json({ error: `Erro ao processar documento: ${error.message}` }, { status: 500 });
  }
}
