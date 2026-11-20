import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';

const fetchUserBlob = vi.hoisted(() => vi.fn());
vi.mock('@/lib/user-photo-api', () => ({ userPhotoApi: { fetchUserBlob, fetchBlob: vi.fn() } }));

import { InitialsAvatar } from '../InitialsAvatar';
import { resetUserPhotoCache } from '@/lib/user-photo-cache';
import { resetUploadedPhotoOverrides } from '@/lib/uploaded-photo-store';

beforeEach(() => {
  fetchUserBlob.mockReset();
  resetUserPhotoCache();
  resetUploadedPhotoOverrides();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:colega-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

const JIRA = 'https://jira.example/a.png';

describe('InitialsAvatar com userId', () => {
  it('sem userId não busca nada e segue a foto do Jira', () => {
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" src={JIRA} />);
    expect(fetchUserBlob).not.toHaveBeenCalled();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(JIRA);
  });

  it('a foto enviada pela pessoa vale mais que a do Jira', async () => {
    fetchUserBlob.mockResolvedValue(new Blob(['x']));
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" src={JIRA} userId="u1" />);
    // Enquanto carrega, a do Jira (nada de piscar as iniciais).
    expect(container.querySelector('img')?.getAttribute('src')).toBe(JIRA);
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:colega-1'));
    expect(fetchUserBlob).toHaveBeenCalledWith('u1');
  });

  it('sem foto enviada (404), fica com a do Jira', async () => {
    fetchUserBlob.mockResolvedValue(null);
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" src={JIRA} userId="u2" />);
    await waitFor(() => expect(fetchUserBlob).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(container.querySelector('img')?.getAttribute('src')).toBe(JIRA);
  });

  it('sem foto enviada e sem Jira, mostram-se as iniciais', async () => {
    fetchUserBlob.mockResolvedValue(null);
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" userId="u3" />);
    await act(async () => {});
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('AR');
  });

  it('falha de rede também cai nas iniciais, sem erro', async () => {
    fetchUserBlob.mockRejectedValue(new Error('offline'));
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" userId="u4" />);
    await act(async () => {});
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('AR');
  });

  it('imagem enviada quebrada cai para a do Jira e depois para as iniciais, avisando cada uma', async () => {
    fetchUserBlob.mockResolvedValue(new Blob(['x']));
    const onPhotoError = vi.fn();
    const { container } = render(<InitialsAvatar name="Ana Ribeiro" src={JIRA} userId="u5" onPhotoError={onPhotoError} />);
    await waitFor(() => expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:colega-1'));

    fireEvent.error(container.querySelector('img')!);
    expect(onPhotoError).toHaveBeenLastCalledWith('blob:colega-1');
    expect(container.querySelector('img')?.getAttribute('src')).toBe(JIRA);

    fireEvent.error(container.querySelector('img')!);
    expect(onPhotoError).toHaveBeenLastCalledWith(JIRA);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toBe('AR');
  });
});
