import React from 'react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  uiToast: vi.fn(),
  auth: { session: { id: 'u1', name: 'Ana Souza' } as { id: string; name: string } | null },
  api: { listDocuments: vi.fn(), updateDocument: vi.fn(), semanticSearch: vi.fn() },
  chatApi: {
    getAiSettings: vi.fn(),
    saveAiSettings: vi.fn(),
    getTokenUsage: vi.fn(),
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    createConversation: vi.fn(),
    deleteConversation: vi.fn(),
    renameConversation: vi.fn(),
    appendMessage: vi.fn(),
    incrementTokenUsage: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: h.back, push: h.push, replace: h.replace }),
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.uiToast }) }));
vi.mock('../../../hooks/useTdnSettings', () => ({ useTdnSettings: () => ({ settings: null }) }));
vi.mock('../api', () => ({ knowledgeApi: h.api }));
vi.mock('../chat/api', () => ({ knowledgeChatApi: h.chatApi }));
vi.mock('../../../lib/auth-client', () => ({ authFetch: vi.fn() }));
vi.mock('../../../services/oracleService', () => ({ searchKnowledgeBase: vi.fn() }));
vi.mock('../../../services/tdnService', () => ({ searchTdn: vi.fn(), getTdnPageContent: vi.fn(), importTdnToKnowledgeBase: vi.fn() }));

import TrashPage from '../trash/page';
import KnowledgeSettingsPage from '../settings/page';
import ChatPage from '../chat/[chatId]/page';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  // Radix ScrollArea observa o tamanho do conteúdo.
  globalThis.ResizeObserver = globalThis.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});

beforeEach(() => {
  vi.clearAllMocks();
  h.auth.session = { id: 'u1', name: 'Ana Souza' };
});
afterEach(() => cleanup());

const doc = (over: Record<string, unknown> = {}) => ({
  id: 'd1',
  title: 'API de Pedidos',
  category: 'Técnico',
  content: '',
  status: 'deleted',
  canEdit: true,
  deletedAt: new Date(Date.now() - 3600_000).toISOString(),
  ...over,
});

describe('Lixeira', () => {
  it('chama-se Lixeira (não "Cofre de descarte") e traz o aviso normal, sem caixa alta', async () => {
    h.api.listDocuments.mockResolvedValue({ content: [doc()] });
    render(<TrashPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Lixeira' })).toBeTruthy();
    expect(await screen.findByText('API de Pedidos')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Cofre de/i);
    expect(document.body.textContent).not.toMatch(/aviso estrutural/i);
    const note = screen.getByRole('note');
    expect(note.textContent).toContain('Itens na lixeira ficam guardados para restauração. A exclusão permanente ainda não está disponível.');
  });

  it('mantém as funções: restaurar chama o PUT com o registro inteiro e a exclusão permanente só explica', async () => {
    h.api.listDocuments.mockResolvedValue({ content: [doc()] });
    h.api.updateDocument.mockResolvedValue({});
    render(<TrashPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Restaurar API de Pedidos' }));
    await waitFor(() => expect(h.api.updateDocument).toHaveBeenCalledWith('d1', expect.objectContaining({ title: 'API de Pedidos', status: 'published', updatedBy: 'u1' })));
    expect(h.toast.success).toHaveBeenCalled();
  });

  it('exclusão permanente fica indisponível, com a explicação, e não apaga nada', async () => {
    h.api.listDocuments.mockResolvedValue({ content: [doc()] });
    render(<TrashPage />);
    const btn = await screen.findByRole('button', { name: /permanentemente \(indisponível\)/ });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('title')).toBe('A exclusão permanente ainda não está disponível');
    fireEvent.click(btn);
    expect(h.toast.info).toHaveBeenCalledTimes(1);
    expect(h.api.updateDocument).not.toHaveBeenCalled();
  });

  it('sem permissão de edição não oferece Restaurar; vazia mostra a mensagem', async () => {
    h.api.listDocuments.mockResolvedValue({ content: [doc({ canEdit: false })] });
    const { unmount } = render(<TrashPage />);
    await screen.findByText('API de Pedidos');
    expect(screen.queryByRole('button', { name: /Restaurar/ })).toBeNull();
    unmount();
    h.api.listDocuments.mockResolvedValue({ content: [] });
    render(<TrashPage />);
    expect(await screen.findByText('A lixeira está vazia')).toBeTruthy();
  });
});

describe('Ajustes', () => {
  beforeEach(() => {
    h.chatApi.getAiSettings.mockResolvedValue({ model: 'gemini', byokApiKey: 'AIza-secreta' });
    h.chatApi.getTokenUsage.mockResolvedValue({ totalTokens: 12345, updatedAt: new Date(Date.now() - 7200_000).toISOString() });
    h.chatApi.saveAiSettings.mockResolvedValue({});
  });

  it('mostra provedores, chave, consumo e salva; só o Gemini está disponível', async () => {
    render(<KnowledgeSettingsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes do assistente' })).toBeTruthy();
    const key = (await screen.findByLabelText('Chave de API (BYOK)')) as HTMLInputElement;
    expect(key.value).toBe('AIza-secreta');
    expect(key.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar chave' }));
    expect(key.type).toBe('text');

    const gemini = screen.getByRole('button', { name: /Google Gemini/ });
    expect(gemini.getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByRole('button', { name: /OpenAI/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Anthropic/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('link', { name: /Obter chave/ })).toHaveLength(3);

    expect(await screen.findByText('12.345')).toBeTruthy();
    expect(screen.getByText(/Última atualização: há/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(h.chatApi.saveAiSettings).toHaveBeenCalledWith({ model: 'gemini', byokApiKey: 'AIza-secreta' }));
  });

  it('se não conseguiu carregar, trava o Salvar para não sobrescrever a chave', async () => {
    h.chatApi.getAiSettings.mockRejectedValue(new Error('falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<KnowledgeSettingsPage />);
    await waitFor(() => expect((screen.getByRole('button', { name: /Salvar/ }) as HTMLButtonElement).disabled).toBe(true));
  });
});

describe('Assistente virtual', () => {
  beforeEach(() => {
    h.chatApi.getAiSettings.mockResolvedValue({ model: 'gemini', byokApiKey: '' });
    h.chatApi.listConversations.mockResolvedValue([
      { id: 'c1', title: 'Deploy em produção', messages: JSON.stringify([{ content: 'Passo a passo do deploy' }]) },
    ]);
  });

  async function renderChat() {
    await act(async () => {
      render(<ChatPage params={Promise.resolve({ chatId: 'new' })} />);
    });
  }

  it('mostra a conversa vazia com sugestões e a caixa de pergunta acessível', async () => {
    await renderChat();
    expect(await screen.findByRole('heading', { name: 'O que vamos descobrir hoje?' })).toBeTruthy();
    expect(screen.getByLabelText('Sua pergunta')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Enviar pergunta' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Como funciona o Scrum Poker?' }));
    expect((screen.getByLabelText('Sua pergunta') as HTMLInputElement).value).toBe('Como funciona o Scrum Poker?');
    expect((screen.getByRole('button', { name: 'Enviar pergunta' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('lista as conversas recentes com botão de abrir e de excluir nomeados', async () => {
    await renderChat();
    const open = await screen.findByRole('button', { name: /^Deploy em produção/ });
    fireEvent.click(open);
    expect(h.push).toHaveBeenCalledWith('/knowledge/chat/c1');
    h.chatApi.deleteConversation.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir a conversa Deploy em produção' }));
    await waitFor(() => expect(h.chatApi.deleteConversation).toHaveBeenCalledWith('c1'));
  });
});

// Guarda do visual: o que o usuário reprovou (itálico, peso máximo, caixa alta, 9-10px, cores fixas).
const ROOT = resolve(__dirname, '..');
const TELAS = ['trash/page.tsx', 'settings/page.tsx', 'chat/page.tsx', 'chat/[chatId]/page.tsx'].map((p) => join(ROOT, p));

describe('visual das telas Lixeira, Ajustes e Assistente', () => {
  it.each(TELAS.map((f) => [f.slice(ROOT.length + 1).replace(/\\/g, '/'), f]))('%s usa só tokens semânticos e tipografia legível', (_nome, arquivo) => {
    const src = readFileSync(arquivo, 'utf8');
    const quebras: string[] = [];
    const regras: [string, RegExp][] = [
      ['font-black', /font-black/],
      ['italic', /\bitalic\b/],
      ['uppercase', /\buppercase\b/],
      ['texto menor que 13px', /text-\[(?:[0-9]|1[0-2])(?:\.\d+)?px\]/],
      ['tracking largo', /tracking-(?:widest|wider|\[)/],
      ['cor fixa', /\b(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:slate|cyan|indigo|rose|emerald|zinc|gray|stone|neutral)-\d/],
      ['branco/preto fixo', /\b(?:bg|text|border)-(?:white|black)\b/],
      ['hex fixo', /(?:bg|text|border)-\[#/],
    ];
    for (const [nome, re] of regras) if (re.test(src)) quebras.push(nome);
    // Movimento só com motion-safe (o hover de cor do botão do kit não conta).
    for (const m of src.matchAll(/(?<![\w:-])(?:transition(?:-[\w]+)?|animate-[\w-]+|duration-\d+)/g)) {
      quebras.push(`movimento sem motion-safe: ${m[0]}`);
    }
    expect(quebras).toEqual([]);
  });

  it('nenhum window.confirm/alert/prompt em src/app/knowledge nem em src/components/knowledge', () => {
    const raizes = [ROOT, resolve(ROOT, '..', '..', 'components', 'knowledge')];
    const achados: string[] = [];
    const visitar = (dir: string) => {
      for (const nome of readdirSync(dir)) {
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) {
          if (nome !== '__tests__') visitar(caminho);
        } else if (/\.(tsx?|jsx?)$/.test(nome) && /(?<![\w.])(?:window\.)?(?:confirm|alert|prompt)\(/.test(readFileSync(caminho, 'utf8'))) {
          achados.push(caminho);
        }
      }
    };
    raizes.forEach(visitar);
    expect(achados).toEqual([]);
  });
});
