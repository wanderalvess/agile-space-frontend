import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ShowcaseSession, ShowcaseTask } from '../types';

vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../app/showcase/api', () => ({ showcaseApi: {}, isUnavailableError: () => false }));

import { SummaryDialog } from '../SummaryDialog';
import { ReviewConflictBar } from '../ReviewConflictBar';
import { TaskCard } from '../TaskCard';

beforeAll(() => {
  class RO { observe() {} unobserve() {} disconnect() {} }
  (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null }) as MediaQueryList);
});
afterEach(cleanup);

function task(key: string, over: Partial<ShowcaseTask> = {}): ShowcaseTask {
  return {
    id: key, key, title: `Entrega ${key}`, description: '', acceptanceCriteria: '', type: 'História', status: 'Done', priority: 'Medium', points: 0,
    assignee: '', url: '',
    evidence: { problem: 'p', solution: 's', dev: 'Ana', qa: 'Bruno', screenshot: 'https://x/a.png', video: '', timeSpent: 0, timeEstimate: 0 },
    decision: 'open', preparationStatus: 'doing', feedback: '', ...over,
  } as ShowcaseTask;
}
const session = (over: Partial<ShowcaseSession> = {}): ShowcaseSession => ({
  id: 's1', name: 'Review da Sprint 42', sprintName: 'Sprint 42', tasks: [], createdAt: '2026-10-01T10:00:00Z', status: 'finished', ...over,
});

describe('resumo da Review: participantes', () => {
  const renderSummary = (s: ShowcaseSession) =>
    render(<SummaryDialog open onClose={() => {}} tasks={[task('PTV-1', { decision: 'approved' })]} sessionName={s.name} session={s} onExport={() => {}} onPrint={() => {}} />);

  it('mostra a linha Participantes com os nomes que o servidor gravou', () => {
    renderSummary(session({ participants: [{ userId: 'u1', displayName: 'Ana Souza' }, { userId: 'u2', displayName: 'Caio Lima' }] }));
    expect(screen.getByLabelText('Participantes')).toBeTruthy();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    expect(screen.getByText('Caio Lima')).toBeTruthy();
  });

  it('omite a linha quando a lista vem vazia ou o backend não a traz', () => {
    renderSummary(session({ participants: [] }));
    expect(screen.queryByText('Participantes:')).toBeNull();
    cleanup();
    renderSummary(session());
    expect(screen.queryByText('Participantes:')).toBeNull();
  });

  it('a lista de integrantes da Review continua aparecendo, agora como Squad', () => {
    renderSummary(session({ members: [{ id: 'm1', name: 'Dani Prado', role: 'Dev' }] }));
    expect(screen.getByText('Squad:')).toBeTruthy();
    expect(screen.getByText('Dani Prado')).toBeTruthy();
  });
});

describe('aviso de conflito de edição', () => {
  const conflict = { id: 'c1:1', taskId: 'c1', taskKey: 'PTV-12', changes: [{ path: 'title', value: 'Meu título digitado', base: 'Antigo' }, { path: 'evidence.solution', value: 'Minha solução', base: 's' }] };

  it('diz o que aconteceu, guarda o texto digitado e oferece reaplicar ou descartar', () => {
    const onResolve = vi.fn();
    render(<ReviewConflictBar conflicts={[conflict]} onResolve={onResolve} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Outra pessoa alterou PTV-12 ao mesmo tempo: título, solução.');
    expect(alert.textContent).toContain('Meu título digitado');
    fireEvent.click(screen.getByRole('button', { name: 'Reaplicar a minha' }));
    expect(onResolve).toHaveBeenCalledWith('c1:1', 'reapply');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onResolve).toHaveBeenCalledWith('c1:1', 'discard');
  });

  it('sem conflito não renderiza nada', () => {
    const { container } = render(<ReviewConflictBar conflicts={[]} onResolve={() => {}} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('feedback do PO no card', () => {
  const card = task('PTV-3', { decision: 'needs_adjustment', feedback: 'Ajustar a ordem' });
  const renderCard = (canDecide?: boolean) =>
    render(<TaskCard task={card} index={0} members={[]} onUpdateTask={() => {}} onRemoveTask={() => {}} canDecide={canDecide} />);

  it('quem pode decidir edita o feedback', () => {
    renderCard(true);
    expect((screen.getByLabelText('Feedback da Review') as HTMLTextAreaElement).readOnly).toBe(false);
  });

  it('sem informação (padrão) continua editável, como antes', () => {
    renderCard(undefined);
    expect((screen.getByLabelText('Feedback da Review') as HTMLTextAreaElement).readOnly).toBe(false);
  });

  it('quem não pode decidir vê o feedback só para leitura, e o texto não some', () => {
    renderCard(false);
    const field = screen.getByLabelText('Feedback da Review') as HTMLTextAreaElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe('Ajustar a ordem');
  });
});
