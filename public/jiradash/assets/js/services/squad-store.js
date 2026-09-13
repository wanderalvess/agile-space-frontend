// Store de squads: a lista, a squad ativa, o JQL por squad, as abas e o cache por squad.
// Dezessete membros, na ordem em que sempre estiveram.
//
// ⚠️ O PAT é GLOBAL (sessionStorage, via auth); o JQL é POR SQUAD (localStorage). Não
// inverta isso: token por squad já foi tentado e some no primeiro F5.
//
// ⚠️ `nameCustom` existe para o rename automático (derivado do projeto do JQL) não passar
// por cima de um nome digitado à mão. Nome manual vazio apaga a marca e devolve a squad ao
// automático. E `updateActiveName` NÃO re-renderiza durante um rename em andamento, senão
// trocaria o <input> por outro no meio da digitação.
//
// ⚠️ A ORDEM do array É a ordem das abas — não há campo de posição. `reorder` recalcula o
// índice do alvo depois do splice, senão erra por um quando a origem vinha antes do destino.
//
// ── O port de carga, e por que ele existe ───────────────────────────────────────────────
//
// Três operações de carga moram em `app`, no entrypoint: abrir uma geração de carga nova,
// restaurar do cache e disparar uma carga. `squadStore` precisa das três, e `app` precisa de
// `squadStore` — importar um do outro fecharia o ciclo `app → squadStore → app`, que é
// proibido no grafo (AGENTS.md §9).
//
// A saída é o mínimo possível: `app.initialize()` chama `configureSquadLoadActions` uma vez,
// no bootstrap, passando três funções que só reencaminham para os métodos dele. Nada mais.
//
// ⚠️ Isto é INJEÇÃO MANUAL MÍNIMA POR SETTER — não é contêiner/framework de DI, event bus,
// registry nem service locator. São três callbacks, com nome fixo, entregues por uma função
// que só atribui, para inverter três chamadas — e devem continuar sendo só isso. Precisar de
// uma quarta ação é sinal de que o recorte entre `app` e `squadStore` está errado, não de que
// o port deve crescer.
//
// ⚠️ `loadActions` começa `null` DE PROPÓSITO: sem default e sem no-op. Se algum caminho
// tentar carregar antes da configuração, o erro aparece na hora, em vez de a operação sumir
// em silêncio — que é o pior modo de falhar num app que publica dataset.
//
// A avaliação deste módulo é inerte: nada de DOM, storage, auth, jiraApi, geração de ID,
// chamada de callback ou escrita em `state`/`squadCache` antes de um método ser chamado.
// `configureSquadLoadActions` apenas guarda a referência; os efeitos ficam nos métodos.
import { escapeHtml, escapeAttr } from '../core/helpers.js';
import { state, squadCache } from '../core/state.js';
import { dom } from '../platform/dom.js';
import { storage } from '../platform/storage.js';
import { auth } from '../platform/auth.js';
import { jiraApi } from '../platform/jira-api.js';
import { authUI } from '../ui/auth-ui.js';
import { ui } from '../ui/ui.js';

let loadActions = null;

export const configureSquadLoadActions = actions => {
  loadActions = actions;
};

export const squadStore = {
  generateId() {
    return `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  },
  list() {
    return storage.getJson('squads', []);
  },
  save(squads) {
    storage.setJson('squads', squads);
  },
  // ── CP7: referência OPCIONAL da squad a um escopo analítico ────────────────────────────────
  // A squad REFERENCIA um escopo; ela não o identifica. `squadId` NUNCA é identidade de escopo, e
  // o escopo jamais é derivado de JQL, board ou nome da aba — só um `analysisScopeId` gravado
  // explicitamente vale. Ausente = null = comportamento legado (por board). Trocar de aba,
  // renomear ou reordenar não mexe nisto, e duas squads podem apontar para o MESMO escopo.
  // O campo só é persistido quando existe: uma squad que nunca recebeu escopo continua com o
  // shape mínimo `{id, name, jql}`.
  // ⚠️ AUSENTE ≠ MALFORMADA. Devolve `null` só quando a referência está AUSENTE (propriedade não
  // existe, ou foi removida com null/undefined) — aí o app segue no caminho legado. Quando a
  // propriedade EXISTE, o valor sai CRU: quem julga o shape é `resolveScopeSelection`, que
  // transforma valor inválido em `blocked/invalid-scope-reference` em vez de abrir o legado.
  // O valor nunca vai a DOM/log — só ao contexto em memória.
  analysisScopeIdOf(squad) {
    if (!squad || typeof squad !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(squad, 'analysisScopeId')) return null;
    const valor = squad.analysisScopeId;
    return valor === null || valor === undefined ? null : valor;
  },
  activeAnalysisScopeId() {
    return this.analysisScopeIdOf(this.list().find(s => s.id === this.activeId));
  },
  // `null`/'' remove a referência (volta ao legado). Não valida a existência do escopo: quem lê o
  // envelope é fail-closed e ignora escopo desconhecido.
  setActiveAnalysisScopeId(analysisScopeId) {
    const squads = this.list();
    const index = squads.findIndex(s => s.id === this.activeId);
    if (index < 0) return null;
    const valor = typeof analysisScopeId === 'string' && analysisScopeId !== '' ? analysisScopeId : null;
    if (valor === null) delete squads[index].analysisScopeId;
    else squads[index].analysisScopeId = valor;
    this.save(squads);
    state.activeAnalysisScopeId = valor; // mantém o contexto da aplicação coerente na hora
    return valor;
  },
  get activeId() {
    return storage.get('active-squad');
  },
  set activeId(id) {
    storage.set('active-squad', id);
  },
  ensureInitialized() {
    let squads = this.list();

    if (!squads.length) {
      const first = {
        id: this.generateId(),
        name: 'Minha Squad',
        jql: storage.get('jira-jql') || ''
      };
      squads = [first];
      this.save(squads);
      this.activeId = first.id;
    }

    if (!squads.some(squad => squad.id === this.activeId)) {
      this.activeId = squads[0].id;
    }

    return squads.find(squad => squad.id === this.activeId);
  },
  saveActiveInputs() {
    // O PAT é global (sessionStorage), não por-squad. JQL é por-squad e
    // continua em localStorage.
    const squads = this.list();
    const index = squads.findIndex(squad => squad.id === this.activeId);
    if (index === -1) return;

    squads[index].jql = jiraApi.jql;
    this.save(squads);
  },
  // Renomeação automática, derivada do projeto do JQL. Roda a cada loadData
  // (app.updateHeader), então NÃO pode passar por cima de um nome que a pessoa
  // digitou à mão — senão o rename manual se desfaz sozinho no próximo Atualizar.
  updateActiveName(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return;

    const squads = this.list();
    const index = squads.findIndex(squad => squad.id === this.activeId);
    if (index === -1) return;
    if (squads[index].nameCustom) return;

    squads[index].name = cleanName;
    this.save(squads);
    // Um loadData pode terminar com a pessoa no meio de um rename. Re-renderizar
    // aqui trocaria o <input> por outro, apagando o que ela já digitou e tirando o
    // foco — o commit do rename re-renderiza de qualquer jeito.
    if (!state.squadRenamingId) this.renderTabs();
  },
  // Renomeação manual (duplo clique na aba). Marca nameCustom pra desligar o
  // nome automático dessa squad daqui pra frente. Nome vazio = a pessoa quis
  // voltar ao automático: limpa a marca e deixa o próximo loadData renomear.
  beginRename(id) {
    if (!this.list().some(squad => squad.id === id)) return;
    state.squadRenamingId = id;
    this.renderTabs();
    const input = dom.squadTabs.querySelector('.squad-rename');
    if (input) {
      input.focus();
      input.select();
    }
  },
  commitRename(value) {
    const id = state.squadRenamingId;
    if (!id) return;
    state.squadRenamingId = null;

    const squads = this.list();
    const index = squads.findIndex(squad => squad.id === id);
    if (index === -1) {
      this.renderTabs();
      return;
    }

    const cleanName = String(value || '').trim();
    if (cleanName) {
      squads[index].name = cleanName;
      squads[index].nameCustom = true;
    } else {
      delete squads[index].nameCustom;
    }
    this.save(squads);
    this.renderTabs();
  },
  cancelRename() {
    if (!state.squadRenamingId) return;
    state.squadRenamingId = null;
    this.renderTabs();
  },
  // Reordena movendo a squad arrastada para antes/depois da squad alvo.
  // A ordem do array É a ordem das abas — não há campo de posição separado.
  reorder(dragId, targetId, placeAfter) {
    if (!dragId || !targetId || dragId === targetId) return;

    const squads = this.list();
    const from = squads.findIndex(squad => squad.id === dragId);
    const to = squads.findIndex(squad => squad.id === targetId);
    if (from === -1 || to === -1) return;

    const [moved] = squads.splice(from, 1);
    // splice já reindexou: recalcula o alvo depois da remoção pra não errar
    // por um quando a origem estava antes do destino.
    const targetIndex = squads.findIndex(squad => squad.id === targetId);
    squads.splice(placeAfter ? targetIndex + 1 : targetIndex, 0, moved);

    this.save(squads);
    this.renderTabs();
  },
  renderTabs() {
    const squads = this.list();
    const activeId = this.activeId;
    const canRemove = squads.length > 1;
    const renamingId = state.squadRenamingId;
    // Arrastar só faz sentido com mais de uma aba.
    const canDrag = squads.length > 1;

    dom.squadTabs.innerHTML = `${squads
      .map(squad =>
        squad.id === renamingId
          ? `<input class="squad-rename" type="text" value="${escapeAttr(squad.name)}"
                 data-squad-id="${escapeAttr(squad.id)}" aria-label="Renomear squad"
                 maxlength="60" autocomplete="off" />`
          : `<button class="squad-tab ${squad.id === activeId ? 'active' : ''}" type="button"
                 ${canDrag ? 'draggable="true"' : ''}
                 title="Duplo clique para renomear${canDrag ? ' · arraste para reordenar' : ''}"
                 data-action="switch-squad" data-squad-id="${escapeAttr(squad.id)}">
              <span class="name">${escapeHtml(squad.name)}</span>
              ${canRemove ? `<span class="close" title="Remover" data-action="remove-squad" data-squad-id="${escapeAttr(squad.id)}">×</span>` : ''}
            </button>`
      )
      .join('')}
          <button class="btn btn-sm" type="button" data-action="add-squad">+ Squad</button>`;
  },
  apply(squad) {
    dom.jqlInput.value = squad?.jql || '';
    // CP7: publica a referência de escopo da squad que está entrando. É o único ponto onde o
    // contexto de escopo da aplicação é montado — `person-config` lê de `state`, sem importar
    // este módulo (evita ciclo). Squad sem referência publica `null` = caminho legado.
    state.activeAnalysisScopeId = this.analysisScopeIdOf(squad);
    authUI.render();
    this.renderTabs();

    if (!auth.authenticated || !squad?.jql) {
      // Limpar o dataset TAMBÉM é substituí-lo: abre geração nova para invalidar
      // qualquer carga em voo. Sem isso, um loadData pendente continuaria "atual" e
      // publicaria issues por cima de uma squad que ficou sem JQL/sem token.
      loadActions.beginLoad();
      state.allIssues = [];
      ui.setDashboardVisible(false);
      ui.setConfigVisible(true);
      return;
    }

    const cached = squadCache[squad.id];
    if (cached) {
      loadActions.restoreFromCache(cached);
    } else {
      // Sem cache em memória (reload da página, ou squad nova nesta aba): tenta o
      // snapshot compartilhado antes de bater no Jira — ver app.loadFromSharedOrFetch.
      loadActions.loadShared(squad.id, squad.jql);
    }
  },
  add() {
    this.saveActiveInputs();

    const squads = this.list();
    const newSquad = { id: this.generateId(), name: 'Nova Squad', jql: '' };
    squads.push(newSquad);
    this.save(squads);
    this.activeId = newSquad.id;

    // PAT é global (sessionStorage) — nada de token por squad.
    dom.jqlInput.value = '';
    // Squad nova entra sem dataset: invalida a geração para que uma carga da squad
    // anterior, ainda em voo, não publique aqui (mesmo motivo do apply).
    loadActions.beginLoad();
    state.allIssues = [];
    ui.setConfigVisible(true);
    ui.setDashboardVisible(false);
    this.renderTabs();
  },
  remove(id) {
    let squads = this.list();
    if (squads.length <= 1) return;

    squads = squads.filter(squad => squad.id !== id);
    this.save(squads);

    if (this.activeId === id) {
      this.activeId = squads[0].id;
      this.apply(squads[0]);
      return;
    }

    this.renderTabs();
  },
  switchTo(id) {
    if (!id || id === this.activeId) return;
    this.saveActiveInputs();

    const squad = this.list().find(item => item.id === id);
    if (!squad) return;

    this.activeId = id;
    this.apply(squad);
  }
};
