import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTicket: vi.fn(),
  setMode: vi.fn(),
  setVariant: vi.fn(),
  prepare: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@/app/support/api', () => ({ supportApi: { createTicket: mocks.createTicket } }));
vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light', resolvedMode: 'light', variant: 'default', setMode: mocks.setMode, setVariant: mocks.setVariant }),
}));
vi.mock('@/lib/photo-resize', async (orig) => ({ ...(await orig<typeof import('@/lib/photo-resize')>()), prepareProfilePhoto: mocks.prepare }));
vi.mock('@/lib/user-photo-api', () => ({ userPhotoApi: { upload: mocks.upload, remove: mocks.remove } }));

import { ProfileSection, type ProfileSectionProps } from '../ProfileSection';
import { PhotoPrepareError } from '@/lib/photo-resize';
import { getUploadedPhotoOverride, resetUploadedPhotoOverrides } from '@/lib/uploaded-photo-store';

function setup(over: Partial<ProfileSectionProps> = {}) {
  const props: ProfileSectionProps = {
    userId: 'u1',
    name: 'Ana Ribeiro',
    onName: vi.fn(),
    nameInput: { current: null },
    email: 'ana@totvs.com.br',
    errors: {},
    cargo: 'Developer',
    leadership: false,
    squad: 'DDWMISSI',
    photo: undefined,
    hasUploaded: false,
    onPhotoError: vi.fn(),
    photoAvailable: false,
    photoOff: false,
    onPhotoOff: vi.fn(),
    onGoJira: vi.fn(),
    onNavigate: vi.fn(),
    ...over,
  };
  render(<ProfileSection {...props} />);
  return props;
}

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  resetUploadedPhotoOverrides();
});

describe('ProfileSection', () => {
  it('mostra o cargo em leitura e a ação de pedir ajuste', () => {
    setup();
    const cargo = screen.getByLabelText('Cargo') as HTMLInputElement;
    expect(cargo.value).toBe('Developer');
    expect(cargo.readOnly).toBe(true);
    expect(screen.getByRole('button', { name: 'Pedir ajuste do cargo' })).toBeTruthy();
  });

  it('não tem mais link para /configuracoes e traz os controles de tema inline', () => {
    setup();
    expect(document.querySelector('a[href="/configuracoes"]')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }));
    expect(mocks.setMode).toHaveBeenCalledWith('dark');
    fireEvent.click(screen.getByRole('radio', { name: /Corporativo/ }));
    expect(mocks.setVariant).toHaveBeenCalledWith('totvs');
  });

  describe('pedido de ajuste do cargo', () => {
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Pedir ajuste do cargo' }));

    it('exige o cargo desejado para quem não é liderança', () => {
      setup();
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      expect(screen.getByRole('alert').textContent).toContain('Escolha o cargo desejado');
      expect(mocks.createTicket).not.toHaveBeenCalled();
    });

    it('envia o chamado com cargo atual, desejado, motivo, e-mail e squad', async () => {
      mocks.createTicket.mockResolvedValue({ id: 't1' });
      setup();
      open();
      fireEvent.change(screen.getByLabelText('Cargo desejado'), { target: { value: 'QA' } });
      fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'Atuo em testes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      await screen.findByText('Pedido enviado ao Suporte');
      const payload = mocks.createTicket.mock.calls[0][0];
      expect(payload.subject).toBe('Ajuste de cargo');
      expect(payload.type).toBe('support');
      expect(payload.message).toContain('Cargo atual: Developer');
      expect(payload.message).toContain('Cargo desejado: QA');
      expect(payload.message).toContain('Motivo: Atuo em testes');
      expect(payload.message).toContain('E-mail: ana@totvs.com.br');
      expect(payload.message).toContain('Squad ativa: DDWMISSI');
      expect(screen.getByRole('link', { name: 'Ver meus chamados' }).getAttribute('href')).toBe('/support');
    });

    it('aceita "Outro" com campo livre', async () => {
      mocks.createTicket.mockResolvedValue({ id: 't1' });
      setup();
      open();
      fireEvent.change(screen.getByLabelText('Cargo desejado'), { target: { value: '__outro__' } });
      fireEvent.change(screen.getByLabelText('Qual cargo?'), { target: { value: 'Analista de Dados' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      await screen.findByText('Pedido enviado ao Suporte');
      expect(mocks.createTicket.mock.calls[0][0].message).toContain('Cargo desejado: Analista de Dados');
    });

    it('em caso de erro mostra a mensagem e deixa tentar de novo', async () => {
      mocks.createTicket.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ id: 't1' });
      setup();
      open();
      fireEvent.change(screen.getByLabelText('Cargo desejado'), { target: { value: 'UX' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      await screen.findByText(/Não foi possível enviar o pedido/);
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
      await screen.findByText('Pedido enviado ao Suporte');
      expect(mocks.createTicket).toHaveBeenCalledTimes(2);
    });

    it('para liderança o cargo desejado é opcional, mas pede o motivo se vier vazio', async () => {
      mocks.createTicket.mockResolvedValue({ id: 't1' });
      setup({ leadership: true, cargo: 'Agile Master' });
      open();
      expect(screen.getByText(/vêm do Jira ou do convite/)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      expect(screen.getByRole('alert').textContent).toContain('explique o ajuste');
      fireEvent.change(screen.getByLabelText('Motivo (opcional)'), { target: { value: 'Mudei de função' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enviar pedido' }));
      await screen.findByText('Pedido enviado ao Suporte');
    });

    it('cancelar fecha o formulário', () => {
      setup();
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByLabelText('Cargo desejado')).toBeNull();
    });
  });

  describe('foto', () => {
    const file = () => new File(['x'], 'eu.png', { type: 'image/png' });
    const choose = () => fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [file()] } });

    it('o input só aceita jpeg, png e webp e o avatar é clicável', () => {
      setup();
      expect(screen.getByTestId('photo-input').getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
      expect(screen.getAllByRole('button', { name: 'Trocar foto' }).length).toBeGreaterThan(0);
    });

    it('recorta, envia e guarda o novo caminho', async () => {
      const blob = new Blob(['j'], { type: 'image/jpeg' });
      mocks.prepare.mockResolvedValue(blob);
      mocks.upload.mockResolvedValue('/api/users/u1/photo?v=1');
      setup();
      choose();
      await waitFor(() => expect(getUploadedPhotoOverride('u1')).toBe('/api/users/u1/photo?v=1'));
      expect(mocks.upload).toHaveBeenCalledWith(blob);
    });

    it('mostra o erro do preparo (arquivo que não é imagem) sem enviar', async () => {
      mocks.prepare.mockRejectedValue(new PhotoPrepareError('Esse arquivo não é uma imagem.'));
      setup();
      choose();
      await screen.findByText('Esse arquivo não é uma imagem.');
      expect(mocks.upload).not.toHaveBeenCalled();
    });

    it('mostra a mensagem que o servidor recusou', async () => {
      mocks.prepare.mockResolvedValue(new Blob(['j']));
      mocks.upload.mockRejectedValue(new Error('A foto passa de 1 MB.'));
      setup();
      choose();
      await screen.findByText('A foto passa de 1 MB.');
      expect(getUploadedPhotoOverride('u1')).toBeUndefined();
    });

    it('remove a foto enviada', async () => {
      mocks.remove.mockResolvedValue(undefined);
      setup({ hasUploaded: true });
      expect(screen.getByText('Foto enviada por você')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Remover foto' }));
      await waitFor(() => expect(getUploadedPhotoOverride('u1')).toBeNull());
    });

    it('mantém "Usar minhas iniciais" para a foto do Jira', () => {
      const props = setup({ photo: 'https://jira/a.png', photoAvailable: true });
      expect(screen.queryByRole('button', { name: 'Remover foto' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Usar minhas iniciais' }));
      expect(props.onPhotoOff).toHaveBeenCalledWith(true);
    });
  });
});
