import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RetroBoard, RetroCard, RetroParticipant } from '../../../lib/types';
import { RETRO_TEMPLATES } from '../../../lib/types';

const h = vi.hoisted(() => ({ toast: vi.fn(), pdfCtor: vi.fn() }));
vi.mock('../../../hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
// A montagem do PDF (jsPDF) fica fora: aqui vale que o botão chama a geração e que uma falha vira aviso.
vi.mock('jspdf', () => ({ default: function JsPdfStub() { h.pdfCtor(); throw new Error('sem canvas'); } }));

import { ExportRetroDialog } from '../ExportRetroDialog';

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q: string) => ({ matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }) as unknown as MediaQueryList);
});
let copied = '';
beforeEach(() => {
  copied = '';
  h.toast.mockClear();
  Object.assign(navigator, { clipboard: { writeText: vi.fn(async (t: string) => { copied = t; }) } });
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
});
afterEach(cleanup);

const board: RetroBoard = {
  id: 'b1', creatorId: 'fac', isCardsRevealed: true, votingStatus: 'finished', isAuthorsRevealed: true, createdAt: '2025-10-03T12:00:00Z',
  title: 'Retro Sprint 41', team: 'Phoenix', columns: RETRO_TEMPLATES.classic,
};
const people: RetroParticipant[] = [
  { id: 'fac', boardId: 'b1', nickname: 'Carla', role: 'AM', isCreator: true },
  { id: 'u2', boardId: 'b1', nickname: 'Ana', role: 'DEV', isCreator: false },
];
const cards: RetroCard[] = [
  { id: '1', boardId: 'b1', columnKey: 'wentWell', content: 'Pareamento | acelerou', authorId: 'u2', votes: ['fac', 'u2'], order: 1 },
  { id: '2', boardId: 'b1', columnKey: 'toImprove', content: 'Deploys às sextas', authorId: 'fac', votes: ['u2'], order: 1, originalTexts: ['Sexta de deploy é arriscada'] },
  { id: '3', boardId: 'b1', columnKey: 'actionItems', content: 'Congelar deploy', authorId: 'fac', votes: [], order: 1, assignee: 'Carla', dueDate: '2025-10-22', isDone: false },
];

const open = () => render(<ExportRetroDialog isOpen onClose={vi.fn()} boardData={board} cards={cards} participants={people} />);

describe('exportar retro', () => {
  it('resume as contribuições, votos e ações e começa no PDF', () => {
    open();
    expect(screen.getByRole('dialog').textContent).toContain('3 contribuições · 3 votos · 1 ação');
    expect((screen.getByRole('radio', { name: /Documento executivo/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeTruthy();
  });

  it('Markdown copia tabelas com votos, autor, ideias agrupadas e ações, com "|" escapado', async () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: /Markdown/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar Markdown' })); });
    expect(copied).toContain('Relatório de Retrospectiva: Retro Sprint 41');
    expect(copied).toContain('**Squad:** Phoenix');
    expect(copied).toContain('| 2 | Pareamento \\| acelerou | Ana |');
    expect(copied).toContain('_(agrupado com: Sexta de deploy é arriscada)_');
    expect(copied).toContain('| [ ] Pendente | Congelar deploy | 👤 Carla | 📅 22/10/2025 |');
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Markdown Copiado!' }));
  });

  it('o texto do TDN agrupa participantes por papel e leva o link do slide', async () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: /Texto para o TDN/ }));
    fireEvent.change(screen.getByLabelText(/Link do slide/), { target: { value: 'https://slides/x' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar texto do TDN' })); });
    expect(copied).toContain('AM: Carla');
    expect(copied).toContain('DEV TEAM: Ana');
    expect(copied).toContain('Slides: https://slides/x');
    expect(copied).toContain('[ ] Congelar deploy (Carla — 22/10/2025)');
  });

  it('autores só entram no relatório quando estão revelados', async () => {
    render(<ExportRetroDialog isOpen onClose={vi.fn()} boardData={{ ...board, isAuthorsRevealed: false }} cards={cards} participants={people} />);
    fireEvent.click(screen.getByRole('radio', { name: /Markdown/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copiar Markdown' })); });
    expect(copied).toContain('| 2 | Pareamento \\| acelerou | - |');
  });

  it('PDF chama a geração; se falhar, avisa e o botão volta', async () => {
    open();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baixar PDF' })); });
    expect(h.pdfCtor).toHaveBeenCalledTimes(1);
    expect(h.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Erro na exportação', variant: 'destructive' }));
    expect((screen.getByRole('button', { name: 'Baixar PDF' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
