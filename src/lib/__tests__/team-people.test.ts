import { describe, it, expect } from 'vitest';
import { latestSyncAt, mergeTeamPeople } from '../team-people';

describe('mergeTeamPeople', () => {
  it('une as duas listas sem repetir quem está nas duas (por e-mail, sem diferenciar maiúsculas)', () => {
    const jira = [{ displayName: 'Tom Novo', email: 'tom.novo@totvs.com.br', jiraAccountId: 'u-tom' }];
    const roster = [
      { displayName: 'Tom Novo', email: 'TOM.NOVO@totvs.com.br', roleName: 'Developer' },
      { displayName: 'Marta Mestra', email: 'marta.am@totvs.com.br', roleName: 'Agile Master' },
    ];
    const people = mergeTeamPeople(jira, roster);
    expect(people.map((p) => p.displayName)).toEqual(['Tom Novo', 'Marta Mestra']);
    expect(people[0].role).toBe('Developer'); // completa o cargo que a lista do Jira não trazia
  });

  it('reconhece a mesma pessoa pela conta do Jira quando o e-mail falta de um lado', () => {
    const people = mergeTeamPeople(
      [{ displayName: 'Ana', jiraAccountId: 'acc-1' }],
      [{ displayName: 'Ana Souza', email: 'ana@totvs.com.br', jiraAccountId: 'acc-1' }],
    );
    expect(people).toHaveLength(1);
    expect(people[0].email).toBe('ana@totvs.com.br');
  });

  it('homônimos com e-mails diferentes continuam sendo duas pessoas', () => {
    const people = mergeTeamPeople(
      [{ displayName: 'João Silva', email: 'joao.a@totvs.com.br' }],
      [{ displayName: 'João Silva', email: 'joao.b@totvs.com.br' }],
    );
    expect(people).toHaveLength(2);
  });

  it('sem e-mail nem conta, o nome (sem acento) identifica', () => {
    const people = mergeTeamPeople([{ displayName: 'José' }], [{ displayName: 'jose' }]);
    expect(people).toHaveLength(1);
  });

  it('o caso do teste: 3 do Jira + 6 do cadastro, 1 em comum = 8 pessoas', () => {
    const jira = ['rita', 'tom', 'zeca'].map((n) => ({ displayName: n, email: `${n}@totvs.com.br` }));
    const roster = ['davi', 'gui', 'lia', 'marta', 'quin', 'tom'].map((n) => ({ displayName: n, email: `${n}@totvs.com.br` }));
    expect(mergeTeamPeople(jira, roster)).toHaveLength(8);
  });

  it('listas vazias ou ausentes', () => {
    expect(mergeTeamPeople()).toEqual([]);
    expect(mergeTeamPeople([], [])).toEqual([]);
  });
});

describe('latestSyncAt', () => {
  it('devolve a data mais recente entre as informadas, ignorando vazias e inválidas', () => {
    expect(latestSyncAt(undefined, '2026-10-15T10:00:00Z', 'lixo', '2026-10-15T11:00:00Z', null)).toBe('2026-10-15T11:00:00Z');
  });
  it('vazio quando nada foi informado', () => {
    expect(latestSyncAt(undefined, null, '')).toBe('');
  });
});
