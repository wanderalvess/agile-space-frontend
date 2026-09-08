// Domínio de issues: papel/trilha por tipo, pertencimento à sprint atual e as
// categorias de execução.
//
// `CONTAINER_TYPES_SET` e `COR_REGRESSIVO` são derivados de `CONFIG` na AVALIAÇÃO do
// módulo, e o registro do browser avalia este arquivo uma única vez — o Set não é
// remontado a cada chamada. `state` entra como singleton importado e é só LIDO aqui
// (`state.sprintFieldId`, `state.sprintInfo`); quem escreve nele é o entrypoint.
//
// `getIssueSprintIds` fica privado: é detalhe de como o Jira serializa o campo Sprint.
import { CONFIG } from '../core/config.js';
import { normalize } from '../core/helpers.js';
import { state } from '../core/state.js';

export const getIssueTypeRole = issue => CONFIG.issueTypeRole[normalize(issue.fields.issuetype?.name)] || '';
const CONTAINER_TYPES_SET = new Set(CONFIG.containerTypes);
export const isContainerType = issue => CONTAINER_TYPES_SET.has(normalize(issue.fields.issuetype?.name));
// Verdadeiro se o tipo da issue exige Estimativa Original (default).
// Combina duas listas: substring (estimateNotRequiredTypePatterns) e exact match
// (estimateNotRequiredExactTypes). Exact match é usado pra tipos como "Apoio" onde
// o substring pegaria casos não desejados ("Apoio - Cliente" continua exigindo).
export const requiresEstimate = issue => {
  const typeName = normalize(issue.fields.issuetype?.name);
  if (!typeName) return true;
  if (CONFIG.estimateNotRequiredExactTypes.includes(typeName)) return false;
  return !CONFIG.estimateNotRequiredTypePatterns.some(pattern => typeName.includes(pattern));
};
// Verdadeiro se o tipo da issue deve ser EXCLUÍDO dos gráficos "Capacidade Produtiva
// vs Alocação" e "Capacity Atual". Trabalho reativo (Defeito) entra aqui — não é
// commitment planejado, então distorce a comparação contra capacity produtiva.
export const isExcludedFromCapacityChart = issue => {
  const typeName = normalize(issue.fields.issuetype?.name);
  if (!typeName) return false;
  return CONFIG.capacityChartExcludedTypePatterns.some(pattern => typeName.includes(pattern));
};
// Lê o customfield de Sprint e devolve a lista de IDs (issue pode estar em múltiplas).
// Lida com dois formatos do Jira: objeto com .id (novo) e string serializada (legado).
const getIssueSprintIds = issue => {
  const raw = issue.fields?.[state.sprintFieldId];
  if (!Array.isArray(raw)) return [];
  return raw
    .map(entry => {
      if (entry && typeof entry === 'object' && entry.id != null) return String(entry.id);
      if (typeof entry === 'string') {
        const match = entry.match(/id=(\d+)/);
        return match ? match[1] : null;
      }
      return null;
    })
    .filter(Boolean);
};
// Verdadeiro se a issue tem a sprint atual no seu campo Sprint.
// Defensivo: se não dá pra determinar (sem sprintInfo, sem field, ou field vazio),
// assume que está incluída — evita falsos negativos por meta-dado faltando.
export const isIssueInCurrentSprint = issue => {
  const currentId = state.sprintInfo?.id;
  if (!currentId) return true;
  const ids = getIssueSprintIds(issue);
  if (!ids.length) return true;
  return ids.includes(String(currentId));
};
// Trilha efetiva da issue para agregados de horas:
// - DEV/QA se o tipo está mapeado
// - NA caso contrário (containers sem subtask, tipos não classificados, apontamentos em pai com subtasks)
export const getTrilha = issue => getIssueTypeRole(issue) || 'NA';

// Categoria de EXECUÇÃO do apontamento — quebra mais fina que DEV/QA/GESTAO/NA,
// usada no gráfico "Capacity vs Execução por pessoa". Responde "onde a pessoa gastou
// as horas que não são tarefa estimada": gestão, apoio, defeito, etc.
// Ordem de checagem importa: gestão e os tipos reativos (defeito/apoio) têm precedência
// sobre o papel DEV/QA, pois um "Defeito (Sub-tarefa)" é mapeado como DEV mas queremos
// vê-lo separado das tarefas estimadas.
export const EXEC_CATEGORIES = [
  { key: 'TAREFA', label: 'Tarefas estimadas', color: '#378ADD' },
  { key: 'APOIO', label: 'Apoio', color: '#7F77DD' },
  { key: 'DEFEITO', label: 'Defeito', color: '#E24B4A' },
  { key: 'GESTAO', label: 'Gestão', color: '#BA7517' },
  { key: 'OUTRO', label: 'Não classificado', color: '#888780' }
];
export const newExecBuckets = () => ({ TAREFA: 0, APOIO: 0, DEFEITO: 0, GESTAO: 0, OUTRO: 0 });
// Jornada diária padrão (h/dia) — base da jornada planejada no gráfico Planejado vs
// Apontado: jornada = 8h/dia × (diasCodificacaoTeste + diasRegressivo). Fixo pra todo
// mundo (premissa do time). Gestão planejada = jornada − capacity TOTAL dos dois
// períodos, ou seja, o que sobra da jornada depois das horas produtivas.
export const JORNADA_DIARIA_HORAS = 8;
// Cor única do período de Regressivo nos gráficos de capacity. O mesmo conceito precisa
// ter a mesma cor nas três visões; o cinza da paleta lê como "segunda parte da mesma
// barra de supply" ao lado do tom escuro/azul de Codificação/Teste, e não colide com
// Estimado (chartPalette[4]) nem com Apontado.
export const COR_REGRESSIVO = CONFIG.chartPalette[7];
export const getExecCategory = issue => {
  const typeName = normalize(issue.fields.issuetype?.name);
  const trilha = getTrilha(issue);
  if (trilha === 'GESTAO') return 'GESTAO';
  if (typeName.includes('defeito')) return 'DEFEITO';
  if (typeName.includes('apoio')) return 'APOIO';
  if (trilha === 'DEV' || trilha === 'QA') return 'TAREFA';
  return 'OUTRO';
};
