import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Telas do Jolt (Hub, Sandbox, Gerador): visitante, atalhos, GitHub sob demanda, rascunho e rótulos.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: { current: '/jolt' },
  auth: { current: { isAuthenticated: true, isLoading: false, session: { id: 'u1', name: 'Ana', accessibleProjects: [] } } as Record<string, unknown> },
  toast: vi.fn(),
  transform: vi.fn(),
  generate: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => h.pathname.current,
  useRouter: () => ({ push: h.push, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ ...h.auth.current, switchProject: vi.fn(), logout: vi.fn() }),
}));
vi.mock('../../../context/UserContext', () => ({
  useUserContext: () => ({ userProfile: { role: 'user', name: 'Ana' }, isInitializing: false, requestIdentity: vi.fn() }),
}));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'system', resolvedMode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../components/home/NotificationCenter', () => ({ NotificationCenter: () => <button aria-label="Notificações" /> }));
vi.mock('../../../components/home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../../../components/layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../../components/feedback-widget', () => ({ FeedbackWidget: () => null }));
vi.mock('../../../services/joltService', () => ({ transformJoltBackend: (...a: unknown[]) => h.transform(...a), readApiError: vi.fn() }));
vi.mock('../../../lib/jolt-generator', async (orig) => ({ ...(await orig<typeof import('../../../lib/jolt-generator')>()), generateSpec: (...a: unknown[]) => h.generate(...a) }));
// O Monaco não roda no jsdom: um campo de texto com o mesmo contrato (valor, onChange, somente leitura).
vi.mock('@monaco-editor/react', () => ({
  default: (p: { value: string; onChange?: (v: string) => void; options?: { ariaLabel?: string; readOnly?: boolean } }) => (
    <textarea aria-label={p.options?.ariaLabel} value={p.value} readOnly={p.options?.readOnly} onChange={(e) => p.onChange?.(e.target.value)} />
  ),
  loader: { config: vi.fn() },
}));

import JoltHubPage from '../page';
import JoltSandboxPage from '../sandbox/page';
import JoltGeneratorPage from '../gerador/page';
import { layoutsKey, writeSandboxDraft, writeGeradorDraft, readLayouts, HANDOFF_GERADOR_PARA_SANDBOX } from '../../../lib/jolt-storage';

const member = () => {
  h.auth.current = { isAuthenticated: true, isLoading: false, session: { id: 'u1', name: 'Ana', accessibleProjects: [] } };
};
const guest = () => {
  h.auth.current = { isAuthenticated: false, isLoading: false, session: null };
};

let fetchMock: ReturnType<typeof vi.fn>;

// O editor (textarea no teste) e o painel que o contém têm o mesmo nome acessível: pega o campo de texto.
const field = (name: string) => screen.getAllByLabelText(name).find((el) => el.tagName === 'TEXTAREA') as HTMLTextAreaElement;

beforeAll(() => {
  // Radix (Select, Dropdown) usa estas APIs de ponteiro, que o jsdom não tem.
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia =
    window.matchMedia ||
    ((q: string) => ({ matches: false, media: q, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }) as unknown as MediaQueryList);
  window.ResizeObserver = window.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});

beforeEach(() => {
  member();
  localStorage.clear();
  sessionStorage.clear();
  h.push.mockClear();
  h.toast.mockClear();
  h.transform.mockReset();
  h.generate.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const savedLayout = (id: string, name: string, day: number) => ({
  id, name, apiUrl: `https://api.test/${id}`, joltSpec: '[]', lastInput: '{}', updatedAt: new Date(2026, 9, day, 10, 0).toISOString(),
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('Hub', () => {
  it('um cabeçalho, um rodapé, um h1; Sandbox e Gerador são links; subtítulo sem o Mapeador', async () => {
    render(<JoltHubPage />);
    await flush();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Jolt' })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/desenhar o mapa|Mapeador/i);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/jolt/sandbox', '/jolt/gerador', '/devtools/json']));
  });

  it('visitante vê os modos e o aviso; "Entrar" abre o diálogo e leva ao login voltando para o Jolt', async () => {
    guest();
    render(<JoltHubPage />);
    await flush();
    expect(screen.getByText('Sandbox', { selector: 'h2' })).toBeTruthy();
    expect(screen.getByText(/Entre para executar\./)).toBeTruthy();
    expect(screen.getByText('Entre para ver os seus layouts')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' })[0]);
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Entre para executar')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }));
    expect(h.push).toHaveBeenCalledWith(expect.stringMatching(/^\/login\?returnUrl=/));
  });

  it('mostra no máximo 4 layouts, os mais recentes primeiro, e abre cada um na Sandbox', async () => {
    localStorage.setItem(layoutsKey('u1'), JSON.stringify([1, 2, 3, 4, 5, 6].map((d) => savedLayout(`l${d}`, `Layout ${d}`, d))));
    render(<JoltHubPage />);
    await flush();
    const section = screen.getByRole('region', { name: 'Seus layouts recentes' });
    const items = within(section).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[0].textContent).toContain('Layout 6');
    expect(within(section).getByText('Mostrando os 4 mais recentes de 6')).toBeTruthy();
    expect(within(items[0]).getByRole('link', { name: 'Abrir Layout 6' }).getAttribute('href')).toBe('/jolt/sandbox?layout=l6');
  });

  it('sem layouts: orienta a salvar com Ctrl+S na Sandbox', async () => {
    render(<JoltHubPage />);
    await flush();
    expect(screen.getByText('Nenhum layout salvo ainda')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir Sandbox' })).toBeTruthy();
  });

  it('"Como funciona" é uma folha só, com o fluxo, as 6 operações, os atalhos e a nota honesta', async () => {
    render(<JoltHubPage />);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /Como funciona/ }));
    const sheet = await screen.findByRole('dialog');
    const text = sheet.textContent ?? '';
    for (const op of ['shift', 'modify', 'default', 'cardinality', 'remove', 'sort']) expect(text).toContain(op);
    expect(within(sheet).getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(text).toContain('Ctrl+Enter');
    expect(text).toContain('Ctrl+S');
    expect(text).toContain('Seus dados saem do navegador');
    expect(text).toContain('A execução acontece no servidor');
    // O conteúdo inventado do guia antigo não pode voltar.
    expect(text).not.toMatch(/Laboratório da Squad|Pair Programming|Code Review|isolamento|ambiente seguro/i);
    expect(text).not.toMatch(/motor|JavaScript|Comparar/i);
  });
});

describe('Sandbox', () => {
  it('abrir a página não chama o GitHub; o botão faz a consulta', async () => {
    render(<JoltSandboxPage />);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Ainda não consultado.')).toBeTruthy();

    fetchMock.mockImplementation(async (url: string) =>
      new Response(JSON.stringify(url.includes('/tags') ? [{ name: '1.0' }] : { tree: [{ path: 'protheus/rotas/pedido.json', type: 'blob' }], truncated: false }), { status: 200 }),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Buscar layouts do GitHub' }));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toContain('api.github.com');
    await screen.findByRole('button', { name: 'Carregar layout' });
  });

  it('os rótulos: sem "motor", "JavaScript" nem "Comparar"; os atalhos aparecem nos botões', async () => {
    render(<JoltSandboxPage />);
    await flush();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Sandbox' })).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/motor|JavaScript|Comparar/i);
    expect(screen.getByRole('button', { name: /Executar, atalho Ctrl\+Enter/ }).textContent).toContain('Ctrl+Enter');
    expect(screen.getByRole('button', { name: /Salvar layout, atalho Ctrl\+S/ }).textContent).toContain('Ctrl+S');
    for (const label of ['Modelos', 'Manutenção', 'Layout completo', 'Buscar do GitHub']) expect(text).toContain(label);
  });

  it('visitante edita, mas Executar e Salvar abrem "Entre para executar" e nada vai ao servidor', async () => {
    guest();
    render(<JoltSandboxPage />);
    await flush();
    expect(screen.getByText(/Executar e Salvar pedem login/)).toBeTruthy();
    fireEvent.change(field('Entrada'), { target: { value: '{"a":1}' } });
    expect((field('Entrada') as HTMLTextAreaElement).value).toBe('{"a":1}');

    fireEvent.click(screen.getByRole('button', { name: /Executar, atalho/ }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(h.transform).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(readLayouts(null)).toEqual([]);
  });

  it('Ctrl+Enter executa uma vez só mesmo com cliques em sequência; o selo mostra só o tempo', async () => {
    let finish: (v: unknown) => void = () => {};
    h.transform.mockImplementation(() => new Promise((r) => { finish = r; }));
    render(<JoltSandboxPage />);
    await flush();
    fireEvent.change(field('Entrada'), { target: { value: '{"a":1}' } });
    fireEvent.change(field('Spec'), { target: { value: '[{"operation":"shift","spec":{"a":"b"}}]' } });

    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    const button = screen.getByRole('button', { name: /Executar, atalho/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    await flush();
    expect(h.transform).toHaveBeenCalledTimes(1);
    expect(h.transform.mock.calls[0][0]).toEqual({ a: 1 });
    expect(h.transform.mock.calls[0][1]).toEqual([{ operation: 'shift', spec: { a: 'b' } }]);

    await act(async () => finish({ success: true, output: { b: 1 }, executionTimeMs: 41 }));
    expect(await screen.findByText('41 ms')).toBeTruthy();
    expect((field('Saída') as HTMLTextAreaElement).value).toContain('"b": 1');
    expect(document.body.textContent).not.toMatch(/motor/i);
  });

  it('resposta atrasada de uma execução abandonada ("Limpar" durante a execução) é descartada', async () => {
    let finish: (v: unknown) => void = () => {};
    h.transform.mockImplementation((_i: unknown, _s: unknown, signal: AbortSignal) => new Promise((r) => { finish = r; void signal; }));
    render(<JoltSandboxPage />);
    await flush();
    fireEvent.change(field('Entrada'), { target: { value: '{"a":1}' } });
    fireEvent.change(field('Spec'), { target: { value: '[{"operation":"shift","spec":{"a":"b"}}]' } });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await flush();
    const signal = h.transform.mock.calls[0][2] as AbortSignal;

    fireEvent.click(within(screen.getByRole('region', { name: 'Saída' })).getByRole('button', { name: 'Limpar' }));
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ success: true, output: { late: true }, executionTimeMs: 5 }));

    expect((field('Saída') as HTMLTextAreaElement).value).toBe('');
    expect(screen.queryByText('5 ms')).toBeNull();
    // E dá para executar de novo.
    h.transform.mockResolvedValueOnce({ success: true, output: { ok: 1 }, executionTimeMs: 7 });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(await screen.findByText('7 ms')).toBeTruthy();
  });

  it('erro de sintaxe e erro do servidor aparecem no painel de saída', async () => {
    render(<JoltSandboxPage />);
    await flush();
    fireEvent.change(field('Entrada'), { target: { value: '{"a":' } });
    fireEvent.change(field('Spec'), { target: { value: '[]' } });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(await screen.findByText('Não executou')).toBeTruthy();
    expect(h.transform).not.toHaveBeenCalled();

    fireEvent.change(field('Entrada'), { target: { value: '{"a":1}' } });
    h.transform.mockResolvedValueOnce({ success: false, error: 'Operação inválida na spec', executionTimeMs: 3 });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(await screen.findByText('Operação inválida na spec')).toBeTruthy();
  });

  it('Ctrl+S salva o layout por usuário, mostra "Salvo agora" e não trava o botão', async () => {
    render(<JoltSandboxPage />);
    await flush();
    fireEvent.change(screen.getByLabelText('Nome do layout'), { target: { value: 'Pedido' } });
    fireEvent.change(field('Spec'), { target: { value: '[]' } });

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    const saved = readLayouts('u1');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ name: 'Pedido', joltSpec: '[]' });
    expect(screen.getByText('Salvo agora')).toBeTruthy();
    const button = screen.getByRole('button', { name: /Salvar layout/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);

    fireEvent.change(field('Spec'), { target: { value: '[{"operation":"sort"}]' } });
    expect(screen.getByText('Alterações não salvas')).toBeTruthy();
    fireEvent.click(button);
    expect(readLayouts('u1')).toHaveLength(1); // atualizou o mesmo layout, não criou outro
    expect(readLayouts('u1')[0].joltSpec).toBe('[{"operation":"sort"}]');
  });

  it('salvar sem nome avisa e não grava', async () => {
    render(<JoltSandboxPage />);
    await flush();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(readLayouts('u1')).toEqual([]);
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dê um nome ao layout' }));
  });

  it('cota do navegador cheia ao salvar: avisa com o motivo (não falha em silêncio)', async () => {
    render(<JoltSandboxPage />);
    await flush();
    fireEvent.change(screen.getByLabelText('Nome do layout'), { target: { value: 'Pedido' } });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível guardar o layout', variant: 'destructive' }));
    vi.restoreAllMocks();
  });

  it('o rascunho (entrada, spec e última saída) volta ao recarregar, por usuário', async () => {
    writeSandboxDraft('u1', { entrada: '{"a":1}', spec: '[]', saida: '{"b":2}', nome: 'Pedido', url: 'https://x' });
    writeSandboxDraft('u2', { entrada: 'OUTRA PESSOA', spec: '', saida: '', nome: '', url: '' });
    render(<JoltSandboxPage />);
    await flush();
    expect((field('Entrada') as HTMLTextAreaElement).value).toBe('{"a":1}');
    expect((field('Spec') as HTMLTextAreaElement).value).toBe('[]');
    expect((field('Saída') as HTMLTextAreaElement).value).toBe('{"b":2}');
    expect((screen.getByLabelText('Nome do layout') as HTMLInputElement).value).toBe('Pedido');
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rascunho recuperado' }));
  });

  it('digitar grava o rascunho; cota cheia avisa uma vez', async () => {
    render(<JoltSandboxPage />);
    await flush();
    vi.useFakeTimers();
    fireEvent.change(field('Entrada'), { target: { value: '{"x":1}' } });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    const draft = JSON.parse(localStorage.getItem('agileSpace_jolt_rascunho_sandbox_u1') ?? 'null');
    expect(draft?.entrada).toBe('{"x":1}');

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    fireEvent.change(field('Entrada'), { target: { value: '{"x":2}' } });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.change(field('Entrada'), { target: { value: '{"x":3}' } });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
    const warnings = h.toast.mock.calls.filter(([t]) => t?.title === 'Rascunho não guardado');
    expect(warnings).toHaveLength(1);
    expect(screen.getByText('Rascunho não guardado')).toBeTruthy();
  });

  it('o que o Gerador deixou entra no editor (e a passagem é apagada)', async () => {
    localStorage.setItem(HANDOFF_GERADOR_PARA_SANDBOX, JSON.stringify({ spec: '[{"operation":"sort"}]', input: '{"z":1}', deManutencao: false }));
    render(<JoltSandboxPage />);
    await flush();
    expect((field('Spec') as HTMLTextAreaElement).value).toBe('[{"operation":"sort"}]');
    expect((field('Entrada') as HTMLTextAreaElement).value).toBe('{"z":1}');
    expect(localStorage.getItem(HANDOFF_GERADOR_PARA_SANDBOX)).toBeNull();
  });

  it('abrir pelo Hub (?layout=) carrega o layout salvo', async () => {
    localStorage.setItem(layoutsKey('u1'), JSON.stringify([{ ...savedLayout('abc', 'Cliente', 5), joltSpec: '[{"operation":"sort"}]', lastInput: '{"k":1}' }]));
    window.history.pushState({}, '', '/jolt/sandbox?layout=abc');
    render(<JoltSandboxPage />);
    await flush();
    window.history.pushState({}, '', '/');
    expect((screen.getByLabelText('Nome do layout') as HTMLInputElement).value).toBe('Cliente');
    expect((field('Spec') as HTMLTextAreaElement).value).toBe('[{"operation":"sort"}]');
  });

  it('"Abrir no Gerador" leva a entrada; se não couber no navegador, avisa e ainda abre o Gerador', async () => {
    render(<JoltSandboxPage />);
    await flush();
    fireEvent.change(field('Entrada'), { target: { value: '{"a":1}' } });
    fireEvent.click(screen.getByRole('button', { name: /Abrir no Gerador/ }));
    expect(localStorage.getItem('jolt_sandbox_para_gerador')).toBe('{"a":1}');
    expect(h.push).toHaveBeenCalledWith('/jolt/gerador');

    h.push.mockClear();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    fireEvent.click(screen.getByRole('button', { name: /Abrir no Gerador/ }));
    vi.restoreAllMocks();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'A entrada não foi levada ao Gerador', variant: 'destructive' }));
  });
});

describe('Gerador', () => {
  const rules = (over: Record<string, unknown> = {}) => ({
    spec: [{ operation: 'shift', spec: {} }],
    rules: [
      { output: 'idPedido', scope: '', kind: 'COPY', source: 'pedido.numero', confidence: 'HIGH', pending: false, reason: '', alternatives: [], example: '1 → 1' },
      { output: 'vendedor', scope: '', kind: 'UNRESOLVED', source: null, confidence: 'NONE', pending: true, reason: 'Dois campos com o mesmo valor', alternatives: ['pedido.vendedor', 'pedido.representante'], example: '"0087"' },
    ],
    pending: 1,
    sources: { '': ['pedido.numero', 'pedido.vendedor', 'pedido.representante'] },
    mode: 'VALORES',
    validation: { ran: true, matches: true, error: null, differences: [], checkedFields: 2 },
    ...over,
  });

  const fillBoth = () => {
    fireEvent.change(field('Entrada'), { target: { value: '{"pedido":{"numero":1}}' } });
    fireEvent.change(field('Saída esperada'), { target: { value: '{"idPedido":1}' } });
  };

  it('um único h1, sem a escolha "Contrato/Valores" inventada, e a explicação certa dos dois modos', async () => {
    render(<JoltGeneratorPage />);
    await flush();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Contrato' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Valores' })).toBeNull();
    expect(screen.getByText(/O portal decide sozinho como ler a saída/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/motor|JavaScript/i);
  });

  it('visitante: "Gerar regras" pede login e não chama o servidor', async () => {
    guest();
    render(<JoltGeneratorPage />);
    await flush();
    expect(screen.getByText(/Entre para gerar\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Gerar regras' }));
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(h.generate).not.toHaveBeenCalled();
  });

  it('gera as regras: "A confirmar" primeiro, barra de contagens na própria coluna (não fixa) e Gerar spec travado', async () => {
    h.generate.mockResolvedValue(rules());
    render(<JoltGeneratorPage />);
    await flush();
    fillBoth();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar regras' }));
    });
    expect(h.generate).toHaveBeenCalledWith({ pedido: { numero: 1 } }, { idPedido: 1 }, {}, false);

    expect(await screen.findByText('Modo detectado: Valores.')).toBeTruthy();
    const pending = screen.getByRole('region', { name: 'A confirmar' });
    expect(within(pending).getByText('vendedor')).toBeTruthy();
    expect(within(pending).getByText('pedido.vendedor ou pedido.representante')).toBeTruthy();

    const bar = screen.getByRole('region', { name: 'Resumo e ações' });
    expect(bar.className).toContain('sticky');
    expect(bar.className).not.toMatch(/\bfixed\b|inset-x-0/);
    expect(within(bar).getByText('1 a confirmar')).toBeTruthy();
    expect((within(bar).getByRole('button', { name: /Gerar spec/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(bar).getByRole('button', { name: /Aplicar ajustes \(0\)/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('confirmar uma origem, aplicar e gerar a spec: valida no servidor e mostra "A spec gera a saída esperada"', async () => {
    h.generate.mockResolvedValueOnce(rules());
    render(<JoltGeneratorPage />);
    await flush();
    fillBoth();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar regras' }));
    });
    await screen.findByText('Modo detectado: Valores.');

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar vendedor' }));
    // "Vem de" é o SelectField do kit (Radix): o rascunho já vem com a primeira origem sugerida.
    fireEvent.click(screen.getByRole('button', { name: 'Guardar ajuste' }));
    const bar = screen.getByRole('region', { name: 'Resumo e ações' });
    expect(within(bar).getByText('0 a confirmar')).toBeTruthy();
    expect((within(bar).getByRole('button', { name: /Gerar spec/ }) as HTMLButtonElement).disabled).toBe(true); // falta aplicar
    expect(within(bar).getByText('Aplique os ajustes antes de gerar a spec.')).toBeTruthy();

    h.generate.mockResolvedValueOnce(rules({ rules: rules().rules.map((r) => ({ ...r, pending: false })), pending: 0 }));
    await act(async () => {
      fireEvent.click(within(bar).getByRole('button', { name: /Aplicar ajustes \(1\)/ }));
    });
    expect(h.generate.mock.calls[1][2]).toEqual({ vendedor: { kind: 'COPY', source: 'pedido.vendedor' } });
    expect(h.generate.mock.calls[1][3]).toBe(false);

    h.generate.mockResolvedValueOnce(rules({ pending: 0 }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Gerar spec/ }));
    });
    expect(h.generate.mock.calls[2][3]).toBe(true); // só o "Gerar spec" final grava no glossário
    expect(await screen.findByText('A spec gera a saída esperada')).toBeTruthy();
    expect(screen.getByText(/glossário da equipe/)).toBeTruthy();
  });

  async function reachStep3(validation: Record<string, unknown>, mode = 'VALORES') {
    h.generate.mockResolvedValue(rules({ rules: rules().rules.map((r) => ({ ...r, pending: false })), pending: 0, validation, mode }));
    render(<JoltGeneratorPage />);
    await flush();
    fillBoth();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar regras' }));
    });
    await screen.findByText(/Modo detectado/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Gerar spec/ }));
    });
  }

  it('conferência não executada (validation.ran === false) é dita com todas as letras, sem "bate"', async () => {
    h.generate.mockResolvedValueOnce(rules({ pending: 0, rules: rules().rules.map((r) => ({ ...r, pending: false })) }));
    h.generate.mockResolvedValueOnce(rules({ validation: { ran: false, matches: false, error: 'Servidor ocupado', differences: [], checkedFields: 0 } }));
    render(<JoltGeneratorPage />);
    await flush();
    fillBoth();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Gerar regras' }));
    });
    await screen.findByText(/Modo detectado/);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Gerar spec/ }));
    });
    expect(await screen.findByText('A spec foi gerada, mas não foi conferida')).toBeTruthy();
    expect(screen.getByText(/Servidor ocupado/)).toBeTruthy();
    expect(screen.queryByText(/A spec gera a saída/)).toBeNull();
  });

  it('diferenças da conferência vêm numa tabela com o que esperávamos, o que saiu e como resolver', async () => {
    await reachStep3({
      ran: true, matches: false, error: null, checkedFields: 17,
      differences: [{ path: 'valorTotal', kind: 'valor diferente', expected: 298.8, actual: '298.80' }],
    });
    expect(await screen.findByText('A spec gera 1 diferença')).toBeTruthy();
    const row = screen.getByRole('row', { name: /valorTotal/ });
    expect(row.textContent).toContain('298.8');
    expect(row.textContent).toContain('"298.80"');
    expect(row.textContent).toContain('Como número');
  });

  it('modo CONTRATO: o texto explica campos e tipos, não valores', async () => {
    await reachStep3({ ran: true, matches: true, error: null, differences: [], checkedFields: 2 }, 'CONTRATO');
    expect(await screen.findByText('A spec gera a saída do contrato')).toBeTruthy();
    expect(screen.getByText('Modo detectado: Contrato.')).toBeTruthy();
    expect(screen.getByText(/a conferência vê campos e tipos, não valores/)).toBeTruthy();
  });

  it('"Abrir na Sandbox" com a cota cheia avisa e não navega', async () => {
    await reachStep3({ ran: true, matches: true, error: null, differences: [], checkedFields: 2 });
    await screen.findByText('A spec gera a saída esperada');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir na Sandbox' })[0]);
    vi.restoreAllMocks();
    expect(h.push).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível levar a spec para a Sandbox', variant: 'destructive' }));
  });

  it('"Abrir na Sandbox" deixa a spec e a entrada com o nome novo e navega', async () => {
    await reachStep3({ ran: true, matches: true, error: null, differences: [], checkedFields: 2 });
    await screen.findByText('A spec gera a saída esperada');
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir na Sandbox' })[0]);
    expect(h.push).toHaveBeenCalledWith('/jolt/sandbox');
    const handoff = JSON.parse(localStorage.getItem(HANDOFF_GERADOR_PARA_SANDBOX) ?? 'null');
    expect(handoff).toMatchObject({ input: '{"pedido":{"numero":1}}', deManutencao: false });
    expect(localStorage.getItem('jolt_visual_generated_spec')).toBeNull();
  });

  it('as entradas sobrevivem ao recarregar; a entrada trazida da Sandbox vale mais que a do rascunho', async () => {
    writeGeradorDraft('u1', { entrada: '{"velha":1}', saida: '{"saida":1}' });
    localStorage.setItem('jolt_sandbox_para_gerador', '{"nova":1}');
    render(<JoltGeneratorPage />);
    await flush();
    expect((field('Entrada') as HTMLTextAreaElement).value).toBe('{"nova":1}');
    expect((field('Saída esperada') as HTMLTextAreaElement).value).toBe('{"saida":1}');
    expect(localStorage.getItem('jolt_sandbox_para_gerador')).toBeNull();
  });

  it('JSON inválido mostra linha e coluna e trava o botão', async () => {
    render(<JoltGeneratorPage />);
    await flush();
    fireEvent.change(field('Entrada'), { target: { value: '{"a":' } });
    expect(await screen.findByText(/JSON da entrada inválido/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Gerar regras' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
