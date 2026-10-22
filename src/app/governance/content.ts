/**
 * Conteúdo da página "Segurança e dados".
 *
 * Regra desta página: só entra aqui o que foi conferido no código (backend `develop` e este frontend). Sem promessa,
 * sem prazo inventado. Se o código mudar, o texto muda junto: uma divergência é bug.
 *
 * Onde cada afirmação foi conferida (backend: `src/main/java/com/agilespace/backend/...`):
 *  - sessão: `security/JwtTokenUtil` (24 h por token, teto de 7 dias), `service/AuthService` (refresh, logout, troca de senha);
 *  - link de redefinição: `service/PasswordResetService` (RESET_LINK_MINUTES = 120, só o hash do token no banco);
 *  - domínios de e-mail: `service/AuthService` (`app.security.allowed-email-domain`) e `application-prod.yml`;
 *  - tokens cifrados: `security/CryptoConverter` (AES-GCM) em `UserJiraConfig`, `UserTdnConfig`, `KnowledgeUserAiSettings`;
 *    `controller/UserController` (admin lendo outra pessoa recebe só "configurado" e o domínio);
 *  - chaves de API: `security/ApiKeyLifecycle` (90 dias por padrão), `domain/ApiKey` (só o hash);
 *  - auditoria: `config/SecurityAuditInterceptor` e os `AuditLog` de `PasswordResetService`, `InviteService`,
 *    `LeadDemotionService`, `LinkRequestService`, `SquadTeamService`, `UserService`; leitura só do admin (`AdminController`);
 *  - quem vê o quê: `WorkspaceController` (notas), `PromptService`, `KnowledgeService`, `SupportTicketController`,
 *    `FeedbackController`, `SquadAccessService`, `SquadTeamService`, `InviteController`, `BrainstormingController`.
 */

/** Perfis da matriz "Quem pode ver o quê". A ordem é a das colunas. */
export type RoleId = 'membro' | 'lideranca' | 'admin';

export const ROLE_COLUMNS: { id: RoleId; label: string }[] = [
  { id: 'membro', label: 'Membro' },
  { id: 'lideranca', label: 'Liderança da squad' },
  { id: 'admin', label: 'Admin' },
];

/**
 * Última revisão do texto. Fica em código (e não na configuração do sistema) porque a configuração pública do
 * servidor só entrega duas chaves fixas (nome da empresa e cor) e o admin não tem tela para editar uma chave nova.
 * Quem revisar a página atualiza estes dois campos no mesmo commit das mudanças de texto.
 */
export const SECURITY_REVIEW = { date: '20/10/2026', by: 'Wanderson Alves Santos' } as const;

/** Destino do botão "Pedir exportação ou exclusão": abre o Suporte com um chamado novo do tipo Suporte. */
export const DATA_REQUEST_SUBJECT = 'Pedido de exportação ou exclusão de dados';
export const DATA_REQUEST_HREF = `/support?novo=1&tipo=suporte&assunto=${encodeURIComponent(DATA_REQUEST_SUBJECT)}`;

export type SectionId = 'sessao' | 'guarda' | 'quem' | 'integ' | 'lim' | 'seus';

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'sessao', label: 'Sessão' },
  { id: 'guarda', label: 'O que o portal guarda' },
  { id: 'quem', label: 'Quem pode ver o quê' },
  { id: 'integ', label: 'Integrações' },
  { id: 'lim', label: 'Limitações' },
  { id: 'seus', label: 'Seus dados' },
];

/** Ícones das cartas de sessão e de integração (nomes do lucide-react, resolvidos na página). */
export type ContentIcon = 'login' | 'refresh' | 'logout' | 'key' | 'lock' | 'list' | 'link' | 'sparkles' | 'wrench' | 'vault';

export interface SessionCard {
  id: string;
  title: string;
  text: string;
  icon: ContentIcon;
}

export const SESSION_CARDS: SessionCard[] = [
  {
    id: 'entrada',
    title: 'Entrada',
    text: 'Com e-mail e senha. O cadastro só aceita e-mails dos domínios autorizados pelo servidor (em produção, totvs.com.br e ext.totvs.com.br).',
    icon: 'login',
  },
  {
    id: 'renovavel',
    title: 'Sessão renovável',
    text: 'Cada sessão vale 24 horas e se renova sozinha enquanto você usa o portal, por até 7 dias desde a entrada. Depois disso é preciso entrar de novo.',
    icon: 'refresh',
  },
  {
    id: 'sair',
    title: 'Sair',
    text: 'Ao sair, a sessão termina em todos os aparelhos onde você entrou. Trocar a senha também derruba as outras sessões.',
    icon: 'logout',
  },
  {
    id: 'esqueci',
    title: 'Esqueci a senha',
    text: 'Você pede, o administrador gera um link de uso único, válido por 2 horas, e você mesmo define a nova senha. A senha atual não muda até lá.',
    icon: 'key',
  },
  {
    id: 'temporaria',
    title: 'Senha temporária',
    text: 'Não existe. O acesso é recuperado só pelo link de uso único. As senhas ficam guardadas apenas como hash com sal.',
    icon: 'lock',
  },
];

export interface DataRow {
  id: string;
  /** Nome do dado. */
  name: string;
  /** Detalhe do que é guardado. */
  detail: string;
  /** Onde fica. */
  where: string;
  /** Quem vê. */
  who: string;
  /** Por quanto tempo. */
  keep: string;
}

/** Texto único para o que não tem prazo: a tabela diz isso em vez de inventar. */
export const NO_RETENTION = 'Sem prazo definido ainda';

const DB = 'Banco de dados do portal';

export const DATA_ROWS: DataRow[] = [
  {
    id: 'contas',
    name: 'Contas e vínculos de squad',
    detail: 'Nome, e-mail, squad e função',
    where: DB,
    who: 'Você vê a sua conta; a squad vê o time e os vínculos dela; o admin vê todas',
    keep: NO_RETENTION,
  },
  {
    id: 'cerimonias',
    name: 'Sessões de cerimônia',
    detail: 'Poker, Retro, Review, Radar, Brainstorming, Plano de ação',
    where: DB,
    who: 'A lista de cada squad aparece para quem tem vínculo com ela e para o admin. Brainstorming e Plano de ação (público) também abrem para qualquer pessoa logada que tenha o link',
    keep: NO_RETENTION,
  },
  {
    id: 'notas',
    name: 'Notas e quadro pessoal',
    detail: 'Notas, cartões do quadro, links e trechos de Meu espaço',
    where: DB,
    who: 'Só você, nem o admin',
    keep: NO_RETENTION,
  },
  {
    id: 'conhecimento',
    name: 'Base de conhecimento',
    detail: 'Artigos e pastas',
    where: DB,
    who: 'Todas as pessoas logadas, de todas as squads (compartilhada de propósito). Rascunho: só o autor e o admin',
    keep: NO_RETENTION,
  },
  {
    id: 'prompts',
    name: 'Biblioteca de IA',
    detail: 'Prompts e coleções guardados',
    where: DB,
    who: 'Itens públicos: qualquer pessoa, até sem entrar no portal. Itens privados: só o autor e o admin',
    keep: NO_RETENTION,
  },
  {
    id: 'chamados',
    name: 'Chamados e feedbacks',
    detail: 'Mensagens e respostas do Suporte; feedbacks enviados pelo rodapé',
    where: DB,
    who: 'Chamado: você e o admin. Feedback do rodapé: só o admin',
    keep: NO_RETENTION,
  },
  {
    id: 'assistente',
    name: 'Conversas do assistente',
    detail: 'Perguntas e respostas do assistente da Base de conhecimento',
    where: DB,
    who: 'Só você',
    keep: NO_RETENTION,
  },
  {
    id: 'mensagens',
    name: 'Mensagens entre pessoas',
    detail: 'Conversas diretas entre colegas de squad',
    where: DB,
    who: 'As duas pessoas da conversa',
    keep: NO_RETENTION,
  },
  {
    id: 'tokens',
    name: 'Tokens do Jira e do TDN e chave pessoal do assistente',
    detail: 'Guardados cifrados no servidor (AES-GCM)',
    where: DB,
    who: 'Só você. O admin vê apenas que existe uma conexão e o endereço dela, nunca o token',
    keep: NO_RETENTION,
  },
  {
    id: 'apikeys',
    name: 'Chaves de API',
    detail: 'Acesso programático (API e MCP). O servidor guarda só o hash; a chave inteira aparece uma vez, na criação',
    where: DB,
    who: 'Você vê as suas (nome e validade); o admin vê todas',
    keep: 'Vale 90 dias por padrão (30, 90 ou 180 à escolha); o registro não é apagado sozinho',
  },
  {
    id: 'auditoria',
    name: 'Trilha de auditoria',
    detail:
      'Acessos às rotas de administração (rota, quem e IP), pedidos e links de redefinição de senha, convites, mudanças de papel, de equipe e de acesso',
    where: DB,
    who: 'Admin',
    keep: NO_RETENTION,
  },
  {
    id: 'cofre',
    name: 'Cofre do DevTools',
    detail: 'Segredos que você guarda no DevTools, cifrados no navegador com uma senha sua',
    where: 'Só neste navegador, nunca no servidor',
    who: 'Só você, neste navegador',
    keep: 'Até você apagar ou limpar os dados do navegador',
  },
];

export interface MatrixRow {
  id: string;
  what: string;
  /** Uma resposta por perfil, na ordem de {@link ROLE_COLUMNS}. */
  cells: Record<RoleId, string>;
}

/** Textos que contam como "não": ganham tom apagado na tabela. */
export const NEGATIVE_CELLS = new Set(['Não']);

export const MATRIX_ROWS: MatrixRow[] = [
  {
    id: 'sessoes',
    what: 'Sessões das cerimônias (listas por squad)',
    cells: { membro: 'Da sua squad', lideranca: 'Da sua squad', admin: 'De todas' },
  },
  {
    id: 'membros',
    what: 'Membros e vínculos',
    cells: { membro: 'Da sua squad', lideranca: 'Da sua squad, e convida pessoas', admin: 'De todas' },
  },
  {
    id: 'equipe',
    what: 'Adicionar, remover ou mudar o papel de alguém',
    cells: {
      membro: 'Não',
      lideranca: 'Só Agile Master, Scrum Master e People Lead da squad',
      admin: 'Sim, e só o admin atribui esses papéis',
    },
  },
  {
    id: 'chamados',
    what: 'Chamados e respostas',
    cells: { membro: 'Só os seus', lideranca: 'Só os seus', admin: 'Todos' },
  },
  {
    id: 'feedbacks',
    what: 'Feedbacks enviados pelo rodapé',
    cells: { membro: 'Não', lideranca: 'Não', admin: 'Sim' },
  },
  {
    id: 'conhecimento',
    what: 'Base de conhecimento',
    cells: {
      membro: 'Todos, menos rascunhos de outras pessoas',
      lideranca: 'Todos, menos rascunhos de outras pessoas',
      admin: 'Todos, inclusive rascunhos',
    },
  },
  {
    id: 'prompts',
    what: 'Biblioteca de IA',
    cells: { membro: 'Públicos e os seus', lideranca: 'Públicos e os seus', admin: 'Todos' },
  },
  {
    id: 'pessoal',
    what: 'Notas, quadro pessoal e conversas com o assistente',
    cells: { membro: 'Só os seus', lideranca: 'Só os seus', admin: 'Só os seus' },
  },
  {
    id: 'auditoria',
    what: 'Trilha de auditoria',
    cells: { membro: 'Não', lideranca: 'Não', admin: 'Sim' },
  },
  {
    id: 'tokens',
    what: 'Valor de tokens do Jira e do TDN',
    cells: { membro: 'Só o seu', lideranca: 'Só o seu', admin: 'Só o seu' },
  },
];

export interface IntegrationCard {
  id: string;
  title: string;
  icon: ContentIcon;
  /** O que sai do portal. */
  out: string;
  /** Quando sai. */
  when: string;
}

export const INTEGRATIONS: IntegrationCard[] = [
  {
    id: 'jira',
    title: 'Jira e Zephyr',
    icon: 'list',
    out: 'O portal usa o seu token para ler tarefas, sprints e casos de teste no Jira da empresa. O token fica cifrado no servidor.',
    when: 'Ao sincronizar, importar ou abrir telas que usam o Jira, e ao consultar um caso de teste no DevTools.',
  },
  {
    id: 'tdn',
    title: 'TDN',
    icon: 'link',
    out: 'O portal lê os artigos pelo seu token, guardado cifrado no servidor.',
    when: 'Ao importar ou sincronizar um artigo.',
  },
  {
    id: 'ia',
    title: 'Assistente de IA',
    icon: 'sparkles',
    out: 'A sua pergunta, o histórico da conversa e trechos de artigos da Base de conhecimento usados como contexto vão ao serviço de IA: o Google Gemini, ou o serviço de IA da empresa quando você o escolhe. No Poker, o assistente também recebe os dados da tarefa em votação.',
    when: 'Só quando você usa o assistente.',
  },
  {
    id: 'devtools',
    title: 'Consultas do DevTools',
    icon: 'wrench',
    out: 'O CEP vai ao ViaCEP; o IP vai ao ipapi.co; o Cliente HTTP chama a URL que você digitar, com os cabeçalhos e o corpo que você escrever.',
    when: 'Só quando você roda a consulta.',
  },
  {
    id: 'junit',
    title: 'Gerador de JUnit avançado',
    icon: 'sparkles',
    out: 'A classe Java que você cola vai ao Google Gemini, direto do seu navegador, com a chave que você mesmo informou. Essa chave fica guardada neste navegador. O esqueleto local não envia nada.',
    when: 'Só quando você escolhe o motor avançado.',
  },
  {
    id: 'cofre',
    title: 'Cofre do DevTools',
    icon: 'vault',
    out: 'Nada. Os segredos são cifrados no navegador e não saem dele.',
    when: 'Nunca.',
  },
];

export const LIMITATIONS: { id: string; text: string }[] = [
  { id: 'prazo', text: 'Quase nenhum dado tem prazo de guarda definido. O portal não apaga dados de negócio sozinho.' },
  { id: 'exportar', text: 'Exportar ou excluir seus dados é feito pelo time, por chamado. Ainda não é automático.' },
  {
    id: 'navegador',
    text: 'Enquanto você está logado, o navegador guarda a sessão e uma cópia do seu token do Jira em texto claro; Sair apaga as duas. Quem conseguir rodar script nesta página consegue lê-las.',
  },
  {
    id: 'cofre',
    text: 'O Cofre do DevTools vive só neste navegador, cifrado. Se você limpar os dados do navegador, ele se perde.',
  },
  { id: 'sessao', text: 'A sessão dura até 7 dias. Em computador compartilhado, use Sair ao terminar.' },
  { id: 'politicas', text: 'Esta página descreve o portal, não substitui as políticas da empresa.' },
];

export const DATA_REQUEST_TEXT =
  'Quer uma cópia dos seus dados ou a exclusão deles? Hoje isso é atendido pelo time, por chamado. Ainda não existe um botão automático.';

export interface GuideItem {
  id: string;
  title: string;
  text: string;
}

export const GUIDE_ITEMS: GuideItem[] = [
  {
    id: 'para-que-serve',
    title: 'Para que serve',
    text: 'Mostra, em linguagem simples, o que o portal faz com os dados. Cada afirmação foi conferida no sistema.',
  },
  {
    id: 'sem-prazo',
    title: '"Sem prazo definido ainda"',
    text: 'O portal guarda o dado até alguém apagá-lo. Não há regra automática de descarte.',
  },
  {
    id: 'errado',
    title: 'Achou algo errado?',
    text: 'Abra um chamado no Suporte. A data de revisão no topo mostra quando o texto foi conferido pela última vez.',
  },
];

/** Perfil da pessoa para destacar a coluna dela: admin > liderança de alguma squad > membro. */
export function resolveRole(input: { role?: string | null; accessibleProjects?: { leadership?: boolean }[] | null }): RoleId {
  if ((input.role ?? '').toUpperCase() === 'ADMIN') return 'admin';
  if ((input.accessibleProjects ?? []).some((p) => p?.leadership)) return 'lideranca';
  return 'membro';
}
