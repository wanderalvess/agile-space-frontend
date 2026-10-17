import { describe, expect, it } from 'vitest';
import {
  AUDIENCE_ROLE_OPTIONS,
  EMPTY_ANNOUNCEMENT_FORM,
  canonicalAudienceRole,
  audienceSummary,
  formFromAnnouncement,
  inputFromForm,
  isoToLocalInput,
  validateAnnouncementForm,
} from '../announcement-form';

const base = { ...EMPTY_ANNOUNCEMENT_FORM, title: 'Manutenção', content: 'Sábado 22h' };

describe('validateAnnouncementForm', () => {
  it('aceita o mínimo (título + texto, público todos)', () => {
    expect(validateAnnouncementForm(base)).toBeNull();
  });

  it('aplica os limites do contrato', () => {
    expect(validateAnnouncementForm({ ...base, title: ' ' })).toMatch(/título/i);
    expect(validateAnnouncementForm({ ...base, title: 'x'.repeat(121) })).toMatch(/120/);
    expect(validateAnnouncementForm({ ...base, content: 'x'.repeat(2001) })).toMatch(/2000/);
    expect(validateAnnouncementForm({ ...base, link: 'javascript:alert(1)' })).toMatch(/http/);
    expect(validateAnnouncementForm({ ...base, link: '/room/abc' })).toBeNull();
    expect(validateAnnouncementForm({ ...base, audienceType: 'SQUADS' })).toMatch(/squad/);
    expect(validateAnnouncementForm({ ...base, audienceType: 'ROLES' })).toMatch(/papel/);
    expect(validateAnnouncementForm({ ...base, validFrom: '2026-10-20T10:00', validUntil: '2026-10-20T09:00' })).toMatch(/depois/);
  });
});

describe('inputFromForm', () => {
  it('limpa listas que não valem para o público escolhido e converte datas', () => {
    const input = inputFromForm({
      ...base,
      audienceType: 'ROLES',
      audienceRoles: ['AGILE_MASTER'],
      audienceSquadIds: ['DDW'],
      validFrom: '',
      validUntil: '2026-10-20T23:00',
      link: '  ',
    });
    expect(input.audienceSquadIds).toEqual([]);
    expect(input.audienceRoles).toEqual(['AGILE_MASTER']);
    expect(input.validFrom).toBeNull();
    expect(input.validUntil).toBe(new Date('2026-10-20T23:00').toISOString());
    expect(input.link).toBeNull();
  });

  it('ida e volta pelo formulário de edição preserva os campos', () => {
    const iso = new Date('2026-10-20T23:00').toISOString();
    const form = formFromAnnouncement({
      id: 'a', title: 'T', content: 'C', type: 'IMPORTANT', audienceType: 'SQUADS', audienceSquadIds: ['S1'], audienceRoles: [],
      validFrom: iso, validUntil: null, link: '/x', createdBy: 'u', createdByName: 'Admin', createdAt: iso, dismissed: false,
    });
    expect(form.validFrom).toBe(isoToLocalInput(iso));
    expect(inputFromForm(form)).toMatchObject({ type: 'IMPORTANT', audienceSquadIds: ['S1'], validFrom: iso, validUntil: null, link: '/x' });
  });
});

describe('audienceSummary', () => {
  it('descreve o público', () => {
    expect(audienceSummary({ audienceType: 'ALL', audienceSquadIds: [], audienceRoles: [] })).toBe('para todos');
    expect(audienceSummary({ audienceType: 'SQUADS', audienceSquadIds: ['S1'], audienceRoles: [] }, { S1: 'Phoenix' })).toBe('para Phoenix');
    expect(audienceSummary({ audienceType: 'ROLES', audienceSquadIds: [], audienceRoles: ['AGILE_MASTER', 'X'] })).toBe('para Agile Master, X');
  });
});

describe('audiência por liderança (LEAD virou LEADERSHIP)', () => {
  const iso = new Date('2026-10-20T23:00').toISOString();
  const ann = (roles: string[]) => ({
    id: 'a', title: 'T', content: 'C', type: 'INFO' as const, audienceType: 'ROLES' as const, audienceSquadIds: [], audienceRoles: roles,
    validFrom: iso, validUntil: null, link: null, createdBy: 'u', createdByName: 'Admin', createdAt: iso, dismissed: false,
  });

  it('oferece Liderança com a chave LEADERSHIP e não oferece LEAD', () => {
    expect(AUDIENCE_ROLE_OPTIONS.find((o) => o.value === 'LEADERSHIP')?.label).toBe('Liderança');
    expect(AUDIENCE_ROLE_OPTIONS.some((o) => o.value === 'LEAD')).toBe(false);
  });

  it('lê o LEAD antigo como liderança, sem duplicar', () => {
    expect(canonicalAudienceRole('LEAD')).toBe('LEADERSHIP');
    expect(canonicalAudienceRole('MEMBER')).toBe('MEMBER');
    expect(formFromAnnouncement(ann(['LEAD', 'MEMBER'])).audienceRoles).toEqual(['LEADERSHIP', 'MEMBER']);
    expect(formFromAnnouncement(ann(['LEAD', 'LEADERSHIP'])).audienceRoles).toEqual(['LEADERSHIP']);
  });

  it('o resumo do público mostra "Liderança" para aviso antigo com LEAD', () => {
    expect(audienceSummary(ann(['LEAD']))).toBe('para Liderança');
  });
});
