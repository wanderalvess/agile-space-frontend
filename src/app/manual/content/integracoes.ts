import { MODULE_INTEGRATIONS } from '@/lib/integration-catalog';
import type { ManualBlock } from './types';

/**
 * Endereços e ferramentas vêm do catálogo de integrações (`lib/integration-catalog.ts`), o mesmo do atalho de API
 * dentro de cada módulo, que espelha os controllers `/api/v1/**` e as ferramentas MCP do backend. Não repita nome
 * de rota ou de ferramenta à mão aqui.
 */
const REST: ManualBlock[] = MODULE_INTEGRATIONS.flatMap((m) =>
  m.rest.map((r): ManualBlock => ({ kind: 'api', label: r.method, path: r.path, text: `${r.summary} Escopo ${r.scope}.` })),
);

const MCP: ManualBlock[] = MODULE_INTEGRATIONS.flatMap((m) =>
  m.mcp.map((t): ManualBlock => ({
    kind: 'api',
    label: 'Ferramenta',
    path: t.name,
    text: `${t.summary} Argumentos: ${t.params}. Escopo ${t.scope}.`,
  })),
);

export const INTEGRACOES_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'Quase tudo o que você faz na tela também pode ser feito por programa. A API REST lê e grava dados do portal. As ferramentas MCP deixam um assistente de IA, como o Claude, consultar o portal em seu nome. A mesma chave de API abre as duas portas.',
  },
  { kind: 'h2', text: 'Antes de começar' },
  {
    kind: 'step',
    title: 'Gere a sua chave',
    text: 'Em Meu espaço, na aba Conta, em Conectividade, use a seção “Minhas API Keys”. Dê um nome que diga quem vai usar, como “script de backup”. Administradores também veem e gerenciam as chaves de todo mundo em Administração, na aba API Keys.',
  },
  {
    kind: 'step',
    title: 'Escolha os escopos e a validade',
    text: 'Os escopos dizem o que a chave pode fazer. Cada chave vale 30, 90 ou 180 dias, e 90 é o padrão. Só administradores criam chave sem expiração. Perto do vencimento, renove ou rotacione a chave na mesma tela.',
  },
  {
    kind: 'step',
    title: 'Copie a chave na hora',
    text: 'A chave começa com `ask_` e aparece uma única vez. O portal guarda só uma impressão digital dela e não consegue mostrá-la de novo. Se perder, gere outra.',
  },
  {
    kind: 'step',
    title: 'Envie a chave em toda chamada',
    text: 'Use o cabeçalho `X-Api-Key`. Troque `SEU-PORTAL` nos exemplos pelo endereço que você usa no navegador.',
  },
  {
    kind: 'warn',
    text: 'Trate a chave como uma senha. Vazou ou não usa mais? Revogue na mesma tela onde criou: ela para de funcionar na chamada seguinte. Toda escrita feita pela chave fica registrada em nome do dono dela.',
  },
  { kind: 'h2', text: 'Escopos' },
  { kind: 'api', label: 'Escopo', path: 'KNOWLEDGE_READ', text: 'Base de conhecimento, leitura. Qualquer pessoa pode gerar.' },
  { kind: 'api', label: 'Escopo', path: 'KNOWLEDGE_WRITE', text: 'Base de conhecimento, escrita. Só administrador.' },
  { kind: 'api', label: 'Escopo', path: 'SQUAD_READ', text: 'Squad, leitura. Qualquer pessoa pode gerar, e a chave fica travada na própria squad.' },
  { kind: 'api', label: 'Escopo', path: 'PROMPTHUB_READ', text: 'Prompt Hub, leitura. Só administrador.' },
  { kind: 'api', label: 'Escopo', path: 'PROMPTHUB_WRITE', text: 'Prompt Hub, escrita (importar skills). Só administrador.' },
  { kind: 'api', label: 'Escopo', path: 'POKER_READ', text: 'Scrum Poker, leitura das estimativas. Só administrador.' },
  { kind: 'api', label: 'Escopo', path: 'POKER_WRITE', text: 'Scrum Poker, escrita (criar sala). Só administrador.' },
  {
    kind: 'warn',
    text: 'Sem o escopo certo a chamada falha com erro 403, mesmo com a chave válida. Uma chave com o escopo da Squad só lê a squad de quem a criou; pedir os dados de outra squad dá erro. Sem squad vinculada, o portal não gera essa chave.',
  },
  { kind: 'h2', text: 'API REST' },
  {
    kind: 'p',
    text: 'A API REST atende a Base de conhecimento, o Prompt Hub e as estimativas do Scrum Poker. A Squad é só pelo MCP. Nas listas, a paginação começa em **1**.',
  },
  {
    kind: 'code',
    lang: 'curl',
    code: 'curl "https://SEU-PORTAL/api/v1/knowledge/docs?q=onboarding&page=1&pageSize=20" \\\n  -H "X-Api-Key: ask_SUA_CHAVE_AQUI"',
  },
  ...REST,
  {
    kind: 'p',
    text: 'A lista de documentos devolve só uma prévia do texto, de 240 caracteres. Para o texto completo, peça o documento pelo id, com `format=md`, `html` ou `txt`.',
  },
  { kind: 'h2', text: 'Ferramentas MCP' },
  {
    kind: 'p',
    text: 'Adicione o portal como servidor MCP no seu assistente. Ele passa a oferecer as ferramentas abaixo, que usam a mesma chave. Aqui a paginação começa em **0**, o que é a causa mais comum de “faltou a primeira página” ao portar código da REST para o MCP.',
  },
  {
    kind: 'code',
    lang: 'json',
    code: '{\n  "mcpServers": {\n    "portal": {\n      "url": "https://SEU-PORTAL/mcp/sse",\n      "headers": { "X-Api-Key": "ask_SUA_CHAVE_AQUI" }\n    }\n  }\n}',
  },
  ...MCP,
  {
    kind: 'warn',
    text: 'A API e o MCP seguem as permissões da chave: você só alcança o que o escopo libera. No Prompt Hub as leituras só devolvem itens públicos, o mesmo que uma pessoa sem login veria. O restante do portal, como as cerimônias, não tem API pública.',
  },
  { kind: 'h2', text: 'Quando algo dá errado' },
  { kind: 'li', text: '**401:** a chave está ausente, é inválida, foi revogada ou venceu. Gere ou renove a chave.' },
  { kind: 'li', text: '**403:** a chave é válida, mas não tem o escopo daquela chamada, ou tenta ler outra squad.' },
  { kind: 'li', text: '**404:** o documento ou item não existe, o id não é válido, ou o item é privado.' },
  { kind: 'li', text: '**400:** faltou um campo obrigatório, como o `title` ao criar um documento.' },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Posso usar a chave no navegador ou em um aplicativo para o público?',
    a: 'Não. A chave dá acesso em nome de quem a criou. Use só em scripts e ferramentas suas, nunca em código que outras pessoas possam ver.',
  },
  {
    kind: 'faq',
    q: 'A minha chave parou de funcionar de repente.',
    a: 'Confira se ela venceu ou foi revogada e se a conta do dono continua ativa. Se a conta é desativada, as chaves dela deixam de valer.',
  },
  {
    kind: 'faq',
    q: 'Onde vejo o que a chave pode fazer?',
    a: 'Na lista de chaves, em Meu espaço ou na Administração, cada chave mostra os escopos e a validade.',
  },
];
