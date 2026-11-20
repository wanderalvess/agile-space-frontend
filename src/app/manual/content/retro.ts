import type { ManualBlock } from './types';

export const RETRO_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'A retrospectiva ajuda a squad a olhar para a sprint que passou e decidir o que muda na próxima. Todos assumem que os colegas agiram com as melhores intenções e com as informações do momento: o assunto é o processo, não as pessoas.',
  },
  { kind: 'h2', text: 'Criar a retrospectiva' },
  {
    kind: 'step',
    title: 'Escolha o modelo de colunas',
    text: 'Clássico, Start/Stop/Continue, Mad/Sad/Glad, Starfish, 4Ls, DAKI, Veleiro, Três Porquinhos, Carro de corrida ou Personalizado (de 2 a 6 colunas, com nomes seus). Em cada coluna personalizada você marca qual é a do plano de ação.',
  },
  {
    kind: 'step',
    title: 'Defina as opções de quem facilita',
    text: 'Todas começam desligadas: autores abertos, sincronizar a coluna em foco, check-in de humor, revelar os cartões sozinho quando o tempo acabar e ordenar por votos ao encerrar a votação.',
  },
  {
    kind: 'step',
    title: 'Convide a squad',
    text: 'Quem recebe o link e está logado entra como participante.',
  },
  { kind: 'h2', text: 'Durante a sessão' },
  {
    kind: 'step',
    title: 'Escrever',
    text: 'Cada pessoa escreve seus cartões. Eles ficam ocultos para os outros até a revelação.',
  },
  {
    kind: 'step',
    title: 'Revelar',
    text: 'Quem facilita clica em “Revelar cards”. Pode usar o cronômetro; com a opção ligada, os cartões se revelam quando o tempo zera.',
  },
  {
    kind: 'step',
    title: 'Votar',
    text: 'Quem facilita inicia a votação, só depois de revelar. Cada pessoa vota até o limite por coluna; clicar de novo remove o voto. “Resetar votação” apaga todos os votos e pede confirmação.',
  },
  {
    kind: 'step',
    title: 'Agrupar',
    text: 'Quem facilita funde ideias parecidas dentro da mesma coluna. O texto do cartão de origem vira histórico no destino e os votos se somam sem contar duas vezes a mesma pessoa.',
  },
  {
    kind: 'step',
    title: 'Montar o plano de ação',
    text: 'Nos cartões de ação defina responsável e prazo. Qualquer participante pode marcar como feito.',
  },
  {
    kind: 'step',
    title: 'Fechar',
    text: 'Exporte em PDF, Markdown, texto para o TDN ou CSV. Participantes só exportam depois da revelação.',
  },
  {
    kind: 'warn',
    text: 'O anonimato é da tela: enquanto os cartões não são revelados, o texto e o autor dos cartões dos outros ficam escondidos. Isso não é criptografia, então não use a retrospectiva para dados realmente sigilosos.',
  },
  { kind: 'h2', text: 'Entre uma retro e outra' },
  {
    kind: 'li',
    text: '**Importar ações pendentes:** traga para o novo quadro as ações não concluídas de retros anteriores da mesma squad. O cartão mostra quantas vezes a ação já foi repetida.',
  },
  {
    kind: 'li',
    text: '**Histórico da squad:** na visão de desempenho da squad você acompanha o humor médio, as ações feitas e as ações recorrentes. Veja em [Painel e Squad](/manual/painel).',
  },
  {
    kind: 'li',
    text: '**Chat e arrastar:** o chat tem canal geral e mensagens diretas. Antes da revelação, cada pessoa move apenas os próprios cartões; quem facilita move qualquer um.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Quem facilita a retrospectiva?',
    a: 'Quem cria o quadro, e só existe uma pessoa por vez. Qualquer participante pode assumir o controle quando quem facilita sai.',
  },
  {
    kind: 'faq',
    q: 'Posso ver quem escreveu cada cartão?',
    a: 'Só se quem facilita ligar a opção de autores abertos ao criar a retrospectiva. Por padrão os autores ficam escondidos.',
  },
];
