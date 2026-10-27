import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TopicDisplay } from '../TopicDisplay';

const base = { topic: 'Cadastro de pedidos', isFacilitator: true, onSetTopic: vi.fn() };

describe('TopicDisplay: ações com texto visível', () => {
  it('Editar, Notas e Detalhes aparecem com texto, não só como ícone', () => {
    render(<TopicDisplay {...base} hasDetail onShowDetail={vi.fn()} onShowNotes={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Editar tarefa' }).textContent).toContain('Editar');
    expect(screen.getByRole('button', { name: 'Notas de refinamento' }).textContent).toContain('Notas');
    expect(screen.getByRole('button', { name: 'Ver detalhes da tarefa' }).textContent).toContain('Detalhes');
  });

  it('o nome acessível contém o texto visível (rótulo no nome)', () => {
    render(<TopicDisplay {...base} hasDetail onShowDetail={vi.fn()} onShowNotes={vi.fn()} />);
    for (const [name, visible] of [['Editar tarefa', 'Editar'], ['Notas de refinamento', 'Notas'], ['Ver detalhes da tarefa', 'Detalhes']] as const) {
      expect(screen.getByRole('button', { name }).textContent?.toLowerCase()).toContain(visible.toLowerCase());
      expect(name.toLowerCase()).toContain(visible.toLowerCase());
    }
  });

  it('Editar abre a edição do título e Notas e Detalhes chamam os mesmos callbacks', () => {
    const onShowNotes = vi.fn();
    const onShowDetail = vi.fn();
    render(<TopicDisplay {...base} hasDetail onShowDetail={onShowDetail} onShowNotes={onShowNotes} />);
    fireEvent.click(screen.getByRole('button', { name: 'Notas de refinamento' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes da tarefa' }));
    expect(onShowNotes).toHaveBeenCalledTimes(1);
    expect(onShowDetail).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Editar tarefa' }));
    expect(screen.getByRole('region', { name: 'Tarefa em edição' })).toBeTruthy();
  });

  it('quem não é facilitador não vê Editar', () => {
    render(<TopicDisplay {...base} isFacilitator={false} onShowNotes={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Editar tarefa' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Notas de refinamento' })).toBeTruthy();
  });
});
