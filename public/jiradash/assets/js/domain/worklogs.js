// Janela da sprint e somas de worklog dentro e antes dela.
//
// `isLogInSprintWindow` é INCLUSIVO nos dois limites (`>=` no início, `<=` no fim): um
// apontamento exatamente no início ou no fim da sprint conta. As duas somas devolvem
// `null` — não zero — quando faltam worklogs ou janela, para o caller distinguir "não
// carregado" de "carregado e igual a zero". `state` é só LIDO (`state.sprintDates`).
import { state } from '../core/state.js';

export const sprintWindow = () =>
  state.sprintDates.start
    ? { start: state.sprintDates.start, end: state.sprintDates.end || new Date() }
    : null;

export const isLogInSprintWindow = (log, win) => {
  const date = new Date(log.started);
  return date >= win.start && date <= win.end;
};

export const sumWorklogSecondsInSprint = issue => {
  const win = sprintWindow();
  const worklogs = issue.fields.worklog?.worklogs;
  if (!worklogs || !win) return null;
  return worklogs.reduce(
    (sum, log) => (isLogInSprintWindow(log, win) ? sum + (log.timeSpentSeconds || 0) : sum),
    0
  );
};

// Apontado ANTES do início da sprint — mede quanto da Estimativa Original já foi
// consumido em sprints anteriores (rollover). Par do sumWorklogSecondsInSprint:
// null quando não há worklogs carregados ou janela de sprint.
export const sumWorklogSecondsBeforeSprint = issue => {
  const win = sprintWindow();
  const worklogs = issue.fields.worklog?.worklogs;
  if (!worklogs || !win) return null;
  return worklogs.reduce(
    (sum, log) => (new Date(log.started) < win.start ? sum + (log.timeSpentSeconds || 0) : sum),
    0
  );
};
