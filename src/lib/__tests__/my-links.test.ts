import { describe, expect, it } from 'vitest';
import type { SquadMember } from '../types';
import { activeLinkOf, buildMyLinks, countLabel, filterMyLinks, isLeadershipRole, isRealSquadId, linkKindLabel, squadBadge } from '../my-links';

const session = {
  activeProjectId: 'DDWMISSI',
  activeProjectName: 'Missão Crítica',
  activeProjectRole: 'Developer',
  accessibleProjects: [
    { projectId: 'DDWPRIME', projectName: 'Prime', roleName: 'Agile Master', leadership: true, directAssignment: true, tribeName: 'Varejo' },
    { projectId: 'DDWMISSI', projectName: 'Missão Crítica', roleName: 'Developer', leadership: false, directAssignment: true },
    { projectId: 'DDWOMNI', projectName: 'Omni', roleName: 'QA', directAssignment: false, tribeName: 'Canais' },
  ],
};

describe('isRealSquadId', () => {
  it('descarta vazio e o marcador "Sem Time"', () => {
    expect(isRealSquadId('')).toBe(false);
    expect(isRealSquadId(undefined)).toBe(false);
    expect(isRealSquadId('Sem Time')).toBe(false);
    expect(isRealSquadId('DDWMISSI')).toBe(true);
  });
});

describe('isLeadershipRole', () => {
  it('reconhece papéis de liderança e ignora contribuidores', () => {
    expect(isLeadershipRole('Agile Master')).toBe(true);
    expect(isLeadershipRole('Tech Lead')).toBe(true);
    expect(isLeadershipRole('Developer')).toBe(false);
    expect(isLeadershipRole('')).toBe(false);
  });
});

describe('buildMyLinks', () => {
  it('sem sessão não há vínculos', () => {
    expect(buildMyLinks(null, [])).toEqual([]);
  });

  it('põe a squad ativa primeiro, depois liderança, depois nome', () => {
    const links = buildMyLinks(session, []);
    expect(links.map((l) => l.id)).toEqual(['DDWMISSI', 'DDWPRIME', 'DDWOMNI']);
    expect(links[0].active).toBe(true);
    expect(links.filter((l) => l.active)).toHaveLength(1);
  });

  it('marca liderança pela bandeira do servidor e, na falta dela, pelo papel', () => {
    const byId = Object.fromEntries(buildMyLinks(session, []).map((l) => [l.id, l]));
    expect(byId.DDWPRIME.leadership).toBe(true);
    expect(byId.DDWMISSI.leadership).toBe(false);
    expect(byId.DDWOMNI.leadership).toBe(false);
    const sem = buildMyLinks({ accessibleProjects: [{ projectId: 'X1', roleName: 'Tech Lead' }] }, []);
    expect(sem[0].leadership).toBe(true);
  });

  it('acesso indireto aponta de onde vem', () => {
    const omni = buildMyLinks(session, []).find((l) => l.id === 'DDWOMNI')!;
    expect(omni.direct).toBe(false);
    expect(omni.via).toBe('Canais');
    const prime = buildMyLinks(session, []).find((l) => l.id === 'DDWPRIME')!;
    expect(prime.direct).toBe(true);
    expect(prime.via).toBeUndefined();
  });

  it('completa o papel pelo que o contexto já sabe (/squads/by-user)', () => {
    const squads = [{ squadId: 'X1', role: 'Scrum Master' }] as SquadMember[];
    const links = buildMyLinks({ accessibleProjects: [{ projectId: 'X1', projectName: 'Xis' }] }, squads, 'X1');
    expect(links[0].role).toBe('Scrum Master');
    expect(links[0].leadership).toBe(true);
  });

  it('conta de uma squad só cai na squad ativa da sessão', () => {
    const links = buildMyLinks({ activeProjectId: 'ABC', activeProjectName: 'Alfa', activeProjectRole: 'QA', accessibleProjects: [] }, []);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ id: 'ABC', name: 'Alfa', role: 'QA', active: true });
  });

  it('sem squad ("Sem Time") não há vínculo', () => {
    expect(buildMyLinks({ activeProjectId: 'Sem Time', accessibleProjects: [] }, [])).toEqual([]);
    expect(buildMyLinks({ activeProjectId: '', accessibleProjects: [] }, [])).toEqual([]);
  });

  it('não repete a mesma squad', () => {
    const dup = { accessibleProjects: [{ projectId: 'A' }, { projectId: 'A' }, { projectId: 'B' }] };
    expect(
      buildMyLinks(dup, [])
        .map((l) => l.id)
        .sort(),
    ).toEqual(['A', 'B']);
  });

  it('a squad ativa pode vir do perfil, não só da sessão', () => {
    const links = buildMyLinks(session, [], 'DDWPRIME');
    expect(links[0].id).toBe('DDWPRIME');
    expect(activeLinkOf(links)?.id).toBe('DDWPRIME');
  });
});

describe('filterMyLinks', () => {
  const links = buildMyLinks(session, []);
  it('consulta vazia devolve tudo', () => {
    expect(filterMyLinks(links, '  ')).toHaveLength(3);
  });
  it('ignora acento e caixa, e olha nome, chave e papel', () => {
    expect(filterMyLinks(links, 'missao').map((l) => l.id)).toEqual(['DDWMISSI']);
    expect(filterMyLinks(links, 'ddwprime').map((l) => l.id)).toEqual(['DDWPRIME']);
    expect(filterMyLinks(links, 'agile master').map((l) => l.id)).toEqual(['DDWPRIME']);
    expect(filterMyLinks(links, 'zzz')).toEqual([]);
  });
});

describe('rótulos', () => {
  it('tipo do vínculo', () => {
    expect(linkKindLabel({ leadership: true })).toBe('Liderança');
    expect(linkKindLabel({ leadership: false })).toBe('Contribuidor');
  });
  it('placa da squad', () => {
    expect(squadBadge({ id: 'DDWMISSI', name: 'x' })).toBe('DD');
    expect(squadBadge({ id: '', name: 'Alfa' })).toBe('AL');
  });
  it('contagem no singular e no plural', () => {
    expect(countLabel(1)).toBe('1 vínculo');
    expect(countLabel(3)).toBe('3 vínculos');
  });
});
