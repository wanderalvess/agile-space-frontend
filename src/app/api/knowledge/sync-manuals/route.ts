import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const rootDir = process.cwd();
    const manualDir = path.join(rootDir, 'manual');
    const results = [];

    if (fs.existsSync(manualDir)) {
      const files = fs.readdirSync(manualDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const fullPath = path.join(manualDir, file);
          const content = fs.readFileSync(fullPath, 'utf8');
          const stats = fs.statSync(fullPath);
          
          // Extracts title from file name (e.g., 'como-usar.md' -> 'Como Usar')
          const titleName = file.replace('.md', '').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

          results.push({
            id: `manual-${file.replace('.md', '')}`,
            title: `Manual: ${titleName}`,
            content,
            category: 'Processo', // Manuais de uso
            fullPath: `Repositório / manual / ${file}`,
            byteSize: stats.size,
            lastModified: stats.mtime.toISOString()
          });
        }
      }
    }

    return NextResponse.json({ success: true, files: results });
  } catch (error: any) {
    console.error('Erro ao ler manuais:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
