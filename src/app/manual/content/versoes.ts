import type { ManualBlock } from './types';

export const VERSOES_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'A página Versões conta o que mudou no portal a cada atualização, da mais nova para a mais antiga. Quando sai uma versão nova, o portal avisa você uma vez, em qualquer tela.',
  },
  { kind: 'h2', text: 'Ler o que mudou' },
  {
    kind: 'step',
    title: 'Abra Versões',
    text: 'O link **Versões** fica no rodapé de todas as telas, ao lado da versão em uso. A página abre na versão atual, que vem marcada.',
  },
  {
    kind: 'step',
    title: 'Veja o resumo e as mudanças',
    text: 'Cada versão traz um título, uma frase de resumo e a lista de mudanças. Cada mudança é uma novidade, uma melhoria ou uma correção.',
  },
  {
    kind: 'step',
    title: 'Filtre',
    text: 'Use os filtros de tipo (Major, Minor e Patch) e de ano para achar uma versão. As versões aparecem agrupadas por mês.',
  },
  { kind: 'h2', text: 'O aviso de nova versão' },
  {
    kind: 'li',
    text: '**Quando aparece:** quando você entra e existe uma versão que você ainda não viu, um aviso no alto da tela diz “Nova versão” e leva à página Versões.',
  },
  {
    kind: 'li',
    text: '**Uma vez por versão:** depois que você fecha o aviso ou abre a página, ele não volta para aquela versão. O portal lembra isso para o seu usuário.',
  },
  {
    kind: 'li',
    text: '**Versão mais nova que a sua:** se existe uma versão publicada mais nova que a que você está usando, a página mostra que ela já está disponível, com um botão para recarregar a página.',
  },
  {
    kind: 'li',
    text: '**Ponto no rodapé:** enquanto você não leu a versão nova, o item Versões do rodapé mostra um ponto.',
  },
  {
    kind: 'warn',
    text: 'Se o portal não conseguir buscar as versões publicadas, a página avisa que houve falha ao falar com o servidor, em vez de mostrar uma lista vazia.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Qual versão eu estou usando?',
    a: 'A versão aparece no rodapé de todas as telas, ao lado do nome do portal. Na página Versões ela também vem marcada como versão em uso.',
  },
  {
    kind: 'faq',
    q: 'Quem escreve as versões?',
    a: 'O time do portal. Quem administra publica e edita as versões em Administração, na aba Versões e Releases.',
  },
  {
    kind: 'faq',
    q: 'Posso ver as versões sem entrar no portal?',
    a: 'Sim. A página Versões é aberta e mostra as versões publicadas mesmo sem login.',
  },
];
