import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SquadIssueSnapshot } from '../../../../lib/types';

const storeState: Record<string, unknown> = {};
vi.mock('../../../../store/useSquadStore', () => ({ useSquadStore: () => storeState }));
const getFields = vi.fn();
const saveFields = vi.fn();
vi.mock('../../../../lib/cronograma/date-fields-client', async (orig) => ({
  ...(await orig<typeof import('../../../../lib/cronograma/date-fields-client')>()),
  getJiraDateFields: (...a: unknown[]) => getFields(...a),
  saveJiraDateFields: (...a: unknown[]) => saveFields(...a),
}));

import { buildModel } from '../../../../lib/cronograma/schedule';
import { buildCapacityResolver } from '../../../../lib/cronograma/suggest';
import { toCronoTask } from '../../../../lib/cronograma/task';
import { barGeometry } from '../../../../lib/cronograma/view';
import { dayFromYmd } from '../../../../lib/cronograma/dates';
import { TaskBar, barAriaLabel } from '../GanttBar';
import { InferredBanner } from '../InferredBanner';
import { IssueSheet } from '../IssueSheet';
import { DateFieldsDialog } from '../DateFieldsDialog';
import { CronogramaView } from '../CronogramaView';

const NOW = new Date('2026-10-20T12:00:00Z'); // terça 09:00 em Brasília

let n = 0;
const issue = (o: Partial<SquadIssueSnapshot>): SquadIssueSnapshot => {
  n += 1;
  return {
    key: `PTV-${n}`, jiraKey: `PTV-${n}`, title: `Item ${n}`, type: 'Sub-task', isBug: false, status: 'To Do', statusCategory: 'new', estimateSec: 0, remainingSec: 0,
    loggedSec: 0, updatedAtJira: '', staleSinceDays: 0, dueDate: '', assigneeId: '', assigneeName: '', parentKey: '', parentTitle: '', sprintId: '1', sprintName: 'Sprint 42', syncedAt: '', ...o,
  };
};

const hours = (h: number) => h * 3600;
const realIssues = (): SquadIssueSnapshot[] => [
  issue({ key: 'H-1', jiraKey: 'H-1', title: 'Resumo por e-mail', type: 'Story' }),
  issue({
    key: 'H-2', jiraKey: 'H-2', title: 'Codificar resumo', type: 'Codificação', parentKey: 'H-1', parentTitle: 'Resumo por e-mail', assigneeId: 'acc-ana', assigneeName: 'Ana',
    status: 'In Progress', statusCategory: 'indeterminate', targetStart: '2026-10-19T09:00:00-03:00', targetEnd: '2026-10-21T15:00:00-03:00', datesAreInferred: false,
    estimateSec: hours(16), remainingSec: hours(8),
  }),
  issue({
    key: 'H-3', jiraKey: 'H-3', title: 'Testar resumo', type: 'Teste QA', parentKey: 'H-1', parentTitle: 'Resumo por e-mail', assigneeId: 'acc-diego', assigneeName: 'Diego',
    targetStart: '2026-10-22', targetEnd: '2026-10-23', datesAreInferred: false, estimateSec: hours(8),
  }),
];
const inferredIssues = (): SquadIssueSnapshot[] => [
  issue({ key: 'I-1', jiraKey: 'I-1', title: 'Atalhos de teclado', type: 'Story' }),
  issue({ key: 'I-2', jiraKey: 'I-2', title: 'Codificar atalhos', type: 'Codificação', parentKey: 'I-1', assigneeId: 'acc-ana', assigneeName: 'Ana', targetStart: '2026-10-15', targetEnd: '2026-10-16', datesAreInferred: true, estimateSec: hours(16.4) }),
  issue({ key: 'I-3', jiraKey: 'I-3', title: 'Testar atalhos', type: 'Teste QA', parentKey: 'I-1', assigneeId: 'acc-diego', assigneeName: 'Diego', targetStart: '2026-10-15', targetEnd: '2026-10-16', datesAreInferred: true, estimateSec: hours(8.2) }),
];

function setStore(issues: SquadIssueSnapshot[], extra: Record<string, unknown> = {}) {
  Object.assign(storeState, {
    issuesSnapshot: issues, viewingSprintId: null, viewedIssuesSnapshot: [], viewedRollup: null, isSyncing: false,
    rollup: { extraMetrics: { activeSprintStart: '2026-10-13', activeSprintEnd: '2026-10-30' }, sprintName: 'Sprint 42' },
    config: { phases: undefined, lastSyncAt: '2026-10-20T11:00:00Z', jiraDomain: 'totvs.atlassian.net' },
    members: [{ dbId: '1', squadId: 'S', jiraAccountId: 'acc-ana', displayName: 'Ana', capacityHoursPerDay: 8.2 }],
    ...extra,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  getFields.mockReset();
  saveFields.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function plannedOf(issues: SquadIssueSnapshot[], key: string, source: 'jira' | 'horas' = 'jira') {
  const model = buildModel(issues.map(toCronoTask), { nowMs: NOW.getTime(), source, capacityOf: buildCapacityResolver([], undefined) });
  return model.flatMap((s) => s.tasks).find((t) => t.task.key === key)!;
}

describe('TaskBar', () => {
  const geom = barGeometry({ start: { day: dayFromYmd(2026, 10, 20), frac: 0 }, end: { day: dayFromYmd(2026, 10, 21), frac: 1 } }, dayFromYmd(2026, 10, 19), dayFromYmd(2026, 10, 30), 56)!;

  it('é um botão com nome acessível: chave, fase, responsável, datas com hora e origem', () => {
    const p = plannedOf(realIssues(), 'H-2');
    const onSelect = vi.fn();
    render(<TaskBar ptask={p} geom={geom} top={4} height={28} rowIndex={1} onSelect={onSelect} />);
    const bar = screen.getByRole('button', { name: /H-2, Codificação, Ana, de 19\/10 09:00 a 21\/10 15:00, datas do Jira/ });
    fireEvent.click(bar);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(barAriaLabel(p)).toContain('H-2');
  });

  it('a sugestão pelas horas aparece com contorno tracejado, diferente da data real', () => {
    const real = plannedOf(realIssues(), 'H-2');
    const sug = plannedOf(inferredIssues(), 'I-2', 'horas');
    const { rerender } = render(<TaskBar ptask={real} geom={geom} top={4} height={28} rowIndex={1} onSelect={() => {}} />);
    expect(screen.getByRole('button').className).not.toContain('border-dashed');
    rerender(<TaskBar ptask={sug} geom={geom} top={4} height={28} rowIndex={1} onSelect={() => {}} />);
    expect(screen.getByRole('button').className).toContain('border-dashed');
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('sugestão pelas horas');
  });
});

describe('InferredBanner', () => {
  it('mostra as contagens e dispara as duas ações', () => {
    const onSuggest = vi.fn();
    const onChoose = vi.fn();
    render(<InferredBanner inferred={2} total={5} suggesting={false} canConfigure onSuggest={onSuggest} onChooseFields={onChoose} />);
    expect(screen.getByRole('status').textContent).toContain('2 de 5 subtarefas');
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir pelas horas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Escolher os campos de data' }));
    expect(onSuggest).toHaveBeenCalled();
    expect(onChoose).toHaveBeenCalled();
  });

  it('sem permissão de configurar, esconde a escolha de campos', () => {
    render(<InferredBanner inferred={5} total={5} suggesting canConfigure={false} onSuggest={() => {}} onChooseFields={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Escolher os campos de data' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Sugestão ligada' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('IssueSheet', () => {
  it('mostra data e hora do Jira, a sugestão do portal e a simulação', () => {
    const p = plannedOf(inferredIssues(), 'I-2');
    const onSim = vi.fn();
    render(<IssueSheet task={p} story={null} jiraBaseUrl="totvs.atlassian.net" simDays={1} onSimDays={onSim} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Sugestão do portal')).toBeTruthy();
    expect(dialog.textContent).toMatch(/começa 20\/10 09:00 e termina 21\/10 18:00/);
    expect(dialog.textContent).toContain('Sem data no Jira');
    expect(within(dialog).getByRole('link', { name: 'Abrir no Jira' }).getAttribute('href')).toBe('https://totvs.atlassian.net/browse/I-2');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mais um dia' }));
    expect(onSim).toHaveBeenCalledWith(2);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Menos um dia' }));
    expect(onSim).toHaveBeenCalledWith(0);
  });

  it('com datas reais mostra início e fim com hora', () => {
    const p = plannedOf(realIssues(), 'H-2');
    render(<IssueSheet task={p} story={null} simDays={0} onSimDays={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('dialog').textContent).toContain('19/10 09:00');
    expect(screen.getByRole('dialog').textContent).toContain('21/10 15:00');
  });
});

describe('DateFieldsDialog', () => {
  const data = {
    startFieldId: 'cf_1', endFieldId: null, startFieldName: 'Data e Hora de Início', endFieldName: null, autoDetected: false,
    candidates: { start: [{ id: 'cf_1', name: 'Data e Hora de Início' }, { id: 'cf_2', name: 'Data de início' }], end: [{ id: 'cf_3', name: 'Data e Hora de Fim' }] },
    sample: { total: 17, startFilled: 0, endFilled: 0 }, warning: null,
  };

  it('recurso ainda não disponível não quebra a janela', async () => {
    getFields.mockResolvedValue({ available: false, reason: 'not-found' });
    render(<DateFieldsDialog open onOpenChange={() => {}} squadId="S" onSaved={() => {}} />);
    await waitFor(() => expect(screen.getByText(/ainda não está disponível neste servidor/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Salvar e sincronizar' })).toBeNull();
  });

  it('mostra a amostra, grava a escolha e pede a sincronização', async () => {
    getFields.mockResolvedValue({ available: true, data });
    saveFields.mockResolvedValue(null);
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<DateFieldsDialog open onOpenChange={onOpenChange} squadId="S" onSaved={onSaved} />);
    await waitFor(() => expect(screen.getByText(/Data e Hora de Início em 0 de 17 subtarefas/)).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Fim planejado'), { target: { value: 'cf_3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e sincronizar' }));
    await waitFor(() => expect(saveFields).toHaveBeenCalledWith('S', { startFieldId: 'cf_1', endFieldId: 'cf_3' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('erro ao salvar fica na janela', async () => {
    getFields.mockResolvedValue({ available: true, data });
    saveFields.mockRejectedValue(new Error('Você não tem permissão para configurar esta squad.'));
    render(<DateFieldsDialog open onOpenChange={() => {}} squadId="S" onSaved={() => {}} />);
    await waitFor(() => screen.getByRole('button', { name: 'Salvar e sincronizar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e sincronizar' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('permissão'));
  });
});

describe('CronogramaView', () => {
  it('com datas reais não mostra a faixa de aviso e desenha as barras como botões', () => {
    setStore(realIssues());
    render(<CronogramaView squadId="S" canConfigure />);
    expect(screen.queryByText(/estão sem "Data e Hora de Início"/)).toBeNull();
    expect(screen.getByRole('button', { name: /H-2, Codificação, Ana/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /H-3, Teste QA, Diego/ })).toBeTruthy();
  });

  it('com datas aproximadas mostra a faixa; "Sugerir pelas horas" liga a sugestão e as barras ganham contorno', () => {
    setStore(inferredIssues());
    render(<CronogramaView squadId="S" canConfigure />);
    expect(screen.getByText(/As subtarefas desta sprint estão sem/)).toBeTruthy();
    const before = screen.getByRole('button', { name: /I-2, Codificação, Ana/ });
    expect(before.getAttribute('aria-label')).toContain('data aproximada');
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir pelas horas' }));
    const after = screen.getByRole('button', { name: /I-2, Codificação, Ana/ });
    expect(after.getAttribute('aria-label')).toContain('sugestão pelas horas');
    expect(screen.getByRole('button', { name: /I-3, Teste QA, Diego/ }).getAttribute('aria-label')).toContain('22/10 09:00');
  });

  it('quem não pode configurar não vê a escolha dos campos de data', () => {
    setStore(inferredIssues());
    render(<CronogramaView squadId="S" canConfigure={false} />);
    expect(screen.queryByRole('button', { name: 'Escolher os campos de data' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Campos de data' })).toBeNull();
  });

  it('recolhe e expande a história, e os três níveis de hierarquia', () => {
    setStore(realIssues());
    render(<CronogramaView squadId="S" />);
    fireEvent.click(screen.getByRole('button', { name: 'Recolher H-1' }));
    expect(screen.queryByRole('button', { name: /H-2, Codificação/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Expandir H-1' }));
    expect(screen.getByRole('button', { name: /H-2, Codificação/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'story-only' } });
    expect(screen.queryByRole('button', { name: /H-2, Codificação/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'subtask-only' } });
    expect(screen.queryByRole('button', { name: /^H-1, história/ })).toBeNull();
    expect(screen.getByRole('button', { name: /H-2, Codificação/ })).toBeTruthy();
  });

  it('busca por chave filtra as linhas; trocar para "Por pessoa" agrupa por responsável', () => {
    setStore(realIssues());
    render(<CronogramaView squadId="S" />);
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'H-3' } });
    expect(screen.queryByRole('button', { name: /H-2, Codificação/ })).toBeNull();
    expect(screen.getByRole('button', { name: /H-3, Teste QA/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Por pessoa' }));
    expect(screen.getAllByRole('rowheader').map((r) => r.textContent).join('|')).toMatch(/Ana.*Diego/);
  });

  it('abrir uma barra mostra o detalhe e a simulação empurra a fase seguinte; "Limpar simulação" desfaz', () => {
    setStore(realIssues());
    render(<CronogramaView squadId="S" />);
    fireEvent.click(screen.getByRole('button', { name: /H-2, Codificação/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mais um dia' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mais um dia' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('button', { name: /H-3, Teste QA, Diego, de 26\/10 09:00 a 27\/10 18:00/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar simulação' }));
    expect(screen.getByRole('button', { name: /H-3, Teste QA, Diego, de 22\/10 09:00 a 23\/10 18:00/ })).toBeTruthy();
  });

  it('zoom muda a largura dos dias', () => {
    setStore(realIssues());
    render(<CronogramaView squadId="S" />);
    expect(screen.getByText('56 px/dia')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar a largura dos dias' }));
    expect(screen.getByText('64 px/dia')).toBeTruthy();
  });

  it('sem issues mostra o estado de dados (Jira não conectado) e aciona a conexão', () => {
    setStore([], { config: { lastSyncAt: undefined } });
    const onConnect = vi.fn();
    render(<CronogramaView squadId="S" jiraConnected={false} onConnectJira={onConnect} />);
    fireEvent.click(screen.getByRole('button', { name: 'Conectar o Jira' }));
    expect(onConnect).toHaveBeenCalled();
  });

  it('mostra a sprint vista (histórico) em vez da atual e o estado de sincronização', () => {
    setStore(realIssues().slice(0, 1), {
      viewingSprintId: '41', viewedIssuesSnapshot: inferredIssues(), isSyncing: true,
      viewedRollup: { sprintName: 'Sprint 41', extraMetrics: { activeSprintStart: '2026-10-01', activeSprintEnd: '2026-10-12' } },
    });
    render(<CronogramaView squadId="S" onSync={() => {}} />);
    expect(screen.getByText(/Sprint 41/)).toBeTruthy();
    expect(screen.getByText('Sincronizando…')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Sincronizar agora' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
