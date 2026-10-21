import { ALERT_BELOW, CRITICAL_BELOW, CRITICAL_WORST_SHARE, STRONG_FROM } from '@/lib/health-check-rules';
import type { ManualBlock } from './types';

const num = (n: number) => String(n).replace('.', ',');
const pct = (n: number) => `${Math.round(n * 100)}%`;

export const HEALTH_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Radar de clima é uma pesquisa rápida e anônima sobre como a squad se sente. Cada pessoa responde sozinha e o resultado só aparece quando quem facilita encerra, para que ninguém seja influenciado pelas respostas dos outros.',
  },
  { kind: 'h2', text: 'Como uma pesquisa funciona' },
  {
    kind: 'step',
    title: 'Crie a pesquisa',
    text: 'Escolha o modelo de perguntas e a escala. Quem cria é quem facilita.',
  },
  {
    kind: 'step',
    title: 'Compartilhe o link',
    text: 'Quem abrir o link, estando logado, entra na sala e responde. Não há bloqueio por squad.',
  },
  {
    kind: 'step',
    title: 'Cada pessoa responde',
    text: 'Uma resposta por pergunta, com comentário opcional. Dá para trocar a resposta até quem facilita encerrar.',
  },
  {
    kind: 'step',
    title: 'Quem facilita encerra',
    text: 'Encerrar é definitivo e pede ao menos um voto. Depois disso ninguém altera respostas e o resultado aparece para todos.',
  },
  {
    kind: 'step',
    title: 'Leia o resultado e crie as ações',
    text: 'O resultado traz a nota de clima, o radar, o que está em atenção e a opção de criar um [Plano de ação](/manual/action-plan) a partir dos pontos críticos.',
  },
  { kind: 'h2', text: 'Escalas e como ler a nota' },
  { kind: 'li', text: '**Semáforo:** Ótimo, Atenção e Ruim. Valem 3, 2 e 1.' },
  { kind: 'li', text: '**Numérica de 1 a 5:** de 1 (crítico) a 5 (muito bom). Cada número vale o próprio valor.' },
  { kind: 'li', text: '**Emocional:** Bom, Médio e Ruim, com rostos. Valem 3, 2 e 1.' },
  {
    kind: 'li',
    text: '**Nota de clima:** vai de 0 a 10 nas três escalas: a pior resposta vale 0 e a melhor, 10. É a média das notas das dimensões.',
  },
  { kind: 'li', text: `**Forte:** dimensão com nota de ${num(STRONG_FROM)} ou mais.` },
  { kind: 'li', text: `**Alerta:** dimensão com nota abaixo de ${num(ALERT_BELOW)}.` },
  {
    kind: 'li',
    text: `**Crítico:** nota abaixo de ${num(CRITICAL_BELOW)}, ou ${pct(CRITICAL_WORST_SHARE)} ou mais dos votos na pior resposta.`,
  },
  { kind: 'h2', text: 'Privacidade' },
  {
    kind: 'li',
    text: '**O que é anônimo:** quem votou e quem comentou. O servidor remove o seu nome do voto antes de mostrar o resultado.',
  },
  {
    kind: 'li',
    text: '**O que a squad vê:** no resultado, todos os votos e comentários, sem nome. Um comentário muito específico pode revelar quem escreveu, então evite detalhes que só você sabe.',
  },
  {
    kind: 'li',
    text: '**Enquanto coleta:** cada pessoa vê só as próprias respostas. Os votos dos outros não chegam ao seu navegador.',
  },
  {
    kind: 'li',
    text: '**Quem entrou:** a lista mostra quem entrou na sala, não quem já respondeu.',
  },
  {
    kind: 'warn',
    text: 'Quem encerra a pesquisa é quem facilita ou um administrador. Depois do encerramento ninguém altera respostas.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Posso ver quem respondeu o quê?',
    a: 'Não. As respostas e os comentários aparecem sem nome. A lista de participantes mostra só quem entrou na sala.',
  },
  {
    kind: 'faq',
    q: 'Com que frequência devo repetir o radar?',
    a: 'A cada três ou quatro sprints costuma ser suficiente para ver a tendência sem cansar a squad.',
  },
];
