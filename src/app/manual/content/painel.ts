import type { ManualBlock } from './types';

export const PAINEL_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'A página da squad reúne, em abas, o que a squad precisa ver durante a sprint: o resumo, o quadro do Jira, o cronograma, as métricas e os painéis por papel. Tudo vem do Jira da squad, sincronizado pelo portal.',
  },
  { kind: 'h2', text: 'As abas da squad' },
  {
    kind: 'step',
    title: 'Resumo',
    text: 'A sprint atual com o progresso, os itens parados e atrasados, a próxima cerimônia, o time e os últimos movimentos.',
  },
  {
    kind: 'step',
    title: 'Quadro',
    text: 'O quadro Scrum do Jira da squad, com filtros rápidos e raias. O que você ajusta no quadro (filtros, raias e limites de WIP) fica guardado neste navegador, por squad.',
  },
  {
    kind: 'step',
    title: 'Cronograma',
    text: 'A linha do tempo da sprint, por história ou por pessoa, com as fases do trabalho. Veja a seção abaixo.',
  },
  {
    kind: 'step',
    title: 'Métricas',
    text: 'Duas visões: **Sprint atual**, com o concluído, as horas, os bugs e os itens parados, e **Desempenho do time**, que compara as horas registradas com a capacidade e mostra a composição do escopo.',
  },
  {
    kind: 'step',
    title: 'Painéis',
    text: 'Um painel para cada papel, com os números que importam para ele. Veja a seção “Painéis por papel”.',
  },
  {
    kind: 'li',
    text: '**Sincronizar:** o botão busca os dados no Jira com o seu token pessoal e grava para a squad toda. **Configurar** é onde você conecta o seu Jira; o projeto e o filtro da squad são da liderança.',
  },
  {
    kind: 'li',
    text: '**Seletor de sprint:** mostra uma sprint do histórico, só para leitura. A sincronização só vale na sprint atual.',
  },
  {
    kind: 'li',
    text: '**Time da squad:** em [Time da squad](/squad/roster) ficam as pessoas, os papéis, as horas por dia e a capacidade. A liderança edita; todos veem.',
  },
  { kind: 'h2', text: 'Cronograma com data e hora' },
  {
    kind: 'p',
    text: 'O Cronograma lê o **Data e Hora de Início** e o **Data e Hora de Fim** das subtarefas no Jira da squad. Quem configura a squad escolhe quais campos valem em **Campos de data**, caso o Jira tenha mais de um campo com o mesmo nome.',
  },
  {
    kind: 'step',
    title: 'Com as datas preenchidas',
    text: 'As barras usam as datas e horas do Jira e o portal mostra o que está atrasado ou pode atrasar.',
  },
  {
    kind: 'step',
    title: 'Sem as datas no Jira',
    text: 'Uma faixa avisa quantas subtarefas estão sem data e hora. As barras tracejadas usam a data de criação e a da última edição, que não dizem quando o trabalho deve acontecer, e por isso o portal não declara atraso.',
  },
  {
    kind: 'step',
    title: 'Sugerir pelas horas',
    text: 'Em **Fonte das datas**, escolha “Sugestão pelas horas”. Cada fase começa quando a anterior termina e cada pessoa segue a própria capacidade diária. As barras com contorno são a sugestão do portal e nada é gravado no Jira.',
  },
  {
    kind: 'li',
    text: '**Filtros:** Todas, Atrasadas, Podem atrasar, Em andamento e Minhas, além de busca por chave, título ou pessoa e filtros por tipo, status, responsável e período.',
  },
  {
    kind: 'li',
    text: '**Simulação:** no detalhe de uma fase, “E se esta fase atrasar?” mostra quanto as fases seguintes da história se deslocam. Nada é gravado no Jira e “Limpar simulação” volta ao normal.',
  },
  { kind: 'h2', text: 'Painéis por papel' },
  {
    kind: 'li',
    text: '**Execução:** para quem desenvolve, testa ou desenha. Mostra o seu progresso, as suas tarefas por status e os seus bugs em aberto.',
  },
  {
    kind: 'li',
    text: '**Product Owner:** o que foi entregue em relação aos itens da sprint, o escopo por tipo e o que está em andamento.',
  },
  {
    kind: 'li',
    text: '**Agile Master:** o percentual entregue, os status, os bugs e o atalho para o [Plano de ação](/manual/action-plan).',
  },
  {
    kind: 'li',
    text: '**Tech Lead:** o esforço por tipo, o que espera Code Review ou está em QA e a carga por pessoa.',
  },
  {
    kind: 'li',
    text: '**People Lead:** as horas estimadas contra a capacidade da semana de cada pessoa.',
  },
  {
    kind: 'li',
    text: '**Tribo:** para quem lidera uma tribo, uma linha por squad, com o que foi concluído e o que está atrasado.',
  },
  {
    kind: 'li',
    text: '**Consultas JQL:** painéis com consultas do Jira escritas por você. Ficam guardados neste navegador.',
  },
  {
    kind: 'warn',
    text: 'Quem lidera vê todos os painéis. As demais pessoas veem o painel do próprio papel e as consultas JQL. O painel por papel organiza a leitura, não é uma trava de acesso: todo mundo da squad lê as mesmas issues.',
  },
  { kind: 'module-api', moduleId: 'squad' },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Por que aparece “sem dados desta squad ainda”?',
    a: 'A squad ainda não foi sincronizada com o Jira. Conecte o seu Jira em Configurar e use Sincronizar. O portal nunca mostra 0% inventado: sem dado, ele diz o próximo passo.',
  },
  {
    kind: 'faq',
    q: 'O que o botão Atualizar faz?',
    a: 'Relê o que já está salvo no portal. Para buscar dados novos no Jira, use Sincronizar.',
  },
  {
    kind: 'faq',
    q: 'O cronograma mexe nas datas do Jira?',
    a: 'Não. A sugestão pelas horas e a simulação só existem na tela e nada é gravado no Jira.',
  },
];
