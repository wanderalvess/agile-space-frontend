// CONFIG — constantes congeladas do dashboard.
// Extraido de assets/js/jiradash.js sem alterar nenhum valor. O Object.freeze e a
// IDENTIDADE deste objeto importam: quem importa recebe a mesma instancia, nunca uma copia.

export const CONFIG = Object.freeze({
  jiraProxyBase: '/jira',
  jiraBrowseBase: 'https://jiraproducao.totvs.com.br/browse/',
  defaultFlaggedFieldId: 'customfield_10021',
  defaultSprintFieldId: 'customfield_10020',
  tabs: ['charts', 'planning', 'issues', 'assignees', 'horas', 'cycletime', 'quality', 'config'],
  issuePageSize: 50,
  rateLimit: {
    maxRetries: 4,
    baseBackoffMs: 1000,
    maxBackoffMs: 15000,
    worklogConcurrency: 8
  },
  chartPalette: [
    '#378ADD',
    '#1D9E75',
    '#E24B4A',
    '#BA7517',
    '#7F77DD',
    '#D85A30',
    '#D4537E',
    '#888780',
    '#5DCAA5',
    '#EF9F27'
  ],
  colors: {
    success: '#1D9E75',
    warning: '#BA7517',
    danger: '#E24B4A',
    info: '#378ADD',
    muted: '#888',
    light: '#ccc'
  },
  issueTypeRole: {
    // DEV
    apoio: 'DEV',
    'apoio - cliente': 'DEV',
    'associado (sub-tarefa)': 'DEV',
    'code review (sub-tarefa)': 'DEV',
    'codificação (sub-tarefa)': 'DEV',
    'codificacao (sub-tarefa)': 'DEV',
    'defeito (sub-tarefa)': 'DEV',
    'preparação de ambiente (sub-tarefa)': 'DEV',
    'preparacao de ambiente (sub-tarefa)': 'DEV',
    spike: 'DEV',
    'teste unitário automatizado (sub-tarefa)': 'DEV',
    'teste unitario automatizado (sub-tarefa)': 'DEV',
    // QA
    'apoio - diversos (sub-tarefa)': 'QA',
    documentação: 'QA',
    documentacao: 'QA',
    'documento técnico (sub-tarefa)': 'QA',
    'documento tecnico (sub-tarefa)': 'QA',
    'execução de ti (sub-tarefa)': 'QA',
    'execucao de ti (sub-tarefa)': 'QA',
    'executar automação': 'QA',
    'executar automacao': 'QA',
    'manutenção automação': 'QA',
    'manutencao automacao': 'QA',
    'preparação de teste (sub-tarefa)': 'QA',
    'preparacao de teste (sub-tarefa)': 'QA',
    'teste automatizado (sub-tarefa)': 'QA',
    'teste integrado': 'QA',
    'teste sistêmico': 'QA',
    'teste sistemico': 'QA',
    // GESTÃO — overhead esperado (cerimônias, reuniões). Já está descontado
    // do capacity produtivo das pessoas, então é exibido em card separado e
    // não entra no gráfico de Capacidade vs Alocação.
    gestão: 'GESTAO',
    gestao: 'GESTAO',
    // ⚠️ Capacitação é overhead, não entrega: fica FORA da capacidade produtiva.
    'execução de capacitação (sub-tarefa)': 'GESTAO',
    'execucao de capacitacao (sub-tarefa)': 'GESTAO',
    // ⚠️ RECLASSIFICAÇÃO deliberada: era QA. Preparar ambiente de automação é montagem de
    // infraestrutura, não execução de teste — contava como capacidade produtiva de QA e
    // inflava a trilha de teste.
    'preparação de ambiente automação (sub-tarefa)': 'GESTAO',
    'preparacao de ambiente automacao (sub-tarefa)': 'GESTAO',
    'reunião (sub-tarefa)': 'GESTAO',
    'reuniao (sub-tarefa)': 'GESTAO'
  },
  // Tipos container: esperam subtasks. Fora do mapa DEV/QA.
  // Pai container sem subtasks → aviso visual na aba "Por issue".
  containerTypes: [
    'story',
    'legislação',
    'legislacao',
    'manutenção',
    'manutencao',
    'débito técnico',
    'debito tecnico',
    'rejeição - manutenção',
    'rejeicao - manutencao',
    'participativo'
  ],
  // Tipos de issue que NÃO exigem Estimativa Original — ficam fora da coluna "Sem est."
  // no card "Comprometimento estimado por pessoa" e do drill-down de issues sem estimativa.
  // Tipos como Codificação, Execução de TI, Teste Automatizado etc. continuam exigidos
  // (default = qualquer tipo não-listado abaixo precisa de estimativa).
  // Padrões aplicados via includes() sobre o nome normalizado (lowercase) do issuetype.
  estimateNotRequiredTypePatterns: [
    'defeito', // Defeito, Defeito (Sub-tarefa)
    'code review', // Code Review (Sub-tarefa)
    'documentação técnic', // Documentação Técnica/Técnico
    'documentacao tecnic', // sem acentos
    'reunião', // Reunião (Sub-tarefa)
    'reuniao', // sem acento
    'associado' // Associado (Sub-tarefa)
  ],
  // Tipos com nome EXATO (lowercase) — usado quando substring match seria muito amplo.
  // Ex.: "apoio" exato exclui só "Apoio", mas mantém "Apoio - Cliente" exigindo estimativa.
  estimateNotRequiredExactTypes: [
    'apoio' // só "Apoio" (Apoio - Cliente continua exigindo)
  ],
  // Tipos de issue que NÃO entram nos gráficos "Capacidade Produtiva vs Alocação"
  // e "Capacity Atual" — trabalho reativo (sem commitment no planning) distorce a
  // comparação contra capacity produtiva. Apontamento desses tipos continua visível
  // em outros lugares (Qualidade → Horas em Defeitos, Pessoas → h DEV/QA).
  capacityChartExcludedTypePatterns: [
    'defeito' // Defeito (Sub-tarefa), Defeito de Produção, etc.
  ]
});
