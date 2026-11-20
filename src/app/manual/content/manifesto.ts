import type { ManualBlock } from './types';

export const MANIFESTO_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O portal existe para que a squad gaste a energia na conversa, e não na ferramenta. Estes são os princípios que guiam o que entra e como cada tela é feita.',
  },
  { kind: 'h2', text: 'Nossos princípios' },
  {
    kind: 'step',
    title: 'Ajuda em primeiro lugar',
    text: 'Cada módulo traz o seu guia de “Como usar” a um clique do cabeçalho, e este Manual reúne tudo num lugar só. Uma funcionalidade nova não está pronta sem o texto que explica como usá-la.',
  },
  {
    kind: 'step',
    title: 'Privacidade onde ela importa',
    text: 'No Radar de clima, o servidor tira o seu nome do voto antes de mostrar o resultado. Nas cerimônias, votos e cartões ficam escondidos até a revelação, para ninguém copiar a opinião do outro. Cada tela diz com clareza o que é anônimo e o que é só uma proteção visual.',
  },
  {
    kind: 'step',
    title: 'Todo mundo vê a mesma coisa',
    text: 'As salas de cerimônia se atualizam sozinhas, sem recarregar a página, para que a squad inteira discuta sobre o mesmo estado.',
  },
  {
    kind: 'step',
    title: 'O resultado sai da sala',
    text: 'O que a squad decidiu pode ser exportado, em PDF, Markdown ou CSV, ou copiado para o Jira, para não ficar preso na ferramenta.',
  },
  {
    kind: 'step',
    title: 'Os dados são do time',
    text: 'Cada squad vê os próprios dados. O que é pessoal, como as suas notas e tarefas, é só seu. Veja [Segurança e dados](/manual/governance).',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Como sugiro uma melhoria?',
    a: 'Abra um chamado no [Suporte](/support) e escolha o tipo Sugestão. O Manual cresce com as perguntas das squads.',
  },
];
