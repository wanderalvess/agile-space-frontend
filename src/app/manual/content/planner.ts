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
    text: 'A liderança da squad confere as horas de DEV e QA de cada pessoa. A conta é (dias de codificação ou teste + dias de regressivo) × horas por dia − feriados − ausências, e pode ser multiplicada por um fator de foco. Para não refazer tudo a cada sprint, use **Copiar da sprint anterior**: ele traz a reserva, o foco do time e quem entra na conta (e o foco de cada pessoa), mas não copia ausências, feriados nem tarefas. O botão só aparece para a liderança e enquanto o planejamento está em rascunho.',
  },
  {
    kind: 'step',
    title: 'Escopo',
    text: 'A liderança escolhe as tarefas refinadas, que vêm do Jira, até chegar perto da capacidade, e apresenta ao time. As barras mostram a carga a cada tarefa e não é preciso fechar exato. É preciso ao menos uma tarefa para avançar. Na coluna **Nesta sprint**, a liderança muda a ordem das tarefas com os botões de subir e descer (a lista muda na hora e volta ao que estava se der erro). O cartão da meta mostra a **meta atual no Jira** e, quando você mudou o texto, o “de → para” que será gravado.',
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
  {
    kind: 'li',
    text: '**Nova sprint a partir do Jira:** ao criar o planejamento, o botão **Buscar a próxima sprint do Jira** preenche nome, datas e meta. Você ainda pode editar tudo. Se o Jira não tiver sprint futura, preencha à mão; se faltar o token ou o quadro do Jira, o portal diz o que falta, e se pedir cedo demais ele indica quanto esperar.',
  },
  {
    kind: 'li',
    text: '**Ausências na Distribuição:** os dias de ausência de cada pessoa aparecem hachurados em âmbar na linha dela no cronograma, com o motivo e “dia inteiro” ou o número de horas ao passar o mouse. Os feriados ficam hachurados em cinza.',
  },
  { kind: 'h2', text: 'De onde vêm as horas das tarefas' },
  {
    kind: 'p',
    text: 'O peso de cada tarefa vem das horas no título, que é o texto que o [Scrum Poker](/manual/poker) copia no formato `(DEV 10h / QA 4h)`, mais o Code Review. Sem horas no título, vale a soma das subtarefas do Jira. Uma tarefa sem estimativa aparece com um aviso pedindo o refinamento no Poker.',
  },
  {
    kind: 'p',
    text: '**Regra do Code Review:** o título copiado pelo Poker não inclui o Code Review. Por isso, as horas de DEV de uma tarefa são o título mais o Code Review (a subtarefa de Code Review ou, se não houver, uma hora padrão). O QA conta só o que está no título. A tela mostra a conta, por exemplo “DEV 11 h = título 10 h + Code Review 1 h”.',
  },
  {
    kind: 'p',
    text: '**Classificação por tipo e mapeamento:** a classe de cada subtarefa (DEV, QA, fora da conta ou sem classificação) vem do tipo dela no Jira. Quem mapeia os tipos é a liderança da squad (AM), na seção Tipos de subtarefa da Capacidade; a sprint seguinte herda o mapa. Subtarefas de tipos sem classificação não entram no total, e o Escopo avisa quantas são.',
  },
  {
    kind: 'warn',
    text: 'Quem monta o planejamento é a liderança da squad. As demais pessoas acompanham em leitura e só mexem na Distribuição.',
  },
  {
    kind: 'li',
    text: '**Iniciar a sprint:** na Revisão, o link **Iniciar a sprint no Jira** abre a sprint em uma nova aba. A prévia também mostra a meta atual no Jira e o “de → para” quando ela mudar.',
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
