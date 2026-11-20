import type { ManualBlock } from './types';

export const POKER_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Scrum Poker serve para a squad estimar uma issue em conjunto. Cada pessoa vota em horas pelo seu papel (DEV ou QA), os votos aparecem todos juntos e a squad conversa sobre as diferenças antes de fechar.',
  },
  { kind: 'h2', text: 'Como uma rodada funciona' },
  {
    kind: 'step',
    title: 'Crie a sala',
    text: 'Escolha título, squad, baralho (Fibonacci, Horas ou Camisetas) e o modo, síncrono ou assíncrono. Quem recebe o link e está logado entra na sala.',
  },
  {
    kind: 'step',
    title: 'Monte a fila',
    text: 'Traga as issues da sprint do Jira, cole uma lista ou um CSV, ou adicione as tarefas à mão. Cada tarefa pode ter o link da demanda, os critérios de aceite e notas separadas para DEV e QA.',
  },
  {
    kind: 'step',
    title: 'Inicie o refinamento',
    text: 'Enquanto o refinamento não começa, o baralho fica bloqueado. A sala pode iniciar sozinha quando há uma pessoa de DEV e uma de QA online, se essa opção estiver ligada.',
  },
  {
    kind: 'step',
    title: 'Vote em horas',
    text: 'Quem é DEV vota as horas de desenvolvimento, quem é QA vota as horas de teste. Todos veem quem já votou, mas não o valor. Clicar de novo na mesma carta remove o voto.',
  },
  {
    kind: 'step',
    title: 'Revele e converse',
    text: 'Quem facilita revela os votos. A sala mostra a média de cada papel, o menor e o maior voto. Se a diferença for grande, quem votou menos e quem votou mais explicam o motivo e a squad vota de novo.',
  },
  {
    kind: 'step',
    title: 'Salve e copie a estimativa',
    text: 'Com o consenso, use **Salvar e próxima** para gravar as horas por papel. Depois use **Copiar estimativa**: o portal gera o texto `(DEV 10h / QA 4h)` para você colar no título e no comentário da issue pai, no Jira.',
  },
  {
    kind: 'warn',
    text: 'O portal não cria subtarefas de DEV e QA no Jira. A estimativa vai para a issue pai pelo texto copiado; as notas de DEV e QA ficam na sala.',
  },
  { kind: 'h2', text: 'Quem vota e como a sala decide' },
  {
    kind: 'li',
    text: '**Quem vota:** por padrão, só quem tem o cargo Desenvolvedor(a) ou Analista de QA. O cargo é o definido na administração. Quem facilita escolhe, em “Quem vota” (ao criar a sala ou nas configurações), quais cargos votam; os demais, e quem está sem cargo, entram como observadores: veem a mesa, mas não recebem baralho e não entram na contagem. Espectadores nunca votam.',
  },
  {
    kind: 'li',
    text: '**Revelar e limpar votos:** só quem facilita. O arredondamento da média é para cima por padrão e pode ser mudado nas regras da sala.',
  },
  {
    kind: 'li',
    text: '**Consenso por papel:** quando todas as pessoas do mesmo papel votam igual, a mesa marca o consenso.',
  },
  {
    kind: 'li',
    text: '**Divergência e teto de rodadas:** a sala avisa quando a diferença passa do limite configurado e quando o teto de rodadas acaba sem consenso. Aí a tarefa sai da mesa ou é adiada.',
  },
  {
    kind: 'li',
    text: '**Regras opcionais:** revelar sozinho, iniciar sozinho e mudanças de regra ficam desligadas por padrão. Quem facilita liga só o que a squad quer.',
  },
  { kind: 'h2', text: 'Baralhos' },
  {
    kind: 'li',
    text: '**Horas:** para subtarefas e esforço técnico. O resultado é a média por papel e a cópia sai como `(DEV 10h / QA 4h)`.',
  },
  {
    kind: 'li',
    text: '**Fibonacci:** para histórias de usuário, em complexidade relativa. O resultado também é a média por papel.',
  },
  {
    kind: 'li',
    text: '**Camisetas:** para tamanho relativo. Sem equivalência vale o tamanho mais votado; com equivalência em horas, dias ou semanas, a sala calcula em horas.',
  },
  { kind: 'h2', text: 'Outras opções da sala' },
  {
    kind: 'li',
    text: '**Pular, adiar ou cancelar:** cada tarefa pode ser pulada, adiada (volta ao fim da fila) ou cancelada, e reaberta depois.',
  },
  {
    kind: 'li',
    text: '**Modo assíncrono:** cada pessoa vota quando puder, em qualquer tarefa, e quem facilita revela e consolida tarefa por tarefa. Não há cronômetro nem revelação automática.',
  },
  {
    kind: 'li',
    text: '**Relatório:** ao encerrar a sessão a tela mostra o relatório, com médias, consensos e o histórico das rodadas, e dá para exportar.',
  },
  { kind: 'module-api', moduleId: 'poker' },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Posso mudar meu voto antes de revelar?',
    a: 'Pode. Enquanto os votos estiverem escondidos, escolha outra carta e ela substitui a anterior. Clicar de novo na mesma carta remove o voto.',
  },
  {
    kind: 'faq',
    q: 'E se a squad só tem uma pessoa de QA?',
    a: 'Só ela vota nas horas de QA. O resultado de DEV continua saindo da média de quem votou como DEV.',
  },
  {
    kind: 'faq',
    q: 'Onde vejo as estimativas antigas?',
    a: 'No histórico da sala e no relatório da sessão. O texto copiado para o Jira não muda se você abrir a sala de novo.',
  },
];
