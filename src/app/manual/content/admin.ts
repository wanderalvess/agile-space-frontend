import type { ManualBlock } from './types';

export const ADMIN_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'A Administração é a área de quem cuida do portal: pessoas, aprovações, atendimento, uso, avisos, integrações e configurações. Ela aparece só para administradores, e o servidor também recusa quem não é.',
  },
  {
    kind: 'p',
    text: 'As abas ficam agrupadas na lateral, e cada aba tem o seu próprio endereço, então dá para guardar ou compartilhar o link de uma aba.',
  },
  { kind: 'h2', text: 'Pessoas e acesso' },
  {
    kind: 'li',
    text: '**Usuários e acesso:** lista as pessoas, o nível da conta (Administrador ou Membro) e o estado. Também gera o link de redefinição de senha de quem pediu. Desativar uma conta tira a sessão da pessoa em até 30 segundos, e as chaves de API dela deixam de valer. Nada é apagado e dá para reativar.',
  },
  {
    kind: 'li',
    text: '**Aprovações:** reúne os pedidos que esperam decisão, em abas: os pedidos de vínculo e as redefinições de senha.',
  },
  { kind: 'h2', text: 'Atendimento' },
  {
    kind: 'li',
    text: '**Chamados:** os chamados do [Suporte](/manual/suporte). Aqui o time lê, responde e muda a situação.',
  },
  {
    kind: 'li',
    text: '**Feedbacks e NPS:** os recados enviados pelo botão Feedback do rodapé, com a nota e o comentário. Dá para marcar como lido ou arquivar.',
  },
  { kind: 'h2', text: 'Uso e métricas' },
  {
    kind: 'li',
    text: '**Crescimento e métricas:** a visão geral do uso do portal, com o ranking de utilização.',
  },
  {
    kind: 'li',
    text: '**Analytics de cerimônias:** os números consolidados da sprint, que dependem da sincronização com o Jira.',
  },
  {
    kind: 'li',
    text: '**Histórico de sessões:** as salas de Poker, Retro, Radar de clima, Brainstorming e Planejamento que já aconteceram.',
  },
  { kind: 'h2', text: 'Comunicação' },
  {
    kind: 'li',
    text: '**Anúncios e avisos:** publica avisos que aparecem para todas as pessoas. Início vazio publica agora e fim vazio não expira.',
  },
  {
    kind: 'li',
    text: '**Versões e releases:** publica e edita o que mudou em cada versão, a mesma lista que a página [Versões](/manual/versoes) mostra.',
  },
  { kind: 'h2', text: 'Integrações e IA' },
  {
    kind: 'li',
    text: '**Sincronização Jira:** configura e acompanha a sincronização dos projetos com o Jira.',
  },
  {
    kind: 'li',
    text: '**Motor AI e conhecimento:** acompanha o uso do assistente da Base de conhecimento, como as pessoas que mais consultaram.',
  },
  {
    kind: 'li',
    text: '**API Keys:** vê, cria, renova e revoga as chaves de todo mundo. Veja [Integrações e API](/manual/integracoes).',
  },
  { kind: 'h2', text: 'Sistema' },
  {
    kind: 'li',
    text: '**Configurações:** valem para todas as pessoas que usam o portal, como o nome exibido do sistema e a cor de destaque, que vale só no tema Espaço Clássico.',
  },
  {
    kind: 'li',
    text: '**Auditoria e logs:** o registro de ações sensíveis, como a criação e a revogação de chaves e as mudanças de configuração.',
  },
  {
    kind: 'warn',
    text: 'Quem vira administrador passa a abrir a Administração e a ver todas as squads. Conceda esse nível com cuidado; dá para voltar o nível depois.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Por que uma pessoa não vê a Administração?',
    a: 'Porque a conta dela é Membro. O nível da conta é mudado na aba Usuários e acesso.',
  },
  {
    kind: 'faq',
    q: 'Uma pessoa esqueceu a senha. O que eu faço?',
    a: 'Gere o link de redefinição na aba Usuários e acesso e envie à pessoa. O link vale por 2 horas e só funciona uma vez; ela mesma define a nova senha.',
  },
];
