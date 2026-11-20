import type { ManualBlock } from './types';

export const WORKSPACE_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Meu espaço é o seu canto no portal. Tudo o que você guarda aqui, como tarefas, notas, atalhos e snippets, é visível só para você. Nem a sua squad nem os administradores veem esses itens.',
  },
  { kind: 'h2', text: 'As abas do Meu espaço' },
  {
    kind: 'step',
    title: 'Início',
    text: 'Resumo do dia: tarefas abertas, notas recentes e as últimas cerimônias de que você participou.',
  },
  {
    kind: 'step',
    title: 'Kanban',
    text: 'Três colunas: A Fazer, Em Andamento e Concluído. Arraste o cartão para outra coluna para mudar o status, ou clique nele para editar título, descrição, urgência e status. Dentro da coluna os cartões ficam do mais recente para o mais antigo; a ordem manual ainda não é guardada.',
  },
  {
    kind: 'step',
    title: 'Notas',
    text: 'Mural de notas coloridas. O texto é salvo sozinho poucos segundos depois que você para de digitar, e ao trocar de aba. Dá para fixar uma nota no topo, trocar a cor ou transformá-la numa tarefa do Kanban.',
  },
  {
    kind: 'step',
    title: 'Biblioteca',
    text: 'Três subabas. **Atalhos** são links rápidos com nome, ícone e cor; só endereços http ou https são aceitos e, se você digitar sem o início, o portal completa com https. **Prompts** mostra os seus itens do [Prompt Hub](/manual/prompt-hub). **Snippets** é o seu caderno de código, com destaque por linguagem e botão de copiar.',
  },
  {
    kind: 'step',
    title: 'Histórico',
    text: 'Poker, retrospectivas e radares de clima da sua squad de que você participou ou que criou, com link para reabrir cada um.',
  },
  {
    kind: 'step',
    title: 'Conta',
    text: 'Duas subabas. **Perfil** tem os seus dados de exibição: cargo e squad vêm do Jira, do convite ou de um pedido de vínculo aprovado, e você não escolhe papéis de liderança sozinho. **Conectividade** guarda o domínio e o token do Jira, os dados do TDN e as suas chaves de API pessoais.',
  },
  { kind: 'h2', text: 'Limites e atalhos' },
  {
    kind: 'li',
    text: '**Limites:** até 2.000 itens de cada tipo (tarefas, notas, atalhos e snippets). Notas e snippets aceitam textos longos, mas há um teto; se passar, o portal avisa.',
  },
  {
    kind: 'li',
    text: '**Busca rápida:** use o botão Busca, ou Ctrl/⌘ + K, para pular entre as abas e criar tarefa, nota ou snippet sem tirar a mão do teclado.',
  },
  {
    kind: 'li',
    text: '**Chaves de API:** na aba Conta, em Conectividade, você gera as chaves pessoais para scripts e agentes. Veja [Integrações e API](/manual/integracoes).',
  },
  { kind: 'h2', text: 'Quando algo dá errado' },
  {
    kind: 'li',
    text: '**Erro ao salvar:** uma mensagem em vermelho explica o motivo. Em tarefas e atalhos a janela continua aberta com o que você digitou, para tentar de novo.',
  },
  {
    kind: 'li',
    text: '**Dados não aparecem:** se a lista não carregar, o portal avisa. Recarregue a página: o conteúdo não foi apagado.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Meu líder consegue ver as minhas notas?',
    a: 'Não. Notas, tarefas, atalhos e snippets são só seus, inclusive para administradores.',
  },
  {
    kind: 'faq',
    q: 'Meus links antigos de abas (atalhos, perfil) pararam de funcionar?',
    a: 'Não. Os endereços das abas antigas continuam levando ao mesmo conteúdo, dentro das abas Biblioteca e Conta.',
  },
];
