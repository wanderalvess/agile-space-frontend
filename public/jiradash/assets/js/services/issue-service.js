// Serviço de issues: o pipeline que transforma a resposta do Jira em tudo que o dashboard
// mede — árvore pai/subtask, métricas por pessoa/trilha/categoria, estimativas, worklogs,
// cycle time, churn, bugs e removidas da sprint.
//
// ⚠️ ESCREVE em `state` de propósito, e a ORDEM importa: `setIssues` troca `state.allIssues`,
// define `state.worklogsLoaded` conforme a opção recebida, zera `state.worklogLoadingPromise`,
// limpa os Sets de worklogs parciais e linhas expandidas, reinicia a paginação, publica
// `state.derived` e só então incrementa `state.dataVersion` e reseta `state.renderedVersion`
// — quem lê a versão precisa encontrar o derivado já pronto. O `state` é
// o singleton importado: nada é copiado, congelado, selado ou embrulhado em Proxy.
//
// ⚠️ Vários métodos dependem do receptor: `setIssues`/`rebuildDerived` chamam
// `this.buildDerived`, `getDerived` faz a construção LAZY, e as métricas se compõem por
// `this.*`. Não desmembre esses métodos, não os converta em arrow e não os passe soltos.
//
// `getDerived()` é lazy e `state.derived` é o cache; `rebuildDerived()` reconstrói a partir
// de `state.allIssues`. Não acrescente memoização nem clonagem.
//
// A avaliação deste módulo é inerte: nada de DOM, fetch, storage, timer ou escrita em
// `state` antes de um método ser chamado.
import { normalize, customFieldText, countBy } from '../core/helpers.js';
import { state } from '../core/state.js';
import { newRoleBuckets, addToRole } from '../domain/roles.js';
import {
  getIssueTypeRole,
  requiresEstimate,
  isIssueInCurrentSprint,
  getTrilha,
  newExecBuckets,
  getExecCategory
} from '../domain/issues.js';
import { issueRules } from '../domain/issue-rules.js';
import { createIdentityRegistry } from '../domain/person-identity.js';
import { createPresentationRegistry, createRowProvenance } from '../domain/person-presentation.js';
import {
  sprintWindow,
  isLogInSprintWindow,
  sumWorklogSecondsInSprint,
  sumWorklogSecondsBeforeSprint
} from '../domain/worklogs.js';

export const issueService = {
  setIssues(issues, { worklogsLoaded = false } = {}) {
    state.allIssues = issues;
    state.worklogsLoaded = worklogsLoaded;
    state.worklogLoadingPromise = null;
    state.partialWorklogs.clear();
    state.expandedRows.clear();
    // Expansões da aba Horas são de SESSÃO e presas ao dataset: chave de outra squad/carga não
    // significa nada aqui. Estado próprio, separado do `expandedRows` da aba Issues.
    state.hoursExpandedParents.clear();
    state.issuePage = 1;
    state.derived = this.buildDerived(issues);
    state.dataVersion += 1;
    state.renderedVersion = {};
  },
  rebuildDerived() {
    state.derived = this.buildDerived(state.allIssues);
    state.dataVersion += 1;
    state.renderedVersion = {};
  },
  getDerived() {
    if (!state.derived) state.derived = this.buildDerived(state.allIssues);
    return state.derived;
  },
  buildTree(issues) {
    const byKey = new Map(issues.map(issue => [issue.key, { ...issue, children: [] }]));
    const parents = [];

    for (const issue of issues) {
      const current = byKey.get(issue.key);
      const parentKey = issue.fields.parent?.key;

      if (parentKey && byKey.has(parentKey)) byKey.get(parentKey).children.push(current);
      else parents.push(current);
    }

    return { byKey, parents, parentKeys: new Set(parents.map(parent => parent.key)) };
  },
  buildDerived(issues) {
    const { byKey, parents, parentKeys } = this.buildTree(issues);
    const issueMetaByKey = new Map();
    const parentMetaByKey = new Map();
    const sprintWorklogs = [];
    const win = sprintWindow();
    let hasIncompleteWorklogs = false;

    for (const issue of issues) {
      const worklog = issue.fields.worklog;
      if (worklog && worklog.total > worklog.worklogs.length) hasIncompleteWorklogs = true;

      const isCancelled = issueRules.isCancelled(issue.fields.status?.name);
      const meta = {
        storyPoints: this.getStoryPoints(issue),
        spent: this.getSpentInSprint(issue),
        estimated: this.getEstimatedInSprint(issue),
        // Estimativa Original: valor congelado no planning, não recalcula com apontado.
        // Usado em Tempo Excedido (estouro real) e na lente "Comprometimento estimado".
        originalEstimated: this.getOriginalEstimateSecs(issue),
        cycleTime: this.cycleTimeDays(issue),
        enteredCurrentStatus: this.getDateEnteredCurrentStatus(issue),
        // isDone = entrega bem-sucedida (resolutiondate + status NÃO cancelado).
        // Canceladas têm resolutiondate igual concluídas mas não devem entrar em
        // métricas de conclusão (% done, cycle time, bugs resolvidos, etc.).
        isDone: !!issue.fields.resolutiondate && !isCancelled,
        isCancelled,
        isInProgress: issueRules.isInProgress(issue.fields.status.name),
        isImpediment: issueRules.isImpediment(issue)
      };
      issueMetaByKey.set(issue.key, meta);

      if (win) {
        for (const log of worklog?.worklogs || []) {
          if (isLogInSprintWindow(log, win)) {
            sprintWorklogs.push({ date: new Date(log.started), hours: (log.timeSpentSeconds || 0) / 3600 });
          }
        }
      }
    }

    for (const parent of parents) {
      const own = issueMetaByKey.get(parent.key) || {
        estimated: 0,
        spent: 0,
        storyPoints: 0,
        originalEstimated: 0
      };
      const childTotals = (parent.children || []).reduce(
        (acc, child) => {
          const meta = issueMetaByKey.get(child.key) || { estimated: 0, spent: 0, originalEstimated: 0 };
          acc.estimated += meta.estimated;
          acc.spent += meta.spent;
          acc.originalEstimated += meta.originalEstimated || 0;
          return acc;
        },
        { estimated: 0, spent: 0, originalEstimated: 0 }
      );

      const estimatedEffective = own.estimated > 0 ? own.estimated : childTotals.estimated;
      const estimatedTotal = own.estimated + childTotals.estimated;
      const spentTotal = own.spent + childTotals.spent;
      // Estimativa Original "efetiva": prioriza valor do pai; se 0, usa soma dos filhos.
      // Mesmo pattern que estimatedEffective — bate com a forma que o Jira UI agrega.
      const originalEstimatedEffective =
        (own.originalEstimated || 0) > 0 ? own.originalEstimated : childTotals.originalEstimated;

      parentMetaByKey.set(parent.key, {
        ...own,
        estimatedEffective,
        estimatedTotal,
        spentTotal,
        originalEstimatedEffective,
        // timeExceeded usa Estimativa Original (não Ajustado) — o "estouro" só faz
        // sentido contra o valor committed no planning. Ajustado inclui apontado e
        // tornaria a métrica tautológica.
        timeExceeded: originalEstimatedEffective > 0 && spentTotal > originalEstimatedEffective
      });
    }

    const statuses = [...new Set(parents.map(issue => issue.fields.status.name))].sort();
    const types = [...new Set(parents.map(issue => issue.fields.issuetype.name))].sort();

    const total = parents.length;
    // Escopo válido da conclusão: fora Canceladas (não são escopo — nem entregue nem
    // aberto) e fora tipo Gestão (overhead recorrente tipo "Registro de Horas", nunca
    // "conclui" — inflaria o denominador como item eternamente aberto).
    const scopeParents = parents.filter(
      parent => !parentMetaByKey.get(parent.key)?.isCancelled && getIssueTypeRole(parent) !== 'GESTAO'
    );
    const doneParents = scopeParents.filter(parent => parentMetaByKey.get(parent.key)?.isDone);
    const cycleDone = doneParents.filter(parent => parentMetaByKey.get(parent.key)?.cycleTime !== null);
    const cancelledCount = parents.filter(parent => parentMetaByKey.get(parent.key)?.isCancelled).length;
    const activeTotal = scopeParents.length;
    const done = doneParents.length;
    const pct = activeTotal ? Math.round((done / activeTotal) * 100) : 0;
    // Story points: mesma base do escopo válido.
    const totalSp = scopeParents.reduce(
      (sum, parent) => sum + (parentMetaByKey.get(parent.key)?.storyPoints || 0),
      0
    );
    const doneSp = doneParents.reduce(
      (sum, parent) => sum + (parentMetaByKey.get(parent.key)?.storyPoints || 0),
      0
    );

    const metrics = {
      total,
      activeTotal,
      cancelled: cancelledCount,
      done,
      subtaskCount: issues.length - total,
      pct,
      timeExceeded: parents.filter(parent => parentMetaByKey.get(parent.key)?.timeExceeded).length,
      impediments: parents.filter(parent => parentMetaByKey.get(parent.key)?.isImpediment).length,
      avgCycleTime: cycleDone.length
        ? (
            cycleDone.reduce((sum, parent) => sum + parentMetaByKey.get(parent.key).cycleTime, 0) /
            cycleDone.length
          ).toFixed(1)
        : '—',
      totalSp,
      doneSp,
      hasIncompleteWorklogs
    };

    // Atribuição por responsável:
    // - Issue pai SEM subtasks: 1 issue para o responsável do pai; feito se o pai estiver resolvido.
    // - Issue pai COM subtasks: cada pessoa que aparece nas subtasks conta 1 issue por pai
    //   (mesmo que tenha várias subtasks dele); feito só se TODAS as subtasks dela neste pai
    //   estiverem concluídas. O responsável do pai é ignorado.
    const byAssignee = {};
    // CP6: PROVENIÊNCIA das linhas de pessoa. Registrada AQUI, onde o bucket nasce do objeto de
    // usuário do Jira — é o que autoriza status/externalRef na apresentação. Linha que só existe
    // em config/carry-forward nunca ganha proveniência (fica "status desconhecido", sem escrita v2)
    // e homônimos (duas keys no mesmo bucket) ficam ambíguos. Nada disto vai ao DOM.
    const rowProvenance = createRowProvenance();
    const bucketFor = name => {
      byAssignee[name] ??= {
        total: 0,
        done: 0,
        inProgress: 0,
        subtasks: 0,
        // Estimativa por pessoa: soma da Estimativa Original (timeoriginalestimate) das
        // unidades de trabalho atribuídas, separando o que já foi entregue e listando
        // as que ainda não têm estimativa. Canceladas não entram em nenhum dos números.
        estimatedTotalSecs: 0,
        estimatedDoneSecs: 0,
        withoutEstimateIssues: []
      };
      return byAssignee[name];
    };
    // Aplica os contadores de estimativa pra uma unidade de trabalho individual.
    // Reusa meta.originalEstimated já populado em cima — evita duplicar a lógica.
    // FILTRO: só conta unidades que estão na sprint atual. Subtasks de parents da sprint
    // que ficaram em outras sprints (cenário de carryover) NÃO entram no comprometimento
    // desta sprint, pra manter o card honesto com a janela atual.
    const accumulateEstimateStats = (bucket, issue, meta) => {
      if (meta?.isCancelled) return; // Cancelada: trabalho descartado, fica fora dos números
      if (!isIssueInCurrentSprint(issue)) return; // Filtro de sprint (comprometimento desta sprint)
      const origSecs = meta?.originalEstimated || 0;
      if (origSecs > 0) {
        // Issues com estimativa contam em h Est. / % Entr. independente do tipo —
        // se alguém estimou, é comprometimento mesmo em tipos opcionais.
        bucket.estimatedTotalSecs += origSecs;
        if (meta?.isDone) bucket.estimatedDoneSecs += origSecs;
      } else if (requiresEstimate(issue)) {
        // "Sem est." só lista tipos que EXIGEM estimativa (Codificação, Execução de TI,
        // Teste Automatizado, etc.). Defeito, Code Review e Documentação Técnica não
        // contam aqui — não são tipos que devem ser estimados.
        bucket.withoutEstimateIssues.push({
          key: issue.key,
          type: issue.fields.issuetype?.name || '—',
          summary: issue.fields.summary || ''
        });
      }
    };

    for (const parent of parents) {
      // Canceladas fora das unidades de trabalho por pessoa — mesma regra da conclusão
      // da sprint: cancelada não é escopo, não pode contar como unidade "aberta".
      // (accumulateEstimateStats já ignorava canceladas internamente; o filtro aqui
      // alinha também os contadores Issues/Feito/% da tabela Pessoas.)
      const children = (parent.children || []).filter(child => !issueMetaByKey.get(child.key)?.isCancelled);
      if (children.length > 0) {
        const childrenByAssignee = new Map();
        for (const child of children) {
          const name = child.fields.assignee ? child.fields.assignee.displayName : 'Não atribuído';
          rowProvenance.observe(name, child.fields.assignee);
          if (!childrenByAssignee.has(name)) childrenByAssignee.set(name, []);
          childrenByAssignee.get(name).push(child);
        }
        for (const [name, list] of childrenByAssignee) {
          const bucket = bucketFor(name);
          bucket.total += 1;
          bucket.subtasks += list.length;
          const allDone = list.every(child => issueMetaByKey.get(child.key)?.isDone);
          const anyInProgress = list.some(child => issueMetaByKey.get(child.key)?.isInProgress);
          if (allDone) bucket.done += 1;
          else if (anyInProgress) bucket.inProgress += 1;
          // Cada subtask é uma unidade de trabalho independente para a métrica de estimativa.
          for (const child of list) accumulateEstimateStats(bucket, child, issueMetaByKey.get(child.key));
        }
      } else {
        const meta = parentMetaByKey.get(parent.key);
        // Pai cancelado (ou pai cujas subtasks foram TODAS canceladas e ele próprio
        // está cancelado) não vira unidade de ninguém.
        if (meta?.isCancelled) continue;
        const name = parent.fields.assignee ? parent.fields.assignee.displayName : 'Não atribuído';
        rowProvenance.observe(name, parent.fields.assignee);
        const bucket = bucketFor(name);
        bucket.total += 1;
        if (meta?.isDone) bucket.done += 1;
        if (meta?.isInProgress) bucket.inProgress += 1;
        // Pai sem subtasks: a própria issue conta como unidade de trabalho.
        accumulateEstimateStats(bucket, parent, meta);
      }
    }

    const assignees = Object.entries(byAssignee).sort((a, b) => b[1].total - a[1].total);
    const statusCount = countBy(parents, issue => issue.fields.status.name);
    const typeCount = countBy(parents, issue => issue.fields.issuetype.name);

    const totalEstimatedEffective = parents.reduce(
      (sum, parent) => sum + (parentMetaByKey.get(parent.key)?.estimatedEffective || 0),
      0
    );
    const totalSpentAll = issues.reduce((sum, issue) => sum + (issueMetaByKey.get(issue.key)?.spent || 0), 0);

    // Detalhe das subtasks para o drill-down da aba Horas.
    //
    // ⚠️ É APENAS visual: nada aqui entra em `totalEstimated`, `totalSpent`, saldo, totais por
    // pessoa/trilha/categoria, capacity, burndown ou export. As subtasks já estão representadas
    // no agregado do pai (`estimatedEffective`/`spentTotal`) — somá-las de novo dobraria as horas.
    //
    // ⚠️ Elegibilidade ESTRUTURAL: "tem filho materializado", nunca o TIPO da issue. História,
    // Tarefa, Bug ou Capacitação com subtask são todos expansíveis; não há allowlist e
    // `isContainerType()` não participa desta decisão.
    //
    // Ordem: a declarada em `parent.fields.subtasks` (é a que a pessoa vê no Jira); filho que
    // exista no dataset mas não esteja nessa lista entra no fim, para o detalhe nunca omitir uma
    // linha que ESTÁ no agregado do pai. Referência não materializada (fora do JQL) é ignorada em
    // silêncio — nunca vira request.
    const subtasksDoPai = parent => {
      const materializados = new Map((parent.children || []).map(child => [child.key, child]));
      const emOrdem = [];
      for (const ref of parent.fields.subtasks || []) {
        const filho = materializados.get(ref?.key);
        if (!filho) continue;
        emOrdem.push(filho);
        materializados.delete(ref.key);
      }
      for (const restante of materializados.values()) emOrdem.push(restante);
      return emOrdem.map(child => {
        // MESMOS campos do pipeline: `estimated` é a estimativa própria da subtask e `spent` é o
        // apontamento próprio dentro da MESMA janela de sprint. Nada é derivado do total do pai.
        const meta = issueMetaByKey.get(child.key) || { estimated: 0, spent: 0 };
        return {
          key: child.key,
          summary: child.fields.summary || '',
          status: child.fields.status?.name || '',
          assignee: child.fields.assignee?.displayName || '',
          issueType: child.fields.issuetype?.name || '',
          estimated: meta.estimated || 0,
          spent: meta.spent || 0
        };
      });
    };

    const parentData = parents
      .map(parent => {
        const meta = parentMetaByKey.get(parent.key) || { estimatedEffective: 0, spentTotal: 0 };
        const summary = parent.fields.summary || '';
        const shortSummary = summary.length > 22 ? `${summary.slice(0, 22)}…` : summary;
        return {
          label: `${parent.key} · ${shortSummary}`,
          fullLabel: `${parent.key} · ${summary}`,
          key: parent.key,
          estimated: meta.estimatedEffective,
          spent: meta.spentTotal,
          status: parent.fields.status?.name || '',
          subtasks: subtasksDoPai(parent)
        };
      })
      .filter(parent => parent.estimated > 0 || parent.spent > 0)
      .sort((a, b) => b.estimated - a.estimated);

    const horasSpentByPerson = {};
    const horasByPersonByTrilha = {};
    // Apontado por pessoa quebrado por categoria de execução (Tarefas/Apoio/Defeito/
    // Gestão/Não classificado) — alimenta o chart "Capacity vs Execução por pessoa".
    const horasByPersonByCategory = {};
    const realizadoByTrilha = newRoleBuckets();
    const estimadoByTrilha = newRoleBuckets();
    // Realizado por categoria de execução no nível da ISSUE (meta.spent) — mesma lente
    // do realizadoByTrilha. Usado nos totais de rodapé (ex.: h Defeito na aba Pessoas).
    const realizadoByCategory = newExecBuckets();
    // CP2: observação de identidade EM SESSÃO, paralela às métricas. O Jira já manda
    // key/name/active em assignee e worklog.author; aqui eles são preservados em memória
    // (derived.identity) em vez de descartados. NENHUMA estrutura legada por displayName
    // muda com isso, e nada disto é persistido nem exposto na UI.
    const identity = createIdentityRegistry();
    // CP6: registro de APRESENTAÇÃO por dataset (handles opacos de sessão, status, personId de
    // binding). Gerador de handle = contador opaco, sem relação com key/nome; nova instância a
    // cada rebuild do dataset (handles descartados). A resolução (identity/envelope) é feita na
    // hora do render — aqui só a instância nasce presa a ESTE dataset.
    let seqHandle = 0;
    const presentation = createPresentationRegistry({ nextHandle: () => `ph${(seqHandle += 1)}` });
    for (const issue of issues) {
      identity.observe(issue.fields.assignee, 'issue.assignee');
      const meta = issueMetaByKey.get(issue.key);
      const spent = meta?.spent || 0;
      const estimated = meta?.estimated || 0;
      const trilha = getTrilha(issue);
      const execCat = getExecCategory(issue);

      addToRole(realizadoByTrilha, trilha, spent);
      addToRole(estimadoByTrilha, trilha, estimated);
      realizadoByCategory[execCat] += spent;

      // Atribuição por pessoa = AUTOR do worklog, não assignee da issue.
      // Se Phillip é assignee mas Bruno apontou na issue dele, os 5h vão pro Bruno.
      for (const log of issue.fields.worklog?.worklogs || []) {
        // Observa o AUTOR antes do filtro de janela: ele apareceu no payload de qualquer
        // forma — a janela governa métricas, não observação de identidade.
        identity.observe(log.author, 'worklog.author');
        if (win && !isLogInSprintWindow(log, win)) continue;
        const author = log.author?.displayName || 'Não atribuído';
        const secs = log.timeSpentSeconds || 0;
        if (secs <= 0) continue;
        horasSpentByPerson[author] = (horasSpentByPerson[author] || 0) + secs;
        horasByPersonByTrilha[author] ??= newRoleBuckets();
        addToRole(horasByPersonByTrilha[author], trilha, secs);
        horasByPersonByCategory[author] ??= newExecBuckets();
        horasByPersonByCategory[author][execCat] += secs;
      }
    }

    const horasAssignees = Object.entries(horasSpentByPerson)
      .filter(([, spent]) => spent > 0)
      .sort((a, b) => b[1] - a[1]);

    const totalEstimated = parentData.reduce((sum, parent) => sum + parent.estimated, 0);
    const totalSpent = parentData.reduce((sum, parent) => sum + parent.spent, 0);

    return {
      issues,
      byKey,
      parents,
      parentKeys,
      statuses,
      types,
      issueMetaByKey,
      parentMetaByKey,
      metrics,
      assignees,
      charts: { statusCount, typeCount, totalEstimatedEffective, totalSpentAll },
      horas: {
        parentData,
        totalEstimated,
        totalSpent,
        horasSpentByPerson,
        horasByPersonByTrilha,
        horasByPersonByCategory,
        realizadoByTrilha,
        realizadoByCategory,
        estimadoByTrilha,
        assignees: horasAssignees
      },
      sprintWorklogs,
      hasIncompleteWorklogs,
      identity,
      presentation,
      rowProvenance
    };
  },
  getStoryPoints(issue) {
    return (
      issue.fields.customfield_10016 || issue.fields.customfield_10028 || issue.fields.customfield_10002 || 0
    );
  },
  getSpentInSprint(issue) {
    const fromWorklog = sumWorklogSecondsInSprint(issue);
    if (fromWorklog !== null) return fromWorklog;
    return issue.fields.timespent || issue.fields.timetracking?.timeSpentSeconds || 0;
  },
  // Estimativa Ajustada = quanto da estimativa ENTROU nesta sprint.
  //   base  = Restante + Apontado na sprint (desconta rollover: o que foi queimado
  //           em sprints anteriores não entra)
  //   teto  = Original − Apontado antes da sprint (quando há Original)
  // O teto existe porque o Jira trava o Restante em 0: quando alguém aponta ALÉM da
  // estimativa, o excesso vazava direto pra base (issue de 6h com 11,75h apontadas
  // virava 11,75h de "estimativa"). Estouro é consumo, não compromisso — vive nas
  // lentes de Apontado. Efeito colateral aceito: re-estimativa de Restante pra cima
  // além do Original também é capada. Sem Original (rollover sem original), sem teto.
  getEstimatedInSprint(issue) {
    const hasEstimate =
      issue.fields.timeoriginalestimate ||
      issue.fields.timeestimate ||
      issue.fields.timetracking?.originalEstimateSeconds ||
      issue.fields.timetracking?.remainingEstimateSeconds;
    if (!hasEstimate) return 0;

    const remaining = issue.fields.timeestimate || issue.fields.timetracking?.remainingEstimateSeconds || 0;
    if (!state.sprintDates.start) return remaining;
    const adjusted = remaining + (sumWorklogSecondsInSprint(issue) || 0);
    const original = this.getOriginalEstimateSecs(issue);
    if (original <= 0) return adjusted;
    const enteredSprint = Math.max(0, original - (sumWorklogSecondsBeforeSprint(issue) || 0));
    return Math.min(adjusted, enteredSprint);
  },
  // Estimativa Original (committed at planning) — valor fixo, não recalcula com
  // apontado. Usado pra detectar estouro real ("apontado > original") e como
  // base no card "Comprometimento estimado por pessoa".
  getOriginalEstimateSecs(issue) {
    return issue.fields.timeoriginalestimate || issue.fields.timetracking?.originalEstimateSeconds || 0;
  },
  getParentEstimatedInSprint(parent) {
    return this.getDerived().parentMetaByKey.get(parent.key)?.estimatedEffective || 0;
  },
  getParentSpentInSprint(parent) {
    return this.getDerived().parentMetaByKey.get(parent.key)?.spentTotal || 0;
  },
  isTimeExceeded(parent) {
    return this.getDerived().parentMetaByKey.get(parent.key)?.timeExceeded || false;
  },
  cycleTimeDays(issue) {
    if (!issue.fields.resolutiondate || !issue.fields.created) return null;
    const diff = new Date(issue.fields.resolutiondate) - new Date(issue.fields.created);
    return Math.round((diff / (1000 * 60 * 60 * 24)) * 10) / 10;
  },
  // Lista cronológica de [{date, status}] desde a criação até a última transição.
  // O status inicial vem do `from` da primeira transição (estado original quando criada),
  // ou do status atual quando nunca houve transição.
  getStatusEvents(issue) {
    if (!issue.fields.created) return [];
    const transitions = [];
    for (const history of issue.changelog?.histories || []) {
      for (const item of history.items || []) {
        if (item.field === 'status') {
          transitions.push({ date: new Date(history.created), from: item.fromString, to: item.toString });
        }
      }
    }
    transitions.sort((a, b) => a.date - b.date);
    const initialStatus = transitions.length > 0 ? transitions[0].from : issue.fields.status?.name;
    const events = [{ date: new Date(issue.fields.created), status: initialStatus }];
    for (const t of transitions) events.push({ date: t.date, status: t.to });
    return events;
  },
  // Horas produtivas por status (nome real), pra issues concluídas.
  // Usa productiveHoursBetween — descarta fim de semana e horas fora de 8h-18h.
  // Status terminais (Concluído E Cancelado) não acumulam tempo — issueRules.isClosed cobre.
  cycleTimeByStatus(issue, prodHoursPerDay) {
    if (!issue.fields.resolutiondate || !(prodHoursPerDay > 0)) return null;
    const events = this.getStatusEvents(issue);
    if (!events.length) return null;
    const endDate = new Date(issue.fields.resolutiondate);
    const result = {};
    for (let i = 0; i < events.length; i += 1) {
      const start = events[i].date;
      const end = i < events.length - 1 ? events[i + 1].date : endDate;
      if (end <= start) continue;
      const status = events[i].status;
      if (!status || issueRules.isClosed(status)) continue;
      const prodHours = this.productiveHoursBetween(start, end, prodHoursPerDay);
      if (prodHours > 0) result[status] = (result[status] || 0) + prodHours;
    }
    return result;
  },
  // Classifica os parents atuais da sprint em "planejada vs adicionada após start"
  // e marca carryover (issues que vieram de outra sprint antes de entrar nesta).
  // Usa o changelog do campo Sprint — IDs vêm em `item.from`/`item.to` separados por vírgula.
  // Issues *removidas* da sprint não aparecem (JQL filtra Sprint = X, não vêm no payload).
  // Cada entry retornada é { issue, addedDate } — addedDate é quando a sprint atual
  // foi vinculada à issue (timestamp do changelog) ou created se não houve transição.
  getSprintChurn() {
    const sprintInfo = state.sprintInfo;
    const sprintStart = state.sprintDates.start;
    if (!sprintInfo?.id || !sprintStart) return null;
    const sprintId = String(sprintInfo.id);
    const parseIds = raw =>
      raw
        ? String(raw)
            .split(/[,\s]+/)
            .map(s => s.trim())
            .filter(Boolean)
        : [];

    const planned = [];
    const added = [];
    const carryover = [];

    for (const parent of this.getDerived().parents) {
      const changes = [];
      for (const history of parent.changelog?.histories || []) {
        for (const item of history.items || []) {
          if (item.field === 'Sprint') {
            changes.push({
              date: new Date(history.created),
              fromIds: parseIds(item.from),
              toIds: parseIds(item.to)
            });
          }
        }
      }
      changes.sort((a, b) => a.date - b.date);

      // Momento em que a sprint atual foi adicionada à issue.
      let addedDate = null;
      for (const change of changes) {
        if (change.toIds.includes(sprintId) && !change.fromIds.includes(sprintId)) {
          addedDate = change.date;
          break;
        }
      }
      if (!addedDate) addedDate = new Date(parent.fields.created);

      const entry = { issue: parent, addedDate };
      if (addedDate > sprintStart) added.push(entry);
      else planned.push(entry);

      // Carryover: antes (ou no momento) de entrar nesta sprint, esteve em outra?
      let isCarryover = false;
      for (const change of changes) {
        if (change.date > addedDate) break;
        if (change.date < addedDate) {
          if (change.toIds.some(id => id !== sprintId)) {
            isCarryover = true;
            break;
          }
        } else if (change.fromIds.some(id => id !== sprintId)) {
          isCarryover = true;
          break;
        }
      }
      if (isCarryover) carryover.push(entry);
    }

    return {
      sprintName: sprintInfo.name || '',
      sprintStart,
      total: this.getDerived().parents.length,
      planned,
      added,
      carryover,
      // Removidas vêm de fonte externa (consulta paralela + changelog).
      // null = consulta indisponível, [] = OK sem removidas, [..] = lista com {issue, removedAt, author}.
      removed: state.sprintRemoved
    };
  },
  // Variação A do "bug escape rate": olha só o que aconteceu dentro da janela da sprint.
  // Considera bugs como issues (parents OU subtasks) cujo issuetype.name contém
  // "bug", "defeito" ou "defect" — captura "Bug", "Defeito (Sub-tarefa)", etc.
  // - criados: bugs criados entre sprintStart e sprintEnd
  // - resolvidosNaSprint: subset dos criados que já foram resolvidos dentro da janela
  // - abertos: criados na janela sem resolutiondate ou resolvidos fora dela
  // - horasDefeitoSecs: soma das horas apontadas dentro da janela em subtasks
  //   "Defeito (Sub-tarefa)" — mede o esforço gasto consertando bugs nesta sprint
  getSprintBugs() {
    const win = sprintWindow();
    if (!win) return null;
    const isBug = issue => {
      const name = normalize(issue.fields.issuetype?.name);
      return !!name && (name.includes('bug') || name.includes('defeito') || name.includes('defect'));
    };
    const inWindow = raw => {
      if (!raw) return false;
      const date = new Date(raw);
      return date >= win.start && date <= win.end;
    };
    const derived = this.getDerived();
    const created = derived.issues.filter(issue => isBug(issue) && inWindow(issue.fields.created));
    const resolvidosNaSprint = created.filter(issue => inWindow(issue.fields.resolutiondate));
    const abertos = created.filter(issue => !inWindow(issue.fields.resolutiondate));
    // Esforço gasto com bugs: soma do `spent` (já filtrado pra janela da sprint) das
    // subtasks de tipo Defeito — independente de quando o bug foi criado, conta o
    // tempo investido durante esta sprint.
    let horasDefeitoSecs = 0;
    // Quebra das mesmas horas por "Tipo do Defeito" — soma bate com horasDefeitoSecs.
    // O customfield pode estar na própria subtask OU só no pai: subtasks trazidas por
    // fetchSubtasks não carregam o customfield, então tenta subtask → pai → "Não informado".
    const horasPorTipoDefeitoSecs = {};
    for (const issue of derived.issues) {
      if (!isBug(issue)) continue;
      if (!issue.fields.parent) continue; // só subtasks (têm parent)
      const meta = derived.issueMetaByKey.get(issue.key);
      const secs = meta?.spent || 0;
      horasDefeitoSecs += secs;
      if (secs > 0 && state.tipoDefeitoFieldId) {
        let tipo = customFieldText(issue.fields[state.tipoDefeitoFieldId]);
        if (!tipo) {
          const parent = derived.byKey.get(issue.fields.parent.key);
          if (parent) tipo = customFieldText(parent.fields[state.tipoDefeitoFieldId]);
        }
        tipo = tipo || 'Não informado';
        horasPorTipoDefeitoSecs[tipo] = (horasPorTipoDefeitoSecs[tipo] || 0) + secs;
      }
    }
    return { created, resolvidosNaSprint, abertos, horasDefeitoSecs, horasPorTipoDefeitoSecs };
  },
  // A partir das issues candidatas (fetchSprintRemoved), filtra as que de fato foram
  // removidas da sprint atual via changelog do campo Sprint, e retorna a transição mais
  // recente. Mesma lógica de parsing usada em getSprintChurn — invertida (from inclui
  // a sprint, to não inclui). Só conta remoções DEPOIS do start da sprint.
  extractRemovedFromCandidates(candidates, sprintId, sprintStart) {
    if (!Array.isArray(candidates) || !sprintId || !sprintStart) return null;
    const sprintIdStr = String(sprintId);
    const parseIds = raw =>
      raw
        ? String(raw)
            .split(/[,\s]+/)
            .map(s => s.trim())
            .filter(Boolean)
        : [];

    const removed = [];
    for (const candidate of candidates) {
      let latestRemoval = null;
      for (const history of candidate.changelog?.histories || []) {
        for (const item of history.items || []) {
          if (item.field !== 'Sprint') continue;
          const fromIds = parseIds(item.from);
          const toIds = parseIds(item.to);
          // Remoção: sprint atual estava em `from` e NÃO está mais em `to`.
          if (!fromIds.includes(sprintIdStr) || toIds.includes(sprintIdStr)) continue;
          const removedAt = new Date(history.created);
          if (Number.isNaN(removedAt.getTime()) || removedAt <= sprintStart) continue;
          // Mantém a remoção mais recente (issue pode ter saído e voltado várias vezes).
          if (!latestRemoval || removedAt > latestRemoval.removedAt) {
            latestRemoval = {
              removedAt,
              author: history.author?.displayName || ''
            };
          }
        }
      }
      if (latestRemoval) {
        removed.push({
          issue: candidate,
          removedAt: latestRemoval.removedAt,
          author: latestRemoval.author
        });
      }
    }
    // Ordena pela remoção mais recente primeiro.
    removed.sort((a, b) => b.removedAt - a.removedAt);
    return removed;
  },
  getDateEnteredCurrentStatus(issue) {
    const currentStatus = issue.fields.status.name;
    let lastDate = null;

    for (const history of issue.changelog?.histories || []) {
      if (history.items?.some(item => item.field === 'status' && item.toString === currentStatus))
        lastDate = new Date(history.created);
    }

    return lastDate || new Date(issue.fields.created);
  },
  // Horas produtivas entre dois instantes: intersecta cada dia útil (Seg-Sex)
  // com a janela 8h-18h, escala pelo prodRatio (prodHoursPerDay / 10h).
  // Fins de semana e horários fora da janela contam 0.
  productiveHoursBetween(start, end, prodHoursPerDay) {
    if (!(prodHoursPerDay > 0)) return 0;
    const workStart = 8;
    const workEnd = 18;
    const workWindow = workEnd - workStart;
    const prodRatio = prodHoursPerDay / workWindow;
    const a = new Date(start);
    const b = new Date(end);
    if (b <= a) return 0;

    let total = 0;
    let cursor = new Date(a);
    cursor.setHours(0, 0, 0, 0);

    // O avanço do dia reatribui `cursor` em vez de mutá-lo in-place: a mutação
    // (cursor.setDate) é invisível para a análise estática, que passa a acusar
    // loop infinito. Segue usando setDate (e não soma de milissegundos) porque
    // setDate respeita horário de verão — somar 24h pularia ou repetiria um dia.
    while (cursor < b) {
      if (cursor.getDay() !== 0 && cursor.getDay() !== 6) {
        const dayStart = new Date(cursor);
        dayStart.setHours(workStart, 0, 0, 0);
        const dayEnd = new Date(cursor);
        dayEnd.setHours(workEnd, 0, 0, 0);
        const segStart = dayStart < a ? a : dayStart;
        const segEnd = dayEnd > b ? b : dayEnd;
        if (segEnd > segStart) total += ((segEnd - segStart) / 3600000) * prodRatio;
      }
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      cursor = nextDay;
    }

    return total;
  },
  productiveHoursSince(date, prodHoursPerDay) {
    return this.productiveHoursBetween(date, new Date(), prodHoursPerDay);
  }
};
