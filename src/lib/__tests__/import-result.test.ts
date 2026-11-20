import { describe, expect, it } from 'vitest';
import type { ProjectDetail, ProjectMemberRoleItem } from '@/services/projectService';
import { buildIssues, plural, summarizeImport, summarizeSquad } from '../import-result';

const member = (o: Partial<ProjectMemberRoleItem> & { displayName: string }): ProjectMemberRoleItem => ({
  projectId: 'X',
  roleName: 'Developer',
  roleKey: 'DEVELOPER',
  leadership: false,
  ...o,
});
const project = (id: string, members: ProjectMemberRoleItem[], name = id) => ({ id, name, members }) as unknown as ProjectDetail;

const MISSI = project(
  'DDWMISSI',
  [
    member({ displayName: 'Ana', email: 'ana@x.com', userId: 'u1' }),
    member({ displayName: 'Bruno', email: 'bruno@x.com' }),
    member({ displayName: 'Carla', email: 'carla@x.com' }),
    member({ displayName: 'Fabio', email: '' }),
    member({ displayName: 'Elisa', email: 'elisa@parceiro.com', leadership: true, roleName: 'Agile Master', id: 'm-elisa' }),
  ],
  'Projeto Mississauga',
);
const PRIME = project('DDWPRIME', [member({ displayName: 'Gabi', email: 'g@x.com', userId: 'u2' }), member({ displayName: 'Hugo', email: 'h@x.com' })]);

describe('resumo da importação', () => {
  it('divide as pessoas em com conta, atenção e sem conta, somando o total', () => {
    const s = summarizeSquad(MISSI, 'active');
    expect(s).toMatchObject({ id: 'DDWMISSI', name: 'Projeto Mississauga', people: 5, withAccount: 1, withoutAccount: 2, attention: 2 });
    expect(s.withAccount + s.withoutAccount + s.attention).toBe(s.people);
    expect(s.noEmail.map((m) => m.displayName)).toEqual(['Fabio']);
    expect(s.leadersWithoutAccount.map((m) => m.displayName)).toEqual(['Elisa']);
  });

  it('liderança sem e-mail conta uma vez, em "sem e-mail"', () => {
    const s = summarizeSquad(project('Z', [member({ displayName: 'Lia', leadership: true, email: undefined })]), 'imported');
    expect(s.attention).toBe(1);
    expect(s.noEmail).toHaveLength(1);
    expect(s.leadersWithoutAccount).toHaveLength(0);
  });

  it('a primeira squad é a ativa; o nome vira a chave quando o Jira só deu a chave', () => {
    const r = summarizeImport([MISSI, PRIME], []);
    expect(r.squads.map((s) => s.status)).toEqual(['active', 'imported']);
    expect(r.squads[1].name).toBe('DDWPRIME');
    expect(r.people).toBe(7);
    expect(r.withAccount).toBe(2);
    expect(r.withAccount + r.withoutAccount + r.attention).toBe(r.people);
  });

  it('squad sem pessoas não quebra', () => {
    expect(summarizeImport([project('V', [])], [])).toMatchObject({ people: 0, withAccount: 0, withoutAccount: 0, attention: 0 });
  });
});

describe('pendências da importação', () => {
  it('lista sem e-mail, liderança, sem conta e squads puladas, nessa ordem', () => {
    const issues = buildIssues(summarizeImport([MISSI, PRIME], ['DDWRADAR']));
    expect(issues.map((i) => i.id)).toEqual(['no-email-DDWMISSI', 'leader-DDWMISSI', 'no-account', 'skipped-DDWRADAR']);
  });

  it('cada pendência leva à ação certa', () => {
    const issues = buildIssues(summarizeImport([MISSI, PRIME], ['DDWRADAR']));
    const byId = Object.fromEntries(issues.map((i) => [i.id, i]));
    expect(byId['no-email-DDWMISSI'].action).toEqual({ kind: 'invite', label: 'Gerar convite' });
    expect(byId['leader-DDWMISSI']).toMatchObject({ action: { kind: 'request-link', label: 'Pedir vínculo' }, projectKey: 'DDWMISSI', memberId: 'm-elisa' });
    expect(byId['no-account'].title).toBe('3 pessoas sem conta');
    expect(byId['skipped-DDWRADAR']).toMatchObject({ action: { kind: 'import', label: 'Importar' }, projectKey: 'DDWRADAR', tone: 'danger' });
  });

  it('mais de uma liderança sem conta pede vínculo sem apontar uma pessoa', () => {
    const squad = project('Q', [
      member({ displayName: 'A', email: 'a@x.com', leadership: true, id: '1' }),
      member({ displayName: 'B', email: 'b@x.com', leadership: true, id: '2' }),
    ]);
    const [issue] = buildIssues(summarizeImport([squad], []));
    expect(issue.title).toBe('2 lideranças sem conta · Q');
    expect(issue.memberId).toBeUndefined();
  });

  it('tudo ligado: nenhuma pendência', () => {
    const squad = project('OK', [member({ displayName: 'A', email: 'a@x.com', userId: 'u' })]);
    expect(buildIssues(summarizeImport([squad], []))).toEqual([]);
  });

  it('plural', () => {
    expect(plural(1, 'pessoa', 'pessoas')).toBe('1 pessoa');
    expect(plural(0, 'pessoa', 'pessoas')).toBe('0 pessoas');
  });
});
