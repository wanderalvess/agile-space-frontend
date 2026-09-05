import { ChartType, ImpactMetric } from './types';

/**
 * Cor fixa por nome de categoria (normalizado: minúsculo, sem acento) — cobre
 * os dois vocabulários mais comuns que um dev team relata (severidade de bug,
 * resultado de teste), pra squads diferentes gerarem gráficos com a MESMA
 * paleta em vez de cor aleatória por ordem de cadastro. Campo que não bate
 * com nenhuma chave aqui simplesmente usa a paleta padrão do gráfico (sem
 * quebrar nada) — não é obrigatório usar os nomes exatos, só fica mais bonito.
 */
const CATEGORY_COLORS: Record<string, string> = {
  // Severidade de bug
  'critico': 'hsl(0, 84%, 63%)',
  'critica': 'hsl(0, 84%, 63%)',
  'alto': 'hsl(25, 95%, 58%)',
  'alta': 'hsl(25, 95%, 58%)',
  'medio': 'hsl(43, 96%, 56%)',
  'media': 'hsl(43, 96%, 56%)',
  'baixo': 'hsl(158, 64%, 48%)',
  'baixa': 'hsl(158, 64%, 48%)',
  // Resultado de teste
  'passou': 'hsl(158, 64%, 48%)',
  'aprovado': 'hsl(158, 64%, 48%)',
  'falhou': 'hsl(0, 84%, 63%)',
  'reprovado': 'hsl(0, 84%, 63%)',
  'bloqueado': 'hsl(43, 96%, 56%)',
  'pulado': 'hsl(215, 16%, 57%)',
  'ignorado': 'hsl(215, 16%, 57%)',
};

const DIACRITICS_REGEX = new RegExp(String.fromCharCode(0x5b, 0x5c, 0x75, 0x30, 0x33, 0x30, 0x30, 0x2d, 0x5c, 0x75, 0x30, 0x33, 0x36, 0x66, 0x5d), 'g');

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .trim()
    .toLowerCase();
}

export function getCategoryColor(field: string): string | undefined {
  return CATEGORY_COLORS[normalize(field)];
}

export interface ChartPreset {
  id: string;
  label: string;
  description: string;
  chartType: ChartType;
  chartTitle: string;
  metrics: ImpactMetric[];
}

/**
 * Ponto de partida pronto pra entregas que não são causa/solução — bug
 * triage, resultado de QA, tendência ao longo de sprints. Usuário ainda edita
 * campo/valor livremente depois; isso só poupa digitar os nomes e já acerta
 * o tipo de gráfico e a cor por categoria (via getCategoryColor).
 */
export const CHART_PRESETS: ChartPreset[] = [
  {
    id: 'bug-severity',
    label: 'Bugs por Severidade',
    description: 'Pizza — Crítico/Alto/Médio/Baixo',
    chartType: 'pie',
    chartTitle: 'Bugs por Severidade',
    metrics: [
      { field: 'Crítico', value: 0 },
      { field: 'Alto', value: 0 },
      { field: 'Médio', value: 0 },
      { field: 'Baixo', value: 0 },
    ],
  },
  {
    id: 'test-results',
    label: 'Resultado dos Testes',
    description: 'Pizza — Passou/Falhou/Bloqueado',
    chartType: 'pie',
    chartTitle: 'Resultado dos Testes',
    metrics: [
      { field: 'Passou', value: 0 },
      { field: 'Falhou', value: 0 },
      { field: 'Bloqueado', value: 0 },
    ],
  },
  {
    id: 'sprint-trend',
    label: 'Tendência por Sprint',
    description: 'Linha — evolução de um número ao longo do tempo',
    chartType: 'line',
    chartTitle: 'Tendência',
    metrics: [
      { field: 'Sprint 1', value: 0 },
      { field: 'Sprint 2', value: 0 },
      { field: 'Sprint 3', value: 0 },
    ],
  },
  {
    id: 'blank',
    label: 'Personalizado',
    description: 'Barra — começar do zero com seus próprios campos',
    chartType: 'bar',
    chartTitle: '',
    metrics: [{ field: '', value: 0 }],
  },
];
