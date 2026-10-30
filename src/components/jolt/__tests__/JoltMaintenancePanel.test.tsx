import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { JoltMaintenancePanel } from '../JoltMaintenancePanel';

const spec = [{ operation: 'shift', spec: { items: { '*': { name: 'items.[&1].nome', email: 'items.[&1].email' } } } }];
const input = { items: [{ name: 'Ana', email: 'a@b.c', cidade: 'Londrina' }] };

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.scrollIntoView = vi.fn();
  window.ResizeObserver = window.ResizeObserver || (class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver);
});
afterEach(cleanup);

function setup() {
  const onOpenChange = vi.fn();
  const onSpecChange = vi.fn();
  render(<JoltMaintenancePanel open onOpenChange={onOpenChange} specText={JSON.stringify(spec)} inputText={JSON.stringify(input)} onSpecChange={onSpecChange} />);
  return { onOpenChange, onSpecChange };
}

describe('Manutenção da spec', () => {
  it('mostra campos sem uso, mapeamentos e o que cada função faz', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Adicionar campo' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Campos que a spec não usa \(1\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher items.*.cidade para adicionar' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mapeamentos (2)' })).toBeTruthy();
    expect(screen.getByText('Nenhuma alteração ainda nesta sessão.')).toBeTruthy();
  });

  it('adicionar: campo escolhido + destino mostram o que entra na spec e a mudança volta à tela', () => {
    const { onSpecChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Escolher items.*.cidade para adicionar' }));
    fireEvent.change(screen.getByLabelText('Destino na saída'), { target: { value: 'municipio' } });
    expect(screen.getByRole('status').textContent).toContain('municipio');
    fireEvent.click(screen.getByRole('button', { name: /Adicionar à spec/ }));
    expect(onSpecChange).toHaveBeenCalledTimes(1);
    const newSpec = JSON.parse(onSpecChange.mock.calls[0][0]);
    expect(newSpec[0].spec.items['*'].cidade).toBe('items.[&1].municipio');
  });

  it('remover pede confirmação na própria linha ("Manter" desiste)', () => {
    const { onSpecChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Remover items.*.email' }));
    const alert = screen.getByText('Remover este mapeamento da spec?').closest('[role="alert"]') as HTMLElement;
    fireEvent.click(within(alert).getByRole('button', { name: 'Manter' }));
    expect(onSpecChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remover items.*.email' }));
    fireEvent.click(within(screen.getByText('Remover este mapeamento da spec?').closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Remover' }));
    expect(onSpecChange).toHaveBeenCalledTimes(1);
    expect(JSON.parse(onSpecChange.mock.calls[0][0])[0].spec.items['*'].email).toBeUndefined();
  });

  it('Esc dentro da edição de uma linha só cancela a edição: o painel continua aberto', () => {
    const { onOpenChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Editar destino de items.*.name' }));
    const edit = screen.getByLabelText('Novo destino de items.*.name');
    expect(document.activeElement).toBe(edit);
    fireEvent.change(edit, { target: { value: 'items.[&1].razaoSocial' } });

    fireEvent.keyDown(edit, { key: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Novo destino de items.*.name')).toBeNull(); // edição cancelada
    expect(screen.getByRole('dialog')).toBeTruthy(); // painel aberto
  });

  it('Esc fora da edição fecha o painel', () => {
    const { onOpenChange } = setup();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('editar o destino e salvar troca o destino na shift', () => {
    const { onSpecChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Editar destino de items.*.name' }));
    const edit = screen.getByLabelText('Novo destino de items.*.name');
    fireEvent.change(edit, { target: { value: 'items.[&1].razaoSocial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(JSON.parse(onSpecChange.mock.calls[0][0])[0].spec.items['*'].name).toBe('items.[&1].razaoSocial');
  });
});
