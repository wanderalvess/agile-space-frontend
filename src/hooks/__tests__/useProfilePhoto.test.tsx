import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profile: { id: 'u1', email: 'a@totvs.com.br', name: 'Ana', photoUrl: null as string | null },
  team: undefined as string | undefined,
  uploaded: { url: undefined as string | undefined, loading: false, failed: false },
}));

vi.mock('@/context/UserContext', () => ({ useUserContext: () => ({ userProfile: mocks.profile }) }));
vi.mock('@/hooks/useTeamAvatars', () => ({ useTeamAvatars: () => ({ avatarFor: () => mocks.team }) }));
vi.mock('@/hooks/useUploadedPhoto', () => ({ useUploadedPhoto: () => mocks.uploaded }));

import { useProfilePhoto } from '../useProfilePhoto';
import { resetUploadedPhotoOverrides, setUploadedPhotoOverride } from '@/lib/uploaded-photo-store';

beforeEach(() => {
  mocks.profile.photoUrl = null;
  mocks.team = 'https://jira.example/a.png';
  mocks.uploaded = { url: undefined, loading: false, failed: false };
  resetUploadedPhotoOverrides();
  window.localStorage.clear();
});

describe('useProfilePhoto: foto enviada x Jira', () => {
  it('sem foto enviada usa a do Jira', () => {
    const { result } = renderHook(() => useProfilePhoto());
    expect(result.current.photo).toBe('https://jira.example/a.png');
    expect(result.current.hasUploaded).toBe(false);
  });

  it('a enviada (blob:) vale mais que a do Jira', () => {
    mocks.profile.photoUrl = '/api/users/u1/photo?v=1';
    mocks.uploaded = { url: 'blob:enviada', loading: false, failed: false };
    const { result } = renderHook(() => useProfilePhoto());
    expect(result.current.photo).toBe('blob:enviada');
    expect(result.current.hasUploaded).toBe(true);
  });

  it('enquanto a enviada carrega não pisca a do Jira', () => {
    mocks.profile.photoUrl = '/api/users/u1/photo?v=1';
    mocks.uploaded = { url: undefined, loading: true, failed: false };
    const { result } = renderHook(() => useProfilePhoto());
    expect(result.current.photo).toBeUndefined();
  });

  it('se a enviada falha, volta à do Jira', () => {
    mocks.profile.photoUrl = '/api/users/u1/photo?v=1';
    mocks.uploaded = { url: undefined, loading: false, failed: true };
    const { result } = renderHook(() => useProfilePhoto());
    expect(result.current.photo).toBe('https://jira.example/a.png');
    expect(result.current.hasUploaded).toBe(false);
  });

  it('remover na hora (override null) ignora o photoUrl da sessão', () => {
    mocks.profile.photoUrl = '/api/users/u1/photo?v=1';
    const { result } = renderHook(() => useProfilePhoto());
    expect(result.current.hasUploaded).toBe(true);
    act(() => setUploadedPhotoOverride('u1', null));
    expect(result.current.hasUploaded).toBe(false);
  });
});
