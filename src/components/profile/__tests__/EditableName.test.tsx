import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableName } from '../EditableName';

function setup(onSave: (n: string) => void | Promise<void> = vi.fn(), value = 'Ana Ribeiro') {
  render(<EditableName value={value} onSave={onSave} />);
  return onSave;
}
const edit = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Editar nome' }));
  return screen.getByRole('textbox', { name: 'Nome' }) as HTMLInputElement;
};

describe('EditableName', () => {
  it('mostra o nome com o lápis; o campo só aparece ao editar', () => {
    setup();
    expect(screen.getByText('Ana Ribeiro')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    const input = edit();
    expect(input.value).toBe('Ana Ribeiro');
    expect(document.activeElement).toBe(input);
  });

  it('Enter salva na hora com o nome aparado e confirma', async () => {
    const onSave = setup();
    const input = edit();
    fireEvent.change(input, { target: { value: '  Ana Maria  ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Ana Maria'));
    await screen.findByText('Nome salvo');
    expect(screen.queryByRole('textbox')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Editar nome' })));
  });

  it('sair do campo (blur) também salva, uma vez só', async () => {
    const onSave = setup();
    const input = edit();
    fireEvent.change(input, { target: { value: 'Ana M.' } });
    fireEvent.blur(input);
    fireEvent.blur(input);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith('Ana M.');
  });

  it('Esc cancela sem salvar e o blur seguinte não grava', () => {
    const onSave = setup();
    const input = edit();
    fireEvent.change(input, { target: { value: 'Outro nome' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.blur(input);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('Ana Ribeiro')).toBeTruthy();
  });

  it('sem mudança não chama o salvamento', () => {
    const onSave = setup();
    const input = edit();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('nome vazio: mostra "Informe seu nome." e continua editando', () => {
    const onSave = setup();
    const input = edit();
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toContain('Informe seu nome.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Nome' })).toBeTruthy();
  });

  it('falha ao salvar: mantém o campo aberto com a mensagem e deixa tentar de novo', async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    setup(onSave);
    const input = edit();
    fireEvent.change(input, { target: { value: 'Ana Nova' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await screen.findByText(/Não foi possível salvar o nome/);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Nome' }), { key: 'Enter' });
    await screen.findByText('Nome salvo');
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('avisa quando está gravando', async () => {
    let release: () => void = () => {};
    const onSave = vi.fn(() => new Promise<void>((r) => (release = r)));
    const onBusyChange = vi.fn();
    render(<EditableName value="Ana" onSave={onSave} onBusyChange={onBusyChange} />);
    const input = edit();
    fireEvent.change(input, { target: { value: 'Ana B' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    release();
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });
});
