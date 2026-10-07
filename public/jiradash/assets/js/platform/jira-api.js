// Cliente do Jira: toda a conversa com a API passa por aqui, sempre pelo proxy `/jira`.
//
// ⚠️ `this` é o próprio objeto: `request` se rechama em `this.request(path, attempt + 1)`
// no retry de 429, e `fetchFieldMeta`, `fetchSprintInfo`, `fetchSprintRemoved`,
// `fetchAllIssues`, `fetchSubtasks` e `fetchFullWorklogs` dependem de `this.request` /
// `this.runWithConcurrency`. Não desmembre esses métodos nem os passe soltos como callback.
//
// Nada acontece na AVALIAÇÃO deste módulo: não há `fetch`, leitura de token, acesso ao DOM,
// timer nem leitura de `state`. Tudo isso só ocorre quando um getter ou método é chamado.
//
// `state` entra como singleton importado e é só LIDO (os ids de customfield descobertos por
// `fetchFieldMeta`); quem publica no `state` é o entrypoint, depois de conferir a geração da
// carga. `fetchFullWorklogs` acumula `failedKeys` LOCALMENTE e devolve ao chamador em vez de
// escrever em `state.partialWorklogs`, para uma carga obsoleta não contaminar o dataset novo.
import { CONFIG } from '../core/config.js';
import { normalize } from '../core/helpers.js';
import { state } from '../core/state.js';
import { auth } from './auth.js';
import { dom } from './dom.js';

export const jiraApi = {
  get token() {
    return auth.token;
  },
  get jql() {
    return dom.jqlInput.value.trim();
  },
  async request(path, attempt = 1) {
    const response = await fetch(`${CONFIG.jiraProxyBase}${path}`, {
      headers: {
        'x-jira-token': auth.token,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      // PAT inválido/expirado/ausente. Mantém o valor no campo para conferência.
      throw new Error('Token do Jira inválido ou expirado (HTTP 401). Verifique o PAT.');
    }

    if (response.status === 429) {
      const reason = (response.headers.get('RateLimit-Reason') || '').toLowerCase();
      // Quota horária estourada: retry curto não resolve, só atrasa a falha.
      if (reason.includes('points-based')) {
        throw new Error('Cota horária do Jira atingida. Aguarde alguns minutos e tente novamente.');
      }
      const { maxRetries, baseBackoffMs, maxBackoffMs } = CONFIG.rateLimit;
      if (attempt >= maxRetries) {
        throw new Error(`HTTP 429: limite de requisições atingido após ${attempt} tentativas`);
      }
      const retryAfterSec = Number.parseFloat(response.headers.get('Retry-After'));
      const fallback = Math.min(baseBackoffMs * 2 ** (attempt - 1), maxBackoffMs);
      const delay = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : fallback;
      const jitter = Math.random() * 250;
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
      return this.request(path, attempt + 1);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  },
  async runWithConcurrency(items, limit, task) {
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        await task(items[index], index);
      }
    });
    await Promise.all(workers);
  },
  // Só BUSCA e DEVOLVE os ids dos customfields — não escreve em state. Quem chama
  // publica (app.publishFieldMeta) depois de confirmar a geração: uma carga obsoleta
  // escrevendo aqui trocaria os ids de campo por baixo de uma carga mais nova, e o
  // fields= da query seguinte sairia com o customfield errado.
  async fetchFieldMeta() {
    const fallback = {
      flaggedFieldId: CONFIG.defaultFlaggedFieldId,
      sprintFieldId: CONFIG.defaultSprintFieldId,
      identificadorFieldId: null,
      tipoDefeitoFieldId: null,
      rotinaFieldId: null,
      clienteFieldId: null
    };
    try {
      const fields = await this.request('/rest/api/2/field');
      const idByName = name => fields.find(field => normalize(field.name) === name)?.id || null;
      // Campos de detalhamento de defeito (variam de instância pra instância — por isso
      // descobrimos por nome, não por ID fixo). Casa por nome normalizado.
      // Rotina/cliente são usados só pela exportação de retro (top rotinas / top clientes).
      // normalize() mantém acentos (só lowercase+trim), então casamos a forma acentuada.
      const cliente = fields.find(field => {
        const n = normalize(field.name);
        return (
          n === 'nome fantasia / razão social' ||
          (n.includes('nome fantasia') && (n.includes('razão social') || n.includes('razao social')))
        );
      });
      return {
        flaggedFieldId: idByName('flagged') || CONFIG.defaultFlaggedFieldId,
        sprintFieldId: idByName('sprint') || CONFIG.defaultSprintFieldId,
        identificadorFieldId: idByName('identificador'),
        tipoDefeitoFieldId: idByName('tipo do defeito'),
        rotinaFieldId: idByName('agrupador de rotina'),
        clienteFieldId: cliente?.id || null
      };
    } catch {
      return fallback;
    }
  },
  // Recebe o JQL por parâmetro em vez de ler this.jql: durante uma carga já iniciada o
  // input pode ter sido editado, e a sprint consultada tem que ser a mesma que originou
  // a busca de issues.
  async fetchSprintInfo(jql) {
    try {
      const sprintId = String(jql || '').match(/Sprint\s*=\s*(\d+)/i)?.[1];
      if (!sprintId) return null;
      return this.request(`/rest/agile/1.0/sprint/${sprintId}`);
    } catch {
      return null;
    }
  },
  // ── CP7: EVIDÊNCIA de board para a M1b (implementada, mas INERTE) ─────────────────────────
  // Consulta EXCLUSIVAMENTE `GET /rest/agile/1.0/sprint/<id>` — o mesmo endpoint já whitelistado
  // no proxy, que só aceita GET. Devolve `{ sprintId, boardId }` por sprint OU marca a sprint como
  // sem evidência; NUNCA inventa board e NUNCA usa o cache `sprint-boards` (que é sugestão visual,
  // não evidência — ausência no cache significa "desconhecido", e não "sem board").
  //
  // ⚠️ Ninguém chama isto no boot, na carga, no render ou na M1: a coleta é um passo EXPLÍCITO,
  // anterior à transação, e sua execução real contra o Jira exige autorização separada. Os testes
  // usam `request` stubado.
  async collectSprintBoardEvidence(sprintIds) {
    // sprintId CANÔNICO (string numérica positiva) e boardId inteiro seguro positivo — os mesmos
    // contratos do servidor. Entrada inválida é REPRESENTADA (`invalid`), nunca silenciada: um
    // lote com id malformado jamais pode "parecer completo".
    const canonico = v => typeof v === 'string' && /^[1-9]\d*$/.test(v);
    const boardValido = v => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
    // Sem coerção: o contrato público exige STRING canônica. Um número (ou qualquer outro tipo)
    // é REPRESENTADO como inválido, nunca convertido em silêncio.
    const pedidos = [...new Set(sprintIds || [])];
    const invalid = pedidos.filter(id => !canonico(id));
    const ids = pedidos.filter(canonico);
    const evidence = {};
    const missing = [];
    for (const id of ids) {
      try {
        const info = await this.request(`/rest/agile/1.0/sprint/${encodeURIComponent(id)}`);
        const boardId = info?.originBoardId;
        // Board ausente ou fora do contrato → SEM evidência (fail-closed).
        if (!boardValido(boardId)) missing.push(id);
        else evidence[id] = { boardId };
      } catch {
        missing.push(id); // falha de rede/permissão nunca vira evidência
      }
    }
    return { evidence, missing, invalid, complete: missing.length === 0 && invalid.length === 0 };
  },
  // ── CP9: BUSCA DE USUÁRIOS do picker (leitura pura) ───────────────────────────────────────
  // Operação DEDICADA: não aceita `method` — o único verbo possível continua sendo o GET implícito
  // de `request`, e o proxy recusa qualquer outro antes mesmo de olhar o PAT. A query é montada
  // AQUI, fixa, e nada dela vem do chamador além do texto consultado:
  //
  //   GET /rest/api/2/user/search?username=<q>&includeActive=true&includeInactive=true
  //                              &startAt=0&maxResults=20
  //
  // ⚠️ ALLOWLIST DE RESPOSTA: só `key`, `name`, `displayName` e `active` são lidos.
  // `emailAddress`, `avatarUrls`, `self`, `timeZone` e qualquer campo desconhecido NUNCA são
  // tocados — não basta "não persistir", eles não entram nem na estrutura de sessão.
  //
  // Fail-closed: falha de rede, resposta que não é array ou shape inesperado terminam em
  // `{ status: 'unavailable' }` — nunca em resultado parcial reaproveitado. Resultado sem `key`
  // fica em `results` marcado como NÃO selecionável (o picker precisa mostrá-lo sem permitir a
  // seleção), e a deduplicação é por key EXATA: caixa e espaços vêm como o Jira mandou, sem
  // heurística de formato.
  //
  // ⚠️ Ninguém chama isto no boot, na carga ou no render: só a digitação humana no picker.
  async searchUsers(consulta) {
    const texto = typeof consulta === 'string' ? consulta.trim() : '';
    // ⚠️ Consulta vazia é recusa LOCAL, com status próprio — nunca `empty`. `empty` significa "o
    // Jira respondeu e não achou ninguém", e essa afirmação só pode ser feita DEPOIS de um GET
    // bem-sucedido: dizê-la sem perguntar seria uma resposta inventada.
    if (texto === '') return { status: 'invalid-query', results: [] };
    const query =
      `username=${encodeURIComponent(texto)}` +
      '&includeActive=true&includeInactive=true&startAt=0&maxResults=20';
    let bruto;
    try {
      bruto = await this.request(`/rest/api/2/user/search?${query}`);
    } catch {
      return { status: 'unavailable', results: [] };
    }
    if (!Array.isArray(bruto)) return { status: 'unavailable', results: [] };
    const vistos = new Set();
    const results = [];
    for (const item of bruto) {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return { status: 'unavailable', results: [] }; // shape inesperado: nada é aproveitado
      }
      const key = typeof item.key === 'string' && item.key !== '' ? item.key : null;
      if (key !== null) {
        if (vistos.has(key)) continue; // dedup por key EXATA
        vistos.add(key);
      }
      results.push({
        key,
        username: typeof item.name === 'string' ? item.name : null,
        displayName: typeof item.displayName === 'string' ? item.displayName : null,
        active: typeof item.active === 'boolean' ? item.active : null
      });
    }
    return { status: results.length === 0 ? 'empty' : 'results', results };
  },
  // Busca candidatas a "removidas da sprint": issues do mesmo projeto, atualizadas
  // na janela da sprint, que NÃO estão mais na sprint atual. A confirmação real
  // de remoção acontece via changelog em issueService.extractRemovedFromCandidates.
  // Sanitização defensiva: projectKey só [A-Z0-9_], sprintId força integer.
  // Falhas retornam null — totalmente isolado do fluxo principal.
  async fetchSprintRemoved(projectKey, sprintId, startDate, endDate) {
    if (!projectKey || !sprintId || !startDate) return null;
    try {
      const safeProject = String(projectKey)
        .replace(/[^A-Z0-9_]/gi, '')
        .toUpperCase();
      if (!safeProject) return null;
      const safeSprintId = parseInt(sprintId, 10);
      if (!Number.isFinite(safeSprintId)) return null;

      // Formato yyyy-MM-dd HH:mm aceito pelo Jira JQL.
      const fmtJql = d => {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return null;
        const pad = n => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
      };
      const startStr = fmtJql(startDate);
      const endStr = fmtJql(endDate || new Date());
      if (!startStr || !endStr) return null;

      const jql = `project = "${safeProject}" AND updated >= "${startStr}" AND updated <= "${endStr}" AND sprint != ${safeSprintId}`;
      const fields = 'summary,status,issuetype';
      const MAX_PAGES = 5; // cap defensivo: até 500 candidatas

      const candidates = [];
      let startAt = 0;
      let total = Infinity;
      for (let page = 0; page < MAX_PAGES && candidates.length < total; page += 1) {
        const path = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=100&fields=${fields}&expand=changelog`;
        const data = await this.request(path);
        total = data?.total || 0;
        candidates.push(...(data?.issues || []));
        startAt += data?.issues?.length || 0;
        if (!data?.issues?.length) break;
      }
      return candidates;
    } catch {
      return null;
    }
  },
  async fetchAllIssues(jql) {
    const fields = [
      'summary',
      'status',
      'issuetype',
      'assignee',
      'created',
      'resolutiondate',
      'customfield_10016',
      'customfield_10028',
      'customfield_10002',
      'parent',
      'subtasks',
      'timeoriginalestimate',
      'timeestimate',
      'timespent',
      'timetracking',
      'worklog',
      state.flaggedFieldId,
      state.sprintFieldId,
      state.identificadorFieldId,
      state.tipoDefeitoFieldId,
      state.rotinaFieldId,
      state.clienteFieldId
    ]
      .filter(Boolean)
      .join(',');

    const issues = [];
    let startAt = 0;
    let total = Infinity;

    while (issues.length < total) {
      const path = `/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=100&fields=${fields}&expand=changelog`;
      const data = await this.request(path);
      total = data.total || 0;
      issues.push(...(data.issues || []));
      startAt += data.issues?.length || 0;
      if (!data.issues?.length) break;
    }

    return issues;
  },
  async fetchSubtasks(sprintIssues) {
    const sprintKeys = new Set(sprintIssues.map(issue => issue.key));
    const missingKeys = sprintIssues
      .flatMap(issue => issue.fields.subtasks || [])
      .map(subtask => subtask.key)
      .filter(key => key && !sprintKeys.has(key));

    const uniqueKeys = [...new Set(missingKeys)];
    if (!uniqueKeys.length) return [];

    const fields = `summary,status,issuetype,assignee,parent,resolutiondate,timeoriginalestimate,timeestimate,timespent,timetracking,worklog,${state.sprintFieldId}`;
    const fetched = [];

    for (let index = 0; index < uniqueKeys.length; index += 50) {
      const batch = uniqueKeys.slice(index, index + 50);
      try {
        const jqlBatch = `key in (${batch.join(',')})`;
        const data = await this.request(
          `/rest/api/2/search?jql=${encodeURIComponent(jqlBatch)}&maxResults=100&fields=${fields}`
        );
        fetched.push(...(data.issues || []));
      } catch {
        // Ignora subtasks que falharem individualmente para não quebrar o dashboard inteiro.
      }
    }

    return fetched;
  },
  async fetchFullWorklogs(issues) {
    const incomplete = issues.filter(issue => {
      const worklog = issue.fields.worklog;
      return worklog && worklog.total > worklog.worklogs.length;
    });

    // Pool com limite de concorrência para não estourar o burst-limit do
    // endpoint /worklog (100 req/s no tenant).
    //
    // As falhas são acumuladas AQUI e devolvidas ao chamador em vez de escritas
    // direto em state.partialWorklogs: uma carga antiga, que só termina depois de
    // uma troca de dataset, não pode contaminar o aviso de apontamento incompleto
    // do dataset novo. Quem chama confere a identidade do dataset antes de publicar.
    const failedKeys = [];
    await this.runWithConcurrency(incomplete, CONFIG.rateLimit.worklogConcurrency, async issue => {
      try {
        // Não há corrida aqui: `issue` é parâmetro DESTA invocação, não estado
        // compartilhado. runWithConcurrency distribui índices por um cursor que nunca
        // repete, então dois workers jamais recebem a mesma issue, e nada reatribui
        // `issue` nem `issue.fields` durante o await. Inverter para
        // `const w = await ...; issue.fields.worklog = w;` não silencia a regra (testado),
        // e Object.assign só a driblaria escondendo a intenção — daí a supressão.
        // eslint-disable-next-line require-atomic-updates
        issue.fields.worklog = await this.request(`/rest/api/2/issue/${issue.key}/worklog?maxResults=5000`);
      } catch (error) {
        failedKeys.push(issue.key);
        console.warn(`[worklog] ${issue.key}: ${error.message}`);
      }
    });
    return failedKeys;
  }
};
