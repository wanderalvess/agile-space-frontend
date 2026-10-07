// Cache do board do Jira por sprint. É CACHE REDERIVÁVEL, não configuração: apagar este
// mapa não perde nada, porque qualquer máquina volta a descobrir o board no Jira.
//
// ⚠️ Os quatro métodos dependem de `this`: `all`/`set`/`resolveMissing` leem `this.KEY`,
// `set` e `resolveMissing` chamam `this.all()` e `ensureFor` chama `this.set` e
// `this.resolveMissing`. Não desmembre esses métodos nem os passe soltos como callback.
//
// Duas regras que parecem detalhe e não são:
//   1. FAIL-CLOSED — sprint cujo board não foi resolvido simplesmente não entra no mapa, e
//      portanto não participa da herança. Errar o board é pior que não ter board.
//   2. O merge final é feito sobre uma leitura FRESCA de `this.all()`, depois do
//      `Promise.all`: enquanto os requests estavam em voo, outra carga pode ter gravado no
//      storage, e espalhar um snapshot antigo apagaria essa atualização.
//
// A avaliação deste módulo é inerte: nada de storage, request, `new Set`, DOM ou `state`
// antes de um método ser chamado.
import { storage } from './storage.js';
import { jiraApi } from './jira-api.js';

// Board do Jira por sprint: { [sprintId]: originBoardId }.
// O board É a noção de squad do próprio Jira — não depende de nome digitado, de JQL,
// de id gerado no browser nem de histórico de navegação, então dá o MESMO resultado em
// qualquer máquina. Substituiu o antigo 'squad-members' (localStorage), que só conhecia
// as squads que aquele browser tinha carregado e nunca esquecia quem saiu do time — era
// a razão de o dash se comportar diferente em cada máquina e em aba anônima.
// Isto é CACHE, não configuração: uma sprint nunca troca de board, e qualquer máquina
// re-deriva o valor do Jira sozinha.
export const sprintBoardStore = {
  KEY: 'sprint-boards',
  all() {
    return storage.getJson(this.KEY, {});
  },
  set(sprintId, boardId) {
    if (sprintId == null || boardId == null) return;
    const all = this.all();
    if (all[String(sprintId)] === boardId) return;
    all[String(sprintId)] = boardId;
    storage.setJson(this.KEY, all);
  },
  // Consulta o Jira só pelos ids ainda desconhecidos. Falha em um id não derruba os
  // outros: sprint sem board resolvido simplesmente não entra na herança (fail-closed).
  async resolveMissing(sprintIds) {
    const known = this.all();
    const missing = [...new Set((sprintIds || []).map(String))].filter(id => known[id] === undefined);
    if (!missing.length) return;
    const found = {};
    await Promise.all(
      missing.map(async id => {
        try {
          const info = await jiraApi.request(`/rest/agile/1.0/sprint/${encodeURIComponent(id)}`);
          if (info?.originBoardId != null) found[id] = info.originBoardId;
        } catch {
          /* sprint apagada ou sem acesso — fica sem board, não herda */
        }
      })
    );
    if (Object.keys(found).length) storage.setJson(this.KEY, { ...this.all(), ...found });
  },
  // Garante o board da sprint atual e das anteriores que têm config.
  // Precisa rodar ANTES de renderizar: personConfig.snapshot() é síncrono.
  async ensureFor(sprintInfo) {
    if (!sprintInfo?.id) return;
    if (sprintInfo.originBoardId != null) this.set(sprintInfo.id, sprintInfo.originBoardId);
    const configured = Object.keys(storage.getJson('sprint-configs-by-sprint', {})).filter(
      id => Number(id) < Number(sprintInfo.id)
    );
    await this.resolveMissing(configured);
  }
};
