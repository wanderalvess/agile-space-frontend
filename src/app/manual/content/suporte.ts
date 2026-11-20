import type { ManualBlock } from './types';

export const SUPORTE_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Suporte é onde você tira dúvidas, relata erros e sugere melhorias para o time do portal. Cada pedido vira um chamado, e você acompanha a resposta por lá, sem depender de e-mail.',
  },
  { kind: 'h2', text: 'Abrir um chamado' },
  {
    kind: 'step',
    title: 'Escolha o tipo',
    text: 'Em **Nova solicitação** escolha entre Suporte (dúvida de uso ou pedido de ajuda), Bug ou Erro, Sugestão (uma ideia para melhorar o portal) e Elogio (o que está funcionando bem).',
  },
  {
    kind: 'step',
    title: 'Descreva',
    text: 'Dê um assunto curto e conte o que aconteceu: o que você tentou, o que esperava e o que viu. Para um erro, diga em qual tela estava. Quanto mais claro, mais rápida é a resposta.',
  },
  {
    kind: 'step',
    title: 'Envie',
    text: 'O chamado nasce **Aberto** e aparece na sua lista. Ainda não há anexo de arquivo: descreva o que viu com palavras.',
  },
  { kind: 'h2', text: 'Acompanhar e responder' },
  {
    kind: 'step',
    title: 'Veja a lista',
    text: 'A lista mostra os seus chamados, com o tipo, a situação e a última resposta. Filtre por **Todos**, **Abertos** ou **Fechados** e use a busca pelo assunto. Os chamados com resposta nova aparecem em destaque.',
  },
  {
    kind: 'step',
    title: 'Responda',
    text: 'Abra um chamado para ler a conversa e escrever uma nova mensagem. O time recebe a sua resposta e continua por ali.',
  },
  {
    kind: 'step',
    title: 'Feche ou reabra',
    text: 'Se o assunto foi resolvido, use **Fechar chamado**. Um chamado fechado não recebe mensagens novas; para continuar a conversa, use **Reabrir chamado**.',
  },
  {
    kind: 'step',
    title: 'Receba o aviso no sino',
    text: 'Quando o time responde, o sino do cabeçalho avisa e o chamado fica marcado como “Nova resposta”. Não é preciso ficar reabrindo a página.',
  },
  { kind: 'h2', text: 'Situações de um chamado' },
  { kind: 'li', text: '**Aberto:** o chamado foi enviado e espera a primeira resposta.' },
  { kind: 'li', text: '**Em andamento:** o time já respondeu ou está cuidando do assunto.' },
  { kind: 'li', text: '**Fechado:** o assunto terminou. Você pode reabrir quando quiser.' },
  {
    kind: 'warn',
    text: 'Não escreva senhas, tokens ou chaves de API no chamado. O time nunca precisa deles para ajudar.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Quem vê o meu chamado?',
    a: 'Você e o time do portal. Outras pessoas da squad não veem os seus chamados.',
  },
  {
    kind: 'faq',
    q: 'Posso mandar um print?',
    a: 'Ainda não. O Suporte não aceita anexos de arquivo. Descreva a tela e o passo a passo com palavras.',
  },
  {
    kind: 'faq',
    q: 'Qual a diferença entre Suporte e o botão Feedback do rodapé?',
    a: 'O Feedback do rodapé é um recado rápido sobre a tela em que você está. Para uma dúvida que precisa de resposta, abra um chamado aqui.',
  },
];
