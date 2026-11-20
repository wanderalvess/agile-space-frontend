import type { ManualBlock } from './types';

export const BRAINSTORMING_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Brainstorming leva a squad de uma chuva de ideias a um plano de ação em cinco etapas. A sessão não termina com ideias soltas: as melhores viram ações com responsável e prazo.',
  },
  { kind: 'h2', text: 'As cinco etapas' },
  {
    kind: 'step',
    title: 'Mural',
    text: 'Cada pessoa lança ideias. Quem facilita pode ocultar o texto até a revelação e esconder os autores, para ninguém ancorar nas ideias dos outros. Para juntar ideias repetidas, use o botão de fusão no cartão: textos e votos se combinam.',
  },
  {
    kind: 'step',
    title: 'Teia',
    text: 'As ideias viram nós que se ligam. Arraste para organizar e ligue uma ideia a outra para mostrar o que puxa o quê.',
  },
  {
    kind: 'step',
    title: 'Grupos',
    text: 'Crie grupos e arraste as ideias para dentro, ou use “Mover para” no cartão. O objetivo é reduzir a repetição e achar os grandes temas.',
  },
  {
    kind: 'step',
    title: 'Matriz',
    text: 'Arraste as ideias para Quick wins, Estratégico, Secundários ou Descartar, pelo retorno e pelo esforço. A prioridade vai para o que dá retorno rápido.',
  },
  {
    kind: 'step',
    title: 'Plano',
    text: 'As melhores ideias viram um plano de ação 5W2H da squad, com quem faz o quê e até quando. Veja [Plano de ação](/manual/action-plan).',
  },
  { kind: 'h2', text: 'Votos e papéis' },
  {
    kind: 'li',
    text: '**Votos:** nas etapas Mural, Teia e Grupos qualquer pessoa vota em quantas ideias quiser, um voto por ideia. Votar de novo tira o voto. Não existe uma etapa só de votação.',
  },
  {
    kind: 'li',
    text: '**Quem facilita (quem criou):** muda de etapa, controla o cronômetro, liga autores anônimos, oculta e revela as ideias, ativa o modo apresentação, renomeia a sessão, remove pessoas e apaga o brainstorming.',
  },
  {
    kind: 'li',
    text: '**Todas as pessoas:** lançam e votam, editam ideias, juntam ideias, criam e apagam grupos, ligam ideias, arrastam na Matriz, criam o plano de ação e exportam.',
  },
  { kind: 'li', text: '**Quem apaga uma ideia:** o autor dela e quem facilita.' },
  {
    kind: 'warn',
    text: 'Só quem facilita troca de etapa. Para as demais pessoas a navegação fica travada, com um cadeado.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Como evito que a primeira ideia influencie as outras?',
    a: 'Peça a quem facilita para ocultar o texto das ideias e esconder os autores no Mural. A revelação acontece quando todos terminarem.',
  },
  {
    kind: 'faq',
    q: 'Para que serve o cronômetro?',
    a: 'Para lançar ideias em rodadas curtas. Isso evita o cansaço criativo e mantém a sessão no ritmo.',
  },
];
