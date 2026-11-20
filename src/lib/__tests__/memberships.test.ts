import { describe, expect, it } from 'vitest';
import type { Membership, MyMemberships } from '../memberships-api';
import {
  deriveMustOnboard,
  findMembership,
  hasMemberships,
  isLegacyOnly,
  leadershipOfActiveSquad,
  resolveActiveSquadId,
  scopeLabel,
  sourceLabel,
} from '../memberships';

const ms = (projectId: string, over: Partial<Membership> = {}): Membership => ({
  projectId,
  projectName: projectId,
  roleName: 'Developer',
  roleKey: 'DEVELOPER',
  leadership: false,
  direct: true,
  scope: 'SQUAD',
  source: 'JIRA',
  roles: [{ roleName: 'Developer', roleKey: 'DEVELOPER', leadership: false, source: 'JIRA', primary: true }],
  ...over,
});

const data = (memberships: Membership[], over: Partial<MyMemberships> = {}): MyMemberships => ({
  contractVersion: '1',
  activeProjectId: memberships[0]?.projectId ?? null,
  legacyOnly: false,
  transversalLeader: false,
  memberships,
  ...over,
});

describe('rótulos', () => {
  it('origem em pt-BR; null e desconhecido não mostram nada', () => {
    expect(sourceLabel('JIRA')).toBe('Importado do Jira');
    expect(sourceLabel('CLAIM')).toBe('Reivindicado');
    expect(sourceLabel('APPROVED')).toBe('Aprovado');
    expect(sourceLabel('INVITE')).toBe('Convite');
    expect(sourceLabel('MANUAL')).toBe('Manual');
    expect(sourceLabel('MIGRATION')).toBe('Migrado');
    expect(sourceLabel('BACKFILL')).toBe('Migrado');
    expect(sourceLabel('jira')).toBe('Importado do Jira');
    expect(sourceLabel(null)).toBeNull();
    expect(sourceLabel(undefined)).toBeNull();
    expect(sourceLabel('NOVA_ORIGEM')).toBeNull();
  });

  it('alcance: só tribo e segmento são marcados', () => {
    expect(scopeLabel('TRIBE')).toBe('Liderança da tribo');
    expect(scopeLabel('SEGMENT')).toBe('Liderança do segmento');
    expect(scopeLabel('SQUAD')).toBeNull();
    expect(scopeLabel(undefined)).toBeNull();
  });
});

describe('resolveActiveSquadId', () => {
  const m = data([ms('DDWPRIME'), ms('DDWMISSI')], { activeProjectId: 'DDWPRIME' });

  it('a squad da sessão vale quando está nos vínculos (id canônico, sem diferenciar caixa)', () => {
    expect(resolveActiveSquadId('DDWMISSI', m)).toBe('DDWMISSI');
    expect(resolveActiveSquadId('ddwmissi', m)).toBe('DDWMISSI');
  });

  it('squad da sessão fora dos vínculos: usa a validada pelo servidor', () => {
    expect(resolveActiveSquadId('SOLTA', m)).toBe('DDWPRIME');
    expect(resolveActiveSquadId('', m)).toBe('DDWPRIME');
  });

  it('servidor sem activeProjectId: a primeira por precedência', () => {
    expect(resolveActiveSquadId('SOLTA', data([ms('B1'), ms('A1')], { activeProjectId: null }))).toBe('B1');
  });

  it('sem dados de vínculos (endpoint ausente ou lista vazia) a sessão manda; "Sem Time" não é squad', () => {
    expect(resolveActiveSquadId('DDWMISSI', null)).toBe('DDWMISSI');
    expect(resolveActiveSquadId('DDWMISSI', undefined)).toBe('DDWMISSI');
    expect(resolveActiveSquadId('DDWMISSI', data([]))).toBe('DDWMISSI');
    expect(resolveActiveSquadId('Sem Time', null)).toBe('');
    expect(resolveActiveSquadId(undefined, null)).toBe('');
  });
});

describe('deriveMustOnboard', () => {
  it('sem o endpoint: o critério de antes (sem squad ativa)', () => {
    expect(deriveMustOnboard({ memberships: null, profileSquadId: '' })).toBe(true);
    expect(deriveMustOnboard({ memberships: null, profileSquadId: 'DDWMISSI' })).toBe(false);
    expect(deriveMustOnboard({ memberships: undefined, profileSquadId: undefined })).toBe(true);
  });

  it('com o endpoint: vínculo = não precisa, mesmo sem squad no perfil', () => {
    expect(deriveMustOnboard({ memberships: data([ms('A1')]), profileSquadId: '' })).toBe(false);
  });

  it('com o endpoint e lista vazia: precisa de onboarding, mesmo com squad no perfil (cache local)', () => {
    expect(deriveMustOnboard({ memberships: data([]), profileSquadId: 'DDWMISSI' })).toBe(true);
    expect(deriveMustOnboard({ memberships: data([]), profileSquadId: '' })).toBe(true);
  });

  it('legacyOnly: sem squad na sessão (modo new) vai ao onboarding; com squad na sessão (modo sombra) segue usando o app', () => {
    const legacy = data([], { legacyOnly: true, activeProjectId: null });
    expect(deriveMustOnboard({ memberships: legacy, profileSquadId: '' })).toBe(true);
    expect(deriveMustOnboard({ memberships: legacy, profileSquadId: 'Sem Time' })).toBe(true);
    expect(deriveMustOnboard({ memberships: legacy, profileSquadId: 'DDWMISSI' })).toBe(false);
    expect(deriveMustOnboard({ memberships: data([]), sessionLegacyOnly: true, profileSquadId: 'DDWMISSI' })).toBe(false);
  });
});

describe('isLegacyOnly', () => {
  it('só vale sem nenhum vínculo', () => {
    expect(isLegacyOnly(data([], { legacyOnly: true }))).toBe(true);
    expect(isLegacyOnly(data([], { legacyOnly: false }))).toBe(false);
    expect(isLegacyOnly(null, true)).toBe(true);
    expect(isLegacyOnly(null)).toBe(false);
    expect(isLegacyOnly(data([ms('A1')], { legacyOnly: true }), true)).toBe(false);
  });
});

describe('leadershipOfActiveSquad', () => {
  const lead = ms('LID', {
    leadership: true,
    roleName: 'Agile Master',
    roles: [{ roleName: 'Agile Master', roleKey: 'AGILE_MASTER', leadership: true, source: null, primary: true }],
  });
  const m = data([ms('DEV'), lead]);

  it('usa a bandeira do vínculo da squad ATIVA, não de outra', () => {
    expect(leadershipOfActiveSquad(m, 'LID')).toBe(true);
    expect(leadershipOfActiveSquad(m, 'DEV')).toBe(false);
    expect(leadershipOfActiveSquad(m, 'lid')).toBe(true);
  });

  it('qualquer papel de liderança na squad conta, mesmo se o primário não for', () => {
    const mixed = ms('MIX', {
      leadership: false,
      roles: [
        { roleName: 'Developer', roleKey: 'DEVELOPER', leadership: false, source: null, primary: true },
        { roleName: 'Scrum Master', roleKey: 'SCRUM_MASTER', leadership: true, source: null, primary: false },
      ],
    });
    expect(leadershipOfActiveSquad(data([mixed]), 'MIX')).toBe(true);
  });

  it('sem dados dessa squad: undefined, para o chamador cair na regra por nome do papel', () => {
    expect(leadershipOfActiveSquad(null, 'DEV')).toBeUndefined();
    expect(leadershipOfActiveSquad(m, 'OUTRA')).toBeUndefined();
    expect(leadershipOfActiveSquad(data([]), 'DEV')).toBeUndefined();
  });
});

describe('findMembership / hasMemberships', () => {
  it('acha sem diferenciar caixa', () => {
    expect(findMembership(data([ms('DDWMISSI')]), 'ddwmissi')?.projectId).toBe('DDWMISSI');
    expect(findMembership(null, 'x')).toBeUndefined();
    expect(hasMemberships(data([]))).toBe(false);
    expect(hasMemberships(data([ms('A')]))).toBe(true);
  });
});
