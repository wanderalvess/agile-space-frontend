import type { ManualBlock } from './types';

export const PRIMEIROS_PASSOS_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'Ninguém se torna liderança de uma squad por conta própria. O papel vem do vínculo com a squad: do Jira (Profields), de um convite ou de um pedido aprovado por quem lidera.',
  },
  { kind: 'h2', text: 'Como você entra numa squad' },
  {
    kind: 'step',
    title: 'Convite',
    text: 'Quem recebeu um link usa “Tenho um link de convite” na tela de entrada. O papel já vem definido no convite.',
  },
  {
    kind: 'step',
    title: 'Importação do Jira',
    text: 'Agile Master e People Lead importam as suas squads do Jira, com o domínio e o token digitados uma vez, conferem a prévia, ajustam pessoas e papéis e confirmam. Também dá para criar uma squad sem o Jira.',
  },
  {
    kind: 'step',
    title: 'Pedido de vínculo',
    text: 'Busque a squad pela chave do projeto, pelo nome ou por uma pessoa e peça o vínculo. Quem lidera a squad (Agile Master, Product Owner ou People Lead) confere e aprova. Quem não aparece na lista escolhe o papel de contribuidor: constrói (Desenvolvedor(a)), testa (Analista de QA), desenha (Designer) ou acompanha (Stakeholder ou Observador).',
  },
  {
    kind: 'step',
    title: 'É você?',
    text: 'Se o seu nome bate com alguém da lista de uma squad, e essa pessoa não é liderança, o portal pergunta num clique. Nada muda até você confirmar.',
  },
  {
    kind: 'warn',
    text: 'Enquanto você não tem squad, aparece a tela de espera. Se a sua squad não aparece na busca, peça um convite a quem lidera (Agile Master, Product Owner ou People Lead) ou envie um pedido de vínculo e acompanhe em “Meus pedidos”.',
  },
  { kind: 'h2', text: 'Níveis de conta e liderança' },
  {
    kind: 'li',
    text: '**Administrador e Membro:** o nível da conta é um só entre dois. Administrador cuida do portal, dos usuários e das aprovações; Membro é todo o resto. O nível não diz o seu cargo.',
  },
  {
    kind: 'li',
    text: '**A liderança vem do vínculo:** ser Agile Master, Product Owner ou People Lead depende do vínculo com cada squad, não da conta. Você pode liderar uma squad e ser contribuidor em outra.',
  },
  {
    kind: 'li',
    text: '**Papéis que você escolhe sozinho:** só os de contribuidor: Desenvolvedor(a), Analista de QA, Designer e Stakeholder ou Observador. Os papéis de liderança não podem ser escolhidos por conta própria.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Meu pedido de vínculo está parado. O que faço?',
    a: 'Quem lidera a squad precisa aprová-lo. Acompanhe em “Meus pedidos” e, se passar do prazo combinado, avise a liderança ou abra um chamado no [Suporte](/support).',
  },
  {
    kind: 'faq',
    q: 'Posso estar em mais de uma squad?',
    a: 'Pode. O papel é por squad. A squad ativa aparece no cabeçalho do portal, e você troca por lá.',
  },
];
