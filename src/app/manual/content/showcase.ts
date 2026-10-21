import type { ManualBlock } from './types';

export const SHOWCASE_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'A Review mostra o que a squad entregou na sprint sem ninguém montar slides. A squad importa as entregas do Jira, cada pessoa completa a evidência dos próprios cards e, na cerimônia, o Modo Teatro mostra uma entrega por vez.',
  },
  { kind: 'h2', text: 'Preparar a Review' },
  {
    kind: 'step',
    title: 'Criar',
    text: 'No painel, use “Nova Review” com título, squad (entre as do seu vínculo) e sprint, que é opcional. A lista do painel é por squad, então a Review aparece na squad escolhida.',
  },
  {
    kind: 'step',
    title: 'Configurar',
    text: 'Nas configurações defina capa, fundo, tema, objetivos da sprint e a ordem dos cards. Se tentar iniciar sem objetivos, o portal avisa uma vez.',
  },
  {
    kind: 'step',
    title: 'Importar do Jira',
    text: 'Traz título, tipo, problema, solução, critérios, DEV e QA, horas, versões e links. Cards com a mesma chave não são duplicados. Também dá para criar cards manuais, padrão ou de métricas.',
  },
  {
    kind: 'step',
    title: 'Completar os cards',
    text: 'Cada pessoa preenche problema, solução e evidências dos seus cards (links, imagem, vídeo e até 5 anexos PNG, JPEG ou PDF de 10 MB cada) e marca “Pronta”. Os links de documento técnico e de TDN são opcionais e só aceitam endereços http ou https.',
  },
  {
    kind: 'step',
    title: 'Conferir a prontidão',
    text: 'A faixa abaixo do cabeçalho compara o que está preenchido com o que foi marcado como pronto e sinaliza divergências. Dali dá para corrigir o status.',
  },
  { kind: 'h2', text: 'Apresentar e encerrar' },
  {
    kind: 'step',
    title: 'Modo Teatro',
    text: 'Tela cheia: a capa e depois um card por vez, com navegação por setas e Esc para sair. A apresentação mostra todos os cards, na ordem escolhida, sem os filtros pessoais da lista. Ao apresentar, a Review fica “Ao vivo”; sair sem finalizar a mantém assim.',
  },
  {
    kind: 'step',
    title: 'Decisão do PO',
    text: 'Aprovar grava na hora. Ajuste e rejeição abrem um quadro de feedback, que pode ficar vazio, antes de confirmar.',
  },
  {
    kind: 'step',
    title: 'Finalizar',
    text: 'O botão está disponível em qualquer card e sempre pede confirmação, avisando quando há cards sem decisão. O resumo pode ser reaberto depois pelo menu Mais, e a Review finalizada pode ser reaberta.',
  },
  {
    kind: 'step',
    title: 'Exportar',
    text: 'PDF (capa, indicadores e uma página por card), relatório em Markdown, tabela de aprovações, lista de links do Jira e impressão dos slides pelo navegador.',
  },
  { kind: 'h2', text: 'Quem pode o quê' },
  {
    kind: 'li',
    text: '**Abrir e editar:** uma Review pertence a uma squad, mas qualquer pessoa logada que receba o link consegue abrir e editar. A lista do painel mostra só as Reviews da sua squad.',
  },
  {
    kind: 'li',
    text: '**Decidir:** aprovar, pedir ajuste ou rejeitar é de quem tem o papel Product Owner ou SME no perfil. Os demais participantes veem o botão desativado.',
  },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Preciso montar slides antes?',
    a: 'Não. O Modo Teatro monta a apresentação com o que está nos cards. Quanto melhor a evidência de cada card, melhor a apresentação.',
  },
  {
    kind: 'faq',
    q: 'Importei do Jira de novo. Os cards vão duplicar?',
    a: 'Não. Cards com a mesma chave do Jira não são duplicados.',
  },
];
