import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ prepare: vi.fn(), upload: vi.fn(), remove: vi.fn() }));

vi.mock('@/components/ui/dropdown-menu', async () => await import('./dropdown-menu-mock'));
vi.mock('@/lib/photo-resize', async (orig) => ({ ...(await orig<typeof import('@/lib/photo-resize')>()), prepareProfilePhoto: mocks.prepare }));
vi.mock('@/lib/user-photo-api', () => ({ userPhotoApi: { upload: mocks.upload, remove: mocks.remove } }));

import { IdentityHero, type IdentityHeroProps } from '../IdentityHero';
import { PhotoPrepareError } from '@/lib/photo-resize';
import { getUploadedPhotoOverride, resetUploadedPhotoOverrides } from '@/lib/uploaded-photo-store';

function setup(over: Partial<IdentityHeroProps> = {}) {
  const props: IdentityHeroProps = {
    userId: 'u1',
    name: 'Ana Ribeiro',
    email: 'ana@totvs.com.br',
    photo: undefined,
    hasUploaded: false,
    onPhotoError: vi.fn(),
    photoAvailable: false,
    photoOff: false,
    onPhotoOff: vi.fn(),
    onSaveName: vi.fn(),
    ...over,
  };
  render(<IdentityHero {...props} />);
  return props;
}

const openMenu = () => {
  const trigger = screen.getByRole('button', { name: 'Trocar foto' });
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.findByRole('menu');
};

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  resetUploadedPhotoOverrides();
});

describe('PhotoMenu: menu da foto', () => {
  it('sem foto: oferece enviar, a foto do Jira desativada com a dica e a nota de formato', async () => {
    setup();
    const menu = await openMenu();
    expect(menu.getAttribute('aria-label')).toBe('Foto de perfil');
    expect(screen.getByRole('menuitem', { name: 'Enviar uma foto' })).toBeTruthy();
    const jira = screen.getByRole('menuitem', { name: /Usar a foto do Jira/ });
    expect(jira.getAttribute('aria-disabled')).toBe('true');
    expect(jira.textContent).toContain('Conecte o Jira para trazer a sua.');
    expect(screen.queryByRole('menuitem', { name: 'Remover foto' })).toBeNull();
    expect(screen.getByText('JPG, PNG ou WebP. Recortamos no centro, em quadrado.')).toBeTruthy();
  });

  it('o item desativado não faz nada ao ser escolhido', async () => {
    const props = setup();
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: /Usar a foto do Jira/ }));
    expect(props.onPhotoOff).not.toHaveBeenCalled();
  });

  it('com foto do Jira em uso: "Usar minhas iniciais" liga photoOff, sem "Remover foto"', async () => {
    const props = setup({ photo: 'https://jira/a.png', photoAvailable: true });
    await openMenu();
    expect(screen.queryByRole('menuitem', { name: 'Remover foto' })).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Usar minhas iniciais' }));
    expect(props.onPhotoOff).toHaveBeenCalledWith(true);
  });

  it('com as iniciais ligadas e foto do Jira disponível: "Usar a foto do Jira" desliga photoOff', async () => {
    const props = setup({ photoAvailable: true, photoOff: true });
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Usar a foto do Jira' }));
    expect(props.onPhotoOff).toHaveBeenCalledWith(false);
  });

  it('com foto enviada: mostra "Remover foto" e explica por que a do Jira não vale', async () => {
    setup({ hasUploaded: true, photo: 'blob:x' });
    await openMenu();
    expect(screen.getByRole('menuitem', { name: 'Remover foto' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Usar a foto do Jira/ }).textContent).toContain('Remova a foto enviada');
  });
});

describe('foto: envio e remoção', () => {
  const file = () => new File(['x'], 'eu.png', { type: 'image/png' });
  const choose = () => fireEvent.change(screen.getByTestId('photo-input'), { target: { files: [file()] } });

  it('o input só aceita jpeg, png e webp', () => {
    setup();
    expect(screen.getByTestId('photo-input').getAttribute('accept')).toBe('image/jpeg,image/png,image/webp');
  });

  it('"Enviar uma foto" abre o seletor de arquivo', async () => {
    setup();
    const click = vi.spyOn(screen.getByTestId('photo-input') as HTMLInputElement, 'click');
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Enviar uma foto' }));
    expect(click).toHaveBeenCalled();
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

  it('remove a foto enviada pelo menu', async () => {
    mocks.remove.mockResolvedValue(undefined);
    setup({ hasUploaded: true });
    await openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remover foto' }));
    await waitFor(() => expect(getUploadedPhotoOverride('u1')).toBeNull());
  });

  it('avisa o modal enquanto envia (para segurar o fechamento)', async () => {
    let release: (v: string) => void = () => {};
    mocks.prepare.mockResolvedValue(new Blob(['j']));
    mocks.upload.mockReturnValue(new Promise<string>((r) => (release = r)));
    const onBusyChange = vi.fn();
    setup({ onBusyChange });
    choose();
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    release('/p');
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  });
});
