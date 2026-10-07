// Filtros da aba Issues: estado, correspondência e rótulos.
//
// ⚠️ Antes, cada dimensão guardava UM valor e o sentinela `'all'`, e a filtragem era igualdade
// simples. Isso impedia perguntas comuns do time — "Em Desenvolvimento OU Em Teste", "Story OU
// Manutenção" —, que só se respondiam trocando o filtro várias vezes e comparando de cabeça.
//
// O estado agora é um ARRAY por dimensão, e o vazio significa "todos". Não existe mais sentinela:
// guardar `'all'` junto de valores concretos criaria dois jeitos de dizer a mesma coisa e a
// primeira leitura desatenta trataria `'all'` como se fosse o nome de um status.
//
// Arrays (e não `Set`) de propósito: o estado continua inspecionável no devtools, comparável com
// `deepEqual` nos testes e serializável — mesmo sem ninguém serializar hoje.
//
// Este módulo é PURO: sem DOM, sem `state`, sem storage e sem rede.

// As quatro dimensões, na ordem em que aparecem na barra. `rotuloVazio` é o texto do controle
// fechado quando nada está selecionado; `plural` monta o resumo de 2+ seleções; `nome` é o rótulo
// acessível do grupo.
export const ISSUE_FILTER_DIMENSIONS = Object.freeze({
  status: Object.freeze({
    nome: 'status',
    rotuloVazio: 'Todos os status',
    plural: n => `${n} status selecionados`
  }),
  type: Object.freeze({
    nome: 'tipo',
    rotuloVazio: 'Todos os tipos',
    plural: n => `${n} tipos selecionados`
  }),
  impediment: Object.freeze({
    nome: 'situação',
    rotuloVazio: 'Todas as issues',
    plural: n => `${n} situações selecionadas`
  }),
  assignee: Object.freeze({
    nome: 'responsável',
    rotuloVazio: 'Todos os responsáveis',
    plural: n => `${n} responsáveis selecionados`
  })
});

export const ISSUE_FILTER_KEYS = Object.freeze(Object.keys(ISSUE_FILTER_DIMENSIONS));

// Os dois valores da dimensão de impedimento, com a MESMA semântica de antes:
//   open → issue não concluída · yes → issue impedida. Juntos, é OR (aberta OU impedida).
export const IMPEDIMENT_OPTIONS = Object.freeze([
  Object.freeze({ value: 'open', label: 'Abertas' }),
  Object.freeze({ value: 'yes', label: 'Impedidas' })
]);

// Estado inicial — e o mesmo usado nos resets de carga e troca de squad. Função (não constante)
// para cada chamador receber arrays PRÓPRIOS: um literal compartilhado faria a troca de squad
// herdar o array da squad anterior por referência.
export const emptyIssueFilters = () => ({ status: [], type: [], impediment: [], assignee: [] });

// Marca/desmarca UM valor numa dimensão, sem duplicar. Devolve array novo — o estado é
// substituído, nunca mutado no lugar, para que uma comparação por referência detecte a mudança.
export const toggleFilterValue = (valores, valor, marcado) => {
  const atuais = Array.isArray(valores) ? valores : [];
  if (!marcado) return atuais.filter(v => v !== valor);
  return atuais.includes(valor) ? [...atuais] : [...atuais, valor];
};

// Uma issue passa quando satisfaz PELO MENOS UM valor de CADA dimensão selecionada:
// OR dentro da dimensão, AND entre dimensões. Dimensão vazia não filtra nada.
//
// ⚠️ `some` também garante que `open + yes` não conte a issue duas vezes: o predicado responde
// uma vez por issue, não uma vez por valor marcado.
export const issueMatchesFilters = (issue, filtros = {}) => {
  const dimensao = (selecionados, satisfaz) => {
    const lista = Array.isArray(selecionados) ? selecionados : [];
    return lista.length === 0 || lista.some(satisfaz);
  };
  return (
    dimensao(filtros.status, v => v === issue.status) &&
    dimensao(filtros.type, v => v === issue.type) &&
    dimensao(filtros.assignee, v => v === issue.assignee) &&
    dimensao(filtros.impediment, v =>
      v === 'yes' ? !!issue.isImpediment : v === 'open' ? !issue.isDone : false
    )
  );
};

// Texto do controle FECHADO. Vazio → "todos"; um valor → o próprio nome (o chamador escapa);
// vários → a contagem. `rotuloDe` traduz valor em texto exibível (usado pelo impedimento, cujo
// valor persistido é `open`/`yes` mas a tela mostra "Abertas"/"Impedidas").
export const filterSummaryText = (dimensao, valores, rotuloDe = v => v) => {
  const meta = ISSUE_FILTER_DIMENSIONS[dimensao];
  if (!meta) return '';
  const lista = Array.isArray(valores) ? valores : [];
  if (lista.length === 0) return meta.rotuloVazio;
  if (lista.length === 1) return String(rotuloDe(lista[0]));
  return meta.plural(lista.length);
};
