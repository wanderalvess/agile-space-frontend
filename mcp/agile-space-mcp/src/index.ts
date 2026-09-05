#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listDocs, getDoc, downloadDoc, createDoc, type Source } from './client.js';

const server = new McpServer({
  name: 'agile-space-knowledge',
  version: '1.0.0',
});

const sourceSchema = z
  .enum(['legacy', 'new'])
  .describe('Qual app consultar: "legacy" (Agile-Space, produção) ou "new" (agile-space-frontend, o rewrite)');

server.registerTool(
  'list_docs',
  {
    description: 'Lista documentos da Base de Conhecimento, com filtro opcional de categoria/tag/página.',
    inputSchema: {
      source: sourceSchema,
      category: z.string().optional().describe('Filtra por categoria exata'),
      tag: z.string().optional().describe('Filtra por tag'),
      page: z.number().int().positive().optional().describe('Página, 1-based (padrão 1)'),
      pageSize: z.number().int().positive().max(100).optional().describe('Itens por página (padrão 20, máx 100)'),
    },
  },
  async ({ source, category, tag, page, pageSize }) => {
    const result = await listDocs(source as Source, { category, tag, page, pageSize });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'search_docs',
  {
    description: 'Busca documentos da Base de Conhecimento por texto livre (título e conteúdo).',
    inputSchema: {
      source: sourceSchema,
      query: z.string().min(1).describe('Termo de busca'),
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().positive().max(100).optional(),
    },
  },
  async ({ source, query, page, pageSize }) => {
    const result = await listDocs(source as Source, { q: query, page, pageSize });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'get_doc',
  {
    description: 'Retorna um documento completo da Base de Conhecimento por id.',
    inputSchema: {
      source: sourceSchema,
      id: z.string().describe('ID do documento (retornado por list_docs/search_docs)'),
      format: z.enum(['html', 'md', 'txt']).optional().describe('Formato do conteúdo (padrão html)'),
    },
  },
  async ({ source, id, format }) => {
    const doc = await getDoc(source as Source, id, format as 'html' | 'md' | 'txt' | undefined);
    return { content: [{ type: 'text', text: JSON.stringify(doc, null, 2) }] };
  }
);

server.registerTool(
  'download_doc',
  {
    description: 'Baixa o conteúdo de um documento da Base de Conhecimento pronto pra salvar em arquivo (markdown, texto puro ou html).',
    inputSchema: {
      source: sourceSchema,
      id: z.string().describe('ID do documento'),
      format: z.enum(['html', 'md', 'txt']).optional().describe('Formato do arquivo (padrão md)'),
    },
  },
  async ({ source, id, format }) => {
    const text = await downloadDoc(source as Source, id, format as 'html' | 'md' | 'txt' | undefined);
    return { content: [{ type: 'text', text }] };
  }
);

server.registerTool(
  'create_doc',
  {
    description: 'Cria e publica um novo documento na Base de Conhecimento do Espaço Ágil.',
    inputSchema: {
      source: sourceSchema,
      title: z.string().min(1).describe('Título do documento'),
      content: z.string().describe('Conteúdo do documento (Markdown ou HTML)'),
      category: z.string().optional().describe('Categoria do documento (ex: "Geral", "Arquitetura", "Engenharia")'),
      tags: z.union([z.array(z.string()), z.string()]).optional().describe('Tags associadas (lista de strings ou separadas por vírgula)'),
    },
  },
  async ({ source, title, content, category, tags }) => {
    let parsedTags: string[] | undefined;
    if (Array.isArray(tags)) {
      parsedTags = tags;
    } else if (typeof tags === 'string') {
      parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    const result = await createDoc(source as Source, {
      title,
      content,
      category,
      tags: parsedTags,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
