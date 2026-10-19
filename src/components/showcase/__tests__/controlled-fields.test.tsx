import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControlledTextarea } from '../ControlledFields';

function Harness({ a, b, onA, onB }: { a: string; b: string; onA: (v: string) => void; onB: (v: string) => void }) {
  return (
    <>
      <ControlledTextarea aria-label="criterios" value={a} onChange={onA} />
      <ControlledTextarea aria-label="descricao" value={b} onChange={onB} />
    </>
  );
}

describe('ControlledTextarea: edição simultânea do mesmo campo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const box = (name: string) => screen.getByLabelText(name) as HTMLTextAreaElement;

  it('rascunho sujo sem blur + valor remoto: o texto fica, aparece o aviso e nada é enviado', () => {
    const onA = vi.fn();
    const { rerender } = render(<Harness a="base" b="" onA={onA} onB={vi.fn()} />);
    fireEvent.focus(box('criterios'));
    fireEvent.change(box('criterios'), { target: { value: 'texto de A' } });
    rerender(<Harness a="texto de B" b="" onA={onA} onB={vi.fn()} />);
    expect(box('criterios').value).toBe('texto de A');
    expect(screen.getByRole('alert').textContent).toContain('Outra pessoa alterou este campo');
    act(() => { vi.advanceTimersByTime(1000); });
    fireEvent.blur(box('criterios'));
    expect(onA).not.toHaveBeenCalled();
    expect(box('criterios').value).toBe('texto de A');
  });

  it('Reaplicar a minha envia o rascunho; Descartar volta ao valor remoto', () => {
    const onA = vi.fn();
    const { rerender } = render(<Harness a="base" b="" onA={onA} onB={vi.fn()} />);
    fireEvent.change(box('criterios'), { target: { value: 'texto de A' } });
    rerender(<Harness a="texto de B" b="" onA={onA} onB={vi.fn()} />);
    fireEvent.click(screen.getByText('Reaplicar a minha'));
    expect(onA).toHaveBeenCalledWith('texto de A');
    expect(screen.queryByRole('alert')).toBeNull();

    const onA2 = vi.fn();
    const r2 = render(<Harness a="base" b="" onA={onA2} onB={vi.fn()} />);
    const ta = r2.getAllByLabelText('criterios').at(-1) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'outro' } });
    r2.rerender(<Harness a="texto de B" b="" onA={onA2} onB={vi.fn()} />);
    fireEvent.click(r2.getByText('Descartar'));
    expect(onA2).not.toHaveBeenCalled();
    expect((r2.getAllByLabelText('criterios').at(-1) as HTMLTextAreaElement).value).toBe('texto de B');
  });

  it('com foco e sem digitar, o valor remoto atualiza o campo', () => {
    const { rerender } = render(<Harness a="base" b="" onA={vi.fn()} onB={vi.fn()} />);
    fireEvent.focus(box('criterios'));
    rerender(<Harness a="texto de B" b="" onA={vi.fn()} onB={vi.fn()} />);
    expect(box('criterios').value).toBe('texto de B');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('o eco do que a própria pessoa digitou não gera aviso', () => {
    const { rerender } = render(<Harness a="base" b="" onA={vi.fn()} onB={vi.fn()} />);
    fireEvent.change(box('criterios'), { target: { value: 'meu' } });
    rerender(<Harness a="meu" b="" onA={vi.fn()} onB={vi.fn()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('campos diferentes são independentes', () => {
    const onB = vi.fn();
    const { rerender } = render(<Harness a="base" b="d0" onA={vi.fn()} onB={onB} />);
    fireEvent.change(box('criterios'), { target: { value: 'texto de A' } });
    rerender(<Harness a="base" b="d1 remota" onA={vi.fn()} onB={onB} />);
    expect(box('descricao').value).toBe('d1 remota');
    expect(box('criterios').value).toBe('texto de A');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('sem conflito, a pausa na digitação envia normalmente', () => {
    const onA = vi.fn();
    render(<Harness a="base" b="" onA={onA} onB={vi.fn()} />);
    fireEvent.change(box('criterios'), { target: { value: 'x' } });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onA).toHaveBeenCalledWith('x');
  });
});
