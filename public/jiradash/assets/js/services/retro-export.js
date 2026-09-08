// ⚠️ PONTE LEGADA DE APLICAÇÃO, não arquitetura final. Este módulo mistura de propósito
// quatro coisas que um dia deveriam estar separadas: agregação de métricas, serialização do
// payload, persistência em localStorage e abertura de janela. A etapa que o tirou do
// entrypoint moveu o bloco INTEIRO, sem redesenho, para criar uma fronteira testada — não
// para declarar este desenho como bom.
//
// ⚠️ `localStorage` e `window.open` são usados DIRETAMENTE aqui, sem passar por
// `platform/storage.js` nem por um adaptador de janela. É comportamento legado e fica como
// está nesta etapa; migrar é mudança separada.
//
// ⚠️ `retroExport` LÊ `state` em exatamente quatro pontos e nunca ESCREVE nele:
// `state.allIssues` (a guarda de "carregue uma sprint antes"), `state.sprintInfo` (o nome do
// ciclo) e os dois ids de customfield, `state.rotinaFieldId` e `state.clienteFieldId`. O
// DERIVADO não vem de `state`: é `issueService.getDerived()` que o entrega — inclusive o cache
// lazy. Quem publica dataset é o `issueService`.
//
// ⚠️ As regras de HORAS_RULES e CYCLE_RULES são BEST-EFFORT e a ordem importa: vence o
// PRIMEIRO token que casar, então elas vão da mais específica para a mais genérica. Trocar a
// ordem muda a classificação sem quebrar teste algum de sintaxe.
//
// ⚠️ `deepMergeRetro` é PRIVADO ao módulo, de propósito: ele não faz parte do contrato da
// ponte. A semântica dele (override vence, array do override substitui, `undefined` preserva
// o base) é coberta pelo caminho público de `send`, não por export só para teste.
//
// A avaliação é inerte quanto a efeito externo: nada de document, storage, window.open,
// issueService, renderers, personConfig, squadStore nem leitura de `state`. O único efeito é
// o `new Set` de CLIENTE_IGNORE, que antes acontecia dentro da IIFE do entrypoint.
import { normalize } from '../core/helpers.js';
import { state } from '../core/state.js';
import { personConfig } from '../domain/person-config.js';
import { stripStatusMarker } from '../domain/person-presentation.js';
import { ui } from '../ui/ui.js';
import { renderers } from '../ui/renderers.js';
import { issueService } from './issue-service.js';
import { squadStore } from './squad-store.js';

// ---------------------------------------------------------------------------
// retroExport — ponte Dashboard → Retro.
// Mapeia a squad carregada (state.derived / churn / bugs / burndown) para o
// formato de dados da retro (retro/retro.html) e grava em localStorage.
// Ciclo Q1+Q2: cada envio preenche um slot; os agregados do ciclo inteiro
// (topRotinas, topClientes, horas, cycle) são a UNIÃO dos dois slots.
// Handoff same-origin: dashboard em / e retro em /retro/ compartilham storage.
// ---------------------------------------------------------------------------
export const retroExport = {
  DATA_KEY: id => `retro-data:${id}`,
  STAGE_KEY: id => `retro-stage:${id}`,
  RETRO_URL: '/retro',

  // Clientes ignorados no Top Clientes (requisições internas, não geram demanda externa).
  // Casado por nome normalizado (lowercase/trim).
  CLIENTE_IGNORE: new Set(['totvs interno']),
  // Papel (AM/PO/DEV/QA) → função por extenso exibida no card do time.
  ROLE_FULL: { AM: 'Agile Master', PO: 'Product Owner', DEV: 'Desenvolvedor(a)', QA: 'Quality Assurance' },

  // Mapeamentos de negócio (BEST-EFFORT). As 5 categorias de horas e as 5
  // etapas de cycle são fixas na retro; aqui inferimos a partir do tipo/status
  // do Jira. Ajuste os tokens se a nomenclatura da sua instância divergir —
  // esses dois campos também continuam editáveis no painel "Editar dados" da retro.
  // Primeira regra que casar vence (ordem: mais específica → mais genérica).
  HORAS_RULES: [
    { cat: 'legislacao', tokens: ['legisla'] },
    { cat: 'participativo', tokens: ['participativo', 'reuni', 'gest'] },
    { cat: 'teste', tokens: ['teste', 'homolog', 'aceita', 'qa'] },
    {
      cat: 'inovacao',
      tokens: ['story', 'codifica', 'débito', 'debito', 'execu', 'spike', 'inova', 'desenvolv']
    },
    { cat: 'sustentacao', tokens: ['manuten', 'defeito', 'apoio', 'sustenta', 'rejei', 'corre'] }
  ],
  HORAS_DEFAULT: 'sustentacao',
  CYCLE_RULES: [
    { stage: 'esperaRevisao', tokens: ['aguardando revis', 'espera revis', 'aguardando code'] },
    {
      stage: 'esperaTeste',
      tokens: ['aguardando teste', 'espera teste', 'aguardando homolog', 'aguardando aceit']
    },
    { stage: 'revisao', tokens: ['code review', 'revis'] },
    { stage: 'teste', tokens: ['teste', 'homolog', 'aceita', 'qa'] },
    { stage: 'codificacao', tokens: ['desenvolv', 'execu', 'andamento', 'codifica', 'doing', 'progress'] }
  ],

  classify(rules, name, fallback) {
    const n = normalize(name);
    if (!n) return fallback;
    for (const rule of rules) if (rule.tokens.some(t => n.includes(t))) return rule[Object.keys(rule)[0]];
    return fallback;
  },
  horasCat(typeName) {
    return this.classify(this.HORAS_RULES, typeName, this.HORAS_DEFAULT);
  },
  cycleStage(statusName) {
    return this.classify(this.CYCLE_RULES, statusName, null);
  },

  // Lê o valor textual de um custom field (select => {value}, texto => string,
  // multi-select => array). Retorna lista de rótulos (pode ser vazia).
  fieldLabels(raw) {
    const one = v => {
      if (v == null) return null;
      if (typeof v === 'string') return v.trim() || null;
      if (typeof v === 'object') return String(v.value || v.name || v.displayName || '').trim() || null;
      return String(v);
    };
    if (Array.isArray(raw)) return raw.map(one).filter(Boolean);
    const single = one(raw);
    return single ? [single] : [];
  },

  // Snapshot completo de UM slot (a squad carregada agora), pronto pra serializar.
  buildSlotContribution() {
    const derived = issueService.getDerived();
    if (!derived) return null;
    const parents = derived.parents;
    const metaOf = k => derived.parentMetaByKey.get(k) || {};

    // Conclusão (itens) e churn (composição).
    const churn = issueService.getSprintChurn();
    const bugs = issueService.getSprintBugs();
    const bd = renderers.buildBurndownData();

    // Horas: totais do burndown (fechamento). idealHours[0] = escopo estimado total.
    const lastOf = arr => {
      for (let i = (arr || []).length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
      return 0;
    };
    const horasTot = bd ? bd.idealHours[0] || 0 : 0;
    const horasFin = bd ? Math.max(0, horasTot - lastOf(bd.actualHoursBinary)) : 0;

    // Distribuição por tipo de issue (parents).
    const typeCount = {};
    for (const p of parents) {
      const t = p.fields.issuetype?.name || '—';
      typeCount[t] = (typeCount[t] || 0) + 1;
    }
    const dist = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .map(([label, val]) => ({ label, val }));

    // Agregados do ciclo (guardados crus pra permitir a UNIÃO Q1+Q2 depois):
    // rotina / cliente por parent; horas por categoria; cycle por etapa {sumHours,n}.
    const rotina = {},
      cliente = {},
      horasSecs = {};
    for (const p of parents) {
      for (const label of this.fieldLabels(p.fields[state.rotinaFieldId]))
        rotina[label] = (rotina[label] || 0) + 1;
      for (const label of this.fieldLabels(p.fields[state.clienteFieldId])) {
        if (this.CLIENTE_IGNORE.has(normalize(label))) continue; // ignora requisições internas
        cliente[label] = (cliente[label] || 0) + 1;
      }
      const secs = metaOf(p.key).spentTotal || 0;
      if (secs > 0) {
        const c = this.horasCat(p.fields.issuetype?.name);
        horasSecs[c] = (horasSecs[c] || 0) + secs;
      }
    }

    // Cycle por etapa em horas produtivas (issues concluídas).
    const snap = personConfig.snapshot();
    const cycle = {};
    for (const p of parents) {
      const meta = metaOf(p.key);
      if (!meta.isDone || !p.fields.resolutiondate) continue;
      const prodH = personConfig.get(p.fields.assignee?.displayName || '', snap).horasProdutivas;
      if (!(prodH > 0)) continue;
      const byStatus = issueService.cycleTimeByStatus(p, prodH);
      if (!byStatus) continue;
      for (const [status, hours] of Object.entries(byStatus)) {
        const stage = this.cycleStage(status);
        if (!stage || !(hours > 0)) continue;
        cycle[stage] ??= { sumHours: 0, n: 0 };
        cycle[stage].sumHours += hours;
        cycle[stage].n += 1;
      }
    }

    // Roster do time: só quem tem configuração preenchida (papel ou horas produtivas
    // configuradas, incluindo herdadas). Isso descarta quem aparece sem config na aba
    // Configuração — os "—" e contas duplicadas/inativas (sufixo [X]).
    const team = derived.assignees
      .filter(([name]) => name && name !== 'Não atribuído')
      .map(([name]) => ({ name, conf: personConfig.get(name, snap) }))
      .filter(({ conf }) => conf.hasConfiguredHoras || conf.papel)
      .map(({ name, conf }) => ({ name, role: (conf.papel || 'DEV').toUpperCase().slice(0, 3) }));

    return {
      // itensTot = escopo válido (canceladas fora) — mesma base do card Conclusão da Sprint.
      itensFin: derived.metrics.done,
      itensTot: derived.metrics.activeTotal,
      horasFin: Math.round(horasFin),
      horasTot: Math.round(horasTot),
      planejados: churn ? churn.planned.length : 0,
      adicionados: churn ? churn.added.length : 0,
      outraSprint: churn ? churn.carryover.length : 0,
      dist,
      qualidade: bugs
        ? {
            criados: bugs.created.length,
            resolvidos: bugs.resolvidosNaSprint.length,
            abertos: bugs.abertos.length,
            horas: Math.round((bugs.horasDefeitoSecs / 3600) * 10) / 10
          }
        : { criados: 0, resolvidos: 0, abertos: 0, horas: 0 },
      burndown: bd
        ? {
            labels: bd.labels,
            idealIssues: bd.idealIssues,
            actualIssues: bd.actualIssues,
            idealHours: bd.idealHours,
            actualHours: bd.actualHoursBinary
          }
        : null,
      ciclo: state.sprintInfo?.name || '',
      _rotina: rotina,
      _cliente: cliente,
      _horasSecs: horasSecs,
      _cycle: cycle,
      _team: team
    };
  },

  // Une os mapas de contagem dos slots presentes → top-N [{nome,valor}].
  mergeTopN(slots, mapKey, n = 10) {
    const total = {};
    for (const s of slots)
      for (const [k, v] of Object.entries(s[mapKey] || {})) total[k] = (total[k] || 0) + v;
    return Object.entries(total)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([nome, valor]) => ({ nome, valor }));
  },

  // Monta o payload PARCIAL (só campos derivados) a partir dos slots q1/q2.
  // A retro faz merge(DEFAULTS(), parcial), então campos qualitativos ficam intactos.
  buildPayload(stage, existing) {
    const slots = ['q1', 'q2'].map(k => stage[k]).filter(Boolean);
    const payload = { meta: {} };
    for (const q of ['q1', 'q2']) {
      const c = stage[q];
      if (!c) continue;
      payload[q] = {
        itensFin: c.itensFin,
        itensTot: c.itensTot,
        horasFin: c.horasFin,
        horasTot: c.horasTot,
        planejados: c.planejados,
        adicionados: c.adicionados,
        outraSprint: c.outraSprint,
        dist: c.dist,
        burndown: c.burndown
      };
      (payload.qualidade ??= {})[q] = c.qualidade;
      if (c.ciclo) payload.meta.ciclo = c.ciclo;
    }
    // Agregados do ciclo = união dos slots presentes.
    payload.topRotinas = this.mergeTopN(slots, '_rotina');
    payload.topClientes = this.mergeTopN(slots, '_cliente');
    const horas = {};
    for (const s of slots)
      for (const [c, secs] of Object.entries(s._horasSecs || {})) horas[c] = (horas[c] || 0) + secs;
    payload.horas = ['sustentacao', 'inovacao', 'participativo', 'legislacao', 'teste'].reduce(
      (o, c) => ((o[c] = Math.round(((horas[c] || 0) / 3600) * 100) / 100), o),
      {}
    );
    const cyc = {};
    for (const s of slots)
      for (const [st, v] of Object.entries(s._cycle || {})) {
        cyc[st] ??= { sumHours: 0, n: 0 };
        cyc[st].sumHours += v.sumHours;
        cyc[st].n += v.n;
      }
    payload.cycle = ['codificacao', 'esperaRevisao', 'revisao', 'esperaTeste', 'teste'].reduce(
      (o, st) => ((o[st] = cyc[st]?.n ? Math.round((cyc[st].sumHours / cyc[st].n) * 10) / 10 : 0), o),
      {}
    );
    // Roster: sempre reflete a config atual (filtrada), mas preserva as fotos já
    // enviadas casando por nome — assim re-enviar corrige o time sem perder fotos.
    const roster = (stage.q2 || stage.q1)?._team;
    if (roster?.length) {
      // CP6: a Retro exporta só o nome de APRESENTAÇÃO seguro (sem `[X]`, sem key/username). Cada
      // entrada do roster legado vira um registro com POSIÇÃO própria (m1/m2…), então remover o
      // `[X]` não funde `Ana` com `Ana [X]` — são buckets diferentes no pipeline. ⚠️ Homônimos de
      // verdade (mesmo displayName cru) já chegam aqui como UM único bucket: o pipeline legado
      // agrega por displayName e o CP6 não separa isso. O casamento de foto (best-effort, só
      // apresentação) usa o nome seguro nos DOIS lados — nunca evidência de identidade.
      const photoByName = {};
      for (const m of existing?.team || [])
        if (m && m.photo) photoByName[stripStatusMarker(m.name)] = m.photo;
      payload.team = roster.map((m, i) => {
        const safeName = stripStatusMarker(m.name);
        const entry = {
          id: `m${i + 1}`,
          role: m.role,
          roleFull: this.ROLE_FULL[m.role] || '',
          name: safeName,
          photoId: `photo-m${i + 1}`
        };
        if (photoByName[safeName]) entry.photo = photoByName[safeName];
        return entry;
      });
    }
    const squad = squadStore.list().find(s => s.id === squadStore.activeId);
    if (squad?.name) payload.meta.squad = squad.name;
    return payload;
  },

  readJson(key) {
    try {
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  },

  // Nome da squad ativa (aba atual).
  squadName() {
    const squad = squadStore.list().find(s => s.id === squadStore.activeId);
    return (squad?.name || '').trim();
  },
  // Chave da retro = slug do NOME da squad (não o id da aba). Q1 e Q2 do mesmo time
  // normalmente vivem em ABAS diferentes com o mesmo nome (ex.: duas "DDESTOQUE");
  // chaveando por nome, os dois slots caem na MESMA retro em vez de buckets separados.
  retroKey() {
    const slug = this.squadName()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || squadStore.activeId;
  },

  // Envia a squad carregada para o slot Q1 ou Q2 e reconstrói o retro-data da squad.
  send(slot) {
    if (slot !== 'q1' && slot !== 'q2') return;
    if (!state.allIssues.length) {
      ui.showError('Carregue uma sprint antes de enviar para a retro.');
      return;
    }
    const id = this.retroKey();
    const contribution = this.buildSlotContribution();
    if (!contribution) {
      ui.showError('Sem dados derivados para exportar.');
      return;
    }

    const stage = this.readJson(this.STAGE_KEY(id)) || {};
    stage[slot] = contribution;
    try {
      localStorage.setItem(this.STAGE_KEY(id), JSON.stringify(stage));
    } catch (e) {
      ui.showError('Falha ao guardar staging da retro: ' + e.message);
      return;
    }

    const existing = this.readJson(this.DATA_KEY(id)) || {};
    const payload = this.buildPayload(stage, existing);
    const merged = deepMergeRetro(existing, payload);
    try {
      localStorage.setItem(this.DATA_KEY(id), JSON.stringify(merged));
    } catch (e) {
      ui.showError('Falha ao gravar dados da retro (localStorage cheio?): ' + e.message);
      return;
    }

    const other = slot === 'q1' ? 'q2' : 'q1';
    const otherMsg = stage[other]
      ? 'Q1 e Q2 prontos.'
      : `Falta enviar ${other.toUpperCase()} (carregue a outra sprint da mesma squad e envie).`;
    const name = this.squadName() || id;
    ui.showWarning({
      message: `Sprint enviada para ${slot.toUpperCase()} da retro "${name}". ${otherMsg} Use "Abrir Retro" para ver.`
    });
  },

  open() {
    const id = this.retroKey();
    if (!this.readJson(this.DATA_KEY(id))) {
      ui.showError('Envie ao menos uma sprint (Q1/Q2) antes de abrir a retro.');
      return;
    }
    window.open(`${this.RETRO_URL}?squad=${encodeURIComponent(id)}`, '_blank', 'noopener');
  }
};

// Merge profundo pra retro: override (auto) vence; arrays do override substituem.
// Campos que o override não traz (aprendizados, perguntas, plano...) ficam do base.
function deepMergeRetro(base, override) {
  if (Array.isArray(override)) return override;
  if (override && typeof override === 'object') {
    const out = Object.assign({}, base && typeof base === 'object' ? base : {});
    for (const k of Object.keys(override)) out[k] = deepMergeRetro(out[k], override[k]);
    return out;
  }
  return override === undefined ? base : override;
}
