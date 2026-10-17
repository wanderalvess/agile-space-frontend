import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ShowcaseSession, ShowcaseTask } from '../types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/showcase',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/app/showcase/api', () => ({ showcaseApi: { getSession: vi.fn(), saveSession: vi.fn() } }));
vi.mock('@/components/page', async () => {
  const React = await import('react');
  return {
    EmptyState: ({ title, actions }: { title: string; actions?: React.ReactNode }) => React.createElement('div', { role: 'status' }, title, actions),
    ErrorState: ({ title, onRetry }: { title?: string; onRetry?: () => void }) =>
      React.createElement('div', { role: 'alert' }, title, onRetry ? React.createElement('button', { onClick: onRetry }, 'Tentar de novo') : null),
    DataToolbar: ({ search, filters, count }: { search?: { value: string; onChange: (v: string) => void; placeholder?: string }; filters?: React.ReactNode; count?: { shown: number; total: number; noun: string } }) =>
      React.createElement('div', null,
        search ? React.createElement('input', { 'aria-label': 'Buscar', value: search.value, onChange: (e: { target: { value: string } }) => search.onChange(e.target.value) }) : null,
        filters,
        count ? React.createElement('span', null, `${count.shown} de ${count.total} ${count.noun}`) : null),
  };
});

import { ReviewHub } from '../ReviewHub';
import { ReviewCardsView } from '../ReviewCardsView';
import { ReviewEmptyRoom } from '../ReviewEmptyRoom';
import { ReviewGuide } from '../ReviewGuide';
import { SyncIndicator } from '../ReviewPrepBar';
import { EMPTY_FILTERS } from '../review-room-logic';

beforeAll(() => {
  // Radix (Select/Popover) usa estas APIs, que o jsdom não traz.
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null }) as MediaQueryList);
});

function task(key: string, over: Partial<ShowcaseTask> = {}): ShowcaseTask {
  return {
    id: key, key, title: `Entrega ${key}`, description: '', acceptanceCriteria: '', type: 'História', status: 'Done', priority: 'Medium', points: 0,
    assignee: '', url: '',
    evidence: { problem: 'p', solution: 's', dev: 'Ana', qa: 'Bruno', screenshot: 'https://x/a.png', video: '', timeSpent: 0, timeEstimate: 0 },
    decision: 'open', preparationStatus: 'doing', feedback: '', ...over,
  } as ShowcaseTask;
}
const session = (over: Partial<ShowcaseSession> = {}): ShowcaseSession => ({
  id: 's1', name: 'Review da Sprint 42', sprintName: 'Sprint 42', tasks: [], createdAt: '2026-10-01T10:00:00Z', status: 'planning', ...over,
});

describe('hub da Review', () => {
  it('estado de carregamento é um status com texto para leitor de tela', () => {
    render(<ReviewHub sessions={[]} state="loading" onRetry={() => {}} onNewSession={() => {}} isCreating={false} />);
    expect(screen.getByRole('status', { name: 'Carregando as Reviews' })).toBeTruthy();
  });

  it('erro mostra o estado de erro com "Tentar de novo" e mantém Nova Review e entrar por ID', () => {
    const onRetry = vi.fn();
    render(<ReviewHub sessions={[]} state="error" onRetry={onRetry} onNewSession={() => {}} isCreating={false} />);
    expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar as Reviews');
    fireEvent.click(screen.getByText('Tentar de novo'));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByText('Nova Review')).toBeTruthy();
    expect(screen.getByLabelText('ID ou link da sala')).toBeTruthy();
  });

  it('sem squad explica o que fazer, em vez de um hub vazio', () => {
    render(<ReviewHub sessions={[]} state="no-squad" onRetry={() => {}} onNewSession={() => {}} isCreating={false} />);
    expect(screen.getByText('Escolha uma squad para ver as Reviews')).toBeTruthy();
    expect(screen.getByText('Ver minhas squads')).toBeTruthy();
  });

  it('sem nenhuma Review: "Nenhuma Review ainda", passos desativados e histórico vazio', () => {
    render(<ReviewHub sessions={[]} state="ready" onRetry={() => {}} onNewSession={() => {}} isCreating={false} />);
    expect(screen.getByText('Nenhuma Review ainda')).toBeTruthy();
    expect(screen.getByText('Crie a primeira Review para marcar as etapas.')).toBeTruthy();
    for (const box of screen.getAllByRole('checkbox')) expect((box as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Sem registros de histórico/)).toBeTruthy();
  });

  it('com Reviews: números, status do histórico e botão por estado (Retomar e Ver resumo)', () => {
    const sessions = [
      session({ id: 'a', name: 'Review 43', status: 'planning', tasks: [task('A-1', { decision: 'approved' }), task('A-2')] }),
      session({ id: 'b', name: 'Review 41', sprintName: '', status: 'finished', tasks: [task('B-1', { decision: 'approved' })] }),
    ];
    render(<ReviewHub sessions={sessions} state="ready" onRetry={() => {}} onNewSession={() => {}} isCreating={false} />);
    expect(screen.getByText('100%')).toBeTruthy(); // 2 aprovadas ÷ 2 avaliadas
    expect(screen.getByText('3 cards, 2 avaliados pelo PO.')).toBeTruthy();
    expect(screen.getAllByText('Retomar').length).toBeGreaterThan(0);
    expect(screen.getByText('Ver resumo')).toBeTruthy();
    expect(screen.getByText('Sem sprint informada')).toBeTruthy();
    expect(screen.getByText('2 registros')).toBeTruthy();
  });

  it('o filtro do histórico mostra só as finalizadas e a busca acha por nome', () => {
    const sessions = [
      session({ id: 'a', name: 'Alfa', status: 'planning' }),
      session({ id: 'b', name: 'Beta', status: 'finished' }),
    ];
    render(<ReviewHub sessions={sessions} state="ready" onRetry={() => {}} onNewSession={() => {}} isCreating={false} />);
    const table = () => screen.getByRole('table', { name: 'Histórico de Reviews' });
    fireEvent.click(screen.getByRole('button', { name: 'Finalizadas' }));
    expect(within(table()).queryByText('Alfa')).toBeNull();
    expect(within(table()).getByText('Beta')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }));
    fireEvent.change(screen.getByLabelText('Buscar por nome ou sprint'), { target: { value: 'alf' } });
    expect(within(table()).getByText('Alfa')).toBeTruthy();
    expect(within(table()).queryByText('Beta')).toBeNull();
  });

  it('colar o link reconhece o ID', () => {
    render(<ReviewHub sessions={[]} state="ready" onRetry={() => {}} onNewSession={() => {}} isCreating={false} />);
    fireEvent.change(screen.getByLabelText('ID ou link da sala'), { target: { value: 'https://x.com/showcase/AbC123?setup=1' } });
    expect(screen.getByText('AbC123')).toBeTruthy();
  });
});

describe('sala: lista de cards', () => {
  const all = [task('A-1', { title: 'Fila do Poker' }), task('A-2', { title: 'Painel', evidence: { ...task('x').evidence, dev: 'Carla', qa: 'Diego' } })];
  const baseProps = {
    allTasks: all,
    baseSort: 'key' as const,
    onFiltersChange: vi.fn(),
    onSortChange: vi.fn(),
    onClearAll: vi.fn(),
    onRemoveChip: vi.fn(),
    members: [],
    onUpdateTask: vi.fn(),
    onRemoveTask: vi.fn(),
  };

  it('mostra o contador e os cards; sem filtro não há chips', () => {
    render(<ReviewCardsView {...baseProps} filteredTasks={all} filters={EMPTY_FILTERS} sortBy="key" />);
    expect(screen.getByText('2 de 2 cards')).toBeTruthy();
    expect(screen.queryByText('Filtros ativos')).toBeNull();
  });

  it('um chip por filtro ativo (inclui QA e a ordem), remover chip e Limpar tudo chamam os tratadores', () => {
    const onRemoveChip = vi.fn();
    const onClearAll = vi.fn();
    render(
      <ReviewCardsView {...baseProps} onRemoveChip={onRemoveChip} onClearAll={onClearAll} filteredTasks={[all[1]]} filters={{ search: 'pai', dev: 'Carla', qa: 'Diego', type: 'História' }} sortBy="qa" />
    );
    expect(screen.getByText('QA: Diego')).toBeTruthy();
    expect(screen.getByText('Ordem: Validador / QA')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Remover o filtro: QA: Diego'));
    expect(onRemoveChip).toHaveBeenCalledWith('qa');
    fireEvent.click(screen.getByText('Limpar tudo'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('sem resultado: mensagem e Limpar filtros', () => {
    const onClearAll = vi.fn();
    render(<ReviewCardsView {...baseProps} onClearAll={onClearAll} filteredTasks={[]} filters={{ ...EMPTY_FILTERS, search: 'zzz' }} sortBy="key" />);
    expect(screen.getByText('Nenhuma tarefa encontrada com esses filtros')).toBeTruthy();
    fireEvent.click(screen.getByText('Limpar filtros'));
    expect(onClearAll).toHaveBeenCalled();
  });

  it('pagina de 20 em 20', () => {
    const many = Array.from({ length: 26 }, (_, i) => task(`P-${i + 1}`));
    render(<ReviewCardsView {...baseProps} allTasks={many} filteredTasks={many} filters={EMPTY_FILTERS} sortBy="key" />);
    expect(screen.getByText('Carregar mais 6 tarefas')).toBeTruthy();
    expect(screen.getByText('20 de 26')).toBeTruthy();
    fireEvent.click(screen.getByText('Carregar mais 6 tarefas'));
    expect(screen.queryByText(/Carregar mais/)).toBeNull();
  }, 30_000);
});

describe('sala: peças soltas', () => {
  it('sala vazia: importar do Jira em destaque e criar card manual', () => {
    const onOpenJira = vi.fn();
    render(<ReviewEmptyRoom onOpenJira={onOpenJira} onAddManualTask={() => {}} />);
    expect(screen.getByText('Sua Review está pronta')).toBeTruthy();
    fireEvent.click(screen.getByText('Importar do Jira'));
    expect(onOpenJira).toHaveBeenCalled();
    expect(screen.getByText('Criar card manual')).toBeTruthy();
  });

  it('indicadores: conectado, reconectando com o tempo, sem conexão e falha de gravação com ação', () => {
    const retry = vi.fn();
    const { rerender } = render(<SyncIndicator connection={{ state: 'live' }} saveState="saving" onRetrySave={retry} />);
    expect(screen.getByText('Conectado')).toBeTruthy();
    expect(screen.getByText('Salvando…')).toBeTruthy();
    rerender(<SyncIndicator connection={{ state: 'reconnecting', retryInSec: 4 }} saveState="saved" onRetrySave={retry} />);
    expect(screen.getByText(/nova tentativa em 4 s/)).toBeTruthy();
    expect(screen.getByText('Salvo agora')).toBeTruthy();
    rerender(<SyncIndicator connection={{ state: 'offline', retryInSec: 8 }} saveState="error" onRetrySave={retry} />);
    expect(screen.getByText(/Sem conexão/)).toBeTruthy();
    fireEvent.click(screen.getByText('Não salvou · reler'));
    expect(retry).toHaveBeenCalled();
  });

  it('o guia traz as três abas e refaz o tour', () => {
    const onRedoTour = vi.fn();
    render(<ReviewGuide open onOpenChange={() => {}} onRedoTour={onRedoTour} />);
    expect(screen.getByText('Guia da Review')).toBeTruthy();
    for (const label of ['Como funciona', 'Review', 'Atalhos']) expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    fireEvent.click(screen.getByText('Refazer o tour pela tela'));
    expect(onRedoTour).toHaveBeenCalled();
  });
});
