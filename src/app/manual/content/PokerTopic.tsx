import React from 'react';
import { ManualGuide } from '../components/ManualGuide';
import { ModuleApiToolSection } from '../components/ModuleApiToolSection';

export function PokerTopic() {
  return (
    <ManualGuide
      topicId="poker"
      accentClass="bg-blue-600"
      quoteTitle="Por que esconder os votos"
      quote="Ao ocultar os votos, forçamos o cérebro a pensar de forma independente. O valor não está no número final, mas na discussão que surge quando as opiniões divergem."
      notes={[
        {
          title: 'Quem vota',
          text: 'Desenvolvedores e QA votam. Gestão só vota se o facilitador liberar “Gestão pode votar”. Espectadores nunca votam. A categoria vem do cargo do seu perfil.',
        },
        {
          title: 'Regras opcionais',
          text: 'Automações (revelar sozinho, iniciar sozinho) e mudanças de regra ficam desligadas por padrão. Quem facilita liga só o que o time quer.',
        },
      ]}
      sections={[
        {
          title: 'Rodada síncrona, passo a passo',
          description: 'Todo mundo na mesma sala, uma tarefa por vez.',
          items: [
            { title: 'Criar a sala', text: 'Escolha título, squad, baralho (Fibonacci, Horas ou Camisetas) e o modo. Quem recebe o link e está logado entra.' },
            { title: 'Montar a fila', text: 'Adicione tarefas à mão, cole uma lista/CSV ou importe do Jira. Cada tarefa pode ter link da demanda e notas com critérios de aceite.' },
            { title: 'Iniciar refinamento', text: 'Antes disso o baralho fica bloqueado. A sala pode iniciar sozinha quando há 1 dev e 1 QA online, se essa opção estiver ligada.' },
            { title: 'Votar em sigilo', text: 'Escolha a carta; clicar de novo na mesma carta remove o voto. Todos veem quem já votou, mas não o valor.' },
            { title: 'Revelar', text: 'O facilitador revela. O sistema mostra consenso, menor e maior voto e a média; o arredondamento padrão é para cima e pode ser mudado.' },
            { title: 'Revotar ou salvar', text: '“Revotar todos” limpa os votos; a revotação parcial refaz só uma categoria. “Salvar e próxima” grava a estimativa, devolve o número ao Jira quando a tarefa tem chave e ativa a próxima.' },
          ],
        },
        {
          title: 'Outras opções',
          items: [
            { title: 'Pular, adiar, cancelar', text: 'Cada tarefa pode ser pulada, adiada (volta ao fim da fila) ou cancelada, e depois reaberta.' },
            { title: 'Modo assíncrono', text: 'Cada pessoa vota quando puder, em qualquer tarefa, e o facilitador revela e consolida tarefa por tarefa. Não há timer nem revelação automática.' },
            { title: 'Estimativa salva', text: 'Em Fibonacci e Horas a estimativa salva é a soma das médias por papel (por exemplo, Developer + QA), e o card avisa quando difere da média geral.' },
            { title: 'Relatório', text: 'Ao encerrar a sessão a tela mostra o relatório; dá para exportar com médias, consensos e histórico das rodadas.' },
          ],
        },
      ]}
    >
      <ModuleApiToolSection moduleId="poker" />
    </ManualGuide>
  );
}
