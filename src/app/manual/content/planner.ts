import type { ManualBlock } from './types';

export const PLANNER_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Planejamento mostra quanto a squad consegue fazer na sprint e ajuda a escolher e dividir o trabalho. Ele calcula a capacidade em horas de DEV e QA, compara com o que foi puxado e só então cada pessoa pega as suas subtarefas.',
  },
  { kind: 'h2', text: 'As quatro etapas' },
  {
    kind: 'step',
    title: 'Capacidade',
    text: 'A liderança da squad confere as horas de DEV e QA de cada pessoa. A conta é (dias de codificação ou teste + dias de regressivo) × horas por dia − feriados − ausências, e pode ser multiplicada por um fator de foco.',
  },
  {
    kind: 'step',
    title: 'Escopo',
    text: 'A liderança escolhe as tarefas refinadas, que vêm do Jira, até chegar perto da capacidade, e apresenta ao time. As barras mostram a carga a cada tarefa e não é preciso fechar exato. É preciso ao menos uma tarefa para avançar.',
  },
  {
    kind: 'step',
    title: 'Distribuição',
    text: 'Cada pessoa pega as próprias subtarefas e marca as datas, nas abas Minhas, Disponíveis e Equipe. Avançar desta etapa nunca é bloqueado; se houver problemas, o portal mostra avisos.',
  },
  {
    kind: 'step',
    title: 'Revisar e enviar',
    text: 'Vai reunir o resumo, as pendências e a prévia do que seria gravado no Jira. Por enquanto esta etapa só mostra um aviso: o envio ao Jira ainda não está disponível.',
  },
  { kind: 'h2', text: 'Capacidade em detalhe' },
  {
    kind: 'li',
    text: '**Reserva:** são as horas que não entram no escopo, como gestão, reuniões, defeitos e imprevistos. Você escolhe entre “Horas produtivas e fora da conta” (a reserva já sai das horas por dia, por exemplo 6 h de 8 h) e “Fator de foco” (a capacidade é multiplicada pelo fator do time ou da pessoa).',
  },
  {
    kind: 'li',
    text: '**Termômetro de carga:** compara o escopo com a capacidade de DEV e de QA e diz se está com folga, perto do limite ou no limite. Também avisa quando a carga está coberta pela reserva ou acima dela.',
  },
  {
    kind: 'li',
    text: '**Ausências e feriados:** quem lança as ausências é a liderança, combinando com cada pessoa. Os feriados da sprint saem dos dias úteis de todos.',
  },
  {
    kind: 'li',
    text: '**Tipos de subtarefa:** a squad define como cada tipo do Jira conta (DEV, QA, fora da conta). A classe vem do tipo da subtarefa, não do título.',
  },
  { kind: 'h2', text: 'De onde vêm as horas das tarefas' },
  {
    kind: 'p',
    text: 'O peso de cada tarefa vem das horas no título, que é o texto que o [Scrum Poker](/manual/poker) copia no formato `(DEV 10h / QA 4h)`, mais o Code Review. Sem horas no título, vale a soma das subtarefas do Jira. Uma tarefa sem estimativa aparece com um aviso pedindo o refinamento no Poker.',
  },
  {
    kind: 'warn',
    text: 'Quem monta o planejamento é a liderança da squad. As demais pessoas acompanham em leitura e só mexem na Distribuição.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Por que não vejo nenhuma tarefa para escolher?',
    a: 'O Escopo mostra as tarefas em Refinamento Concluído que foram sincronizadas do Jira. Peça à liderança para sincronizar o backlog.',
  },
  {
    kind: 'faq',
    q: 'Duas pessoas editaram ao mesmo tempo. O que acontece?',
    a: 'O portal avisa que o planejamento mudou e recarrega a versão atual. Confira e refaça a sua mudança.',
  },
  {
    kind: 'faq',
    q: 'Posso apagar um planejamento?',
    a: 'Sim, enquanto ele estiver na Capacidade ou no Escopo. Depois que avança, ele não pode mais ser excluído.',
  },
];
