import {
  Binary,
  Bot,
  Braces,
  Bug,
  Calculator,
  CalendarClock,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  FlaskConical,
  GitCompare,
  KeyRound,
  Lock,
  MapPin,
  Network,
  Regex,
  Send,
  ShieldCheck,
  TestTube,
  Type,
  Wand2,
  Webhook,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

/**
 * Registro das ferramentas do DevTools: 25 cartões em 5 grupos.
 * A Central de qualidade (/qa) deixou de ser um módulo: virou o filtro "Qualidade" do DevTools
 * (as ferramentas com `qa: true`, de vários grupos).
 */

export type DevToolGroupId = 'dados' | 'codificacao' | 'texto' | 'rede' | 'testes';

export interface DevToolGroup {
  id: DevToolGroupId;
  label: string;
  description: string;
}

export const DEVTOOL_GROUPS: DevToolGroup[] = [
  { id: 'dados', label: 'Dados e formatos', description: 'Formate, converta e valide JSON, XML, YAML, SQL, planilhas e Markdown.' },
  { id: 'codificacao', label: 'Codificação e segurança', description: 'Base64, URL, tokens, certificados e segredos.' },
  { id: 'texto', label: 'Texto e tempo', description: 'Regex, comparação, datas, cron, identificadores e conversões.' },
  { id: 'rede', label: 'API e rede', description: 'Chamadas HTTP, trechos de código, IPs e CEPs.' },
  { id: 'testes', label: 'Qualidade e testes', description: 'Massa de dados, Zephyr, cenários BDD, automação e JUnit.' },
];

/** Valores do parâmetro `?grupo=` da tela do DevTools além dos 5 grupos. */
export const HUB_FILTER_QUALITY = 'qualidade';
export const HUB_FILTER_FAVORITES = 'favoritas';
export const HUB_FILTER_RECENTS = 'recentes';
export type DevToolHubTab = 'todas' | DevToolGroupId | typeof HUB_FILTER_QUALITY | typeof HUB_FILTER_FAVORITES | typeof HUB_FILTER_RECENTS;

export const HUB_TABS: readonly DevToolHubTab[] = [
  'todas',
  ...DEVTOOL_GROUPS.map((g) => g.id),
  HUB_FILTER_QUALITY,
  HUB_FILTER_FAVORITES,
  HUB_FILTER_RECENTS,
];

/** Quando a ferramenta envia algo para fora do navegador: o que e para onde. */
export interface DevToolNetwork {
  /** Destino curto, mostrado no Guia e na dica do selo. */
  host: string;
  /** O que sai do navegador. */
  what: string;
  /** Aviso fixo no topo da ferramenta. */
  notice: string;
  /** Texto do selo; o padrão é "Usa serviço externo". */
  badge?: string;
}

export interface DevToolTab {
  id: string;
  label: string;
}

export interface DevToolMeta {
  /** Vira a rota: /devtools/{id}. */
  id: string;
  title: string;
  /** Uma frase: o que a ferramenta faz. */
  description: string;
  group: DevToolGroupId;
  icon: LucideIcon;
  /** Entra no filtro "Qualidade" (antiga Central de qualidade). */
  qa?: boolean;
  keywords: string[];
  /** "Como usar": passos curtos exibidos na folha lateral da ferramenta. */
  howTo: string[];
  /** Ausente = roda inteira no navegador. */
  network?: DevToolNetwork;
  /** Abas das ferramentas fundidas (valores aceitos em `?aba=`). */
  tabs?: DevToolTab[];
}

export const DEVTOOLS: DevToolMeta[] = [
  // ───────── Dados e formatos
  {
    id: 'data-studio', title: 'Estúdio de Dados', group: 'dados', icon: Braces, qa: true,
    description: 'Formate, converta e valide JSON, XML, YAML e SQL. Gere e confira schemas.',
    keywords: ['json', 'xml', 'yaml', 'sql', 'schema', 'formatar', 'minificar', 'converter', 'validar', 'yml'],
    tabs: [{ id: 'formatar', label: 'Formatar' }, { id: 'converter', label: 'Converter' }, { id: 'schema', label: 'Schema' }],
    howTo: [
      'Escolha a aba: Formatar, Converter ou Schema.',
      'Escolha o formato (JSON, XML, YAML ou SQL) e cole o texto na entrada.',
      'Formate ou minifique. Se houver erro, a linha e a coluna aparecem no rodapé do painel e na entrada.',
      'Em Converter, troque o formato de origem e o de destino. Em Schema, gere um schema ou valide um payload.',
      'Copie ou baixe o resultado.',
    ],
  },
  {
    id: 'xlsx-to-csv', title: 'Planilha para CSV', group: 'dados', icon: FileSpreadsheet,
    description: 'Converta um arquivo .xlsx em CSV sem enviá-lo a lugar nenhum.',
    keywords: ['xlsx', 'excel', 'csv', 'planilha'],
    howTo: ['Arraste o arquivo .xlsx (até 20 MB).', 'Escolha a aba e o separador.', 'Baixe o CSV.'],
  },
  {
    id: 'markdown-viewer', title: 'Markdown', group: 'dados', icon: FileText,
    description: 'Escreva e veja a prévia renderizada ao lado.',
    keywords: ['markdown', 'md', 'preview', 'prévia'],
    howTo: ['Escreva ou cole o Markdown.', 'A prévia atualiza ao digitar.'],
  },

  // ───────── Codificação e segurança
  {
    id: 'encoding', title: 'Codificação', group: 'codificacao', icon: Binary,
    description: 'Base64, URL e decodificação em camadas, com JSON e XML já formatados.',
    keywords: ['base64', 'url', 'encode', 'decode', 'camadas', 'deep', 'decoder'],
    tabs: [{ id: 'base64', label: 'Base64' }, { id: 'url', label: 'URL' }, { id: 'camadas', label: 'Camadas' }],
    howTo: [
      'Escolha Base64, URL ou Camadas.',
      'Em Base64 e URL, escolha codificar ou decodificar e cole o texto.',
      'Em Camadas, cole um conteúdo misterioso: a ferramenta decodifica passo a passo.',
      'Se o final for JSON, ele já vem formatado.',
    ],
  },
  {
    id: 'jwt-inspector', title: 'JWT Inspector', group: 'codificacao', icon: KeyRound, qa: true,
    description: 'Leia cabeçalho, conteúdo e validade de um token. Não confere a assinatura.',
    keywords: ['jwt', 'token', 'claims', 'bearer'],
    howTo: ['Cole o token.', 'Veja header e payload decodificados.', 'A expiração aparece em horário local.'],
  },
  {
    id: 'cert-inspector', title: 'Certificados', group: 'codificacao', icon: ShieldCheck,
    description: 'Veja emissor, validade e nomes alternativos de um certificado PEM.',
    keywords: ['certificado', 'pem', 'ssl', 'tls'],
    howTo: ['Cole o certificado PEM.', 'Veja emissor, validade e nomes alternativos.'],
  },
  {
    id: 'secret-vault', title: 'Cofre de Segredos', group: 'codificacao', icon: Lock,
    description: 'Guarde segredos criptografados neste navegador, com senha mestra.',
    keywords: ['segredo', 'senha', 'cofre', 'aes'],
    howTo: ['Defina a senha mestra.', 'Salve o segredo.', 'Só quem tem a senha mestra consegue ler; o texto cifrado fica só neste navegador.'],
  },

  // ───────── Texto e tempo
  {
    id: 'regex-lab', title: 'Regex Lab', group: 'texto', icon: Regex, qa: true,
    description: 'Teste expressões regulares e veja os trechos encontrados.',
    keywords: ['regex', 'expressão regular', 'match'],
    howTo: ['Digite a expressão e as flags.', 'Cole o texto de teste.', 'Os grupos capturados ficam destacados.'],
  },
  {
    id: 'diff', title: 'Diff', group: 'texto', icon: GitCompare, qa: true,
    description: 'Compare textos, JSON e contratos de API; gere asserções para testes.',
    keywords: ['diff', 'comparar', 'diferença', 'contrato', 'api', 'postman', 'cypress', 'playwright', 'regressão'],
    tabs: [{ id: 'texto', label: 'Texto' }, { id: 'json', label: 'JSON' }, { id: 'contrato', label: 'Contrato de API' }],
    howTo: [
      'Escolha Texto, JSON ou Contrato de API.',
      'Em Texto e JSON, cole o original e o alterado: as diferenças ficam destacadas.',
      'Em Contrato de API, cole a resposta esperada e a recebida (a comparação olha o primeiro nível do JSON) ou gere asserções a partir de um payload.',
      'Copie as asserções para Postman, Cypress ou Playwright.',
    ],
  },
  {
    id: 'string-master', title: 'String Master', group: 'texto', icon: Type,
    description: 'Maiúsculas, minúsculas, ordenação, contagem e remoção de duplicados.',
    keywords: ['texto', 'string', 'ordenar', 'contar', 'case', 'slug'],
    howTo: ['Cole o texto.', 'Escolha a transformação.', 'Copie o resultado.'],
  },
  {
    id: 'type-generator', title: 'Gerador de Tipos', group: 'texto', icon: Wand2,
    description: 'Gere tipos TypeScript, Java e Delphi a partir de um JSON.',
    keywords: ['typescript', 'java', 'delphi', 'interface', 'dto', 'tipos'],
    howTo: ['Cole o JSON.', 'Escolha a linguagem.', 'Copie o código gerado.'],
  },
  {
    id: 'cron-decoder', title: 'Cron', group: 'texto', icon: CalendarClock,
    description: 'Leia uma expressão cron em português e veja as próximas execuções.',
    keywords: ['cron', 'agendamento'],
    howTo: ['Cole a expressão cron.', 'Leia a explicação em português.', 'Veja as próximas datas de execução.'],
  },
  {
    id: 'date-time', title: 'Data e Hora', group: 'texto', icon: Clock,
    description: 'Converta timestamps e fusos horários.',
    keywords: ['timestamp', 'epoch', 'fuso', 'data', 'hora'],
    howTo: ['Cole um timestamp ou uma data.', 'Veja em UTC, no horário local e em outros fusos.'],
  },
  {
    id: 'uuid-generator', title: 'UUID e IDs', group: 'texto', icon: Fingerprint, qa: true,
    description: 'Gere UUID v4, v7 e outros identificadores.',
    keywords: ['uuid', 'guid', 'id', 'ulid'],
    howTo: ['Escolha o tipo e a quantidade.', 'Gere e copie.'],
  },
  {
    id: 'calculators', title: 'Calculadoras', group: 'texto', icon: Calculator,
    description: 'Conversões de unidades, bases numéricas e tamanhos.',
    keywords: ['conversão', 'base', 'hex', 'binário', 'bytes', 'calculadora'],
    howTo: ['Escolha a calculadora.', 'Informe os valores.'],
  },

  // ───────── API e rede
  {
    id: 'api-client', title: 'Cliente HTTP', group: 'rede', icon: Send, qa: true,
    description: 'Envie uma requisição e veja status, cabeçalhos e corpo da resposta.',
    keywords: ['http', 'rest', 'requisição', 'get', 'post', 'api', 'postman'],
    network: {
      host: 'Endereço que você informar',
      what: 'A requisição sai do navegador direto para o endereço digitado. Só alcança os hosts que aceitam chamadas do navegador (CORS).',
      notice: 'A requisição sai do navegador direto para o endereço que você digitar.',
    },
    howTo: ['Escolha o método e a URL.', 'Adicione cabeçalhos e corpo.', 'Envie e veja a resposta.'],
  },
  {
    id: 'api-snippets', title: 'Snippets de API', group: 'rede', icon: Webhook,
    description: 'Transforme uma chamada em cURL, fetch, Axios, Python, Java ou C#.',
    keywords: ['curl', 'fetch', 'axios', 'python', 'java', 'csharp', 'snippet'],
    howTo: ['Descreva a requisição ou cole um cURL.', 'Escolha a linguagem.', 'Copie o trecho.'],
  },
  {
    id: 'ip-analyzer', title: 'IP Analyzer', group: 'rede', icon: Network,
    description: 'Calcule CIDR e máscara; localize a região de um IP.',
    keywords: ['ip', 'cidr', 'máscara', 'rede'],
    network: {
      host: 'ipapi.co',
      what: 'Só ao clicar em Localizar: envia o IP consultado. CIDR e máscara são calculados no navegador.',
      notice: 'Ao localizar a região, o IP consultado é enviado a ipapi.co. CIDR e máscara são calculados no navegador.',
    },
    howTo: ['Digite o IP ou o bloco CIDR.', 'Veja máscara, faixa e tipo.', 'Use Localizar para saber a região (consulta ipapi.co).'],
  },
  {
    id: 'cep', title: 'Consulta de CEP', group: 'rede', icon: MapPin,
    description: 'Busque o endereço completo de um CEP.',
    keywords: ['cep', 'endereço', 'correios', 'viacep'],
    network: {
      host: 'viacep.com.br',
      what: 'Envia o CEP que você digitar.',
      notice: 'Esta ferramenta consulta viacep.com.br. O CEP que você digitar é enviado a esse serviço; nada mais sai do navegador.',
    },
    howTo: ['Digite o CEP com 8 números.', 'Clique em Consultar e aguarde a resposta.', 'Copie o endereço.'],
  },

  // ───────── Qualidade e testes
  {
    id: 'test-data', title: 'Massa de Dados', group: 'testes', icon: FlaskConical, qa: true,
    description: 'Gere CPF, CNPJ (inclui alfanumérico), pessoas e cartões de teste. Valide e exporte.',
    keywords: ['cpf', 'cnpj', 'pessoa', 'cartão', 'mock', 'dados de teste', 'massa', 'validar', 'csv', 'filial'],
    tabs: [{ id: 'gerar', label: 'Gerar' }, { id: 'validar', label: 'Validar' }],
    howTo: [
      'Em Gerar, escolha CPF, CNPJ, pessoa completa ou cartão e a quantidade.',
      'Para CNPJ, escolha o formato numérico ou o alfanumérico; dá para gerar filiais da mesma raiz.',
      'Copie a lista ou baixe no formato escolhido. Salve um conjunto para usar de novo neste navegador.',
      'Em Validar, cole um documento por linha para conferir os dígitos.',
    ],
  },
  {
    id: 'zephyr', title: 'Zephyr Explorer', group: 'testes', icon: TestTube, qa: true,
    description: 'Consulte ciclos e casos de teste do Zephyr com o seu token.',
    keywords: ['zephyr', 'jira', 'testes', 'ciclo', 'casos de teste'],
    network: {
      host: 'Zephyr (pelo servidor do portal)',
      what: 'Envia suas consultas ao Zephyr usando o seu token pessoal.',
      notice: 'As consultas vão ao Zephyr pelo servidor do portal, com o seu token pessoal.',
    },
    howTo: ['Informe o token do Zephyr.', 'Busque por projeto ou ciclo.', 'Exporte os casos no formato desejado.'],
  },
  {
    id: 'bdd-bugs', title: 'BDD e Bugs', group: 'testes', icon: Bug, qa: true,
    description: 'Escreva cenários Gherkin e relatos de bug padronizados.',
    keywords: ['bdd', 'gherkin', 'cenário', 'bug', 'relato'],
    howTo: ['Descreva o comportamento.', 'Gere o cenário ou o relato de bug.', 'Copie para o Jira.'],
  },
  {
    id: 'automation', title: 'Gerador de Automação', group: 'testes', icon: Bot, qa: true,
    description: 'Do cenário ao esqueleto de teste em Cypress ou Playwright.',
    keywords: ['cypress', 'playwright', 'automação'],
    howTo: ['Cole o cenário.', 'Escolha o framework.', 'Copie o código gerado.'],
  },
  {
    id: 'fuzz', title: 'Fuzz de Limites', group: 'testes', icon: Workflow, qa: true,
    description: 'Catálogo de valores extremos para testar campos de formulário.',
    keywords: ['fuzz', 'limite', 'valor extremo', 'campo', 'borda', 'teste'],
    howTo: ['Escolha o tipo de campo.', 'Gere os casos.', 'Use nos seus testes.'],
  },
  {
    id: 'junit-generator', title: 'Gerador JUnit', group: 'testes', icon: FileCheck2, qa: true,
    description: 'Esqueleto de teste JUnit pronto para completar. Gemini é opcional.',
    keywords: ['junit', 'java', 'teste', 'gemini'],
    network: {
      host: 'Gemini, do Google (opcional)',
      what: 'Só se você colocar a sua chave: envia o texto da classe colada. Sem a chave, tudo fica no navegador.',
      notice: 'Só se você informar uma chave do Gemini: o código colado é enviado ao Google. Sem a chave, tudo fica no navegador.',
      badge: 'Serviço externo opcional',
    },
    howTo: ['Cole a classe Java.', 'Gere o esqueleto dos testes (a chave do Gemini é opcional).', 'Copie para o projeto.'],
  },
];

/** Ferramentas que entram no filtro "Qualidade". */
export const QUALITY_TOOLS: DevToolMeta[] = DEVTOOLS.filter((t) => t.qa);

export function getDevTool(id: string): DevToolMeta | undefined {
  return DEVTOOLS.find((t) => t.id === id);
}

export function getDevToolHref(id: string, aba?: string): string {
  return aba ? `/devtools/${id}?aba=${aba}` : `/devtools/${id}`;
}

export function getGroup(id: DevToolGroupId): DevToolGroup {
  return DEVTOOL_GROUPS.find((g) => g.id === id)!;
}

/** Ferramenta sem rede = roda no navegador. */
export function isLocalTool(t: DevToolMeta): boolean {
  return !t.network;
}

/** Texto do selo do cartão: onde a ferramenta roda. */
export function toolBadge(t: DevToolMeta): { label: string; external: boolean; tip: string } {
  if (!t.network) return { label: 'Roda no navegador', external: false, tip: 'Nada sai da sua máquina' };
  return { label: t.network.badge ?? 'Usa serviço externo', external: true, tip: t.network.host };
}

/** Primeira aba da ferramenta fundida (ou undefined se ela não tem abas). */
export function normalizeTab(tool: DevToolMeta | undefined, aba: string | null | undefined): string | undefined {
  if (!tool?.tabs?.length) return undefined;
  return tool.tabs.find((t) => t.id === aba)?.id ?? tool.tabs[0].id;
}

/**
 * Rotas antigas que continuam vivas por redirecionamento (links salvos, favoritos do navegador).
 * `null` = ferramenta removida: a rota volta para o hub.
 */
export interface LegacyRedirect {
  tool: string;
  params: Record<string, string>;
}

export const LEGACY_ROUTES: Record<string, LegacyRedirect | null> = {
  json: { tool: 'data-studio', params: { aba: 'formatar', formato: 'json' } },
  xml: { tool: 'data-studio', params: { aba: 'formatar', formato: 'xml' } },
  'yaml-converter': { tool: 'data-studio', params: { aba: 'converter', de: 'yaml', para: 'json' } },
  'sql-formatter': { tool: 'data-studio', params: { aba: 'formatar', formato: 'sql' } },
  'json-schema': { tool: 'data-studio', params: { aba: 'schema' } },
  base64: { tool: 'encoding', params: { aba: 'base64' } },
  'url-encoder': { tool: 'encoding', params: { aba: 'url' } },
  'deep-decoder': { tool: 'encoding', params: { aba: 'camadas' } },
  'api-diff': { tool: 'diff', params: { aba: 'contrato' } },
  'doc-generator': { tool: 'test-data', params: { aba: 'gerar', tipo: 'cpf' } },
  mocks: null,
};

/** Destino da rota antiga `/devtools/{slug}`; `/devtools` quando a ferramenta foi removida. */
export function legacyRedirectHref(slug: string): string {
  const target = LEGACY_ROUTES[slug];
  if (!target) return '/devtools';
  const qs = new URLSearchParams(target.params).toString();
  return `/devtools/${target.tool}${qs ? `?${qs}` : ''}`;
}

/** Destino de `/qa`: o filtro "Qualidade" do DevTools. */
export const QA_REDIRECT_HREF = `/devtools?grupo=${HUB_FILTER_QUALITY}`;
