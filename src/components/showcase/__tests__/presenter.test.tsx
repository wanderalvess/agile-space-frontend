import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowcasePresenter, ShowcaseSession, ShowcaseTask } from '../types';

const h = vi.hoisted(() => ({
  api: {
    setPresenter: vi.fn(),
    clearPresenter: vi.fn(),
    getPresenter: vi.fn(),
  },
}));

vi.mock('../../../app/showcase/api', () => ({
  showcaseApi: h.api,
  isUnavailableError: (e: unknown) => [404, 405, 501].includes((e as { status?: number })?.status ?? 0),
}));
vi.mock('../../../context/UserContext', () => ({ useUserContext: () => ({ userProfile: { role: 'Product Owner' } }) }));
vi.mock('../../../hooks/useJiraSettings', () => ({ useJiraSettings: () => ({ settings: null }) }));

import { canPublishAsPresenter, createThrottle, followTarget, isOtherPresenter } from '../presenter-sync';
import { useShowcasePresenter } from '../useShowcasePresenter';
import { PresenterChip } from '../PresenterChip';
import { TeatroMode } from '../TeatroMode';

const ana: ShowcasePresenter = { userId: 'u-ana', displayName: 'Ana Souza', cardId: 'c2', step: 'card', presentingAt: '2026-10-17T14:30:12' };

describe('regras do apresentador', () => {
  it('só publica quem apresenta ou quando ninguém apresenta', () => {
    expect(canPublishAsPresenter(null, 'me')).toBe(true);
    expect(canPublishAsPresenter({ ...ana, userId: 'me' }, 'me')).toBe(true);
    expect(canPublishAsPresenter(ana, 'me')).toBe(false);
    expect(canPublishAsPresenter(null, undefined)).toBe(false);
  });

  it('outra pessoa apresentando (o chip não aparece para quem apresenta)', () => {
    expect(isOtherPresenter(ana, 'me')).toBe(true);
    expect(isOtherPresenter({ ...ana, userId: 'me' }, 'me')).toBe(false);
    expect(isOtherPresenter(null, 'me')).toBe(false);
  });

  it('o card do apresentador vira a posição do Teatro; capa é -1; card removido não move', () => {
    const tasks = [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }];
    expect(followTarget(tasks, { cardId: 'c3' })).toBe(2);
    expect(followTarget(tasks, { cardId: null })).toBe(-1);
    expect(followTarget(tasks, { cardId: 'sumiu' })).toBeNull();
    expect(followTarget(tasks, null)).toBeNull();
  });
});

describe('limite de publicações (throttle)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T10:00:00')); });
  afterEach(() => vi.useRealTimers());

  it('a primeira sai na hora; no meio do intervalo só a última sai, no fim dele', () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 500);
    t.call('a');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100);
    t.call('b');
    vi.advanceTimersByTime(100);
    t.call('c');
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(299);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });

  it('depois de um intervalo livre sai na hora de novo, e cancelar descarta a pendente', () => {
    const fn = vi.fn();
    const t = createThrottle(fn, 500);
    t.call(1);
    vi.advanceTimersByTime(600);
    t.call(2);
    expect(fn).toHaveBeenCalledTimes(2);
    t.call(3);
    t.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('publicar o card atual', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-17T10:00:00')); });
  afterEach(() => { vi.useRealTimers(); Object.values(h.api).forEach((fn) => fn.mockReset()); });

  const setup = (presenter: ShowcasePresenter | null = null) => {
    const setPresenter = vi.fn();
    const hook = renderHook((props: { presenter: ShowcasePresenter | null }) =>
      useShowcasePresenter({ sessionId: 's1', meId: 'me', presenter: props.presenter, setPresenter, throttleMs: 500 }), { initialProps: { presenter } });
    return { ...hook, setPresenter };
  };

  it('publica o card (a capa vai com cardId nulo) e guarda a resposta', async () => {
    const mine = { ...ana, userId: 'me', cardId: null, step: 'cover' };
    h.api.setPresenter.mockResolvedValue(mine);
    const { result, setPresenter } = setup();
    await act(async () => { result.current.publish(null, 'cover'); });
    expect(h.api.setPresenter).toHaveBeenCalledWith('s1', { cardId: null, step: 'cover' });
    expect(setPresenter).toHaveBeenCalledWith(mine);
  });

  it('trocas rápidas de card viram poucas publicações: a primeira e a última', async () => {
    h.api.setPresenter.mockImplementation(async (_id: string, body: { cardId: string | null }) => ({ ...ana, userId: 'me', cardId: body.cardId }));
    const { result } = setup();
    await act(async () => {
      result.current.publish('c1', 'card');
      result.current.publish('c2', 'card');
      result.current.publish('c3', 'card');
      result.current.publish('c4', 'card');
    });
    expect(h.api.setPresenter).toHaveBeenCalledTimes(1);
    expect(h.api.setPresenter.mock.calls[0][1].cardId).toBe('c1');
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(h.api.setPresenter).toHaveBeenCalledTimes(2);
    expect(h.api.setPresenter.mock.calls[1][1].cardId).toBe('c4');
  });

  it('com outra pessoa apresentando não toma a apresentação', async () => {
    const { result } = setup(ana);
    await act(async () => { result.current.publish('c1', 'card'); });
    expect(h.api.setPresenter).not.toHaveBeenCalled();
  });

  it('backend antigo (404): para de tentar, sem erro na tela', async () => {
    h.api.setPresenter.mockRejectedValue(Object.assign(new Error('x'), { status: 404 }));
    const { result } = setup();
    await act(async () => { result.current.publish('c1', 'card'); });
    await act(async () => { vi.advanceTimersByTime(600); result.current.publish('c2', 'card'); });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(h.api.setPresenter).toHaveBeenCalledTimes(1);
  });

  it('sem permissão (403): tenta uma vez e para', async () => {
    h.api.setPresenter.mockRejectedValue(Object.assign(new Error('x'), { status: 403 }));
    const { result } = setup();
    await act(async () => { result.current.publish('c1', 'card'); });
    await act(async () => { vi.advanceTimersByTime(600); result.current.publish('c2', 'card'); });
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(h.api.setPresenter).toHaveBeenCalledTimes(1);
  });

  it('encerrar a apresentação chama o DELETE só se eu publiquei', async () => {
    h.api.setPresenter.mockResolvedValue({ ...ana, userId: 'me' });
    h.api.clearPresenter.mockResolvedValue(undefined);
    const { result, setPresenter } = setup();
    act(() => result.current.stop());
    expect(h.api.clearPresenter).not.toHaveBeenCalled();
    await act(async () => { result.current.publish('c1', 'card'); });
    act(() => result.current.stop());
    expect(h.api.clearPresenter).toHaveBeenCalledWith('s1');
    expect(setPresenter).toHaveBeenCalledTimes(1); // só o PUT; o apresentador local não é "meu" no props
  });

  it('encerrar cancela a publicação que estava esperando o intervalo', async () => {
    h.api.setPresenter.mockResolvedValue({ ...ana, userId: 'me' });
    h.api.clearPresenter.mockResolvedValue(undefined);
    const { result } = setup();
    await act(async () => { result.current.publish('c1', 'card'); result.current.publish('c2', 'card'); });
    act(() => result.current.stop());
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(h.api.setPresenter).toHaveBeenCalledTimes(1);
  });

  it('refresh lê o apresentador do servidor e ignora a falta da rota', async () => {
    h.api.getPresenter.mockResolvedValueOnce(ana);
    const { result, setPresenter } = setup();
    await act(async () => { await result.current.refresh(); });
    expect(setPresenter).toHaveBeenCalledWith(ana);
    h.api.getPresenter.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 404 }));
    await act(async () => { await result.current.refresh(); });
    expect(setPresenter).toHaveBeenCalledTimes(1);
  });
});

describe('chip Apresentando', () => {
  afterEach(cleanup);

  it('mostra o nome e o botão Acompanhar liga e desliga', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<PresenterChip presenter={ana} following={false} onToggle={onToggle} />);
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Acompanhar' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<PresenterChip presenter={ana} following onToggle={onToggle} />);
    expect(screen.getByRole('button', { name: 'Acompanhar' }).getAttribute('aria-pressed')).toBe('true');
  });
});

describe('Teatro com apresentador', () => {
  beforeAll(() => {
    class RO { observe() {} unobserve() {} disconnect() {} }
    (globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
    Element.prototype.scrollIntoView = vi.fn();
    window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false, onchange: null }) as MediaQueryList);
  });
  afterEach(cleanup);

  const task = (id: string): ShowcaseTask => ({
    id, key: id.toUpperCase(), title: `Entrega ${id}`, description: '', acceptanceCriteria: '', type: 'História', status: 'Done', priority: 'Medium', points: 0,
    assignee: '', url: '',
    evidence: { problem: 'p', solution: 's', dev: 'Ana', qa: 'Bruno', screenshot: '', video: '', timeSpent: 0, timeEstimate: 0 },
    decision: 'open', preparationStatus: 'done', feedback: '',
  } as ShowcaseTask);
  const session: ShowcaseSession = { id: 's1', name: 'Review', sprintName: 'S', tasks: [task('c1'), task('c2'), task('c3')], createdAt: null, status: 'active' };

  const mount = (over: Partial<React.ComponentProps<typeof TeatroMode>> = {}) => {
    const props = {
      session, currentIndex: 0, onIndexChange: vi.fn(), onDecision: vi.fn(), onClose: vi.fn(), onFinish: vi.fn(),
      presenter: ana, meId: 'me', following: false, onFollowingChange: vi.fn(), onPublishPresenter: vi.fn(), ...over,
    };
    const view = render(<TeatroMode {...props} />);
    return { props, ...view };
  };

  it('mostra "Apresentando: nome" e Acompanhar liga o acompanhar', () => {
    const { props } = mount();
    expect(screen.getByText('Ana Souza')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Acompanhar' }));
    expect(props.onFollowingChange).toHaveBeenCalledWith(true);
  });

  it('sem apresentador (ou backend antigo) não aparece nada de acompanhar', () => {
    mount({ presenter: null });
    expect(screen.queryByRole('button', { name: 'Acompanhar' })).toBeNull();
  });

  it('o apresentador sou eu: sem chip', () => {
    mount({ presenter: { ...ana, userId: 'me' } });
    expect(screen.queryByRole('button', { name: 'Acompanhar' })).toBeNull();
  });

  it('acompanhando: o Teatro vai para o card do apresentador', () => {
    const { props } = mount({ following: true, currentIndex: 0 });
    expect(props.onIndexChange).toHaveBeenCalledWith(1); // c2
  });

  it('acompanhando e o apresentador volta à capa: o Teatro vai para a capa', () => {
    const { props } = mount({ following: true, currentIndex: 2, presenter: { ...ana, cardId: null, step: 'cover' } });
    expect(props.onIndexChange).toHaveBeenCalledWith(-1);
  });

  it('acompanhando, navegar com o teclado solta o acompanhar', () => {
    const { props } = mount({ following: true, currentIndex: 1 });
    props.onIndexChange.mockClear();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(props.onFollowingChange).toHaveBeenCalledWith(false);
    expect(props.onIndexChange).toHaveBeenCalledWith(2);
  });

  it('o apresentador encerrou: solta o acompanhar sozinho', () => {
    const { props } = mount({ following: true, presenter: null });
    expect(props.onFollowingChange).toHaveBeenCalledWith(false);
  });

  it('trava de decisão: sem permissão os botões ficam desativados e o motivo aparece; com permissão, ativos', () => {
    const view = mount({ presenter: null, canDecide: false });
    expect((screen.getByRole('button', { name: 'Aprovar' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Rejeitar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Decisão restrita')).toBeTruthy();
    view.unmount();
    mount({ presenter: null, canDecide: true });
    expect((screen.getByRole('button', { name: 'Aprovar' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('Decisão restrita')).toBeNull();
  });

  it('o cargo do perfil vale quando a sala não informa a permissão (como antes)', () => {
    mount({ presenter: null });
    expect((screen.getByRole('button', { name: 'Aprovar' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('publica o card que mostra, e a capa como cardId nulo', () => {
    const { props, rerender } = mount({ presenter: null, currentIndex: -1 });
    expect(props.onPublishPresenter).toHaveBeenLastCalledWith(null, 'cover');
    rerender(<TeatroMode {...props} currentIndex={1} presenter={null} />);
    expect(props.onPublishPresenter).toHaveBeenLastCalledWith('c2', 'card');
  });
});
