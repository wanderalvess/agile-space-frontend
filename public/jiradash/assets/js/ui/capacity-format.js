// Apresentação de capacity: formatação da célula, memória de cálculo do tooltip e a cor de
// utilização. Só formatação — a regra de capacity vive em domain/person-config.js.
//
// `formatCapacityCell` e `capacityCalcTitle` existem fora do renderer porque o preview ao
// vivo da aba Configuração usa as MESMAS funções: se divergissem, o número e o tooltip
// mudariam sozinhos no blur.
import { CONFIG } from '../core/config.js';
import { numOrZero } from '../domain/person-config.js';

// Formata uma capacity para a tabela de Configuração. Zero EXPLÍCITO (a pessoa digitou
// 0) aparece como 0.0h; ausência de configuração continua "—". A diferença importa:
// zerar é justamente como se tira alguém do time. Vive fora do renderer porque o
// preview ao vivo (app.previewSprintConfig) usa a MESMA função — se divergissem, o
// número mudaria sozinho no blur.
// Formatador ÚNICO de horas de capacity — usado pela célula, pelo preview ao vivo e pelo resumo
// do time. Antes cada consumidor chamava `toFixed(1)` por conta própria, e uma casa só escondia
// precisão legítima: 3 dias × 5,12h dá 15,36h, que aparecia como "15.4h".
//
// Contrato: no MÍNIMO uma casa e no MÁXIMO duas. `42` sai `42.0`, `42.5` sai `42.5`, `15.36` sai
// `15.36`. O `toFixed(2)` também é o que impede ruído binário — 15.359999999… vira "15.36".
export const formatCapacityHours = hours => {
  const duas = hours.toFixed(2);
  return duas.endsWith('0') ? hours.toFixed(1) : duas;
};

// Arredondamento de APRESENTAÇÃO para as duas casas do contrato — usado onde a capacity vira dado
// de gráfico. `r1` (uma casa) achatava 35.84h em 35.8h e a barra deixava de bater com a tabela.
// ⚠️ Só para exibir: o cálculo e a persistência usam o número inteiro, sem arredondar.
export const roundCapacityHours = hours => Math.round(hours * 100) / 100;

// Rótulo desenhado DENTRO/ACIMA das barras de capacity. Inteiro sai sem casa nenhuma (`42`), como
// sempre foi; fração sai com uma ou duas (`35.84`). O `toFixed(1)` do plugin genérico transformava
// 35.84 em "35.8" — a barra dizia um número e a tabela, outro.
export const formatCapacityBarLabel = hours => (hours % 1 === 0 ? String(hours) : formatCapacityHours(hours));

export const formatCapacityCell = (hours, ...raws) =>
  hours > 0 ? `${formatCapacityHours(hours)}h` : raws.every(raw => raw === '') ? '—' : '0.0h';

// Memória de cálculo que vai no title das células de capacity ("7 dia(s) × 6h/dia").
// Vive aqui pelo mesmo motivo do formatCapacityCell: o render inicial e o preview ao
// vivo precisam montar a fórmula igual, senão o tooltip passa a mentir durante a
// digitação.
export const capacityCalcTitle = (dias, horas) => `${numOrZero(dias)} dia(s) × ${numOrZero(horas)}h/dia`;

export const utilizationColor = pct =>
  pct <= 90 ? CONFIG.colors.success : pct <= 100 ? CONFIG.colors.warning : CONFIG.colors.danger;
