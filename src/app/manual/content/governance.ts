import type { ManualBlock } from './types';

export const GOVERNANCE_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'Você entra no portal com a sua conta e o portal mantém a sessão por você. Os dados da squad ficam no servidor do portal, e cada pessoa vê apenas as squads de que participa.',
  },
  {
    kind: 'p',
    text: 'Este tópico resume o que importa no dia a dia. A visão completa, com quem vê o quê e o que ainda está em progresso, está na página [Segurança e dados](/governance).',
  },
  { kind: 'h2', text: 'Como o acesso funciona' },
  {
    kind: 'li',
    text: '**Entrada:** o portal tem login próprio, com e-mail e senha. O cadastro aceita só e-mails dos domínios autorizados para o portal.',
  },
  {
    kind: 'li',
    text: '**Sessão renovável:** depois que você entra, o portal identifica você a cada acesso com um token de sessão (JWT). Enquanto você usa o portal, a sessão se renova sozinha, por até 7 dias desde o login. Depois disso, ou se ficar muito tempo parado, o portal pede o login de novo.',
  },
  {
    kind: 'li',
    text: '**Sair:** ao sair, a sessão termina em todos os aparelhos onde você entrou.',
  },
  {
    kind: 'li',
    text: '**Esqueci a senha:** o administrador gera um link de uso único, válido por 2 horas, e você mesmo define a nova senha. Não existe senha temporária. Para trocar a senha por conta própria, use o seu perfil.',
  },
  { kind: 'h2', text: 'Chaves e integrações' },
  {
    kind: 'li',
    text: '**Tokens e chaves cadastrados:** os tokens do Jira e do TDN e a chave de IA da Base de conhecimento ficam guardados cifrados no servidor. Eles não aparecem na tela depois de salvos e só são usados para falar com o serviço que você configurou.',
  },
  {
    kind: 'li',
    text: '**Cópia do token do Jira:** para consultar o Jira, o navegador guarda uma cópia do seu token enquanto você está conectado. Ao sair, essa cópia é apagada.',
  },
  {
    kind: 'li',
    text: '**Chaves de API:** o portal guarda só uma impressão digital de cada chave, mostra a chave inteira uma única vez e permite revogar a qualquer momento. Veja [Integrações e API](/manual/integracoes).',
  },
  {
    kind: 'warn',
    text: 'Nunca cole chaves ou senhas em campos de texto livre, como descrições, comentários e artigos.',
  },
  { kind: 'h2', text: 'O que cada pessoa vê' },
  { kind: 'li', text: 'Os dados de uma squad aparecem só para quem participa dela.' },
  { kind: 'li', text: 'A Base de conhecimento é compartilhada entre todas as squads.' },
  { kind: 'li', text: 'Tarefas, notas, atalhos e snippets do Meu espaço são só seus.' },
  { kind: 'li', text: 'A área de Administração aparece só para administradores.' },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Saí do portal e voltei. Preciso entrar de novo?',
    a: 'Em geral não. Enquanto a sessão estiver válida, o portal reconhece você. Se ela venceu, basta entrar outra vez. Se você clicou em Sair, precisa entrar de novo.',
  },
  {
    kind: 'faq',
    q: 'Alguém da empresa consegue ver minhas chaves?',
    a: 'Não pela tela. As chaves ficam cifradas no servidor e só são usadas para falar com o serviço que você configurou.',
  },
  {
    kind: 'faq',
    q: 'Quero exportar ou excluir os meus dados. Como faço?',
    a: 'Abra um chamado no [Suporte](/support) e explique o que você precisa.',
  },
];
