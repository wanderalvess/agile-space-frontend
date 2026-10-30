import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Issue, Participant } from '../../../lib/types';

vi.mock('next/navigation', () => ({ usePathname: () => '/room/ABC', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', variant: 'default', setMode: vi.fn(), setVariant: vi.fn() }),
}));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../layout/ThemeToggle', () => ({ ThemeToggle: () => <button aria-label="Tema" /> }));
vi.mock('../../home/ProfileMenu', () => ({ ProfileMenu: () => <button aria-label="Menu do perfil" /> }));
vi.mock('../ShareRoomDialog', () => ({ ShareRoomDialog: () => null }));
vi.mock('../ExportDialog', () => ({
  ExportDialog: ({ open }: { open?: boolean }) => (open ? <div role="dialog" aria-label="Exportar resultados" /> : null),
}));
vi.mock('../TopicQueue', () => ({ TopicQueue: () => <div>fila</div> }));
vi.mock('../ParticipantList', () => ({ ParticipantList: () => <div>lista</div> }));
vi.mock('../TemplateDialogs', () => ({ useSaveRoomTemplate: () => ({ openDialog: vi.fn() }) }));
vi.mock('../PokerDialogs', () => ({ CeremonySettingsDialog: () => null }));
vi.mock('../FacilitatorPanel', () => ({ FacilitatorPanel: () => null }));
vi.mock('../../ui/dropdown-menu', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuSub: passthrough,
    DropdownMenuSubTrigger: () => null,
    DropdownMenuSubContent: () => null,
    DropdownMenuSeparator: () => <hr />,
    DropdownMenuContent: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <button role="menuitem" onClick={onClick}>{children}</button>,
  };
});

import { AsyncPokerRoom } from '../AsyncPokerRoom';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((query: string) => ({
    matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }) as unknown as MediaQueryList);
  window.ResizeObserver = window.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});
afterEach(cleanup);

const me = { id: 'u1', nickname: 'Ana', role: 'dev', globalRole: 'Developer' } as unknown as Participant;
const issue = { id: 'i1', title: 'Login social', status: 'pending' } as unknown as Issue;

function renderRoom(over: Record<string, unknown> = {}) {
  const props = {
    roomId: 'ABC', currentUser: me, participants: [me], votes: [], deck: 'fibonacci', revealedIssues: [],
    onAsyncVote: vi.fn(), onAsyncReveal: vi.fn(), onAsyncClear: vi.fn(), onSetDeck: vi.fn(), onRemoveParticipant: vi.fn(),
    onUpdateParticipantRole: vi.fn(), isCurrentUserFacilitator: true, roomTitle: 'Sprint 42', roomTeam: 'Squad Alfa',
    issuesQueue: [issue], onAddIssue: vi.fn(), onBulkAddIssues: vi.fn(), onDeleteIssue: vi.fn(), onCompleteIssue: vi.fn(),
    onLeaveRoom: vi.fn(), isSoundEnabled: true, onSetIsSoundEnabled: vi.fn(), onOpenFeedback: vi.fn(), onOpenRetro: vi.fn(), creatorId: 'u1',
    ...over,
  };
  render(<AsyncPokerRoom {...(props as unknown as React.ComponentProps<typeof AsyncPokerRoom>)} />);
  return props;
}

describe('AsyncPokerRoom: barra do kit', () => {
  it('um único cabeçalho com título, modo, squad e as ações da sala', () => {
    renderRoom();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: /Sprint 42/ })).toBeTruthy();
    expect(screen.getByText('Assíncrono')).toBeTruthy();
    expect(screen.getByText('Squad Alfa')).toBeTruthy();
    for (const name of ['Fila de tarefas', 'Compartilhar sala', 'Configurações da cerimônia', 'Exportar resultados']) {
      expect(screen.getAllByRole('button', { name: new RegExp(name) }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Abrir retro desta sprint').length).toBeGreaterThan(0);
  });

  it('exportar abre o diálogo e a votação da tarefa continua', () => {
    renderRoom();
    expect(screen.queryByRole('dialog', { name: 'Exportar resultados' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /Exportar resultados/ })[0]);
    expect(screen.getByRole('dialog', { name: 'Exportar resultados' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Votar agora/ }));
    expect(screen.getByText('Escolha sua estimativa')).toBeTruthy();
  });

  it('cargo que não vota entra como observador: sem baralho, com o motivo', () => {
    const tl = { id: 'u1', nickname: 'Ana', role: 'organizador', globalRole: 'Tech Lead' } as unknown as Participant;
    renderRoom({ currentUser: tl, participants: [tl] });
    fireEvent.click(screen.getByRole('button', { name: /Votar agora/ }));
    expect(screen.queryByText('Escolha sua estimativa')).toBeNull();
    expect(screen.getByText('Você acompanha como observador')).toBeTruthy();
    expect(screen.getByText('O cargo Tech Lead não vota nesta sala.')).toBeTruthy();
  });

  it('cargo incluído em "Quem vota" recebe o baralho', () => {
    const tl = { id: 'u1', nickname: 'Ana', role: 'organizador', globalRole: 'Tech Lead' } as unknown as Participant;
    renderRoom({ currentUser: tl, participants: [tl], settings: { votingCargos: ['Developer', 'Tech Lead'] } });
    fireEvent.click(screen.getByRole('button', { name: /Votar agora/ }));
    expect(screen.getByText('Escolha sua estimativa')).toBeTruthy();
  });

  it('quem não é facilitador não vê as configurações', () => {
    renderRoom({ isCurrentUserFacilitator: false });
    expect(screen.queryByRole('button', { name: /Configurações da cerimônia/ })).toBeNull();
  });
});
