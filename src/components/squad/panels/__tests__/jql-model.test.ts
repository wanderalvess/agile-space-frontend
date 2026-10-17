import { describe, expect, it } from 'vitest';
import type { SquadPanel } from '../../../../lib/types';
import {
  capRows,
  defaultTemplates,
  emptyForm,
  formFromCard,
  formatPanelValue,
  localStorageKey,
  localToCard,
  parseStoredPanels,
  serverToCard,
  serverUnavailableText,
} from '../jql/jql-model';

describe('modelos de consulta', () => {
  it('são 4, um de cada tipo de gráfico, e usam a chave da squad', () => {
    const t = defaultTemplates('DDWMISSI');
    expect(t.map((p) => p.chartType).sort()).toEqual(['bar', 'number', 'pie', 'table']);
    expect(t.every((p) => p.jql.includes('DDWMISSI'))).toBe(true);
    expect(new Set(t.map((p) => p.id)).size).toBe(4);
  });

  it('a chave de armazenamento no navegador não mudou (painéis salvos continuam aparecendo)', () => {
    expect(localStorageKey('DDWMISSI')).toBe('agileSpace_custom_panels_DDWMISSI');
  });
});

describe('painéis salvos no navegador', () => {
  it('aceita o formato antigo (sem métrica) e preenche o que falta', () => {
    const raw = JSON.stringify([{ id: 'p1', title: 'Bugs', jql: 'type = Bug', chartType: 'number', visibility: 'private', resultTotal: 3, lastUpdated: '14:32', approximate: true }]);
    const [p] = parseStoredPanels(raw)!;
    expect(p).toMatchObject({ id: 'p1', aggregateMetric: 'count', groupBy: 'status', visibility: 'private', resultTotal: 3, lastUpdated: '14:32', approximate: true });
  });

  it('lista vazia, texto quebrado ou itens sem id/JQL viram "nada salvo"', () => {
    expect(parseStoredPanels(null)).toBeNull();
    expect(parseStoredPanels('')).toBeNull();
    expect(parseStoredPanels('{')).toBeNull();
    expect(parseStoredPanels('[]')).toBeNull();
    expect(parseStoredPanels(JSON.stringify([{ title: 'sem id' }]))).toBeNull();
  });

  it('valores desconhecidos de tipo, agrupamento e métrica caem no padrão', () => {
    const [p] = parseStoredPanels(JSON.stringify([{ id: 'a', title: 'x', jql: 'y', chartType: 'radar', groupBy: 'zzz', aggregateMetric: 'kg' }]))!;
    expect(p).toMatchObject({ chartType: 'number', groupBy: 'status', aggregateMetric: 'count', visibility: 'squad' });
  });
});

describe('cartões', () => {
  const base: SquadPanel = {
    id: 's1', squadId: 'S', ownerId: 'u-1', ownerName: 'Elisa Prado', title: 'Fila de QA', jql: 'status = QA', chartType: 'table',
    groupBy: 'none', aggregateMetric: 'count', visibility: 'squad', createdAt: '', updatedAt: '', lastRunAt: '2026-10-16T17:32:00', resultTotal: 4,
  };

  it('painel do navegador: sempre editável, sem dono', () => {
    const c = localToCard(defaultTemplates('S')[0]);
    expect(c).toMatchObject({ storage: 'local', canEdit: true, fromOthers: false, key: 'local:template-bugs' });
  });

  it('painel da squad: só quem criou edita; os outros veem "Criado por"', () => {
    expect(serverToCard(base, 'u-1')).toMatchObject({ storage: 'squad', canEdit: true, fromOthers: false, ownerName: 'Elisa Prado', key: 'squad:s1' });
    expect(serverToCard(base, 'u-2')).toMatchObject({ canEdit: false, fromOthers: true });
    expect(serverToCard(base, '')).toMatchObject({ canEdit: false });
  });

  it('id local e id do servidor iguais não se misturam na lista', () => {
    expect(localToCard({ ...defaultTemplates('S')[0], id: 'x' }).key).not.toBe(serverToCard({ ...base, id: 'x' }, 'u').key);
  });

  it('formulário de edição nunca traz "nenhum" para um tipo que não agrupa', () => {
    expect(formFromCard(serverToCard(base, 'u-1')).groupBy).toBe('status');
    expect(formFromCard({ ...serverToCard(base, 'u-1'), chartType: 'bar', groupBy: 'none' }).groupBy).toBe('none');
    expect(emptyForm('S')).toMatchObject({ storage: 'local', chartType: 'bar', jql: 'project = S' });
  });
});

describe('formatação', () => {
  it('contagem inteira; horas com h', () => {
    expect(formatPanelValue('count', 4)).toBe('4');
    expect(formatPanelValue('estimateHours', 12.5)).toBe('12,5h');
    expect(formatPanelValue('loggedHours', 3)).toBe('3h');
  });

  it('capRows corta e conta o que ficou de fora', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ label: `g${i}`, value: 10 - i }));
    expect(capRows(rows, 8)).toEqual({ rows: rows.slice(0, 8), hidden: 2 });
    expect(capRows(rows.slice(0, 3), 8)).toEqual({ rows: rows.slice(0, 3), hidden: 0 });
  });

  it('motivos de indisponibilidade do servidor', () => {
    expect(serverUnavailableText('forbidden')).toMatch(/não liberou/);
    expect(serverUnavailableText('not_found')).toMatch(/ainda não guarda/);
    expect(serverUnavailableText('error')).toMatch(/não foi possível/);
  });
});
