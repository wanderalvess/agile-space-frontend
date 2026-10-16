import { describe, it, expect } from 'vitest';
import type { SquadMember } from '@/lib/types';
import {
  buildImportMembers,
  buildRosterExportCsv,
  buildRosterTemplateCsv,
  findMemberMatch,
  importAccountId,
  parseRosterImport,
  summarizeImport,
  type ImportParseResult,
} from '../import';
import { parseCsv } from '../csv';

const m = (over: Partial<SquadMember>): SquadMember => ({
  dbId: `S_${over.jiraAccountId}`,
  squadId: 'S',
  jiraAccountId: 'x',
  displayName: 'X',
  ...over,
});

const team: SquadMember[] = [
  m({ jiraAccountId: 'ana.ribeiro', displayName: 'Ana Ribeiro', email: 'ana.ribeiro@totvs.com.br', role: 'Developer', capacityHoursPerDay: 5.5 }),
  m({ jiraAccountId: 'bruno', displayName: 'Bruno Teixeira', email: 'bruno@totvs.com.br', role: 'QA', capacityHoursPerDay: 6.5 }),
  m({ jiraAccountId: 'carla', displayName: 'Carla Mendes', email: 'carla@totvs.com.br', role: 'Developer', capacityHoursPerDay: 7 }),
];

const ok = (r: ReturnType<typeof parseRosterImport>): ImportParseResult => {
  if (typeof r === 'string') throw new Error(`erro ${r}`);
  return r;
};

describe('findMemberMatch', () => {
  it('ID vence e-mail, e-mail vence nome', () => {
    expect(findMemberMatch(team, { id: 'BRUNO', email: 'ana.ribeiro@totvs.com.br', name: 'Carla Mendes' })).toMatchObject({ by: 'id', member: { jiraAccountId: 'bruno' } });
    expect(findMemberMatch(team, { id: '', email: 'ANA.RIBEIRO@totvs.com.br', name: 'Carla Mendes' })).toMatchObject({ by: 'email', member: { jiraAccountId: 'ana.ribeiro' } });
    expect(findMemberMatch(team, { id: 'zzz', email: 'nao@existe.com', name: 'carla  mendes'.replace('  ', ' ') })).toMatchObject({ by: 'name', member: { jiraAccountId: 'carla' } });
  });

  it('nome casa sem diferenciar acento e caixa; sem casamento devolve null', () => {
    const t = [m({ jiraAccountId: 'j', displayName: 'João Pires' })];
    expect(findMemberMatch(t, { id: '', email: '', name: 'JOAO PIRES' })?.by).toBe('name');
    expect(findMemberMatch(t, { id: 'q', email: 'q@q.com', name: 'Outra Pessoa' })).toBeNull();
  });
});

describe('parseRosterImport', () => {
  it('lê planilha com vírgula (a que a própria tela exporta)', () => {
    const csv = [
      'JiraAccountId,Nome,Email,Funcao,Horas_Sugeridas_Sistema_Dia,Horas_Reais_Gestor_Dia,Fonte_Carga_Horaria,Observacoes',
      '"ana.ribeiro","Ana Ribeiro","ana.ribeiro@totvs.com.br","Developer",6,6,"MANUAL_OVERRIDE","ok"',
      '"bruno","Bruno Teixeira","bruno@totvs.com.br","QA",6.5,6.5,"SYSTEM",""',
    ].join('\n');
    const r = ok(parseRosterImport(csv, team, 6));
    expect(r.delimiter).toBe(',');
    expect(r.rows.map((x) => [x.jiraAccountId, x.importedCapacity, x.status])).toEqual([
      ['ana.ribeiro', 6, 'changed'],
      ['bruno', 6.5, 'unchanged'],
    ]);
    expect(r.rows[0].notes).toBe('ok');
    expect(r.rows[1].notes).toBe('Importado via planilha');
  });

  it('lê planilha do Excel em português (; e vírgula decimal)', () => {
    const csv = ['JiraAccountId;Nome;Email;Funcao;Horas_Sugeridas_Sistema_Dia;Horas_Reais_Gestor_Dia', 'carla;Carla Mendes;carla@totvs.com.br;Developer;6;7,5'].join('\r\n');
    const r = ok(parseRosterImport(csv, team, 6));
    expect(r.delimiter).toBe(';');
    expect(r.rows[0]).toMatchObject({ jiraAccountId: 'carla', importedCapacity: 7.5, status: 'changed', matchedBy: 'id', currentCapacity: 7 });
  });

  it('pelo cabeçalho, a ordem das colunas pode ser outra', () => {
    const csv = ['Horas;Nome;E-mail', '8;Bruno Teixeira;bruno@totvs.com.br'].join('\n');
    const r = ok(parseRosterImport(csv, team, 6));
    expect(r.rows[0]).toMatchObject({ jiraAccountId: 'bruno', matchedBy: 'email', importedCapacity: 8, capacityKept: false, status: 'changed' });
  });

  it('horas ilegíveis, ≤ 0 ou > 24 mantêm o valor atual', () => {
    const header = 'id;nome;email;funcao;sug;real';
    const run = (real: string) => ok(parseRosterImport(`${header}\nana.ribeiro;Ana;;;6;${real}`, team, 6)).rows[0];
    expect(run('abc')).toMatchObject({ importedCapacity: 5.5, capacityKept: true, status: 'unchanged' });
    expect(run('0')).toMatchObject({ importedCapacity: 5.5, capacityKept: true });
    expect(run('25')).toMatchObject({ importedCapacity: 5.5, capacityKept: true });
    expect(run('24')).toMatchObject({ importedCapacity: 24, capacityKept: false });
  });

  it('casamento só pelo nome fica marcado; pessoa nova usa as horas padrão da squad', () => {
    const csv = ['id;nome;email;funcao;sug;real', 'zzz;Carla Mendes;;QA;;', 'novo.id;Marcos Silva;marcos@x.com;Developer;;6'].join('\n');
    const r = ok(parseRosterImport(csv, team, 6));
    expect(r.rows[0]).toMatchObject({ matchedBy: 'name', jiraAccountId: 'carla', role: 'QA', status: 'changed' });
    expect(r.rows[1]).toMatchObject({ matchedBy: null, status: 'new', currentCapacity: 6, importedCapacity: 6 });
    const s = summarizeImport(r.rows);
    expect(s).toMatchObject({ total: 2, changed: 1, unchanged: 0, added: 1, nameOnly: 1, matchedByName: 1 });
  });

  it('cargo vazio na planilha mantém o cargo atual (antes virava Developer)', () => {
    const csv = ['id;nome;email;funcao;sug;real', 'bruno;Bruno;;;6;6,5'].join('\n');
    expect(ok(parseRosterImport(csv, team, 6)).rows[0].role).toBe('QA');
  });

  it('resumo conta por regra de casamento e por status', () => {
    const csv = [
      'id;nome;email;funcao;sug;real',
      'ana.ribeiro;;;;;5,5',
      ';;bruno@totvs.com.br;;;6,5',
      ';Carla Mendes;;;;8',
      ';Pessoa Nova;;;;6',
    ].join('\n');
    const s = summarizeImport(ok(parseRosterImport(csv, team, 6)).rows);
    expect(s).toMatchObject({ total: 4, matchedById: 1, matchedByEmail: 1, matchedByName: 1, added: 1, changed: 1, unchanged: 2 });
  });

  it('arquivo sem dados é rejeitado; linhas sem nome, e-mail nem ID são puladas', () => {
    expect(parseRosterImport('so cabecalho', team, 6)).toBe('EMPTY');
    expect(parseRosterImport('', team, 6)).toBe('EMPTY');
    const r = ok(parseRosterImport('id;nome;email\n;;\nana.ribeiro;Ana;', team, 6));
    expect(r.rows).toHaveLength(1);
  });

  it('planilha antiga sem cabeçalho reconhecível usa as posições (horas reais na 6ª coluna)', () => {
    const csv = ['a,b,c,d,e,f,g,h', 'bruno,Bruno,,QA,6,7.5,SYSTEM,'].join('\n');
    expect(ok(parseRosterImport(csv, team, 6)).rows[0]).toMatchObject({ importedCapacity: 7.5, jiraAccountId: 'bruno' });
  });
});

describe('buildImportMembers', () => {
  it('monta os integrantes a gravar; novos sem ID ganham identificador estável', () => {
    const csv = ['id;nome;email;funcao;sug;real', 'ana.ribeiro;;;;;6', ';João da Silva;;Developer;;6', ';Maria;maria@x.com;QA;;7'].join('\n');
    const rows = ok(parseRosterImport(csv, team, 6)).rows;
    const list = buildImportMembers(rows, 'S', 6, () => 6, new Date('2026-10-16T12:00:00Z'));
    expect(list[0]).toMatchObject({ dbId: 'S_ana.ribeiro', jiraAccountId: 'ana.ribeiro', overrideType: 'IMPORTED_EXCEL', capacityHoursPerDay: 6, systemCalculatedCapacityHoursPerDay: 6 });
    expect(importAccountId(rows[1])).toBe('import.joao.da.silva');
    expect(list[2].jiraAccountId).toBe('maria@x.com');
    expect(list[1].updatedAt).toBe('2026-10-16T12:00:00.000Z');
  });
});

describe('exportação e modelo', () => {
  it('exporta com BOM, cabeçalho e aspas onde precisa', () => {
    const csv = buildRosterExportCsv([
      { member: team[0], role: 'Developer', suggested: 6, real: 5.5, source: 'MANUAL_OVERRIDE', notes: 'Silva, Ana' },
    ]);
    expect(csv.startsWith('﻿JiraAccountId,Nome')).toBe(true);
    const { rows } = parseCsv(csv);
    expect(rows[1]).toEqual(['ana.ribeiro', 'Ana Ribeiro', 'ana.ribeiro@totvs.com.br', 'Developer', '6', '5.5', 'MANUAL_OVERRIDE', 'Silva, Ana']);
  });

  it('o modelo baixado volta pelo importador (com ; e vírgula decimal)', () => {
    const csv = buildRosterTemplateCsv();
    const r = ok(parseRosterImport(csv, [], 6));
    expect(r.delimiter).toBe(';');
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ displayName: 'Ana Souza', importedCapacity: 5.5, status: 'new' });
  });
});
