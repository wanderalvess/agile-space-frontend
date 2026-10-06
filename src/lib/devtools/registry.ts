import {
  Binary,
  Bot,
  Braces,
  Bug,
  CalendarClock,
  Calculator,
  FileCode2,
  FileJson,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Fingerprint,
  GitCompare,
  Layers,
  Link2,
  MapPin,
  Network,
  Regex,
  ScanSearch,
  Send,
  ShieldCheck,
  Table2,
  TestTube,
  Type,
  Webhook,
  Wand2,
  KeyRound,
  Lock,
  Workflow,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';

export type DevToolCategoryId = 'dados' | 'codificacao' | 'texto' | 'rede' | 'api' | 'qualidade' | 'docs';

export interface DevToolCategory {
  id: DevToolCategoryId;
  label: string;
  description: string;
}

export const DEVTOOL_CATEGORIES: DevToolCategory[] = [
  { id: 'dados', label: 'Dados & Formatos', description: 'Formatar, validar e converter JSON, XML, YAML, SQL e planilhas.' },
  { id: 'codificacao', label: 'Codificação & Segurança', description: 'Base64, URL, JWT, certificados e segredos.' },
  { id: 'texto', label: 'Texto & Código', description: 'Regex, diff, strings, datas, cron e geradores.' },
  { id: 'rede', label: 'Rede & Brasil', description: 'IP, CEP e consultas de infraestrutura.' },
  { id: 'api', label: 'API & Integração', description: 'Cliente HTTP, snippets e contratos.' },
  { id: 'qualidade', label: 'Qualidade & Testes', description: 'Massa de dados, Zephyr, BDD, automação e mocks.' },
  { id: 'docs', label: 'Documentação', description: 'Geração de documentação e visualização.' },
];

export interface DevToolMeta {
  /** Vira a rota: /devtools/{id}. */
  id: string;
  title: string;
  /** Uma frase: o que a ferramenta faz. */
  description: string;
  category: DevToolCategoryId;
  icon: LucideIcon;
  /** Aparece na visão da Central de Qualidade (/qa). */
  qa?: boolean;
  /** 'soon' = ainda não portada para o novo design; o card aparece desativado. */
  status: 'ready' | 'soon';
  keywords: string[];
  /** "Como usar": passos curtos exibidos na gaveta de ajuda da ferramenta. */
  howTo: string[];
}

export const DEVTOOLS: DevToolMeta[] = [
  // ───────── Dados & Formatos
  {
    id: 'json', title: 'JSON Studio', category: 'dados', icon: Braces, status: 'ready',
    description: 'Formate, minifique, valide e navegue em JSON com erros apontados por linha.',
    keywords: ['json', 'formatar', 'validar', 'minify'],
    howTo: ['Cole o JSON na entrada.', 'Escolha Formatar ou Minificar.', 'Erros de sintaxe aparecem com a linha e a coluna.'],
  },
  {
    id: 'xml', title: 'XML Studio', category: 'dados', icon: FileCode2, status: 'ready',
    description: 'Formate e valide XML e converta de/para JSON.',
    keywords: ['xml', 'formatar', 'converter'],
    howTo: ['Cole o XML.', 'Formate ou converta para JSON.', 'Copie o resultado.'],
  },
  {
    id: 'yaml-converter', title: 'YAML ⇄ JSON', category: 'dados', icon: FileJson, status: 'ready',
    description: 'Converta entre YAML e JSON mantendo a estrutura.',
    keywords: ['yaml', 'yml', 'json', 'converter'],
    howTo: ['Cole o YAML ou o JSON.', 'Escolha o sentido da conversão.', 'Copie o resultado.'],
  },
  {
    id: 'sql-formatter', title: 'SQL Formatter', category: 'dados', icon: Table2, status: 'ready',
    description: 'Deixe consultas SQL legíveis, com indentação e palavras-chave padronizadas.',
    keywords: ['sql', 'formatar', 'query'],
    howTo: ['Cole a consulta.', 'Escolha o dialeto, se necessário.', 'Copie a versão formatada.'],
  },
  {
    id: 'json-schema', title: 'JSON Schema', category: 'dados', icon: ShieldCheck, qa: true, status: 'ready',
    description: 'Gere um schema a partir de um JSON e valide payloads contra ele.',
    keywords: ['schema', 'validar', 'contrato'],
    howTo: ['Cole um JSON de exemplo.', 'Gere o schema.', 'Valide outros payloads contra o schema.'],
  },
  {
    id: 'xlsx-to-csv', title: 'Planilha → CSV', category: 'dados', icon: FileSpreadsheet, status: 'ready',
    description: 'Converta planilhas Excel em CSV direto no navegador, sem enviar o arquivo.',
    keywords: ['xlsx', 'excel', 'csv', 'planilha'],
    howTo: ['Arraste o arquivo .xlsx.', 'Escolha a aba e o separador.', 'Baixe o CSV.'],
  },
  {
    id: 'markdown-viewer', title: 'Markdown Viewer', category: 'docs', icon: BookOpen, status: 'ready',
    description: 'Escreva Markdown e veja a prévia renderizada ao lado.',
    keywords: ['markdown', 'md', 'preview'],
    howTo: ['Escreva ou cole o Markdown.', 'A prévia atualiza ao digitar.'],
  },

  // ───────── Codificação & Segurança
  {
    id: 'base64', title: 'Base64', category: 'codificacao', icon: Binary, status: 'ready',
    description: 'Codifique e decodifique Base64 com detecção automática de JSON e XML.',
    keywords: ['base64', 'encode', 'decode'],
    howTo: ['Escolha Codificar ou Decodificar.', 'Cole o texto.', 'Se o resultado for JSON ou XML, ele é formatado.'],
  },
  {
    id: 'url-encoder', title: 'URL Encoder', category: 'codificacao', icon: Link2, status: 'ready',
    description: 'Codifique e decodifique URLs e query strings.',
    keywords: ['url', 'encode', 'query'],
    howTo: ['Cole a URL ou o trecho.', 'Escolha o sentido.', 'Copie o resultado.'],
  },
  {
    id: 'jwt-inspector', title: 'JWT Inspector', category: 'codificacao', icon: KeyRound, qa: true, status: 'ready',
    description: 'Decodifique um JWT e veja header, payload, expiração e claims.',
    keywords: ['jwt', 'token', 'claims'],
    howTo: ['Cole o token.', 'Veja header e payload decodificados.', 'A expiração aparece em horário local.'],
  },
  {
    id: 'deep-decoder', title: 'Deep Decoder', category: 'codificacao', icon: ScanSearch, status: 'ready',
    description: 'Descubra camadas: tenta Base64, URL, JSON e outros em sequência até achar o conteúdo.',
    keywords: ['decode', 'camadas', 'base64'],
    howTo: ['Cole o conteúdo misterioso.', 'A ferramenta aplica decodificações em cadeia.', 'Cada camada fica visível.'],
  },
  {
    id: 'cert-inspector', title: 'Certificados', category: 'codificacao', icon: ShieldCheck, status: 'ready',
    description: 'Leia um certificado PEM: emissor, validade e nomes alternativos.',
    keywords: ['certificado', 'pem', 'ssl', 'tls'],
    howTo: ['Cole o certificado PEM.', 'Veja emissor, validade e SANs.'],
  },
  {
    id: 'secret-vault', title: 'Cofre de Segredos', category: 'codificacao', icon: Lock, status: 'ready',
    description: 'Guarde segredos criptografados no navegador (AES-GCM, zero-knowledge).',
    keywords: ['segredo', 'senha', 'cofre', 'aes'],
    howTo: ['Defina a senha mestra.', 'Salve o segredo.', 'Só você consegue ler: nada sai do navegador.'],
  },

  // ───────── Texto & Código
  {
    id: 'regex-lab', title: 'Regex Lab', category: 'texto', icon: Regex, qa: true, status: 'ready',
    description: 'Teste expressões regulares com destaque de grupos e explicação.',
    keywords: ['regex', 'expressão regular', 'match'],
    howTo: ['Digite a expressão e as flags.', 'Cole o texto de teste.', 'Os grupos capturados ficam destacados.'],
  },
  {
    id: 'diff', title: 'Diff', category: 'texto', icon: GitCompare, qa: true, status: 'ready',
    description: 'Compare dois textos ou JSONs lado a lado e veja o que mudou.',
    keywords: ['diff', 'comparar'],
    howTo: ['Cole o original à esquerda.', 'Cole o modificado à direita.', 'As diferenças são destacadas.'],
  },
  {
    id: 'string-master', title: 'String Master', category: 'texto', icon: Type, status: 'ready',
    description: 'Maiúsculas, camelCase, snake_case, contagem, limpeza e outras transformações de texto.',
    keywords: ['string', 'texto', 'case', 'slug'],
    howTo: ['Cole o texto.', 'Escolha a transformação.', 'Copie o resultado.'],
  },
  {
    id: 'type-generator', title: 'Gerador de Tipos', category: 'texto', icon: Wand2, status: 'ready',
    description: 'Gere interfaces TypeScript, classes Java e outros tipos a partir de um JSON.',
    keywords: ['typescript', 'java', 'tipos', 'dto'],
    howTo: ['Cole o JSON.', 'Escolha a linguagem.', 'Copie o código gerado.'],
  },
  {
    id: 'cron-decoder', title: 'Cron', category: 'texto', icon: CalendarClock, status: 'ready',
    description: 'Traduza expressões cron para português e veja as próximas execuções.',
    keywords: ['cron', 'agendamento'],
    howTo: ['Cole a expressão cron.', 'Leia a explicação em português.', 'Veja as próximas datas de execução.'],
  },
  {
    id: 'date-time', title: 'Data & Hora', category: 'texto', icon: CalendarClock, status: 'ready',
    description: 'Converta timestamps, fusos horários e formatos de data.',
    keywords: ['data', 'timestamp', 'epoch', 'fuso'],
    howTo: ['Cole um timestamp ou data.', 'Veja em UTC, local e outros fusos.'],
  },
  {
    id: 'uuid-generator', title: 'UUID & IDs', category: 'texto', icon: Fingerprint, qa: true, status: 'ready',
    description: 'Gere UUIDs (v4, v7) e outros identificadores em lote.',
    keywords: ['uuid', 'guid', 'id'],
    howTo: ['Escolha o tipo e a quantidade.', 'Gere e copie.'],
  },
  {
    id: 'calculators', title: 'Calculadoras', category: 'texto', icon: Calculator, status: 'ready',
    description: 'Conversões e cálculos rápidos do dia a dia de desenvolvimento.',
    keywords: ['calculadora', 'bytes', 'conversão'],
    howTo: ['Escolha a calculadora.', 'Informe os valores.'],
  },

  // ───────── Rede & Brasil
  {
    id: 'ip-analyzer', title: 'IP Analyzer', category: 'rede', icon: Network, status: 'ready',
    description: 'Analise um IP ou CIDR: classe, máscara, faixa e tipo (público/privado).',
    keywords: ['ip', 'cidr', 'rede'],
    howTo: ['Digite o IP ou o bloco CIDR.', 'Veja máscara, faixa e tipo.'],
  },
  {
    id: 'cep', title: 'Consulta de CEP', category: 'rede', icon: MapPin, status: 'ready',
    description: 'Busque endereços por CEP.',
    keywords: ['cep', 'endereço'],
    howTo: ['Digite o CEP.', 'Veja o endereço completo.'],
  },

  // ───────── API & Integração
  {
    id: 'api-client', title: 'Cliente HTTP', category: 'api', icon: Send, qa: true, status: 'ready',
    description: 'Dispare requisições HTTP, inspecione resposta, headers e tempo.',
    keywords: ['http', 'rest', 'requisição', 'postman'],
    howTo: ['Escolha método e URL.', 'Adicione headers e corpo.', 'Envie e veja a resposta.'],
  },
  {
    id: 'api-snippets', title: 'Snippets de API', category: 'api', icon: Webhook, status: 'ready',
    description: 'Converta uma requisição em cURL, fetch, Axios, Java e outros.',
    keywords: ['curl', 'fetch', 'snippet'],
    howTo: ['Descreva a requisição.', 'Escolha a linguagem.', 'Copie o snippet.'],
  },

  // ───────── Qualidade & Testes (vindos da antiga Central de Qualidade)
  {
    id: 'test-data', title: 'Massa de Dados', category: 'qualidade', icon: FlaskConical, qa: true, status: 'ready',
    description: 'Gere massa de dados realista (CPF, CNPJ, pessoas, endereços) em lote.',
    keywords: ['massa', 'cpf', 'cnpj', 'dados de teste', 'faker'],
    howTo: ['Escolha os campos e a quantidade.', 'Gere.', 'Exporte como JSON ou CSV.'],
  },
  {
    id: 'zephyr', title: 'Zephyr Explorer', category: 'qualidade', icon: TestTube, qa: true, status: 'ready',
    description: 'Explore casos de teste e ciclos do Zephyr integrados ao Jira.',
    keywords: ['zephyr', 'casos de teste', 'jira'],
    howTo: ['Conecte o Jira no seu perfil.', 'Busque por projeto ou ciclo.', 'Exporte para o formato desejado.'],
  },
  {
    id: 'bdd-bugs', title: 'BDD & Bugs', category: 'qualidade', icon: Bug, qa: true, status: 'ready',
    description: 'Escreva cenários Gherkin e relatórios de bug padronizados.',
    keywords: ['bdd', 'gherkin', 'bug', 'cenário'],
    howTo: ['Descreva o comportamento.', 'Gere o cenário ou o relato de bug.', 'Copie para o Jira.'],
  },
  {
    id: 'automation', title: 'Gerador de Automação', category: 'qualidade', icon: Bot, qa: true, status: 'ready',
    description: 'Transforme cenários em código Cypress ou Playwright.',
    keywords: ['cypress', 'playwright', 'automação'],
    howTo: ['Cole o cenário.', 'Escolha o framework.', 'Copie o código gerado.'],
  },
  {
    id: 'fuzz', title: 'Fuzz de Limites', category: 'qualidade', icon: Workflow, qa: true, status: 'ready',
    description: 'Gere valores de borda e entradas hostis para testar validações.',
    keywords: ['fuzz', 'limites', 'borda'],
    howTo: ['Escolha o tipo de campo.', 'Gere os casos.', 'Use nos seus testes.'],
  },
  {
    id: 'api-diff', title: 'Diff de API', category: 'qualidade', icon: GitCompare, qa: true, status: 'ready',
    description: 'Compare respostas de duas versões de uma API e aponte regressões.',
    keywords: ['api', 'regressão', 'contrato'],
    howTo: ['Cole as duas respostas.', 'Veja campos adicionados, removidos e alterados.'],
  },
  {
    id: 'mocks', title: 'Estúdio de Mocks', category: 'qualidade', icon: Layers, qa: true, status: 'ready',
    description: 'Crie respostas simuladas para testar integrações sem depender do serviço real.',
    keywords: ['mock', 'simulador', 'stub'],
    howTo: ['Defina rota e resposta.', 'Salve o mock.', 'Aponte seu teste para ele.'],
  },
  {
    id: 'junit-generator', title: 'Gerador JUnit', category: 'qualidade', icon: TestTube, qa: true, status: 'ready',
    description: 'Gere esqueletos de testes JUnit a partir de uma classe Java.',
    keywords: ['junit', 'java', 'teste unitário'],
    howTo: ['Cole a classe Java.', 'Gere os testes.', 'Copie para o projeto.'],
  },

  // ───────── Documentação
  {
    id: 'doc-generator', title: 'CPF & CNPJ', category: 'qualidade', icon: FileText, qa: true, status: 'ready',
    description: 'Gere e valide CPF e CNPJ (inclusive o novo CNPJ alfanumérico) para massa de teste.',
    keywords: ['cpf', 'cnpj', 'documento', 'validar', 'filial', 'massa'],
    howTo: ['Escolha CPF ou CNPJ e a quantidade (até 100).', 'Ative máscara ou modo filial (mesma raiz), se precisar.', 'Gere e copie, ou cole um número para validar.'],
  },
];

export function getDevTool(id: string): DevToolMeta | undefined {
  return DEVTOOLS.find(t => t.id === id);
}

export function getDevToolHref(id: string): string {
  return `/devtools/${id}`;
}

export function getCategory(id: DevToolCategoryId): DevToolCategory {
  return DEVTOOL_CATEGORIES.find(c => c.id === id)!;
}
