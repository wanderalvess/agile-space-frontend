import type { ManualBlock } from './types';

export const ACTION_PLAN_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Plano de ação transforma o que a squad decidiu em ações com responsável, prazo e situação. Ele usa o formato 5W2H: para cada ação você diz o quê, por quê, onde, quando, quem, como e quanto.',
  },
  { kind: 'h2', text: 'Criar e preencher' },
  {
    kind: 'step',
    title: 'Crie o plano',
    text: 'Em **Novo plano** informe o título (obrigatório), a squad e, se quiser, a sprint. Planos também nascem das cerimônias: o Brainstorming e o Radar de clima têm um botão para criar o plano a partir do que a squad apontou.',
  },
  {
    kind: 'step',
    title: 'Adicione ações',
    text: 'Use **Nova ação** e preencha os campos. “O quê” e “Quem” são obrigatórios. Os outros ajudam a squad a não esquecer o motivo e o jeito de fazer.',
  },
  {
    kind: 'step',
    title: 'Edite na tabela',
    text: 'Clique numa célula para editar no lugar. Enter salva e Esc cancela. Para editar todos os campos de uma ação de uma vez, use o botão de lápis da linha.',
  },
  {
    kind: 'step',
    title: 'Acompanhe a situação',
    text: 'Clique no status para avançar: A fazer, Em andamento, Concluído e Impedido. Uma ação com prazo vencido e não concluída aparece como atrasada.',
  },
  {
    kind: 'step',
    title: 'Exporte quando precisar',
    text: 'Exporte em Markdown para colar numa página de documentação ou em CSV para uma planilha.',
  },
  { kind: 'h2', text: 'Os sete campos' },
  { kind: 'li', text: '**O quê:** a ação, começando por um verbo. Obrigatório.' },
  { kind: 'li', text: '**Por quê:** o propósito. Sem um bom motivo, talvez a ação não deva existir.' },
  { kind: 'li', text: '**Onde:** sistema, módulo, ambiente ou grupo.' },
  { kind: 'li', text: '**Quando:** o prazo ou a data limite.' },
  { kind: 'li', text: '**Quem:** a pessoa responsável. Se o nome bater com alguém da squad, essa pessoa é avisada.' },
  { kind: 'li', text: '**Como:** os passos ou o método.' },
  { kind: 'li', text: '**Quanto:** o custo ou o esforço, em horas ou valor.' },
  { kind: 'h2', text: 'Compartilhar e atualizar' },
  {
    kind: 'li',
    text: '**Quem tem o link entra:** o plano é aberto a quem recebe o link e está logado, como a Review. Em Configurações do plano você troca o título, vê os participantes e pode apagar o plano.',
  },
  {
    kind: 'li',
    text: '**Atualização:** a página não é ao vivo. O que outra pessoa mudar aparece em até 15 segundos, ou quando você volta para a aba.',
  },
  {
    kind: 'li',
    text: '**Plano da sprint:** a partir do painel da squad, o atalho abre o plano da sprint se ele já existe. Se não existe, leva à criação com a sprint preenchida.',
  },
  {
    kind: 'warn',
    text: 'Duas pessoas editando a mesma célula ao mesmo tempo: vale a última gravação, sem aviso de conflito. Combine quem edita o quê durante a cerimônia.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'A retrospectiva também cria um plano aqui?',
    a: 'Não. As ações da retrospectiva ficam na coluna de ação do próprio quadro. Só o Brainstorming e o Radar de clima criam um plano neste módulo.',
  },
  {
    kind: 'faq',
    q: 'Posso criar o mesmo plano duas vezes a partir de uma cerimônia?',
    a: 'O portal avisa que aquela sessão já gerou um plano e mostra o link dele, para você não repetir.',
  },
  {
    kind: 'faq',
    q: 'Quem pode apagar uma ação?',
    a: 'Quem tem acesso ao plano. A exclusão é feita pela janela de edição da ação e pede confirmação.',
  },
];
