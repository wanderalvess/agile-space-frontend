import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CeremonyApiError } from '../../../lib/ceremony-api';
import type { ActionPlanBoard, ActionPlanTask } from '../../../lib/types';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  toast: vi.fn(),
  api: {
    getBoardById: vi.fn(),
    listTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    updateBoard: vi.fn(),
    deleteBoard: vi.fn(),
    addParticipant: vi.fn(),
  },
  getMembers: vi.fn(),
  auth: { isAuthenticated: true, isLoading: false, session: { id: 'me', role: 'user' } as { id: string; role: string } },
  user: { userProfile: { id: 'me', name: 'Ana Souza', role: 'user' } as { id: string; name: string; role: string } | null, requestIdentity: vi.fn(), isInitializing: false },
  copy: vi.fn(async () => true),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: h.push }), useParams: () => ({ id: 'plan-1' }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => h.user }));
vi.mock('../../../hooks/useMyMemberships', () => ({ useMyMemberships: () => ({ memberships: null, settled: true, stale: null, refresh: vi.fn() }) }));
vi.mock('../../../app/action-plan/api', () => ({ actionPlanApi: h.api }));
vi.mock('../../../app/squad/api', () => ({ squadApi: { getMembers: h.getMembers } }));
vi.mock('../../../lib/copy-to-clipboard', () => ({ copyToClipboard: h.copy }));
vi.mock('../../room-kit/RoomQr', () => ({ RoomQr: () => <div data-testid="qr" /> }));
vi.mock('../../page', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../page')>();
  return { ...real, PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> };
});
// O Select do Radix não abre no jsdom: um <select> nativo exercita a mesma lógica de opções.
vi.mock('../../room-kit/SelectField', () => ({
  SelectField: ({ value, onChange, options, placeholder, ...rest }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; 'aria-label'?: string }) => (
    <select aria-label={rest['aria-label']} value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ),
}));

import ActionPlanSessionPage from '../../../app/action-plan/[id]/page';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) as unknown as MediaQueryList);
  (globalThis as any).ResizeObserver = (globalThis as any).ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

const board = (over: Partial<ActionPlanBoard> = {}): ActionPlanBoard => ({
  id: 'plan-1', creatorId: 'me', title: 'Redesenho do onboarding', team: 'PHOENIX', squadId: 'PHOENIX', createdAt: '2026-10-16T10:00:00Z', isPublic: true, participantIds: ['me'], ...over,
});
const task = (over: Partial<ActionPlanTask> & { id: string }): ActionPlanTask => ({
  boardId: 'plan-1', what: `Ação ${over.id}`, why: '', where: '', when: '', who: '', how: '', howMuch: '', status: 'todo', createdAt: '', updatedAt: '', authorId: 'me', order: 0, ...over,
});

const TASKS = [
  task({ id: 't1', what: 'Criar o checklist', why: 'Ideia priorizada', who: 'Ana Ribeiro', status: 'doing', howMuch: '16 h', order: 0 }),
  task({ id: 't2', what: 'Gravar o vídeo', who: 'Diego Alves', status: 'todo', order: 1 }),
  task({ id: 't3', what: 'Tour guiado', who: '', status: 'blocked', order: 2 }),
  task({ id: 't4', what: 'Importar pelo Jira', who: 'Carla Menezes', status: 'done', order: 3 }),
];

beforeEach(() => {
  h.push.mockClear();
  h.toast.mockClear();
  h.copy.mockClear();
  Object.values(h.api).forEach((f) => f.mockReset());
  h.getMembers.mockReset();
  h.getMembers.mockResolvedValue([
    { displayName: 'Ana Ribeiro', email: 'ana@totvs.com.br', claimedByUid: 'u-ana' },
    { displayName: 'Diego Alves', email: 'diego@totvs.com.br' },
  ]);
  h.auth.session = { id: 'me', role: 'user' };
  h.user.userProfile = { id: 'me', name: 'Ana Souza', role: 'user' };
  h.api.getBoardById.mockResolvedValue(board());
  h.api.listTasks.mockResolvedValue(TASKS);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function renderPage() {
  render(<ActionPlanSessionPage />);
  return screen.findByRole('table', { name: 'Ações do plano (5W2H)' });
}

describe('página do plano: estados', () => {
  it('carregando mostra o esqueleto com texto para leitor de tela', () => {
    h.api.getBoardById.mockReturnValue(new Promise(() => {}));
    render(<ActionPlanSessionPage />);
    expect(screen.getByText('Carregando o plano de ação')).toBeTruthy();
  });

  it('404 vira estado de página com o caminho de volta (sem toast nem redirecionamento)', async () => {
    h.api.getBoardById.mockRejectedValue(new CeremonyApiError('Plano de ação não encontrado.', 404));
    render(<ActionPlanSessionPage />);
    expect(await screen.findByText('Plano de ação não encontrado')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Voltar para o Plano de ação' }).getAttribute('href')).toBe('/action-plan');
    expect(h.push).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalled();
  });

  it('ID que não é UUID (400 do servidor) também é "não encontrado"', async () => {
    h.api.getBoardById.mockRejectedValue(new CeremonyApiError('Bad request', 400));
    render(<ActionPlanSessionPage />);
    expect(await screen.findByText('Plano de ação não encontrado')).toBeTruthy();
  });

  it('403 mostra a mensagem do servidor', async () => {
    h.api.getBoardById.mockRejectedValue(new CeremonyApiError('Acesso restrito a participantes deste board.', 403));
    render(<ActionPlanSessionPage />);
    expect(await screen.findByText('Sem acesso a este plano')).toBeTruthy();
    expect(screen.getByText(/Acesso restrito a participantes deste board\./)).toBeTruthy();
  });

  it('falha de rede mostra "Tentar novamente" e não manda a pessoa embora', async () => {
    h.api.getBoardById.mockRejectedValueOnce(new Error('queda'));
    render(<ActionPlanSessionPage />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Não foi possível carregar o plano de ação agora.');
    expect(h.push).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole('button', { name: /Tentar novamente/ }));
    await screen.findByRole('table', { name: 'Ações do plano (5W2H)' });
  });

  it('sem perfil pede a identidade quando o portal terminou de carregar', async () => {
    h.user.userProfile = null;
    render(<ActionPlanSessionPage />);
    await waitFor(() => expect(h.user.requestIdentity).toHaveBeenCalled());
    expect(h.api.getBoardById).not.toHaveBeenCalled();
  });

  it('plano sem ações convida a criar a primeira', async () => {
    h.api.listTasks.mockResolvedValue([]);
    render(<ActionPlanSessionPage />);
    expect(await screen.findByText('Nenhuma ação definida ainda')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    // o botão do vazio e o da barra (que só aparece a partir de md) abrem a mesma janela
    fireEvent.click(screen.getAllByRole('button', { name: /Nova ação/ })[0]);
    expect(await screen.findByRole('dialog', { name: 'Nova ação 5W2H' })).toBeTruthy();
  });
});

describe('tabela 5W2H', () => {
  it('mostra as sete colunas, o custo sob o "O quê" e o resumo por status', async () => {
    const table = await renderPage();
    const head = within(table).getAllByRole('columnheader').map((c) => c.textContent);
    expect(head).toEqual(['O quê', 'Por quê', 'Como', 'Onde', 'Quando', 'Quem', 'Status']);
    expect(within(table).getByText('Custo: 16 h')).toBeTruthy();
    expect(within(table).getAllByRole('row')).toHaveLength(5);

    const kpis = screen.getAllByText(/^(A fazer|Em andamento|Concluído|Impedido)$/).map((e) => e.closest('div')?.parentElement?.textContent);
    expect(kpis.some((t) => t?.startsWith('A fazer1'))).toBe(true);
    expect(kpis.some((t) => t?.startsWith('Impedido1'))).toBe(true);
  });

  it('o status aparece em português e o clique avança para o próximo, enviando o valor cru', async () => {
    h.api.updateTask.mockResolvedValue({});
    const table = await renderPage();
    const doing = within(table).getByRole('button', { name: /Status: Em andamento/ });
    fireEvent.click(doing);
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledWith('t1', { status: 'done' }));
    // depois de gravar a tela relê as ações
    await waitFor(() => expect(h.api.listTasks.mock.calls.length).toBeGreaterThan(1));
  });

  it('Impedido volta para A fazer', async () => {
    h.api.updateTask.mockResolvedValue({});
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: /Status: Impedido/ }));
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledWith('t3', { status: 'todo' }));
  });

  it('falha ao mudar o status avisa por toast', async () => {
    h.api.updateTask.mockRejectedValue(new Error('queda'));
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: /Status: A fazer/ }));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Não foi possível mudar o status', variant: 'destructive' })));
  });

  it('edita a célula no lugar: Enter salva só aquele campo, uma vez', async () => {
    h.api.updateTask.mockResolvedValue({});
    const table = await renderPage();
    const cell = within(table).getByRole('button', { name: /^Por quê\? Ideia priorizada/ });
    fireEvent.click(cell);
    const input = within(table).getByRole('textbox', { name: 'Por quê?' });
    fireEvent.change(input, { target: { value: 'Novo motivo' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledTimes(1));
    expect(h.api.updateTask).toHaveBeenCalledWith('t1', { why: 'Novo motivo' });
  });

  it('Esc cancela a edição sem gravar', async () => {
    const table = await renderPage();
    fireEvent.click(within(table).getAllByRole('button', { name: /^Como\?/ })[0]);
    const input = within(table).getByRole('textbox', { name: 'Como?' });
    fireEvent.change(input, { target: { value: 'rascunho' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(within(table).queryByRole('textbox')).toBeNull();
    expect(h.api.updateTask).not.toHaveBeenCalled();
  });

  it('falha ao gravar mantém a célula aberta com o texto e mostra a mensagem do servidor', async () => {
    h.api.updateTask.mockRejectedValue(new CeremonyApiError('O campo "O quê" não pode ficar vazio.', 400));
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: /^O que será feito\? Criar o checklist/ }));
    const input = within(table).getByRole('textbox', { name: 'O que será feito?' });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect((await within(table).findByRole('alert')).textContent).toBe('O campo "O quê" não pode ficar vazio.');
    expect(within(table).getByRole('textbox', { name: 'O que será feito?' })).toBeTruthy();
  });

  it('"Editar detalhes" é um botão sempre visível em cada ação', async () => {
    const table = await renderPage();
    const buttons = within(table).getAllByRole('button', { name: /^Editar detalhes da ação \d$/ });
    expect(buttons).toHaveLength(4);
    expect(buttons[0].className).not.toMatch(/opacity-0|group-hover/);
  });
});

describe('busca e filtros', () => {
  it('busca nas ações e mostra a contagem', async () => {
    const table = await renderPage();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar nas ações' }), { target: { value: 'video' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('1 de 4 ações')).toBeTruthy();
  });

  it('filtra por status e por responsável, mantém a numeração e limpa os filtros', async () => {
    const table = await renderPage();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'blocked' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    // continua sendo a ação 3, não a 1
    expect(within(table).getByRole('button', { name: 'Editar detalhes da ação 3' })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'all' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por responsável' }), { target: { value: '__sem_responsavel__' } });
    expect(within(table).getAllByRole('row')).toHaveLength(2);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar nas ações' }), { target: { value: 'nada disso' } });
    expect(screen.getByText('Nenhuma ação neste filtro')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Limpar filtros/ }));
    expect(within(screen.getByRole('table', { name: 'Ações do plano (5W2H)' })).getAllByRole('row')).toHaveLength(5);
  });
});

describe('janela da ação', () => {
  it('Nova ação: "O quê" e "Quem" obrigatórios com erro no campo, sem toast', async () => {
    await renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /Nova ação/ })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Nova ação 5W2H' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));
    expect(within(dialog).getByText('Escreva o que será feito.')).toBeTruthy();
    expect(within(dialog).getByText('Diga quem responde por esta ação.')).toBeTruthy();
    expect(h.api.createTask).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalled();
    // sem status na criação
    expect(within(dialog).queryByRole('button', { name: 'Impedido' })).toBeNull();
  });

  it('Nova ação: cria com autor, ordem e os sete campos, escolhendo "Quem" na squad', async () => {
    h.api.createTask.mockResolvedValue({});
    await renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /Nova ação/ })[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Nova ação 5W2H' });
    fireEvent.change(within(dialog).getByLabelText(/O quê/), { target: { value: 'Publicar o guia' } });
    const who = within(dialog).getByRole('combobox', { name: /Quem/ });
    fireEvent.focus(who);
    fireEvent.change(who, { target: { value: 'dieg' } });
    fireEvent.mouseDown(await within(dialog).findByRole('option', { name: /Diego Alves/ }));
    expect((who as HTMLInputElement).value).toBe('Diego Alves');
    expect(within(dialog).getByText('Diego Alves é avisada quando vira responsável.')).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText(/Quando/), { target: { value: '15/10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));

    await waitFor(() => expect(h.api.createTask).toHaveBeenCalledTimes(1));
    expect(h.api.createTask).toHaveBeenCalledWith('plan-1', {
      what: 'Publicar o guia', why: '', where: '', when: '15/10', who: 'Diego Alves', how: '', howMuch: '', status: 'todo', authorId: 'me', order: 4,
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Nova ação: o servidor recusa, a janela fica aberta com o texto e o erro aparece nela', async () => {
    h.api.createTask.mockRejectedValue(new CeremonyApiError('Campo muito longo.', 400));
    await renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /Nova ação/ })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/O quê/), { target: { value: 'Algo' } });
    fireEvent.change(within(dialog).getByRole('combobox', { name: /Quem/ }), { target: { value: 'Fulana' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));
    const alert = await within(dialog).findByText('Não foi possível salvar a ação.');
    expect(alert.parentElement?.textContent).toContain('Campo muito longo.');
    expect((within(dialog).getByLabelText(/O quê/) as HTMLInputElement).value).toBe('Algo');
  });

  it('Editar ação: status em português, envia o valor cru e permite excluir com confirmação', async () => {
    h.api.updateTask.mockResolvedValue({});
    h.api.deleteTask.mockResolvedValue(undefined);
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: 'Editar detalhes da ação 2' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar ação' });
    for (const label of ['A fazer', 'Em andamento', 'Concluído', 'Impedido']) {
      expect(within(dialog).getByRole('button', { name: label })).toBeTruthy();
    }
    expect(within(dialog).queryByText(/TODO|DOING|DONE|BLOCKED/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Concluído' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar ação' }));
    await waitFor(() => expect(h.api.updateTask).toHaveBeenCalledWith('t2', expect.objectContaining({ what: 'Gravar o vídeo', who: 'Diego Alves', status: 'done' })));
  });

  it('Excluir pede confirmação em janela do kit (não o window.confirm) e só então apaga', async () => {
    const nativeConfirm = vi.spyOn(window, 'confirm');
    h.api.deleteTask.mockResolvedValue(undefined);
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: 'Editar detalhes da ação 3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar ação' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Excluir ação/ }));
    const confirm = await screen.findByRole('alertdialog');
    expect(within(confirm).getByText(/Tour guiado/)).toBeTruthy();
    expect(h.api.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Excluir ação' }));
    await waitFor(() => expect(h.api.deleteTask).toHaveBeenCalledWith('t3'));
    expect(nativeConfirm).not.toHaveBeenCalled();
    nativeConfirm.mockRestore();
  });

  it('cancelar a confirmação volta à janela da ação com o que estava digitado', async () => {
    const table = await renderPage();
    fireEvent.click(within(table).getByRole('button', { name: 'Editar detalhes da ação 3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar ação' });
    fireEvent.change(within(dialog).getByLabelText(/O quê/), { target: { value: 'Texto editado' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Excluir ação/ }));
    const confirm = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirm).getByRole('button', { name: 'Cancelar' }));
    const back = await screen.findByRole('dialog', { name: 'Editar ação' });
    expect((within(back).getByLabelText(/O quê/) as HTMLInputElement).value).toBe('Texto editado');
    expect(h.api.deleteTask).not.toHaveBeenCalled();
  });
});

describe('cabeçalho: guia, compartilhar, exportar, configurações', () => {
  it('o guia tem as três abas, os sete campos e o atalho Esc', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Como usar o plano de ação' }));
    const guide = await screen.findByRole('dialog', { name: 'Guia do plano de ação' });
    expect(within(guide).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Como funciona', 'Os 7 campos', 'Atalhos']);

    fireEvent.mouseDown(within(guide).getByRole('tab', { name: 'Os 7 campos' }), { button: 0 });
    fireEvent.click(within(guide).getByRole('tab', { name: 'Os 7 campos' }));
    for (const name of ['O quê (What)', 'Por quê (Why)', 'Como (How)', 'Onde (Where)', 'Quando (When)', 'Quem (Who)', 'Quanto (How Much)']) {
      expect(await within(guide).findByText(name)).toBeTruthy();
    }

    fireEvent.mouseDown(within(guide).getByRole('tab', { name: 'Atalhos' }), { button: 0 });
    fireEvent.click(within(guide).getByRole('tab', { name: 'Atalhos' }));
    expect(await within(guide).findByText('Esc')).toBeTruthy();
    expect(within(guide).getByText('lápis')).toBeTruthy();
  });

  it('compartilhar abre a janela com o link do plano e o convite em texto', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar o plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Compartilhar o plano' });
    expect((within(dialog).getByLabelText('Link') as HTMLInputElement).value).toBe(`${window.location.origin}/action-plan/plan-1`);
    expect((within(dialog).getByLabelText('Convite em texto') as HTMLTextAreaElement).value).toContain('4 ações com responsável e prazo');
    fireEvent.click(within(dialog).getByRole('button', { name: /^Copiar$/ }));
    await waitFor(() => expect(h.copy).toHaveBeenCalledWith(`${window.location.origin}/action-plan/plan-1`));
  });

  it('exportar: Markdown em português copia; CSV baixa com o status em português', async () => {
    let csv = '';
    const blobs: Blob[] = [];
    (URL as any).createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return 'blob:x'; });
    (URL as any).revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar o plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Exportar o plano' });
    expect(within(dialog).getByText(/4 ações · 1 concluída/)).toBeTruthy();
    expect(within(dialog).getByText(/Status:\*\* Em andamento/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copiar Markdown' }));
    await waitFor(() => expect(h.copy).toHaveBeenCalledTimes(1));
    expect((h.copy.mock.calls[0] as unknown as [string])[0]).toContain('### 1. Criar o checklist');
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Resumo copiado!' }));

    fireEvent.click(screen.getByRole('button', { name: 'Exportar o plano' }));
    const again = await screen.findByRole('dialog', { name: 'Exportar o plano' });
    fireEvent.click(within(again).getByRole('radio', { name: /Planilha/ }));
    fireEvent.click(within(again).getByRole('button', { name: 'Baixar planilha' }));
    expect(blobs).toHaveLength(1);
    csv = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blobs[0]);
    });
    expect(csv).toContain('"Em andamento"');
    expect(csv).toContain('"Impedido"');
    expect(csv).not.toMatch(/"(todo|doing|done|blocked)"/);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('configurações aparecem só para o criador ou administrador', async () => {
    h.api.getBoardById.mockResolvedValue(board({ creatorId: 'outra-pessoa' }));
    await renderPage();
    expect(screen.queryByRole('button', { name: 'Configurações do plano' })).toBeNull();
    cleanup();

    h.auth.session = { id: 'me', role: 'ADMIN' };
    await renderPage();
    expect(screen.getByRole('button', { name: 'Configurações do plano' })).toBeTruthy();
  });

  it('configurações: renomeia e muda a visibilidade enviando só o que mudou', async () => {
    h.api.updateBoard.mockResolvedValue(board({ title: 'Novo nome', isPublic: false }));
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações do plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Configurações do plano' });
    fireEvent.change(within(dialog).getByLabelText('Título do plano'), { target: { value: 'Novo nome' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Só quem eu convidar/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(h.api.updateBoard).toHaveBeenCalledWith('plan-1', { title: 'Novo nome', isPublic: false }));
    // o título novo aparece no cabeçalho e o plano mostra a etiqueta de privado
    expect(await screen.findByRole('heading', { name: 'Novo nome' })).toBeTruthy();
    expect(screen.getByText('Só convidados')).toBeTruthy();
  });

  it('configurações: convida alguém da squad que já tem conta (plano privado)', async () => {
    h.api.getBoardById.mockResolvedValue(board({ isPublic: false }));
    h.api.addParticipant.mockResolvedValue(board({ isPublic: false, participantIds: ['me', 'u-ana'] }));
    await renderPage();
    await waitFor(() => expect(h.getMembers).toHaveBeenCalledWith('PHOENIX'));
    fireEvent.click(screen.getByRole('button', { name: 'Configurações do plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Configurações do plano' });
    const select = await within(dialog).findByRole('combobox', { name: 'Convidar da squad' });
    // só quem tem conta no portal pode ser convidado
    expect(within(select).queryByRole('option', { name: 'Diego Alves' })).toBeNull();
    fireEvent.change(select, { target: { value: 'u-ana' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Convidar/ }));
    await waitFor(() => expect(h.api.addParticipant).toHaveBeenCalledWith('plan-1', 'u-ana'));
    expect(await within(dialog).findByText('Ana Ribeiro')).toBeTruthy();
  });

  it('configurações: apagar o plano pede confirmação e volta ao hub', async () => {
    h.api.deleteBoard.mockResolvedValue(undefined);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Configurações do plano' }));
    const dialog = await screen.findByRole('dialog', { name: 'Configurações do plano' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Apagar plano/ }));
    const confirm = await screen.findByRole('alertdialog');
    expect(h.api.deleteBoard).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Apagar plano' }));
    await waitFor(() => expect(h.api.deleteBoard).toHaveBeenCalledWith('plan-1'));
    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/action-plan'));
  });
});

describe('atualização automática', () => {
  it('relê as ações a cada 15 s e mostra "Atualizado há N s"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPage();
    expect(screen.getByText(/^Atualizado agora$/)).toBeTruthy();
    const before = h.api.listTasks.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(15_100); });
    expect(h.api.listTasks.mock.calls.length).toBeGreaterThan(before);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByText(/^Atualizado há \d+ s$/)).toBeTruthy();
  });

  it('se a releitura falha, mostra desde quando e oferece "Tentar agora"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderPage();
    h.api.listTasks.mockRejectedValue(new Error('queda'));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_100); });
    const note = await screen.findByText(/Sem atualizar desde \d{2}:\d{2}/);
    expect(note.getAttribute('role')).toBe('status');

    h.api.listTasks.mockResolvedValue(TASKS);
    fireEvent.click(screen.getByRole('button', { name: /Tentar agora/ }));
    await waitFor(() => expect(screen.getByText(/^Atualizado/)).toBeTruthy());
  });
});
