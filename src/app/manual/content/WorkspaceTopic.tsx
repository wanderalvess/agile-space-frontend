import React from 'react';
import { ManualGuide } from '../components/ManualGuide';

export function WorkspaceTopic() {
  return (
    <ManualGuide
      topicId="workspace"
      accentClass="bg-slate-900"
      quoteTitle="Só seu"
      quote="Tudo o que você guarda no Meu Espaço é visível apenas para você. Nem a sua squad nem os administradores veem as suas tarefas, notas, atalhos e snippets."
      notes={[
        {
          title: 'Limites',
          text: 'Até 2.000 itens de cada tipo (tarefas, notas, atalhos, snippets). Notas e snippets aceitam textos longos, mas há um teto; se passar, o sistema avisa.',
        },
        {
          title: 'Busca rápida',
          text: 'Use o botão Busca (ou Ctrl/⌘ + K) para pular entre as abas e criar tarefa, nota ou snippet sem tirar a mão do teclado.',
        },
      ]}
      sections={[
        {
          title: 'As abas do Meu Espaço',
          description: 'Cada aba cuida de uma parte da sua rotina.',
          items: [
            { title: 'Início', text: 'Resumo do dia: tarefas abertas, notas recentes e as últimas cerimônias de que você participou.' },
            { title: 'Kanban', text: 'Três colunas: A Fazer, Em Andamento e Concluído. Arraste o cartão para outra coluna para mudar o status, ou clique nele para editar título, descrição, urgência e status. Dentro da coluna os cartões ficam do mais recente para o mais antigo; a ordem manual ainda não é guardada.' },
            { title: 'Notas', text: 'Mural de notas coloridas. O texto é salvo sozinho poucos segundos depois que você para de digitar (e ao trocar de aba). Dá para fixar uma nota no topo, trocar a cor ou promovê-la a tarefa do Kanban.' },
            { title: 'Histórico', text: 'Poker, retrospectivas e radares de saúde da sua squad em que você participou ou que você criou, com link para reabrir cada um.' },
            { title: 'Perfil', text: 'Seus dados de exibição. Cargo e equipe vêm do Jira ou do convite; você não escolhe papéis de liderança sozinho.' },
            { title: 'Conectividade', text: 'Domínio e token do Jira, dados do TDN e as suas chaves de API pessoais (X-Api-Key), usadas para integrar scripts e agentes com o mesmo acesso que você tem.' },
            { title: 'Atalhos', text: 'Links rápidos com nome, ícone e cor. Só endereços http:// ou https:// são aceitos; se você digitar sem o início, o sistema completa com https://.' },
            { title: 'Prompts e Snippets', text: 'Prompts mostra os seus itens da Biblioteca de IA. Snippets é o seu caderno de código, com destaque de sintaxe por linguagem e botão de copiar.' },
          ],
        },
        {
          title: 'Quando algo dá errado',
          items: [
            { title: 'Erro ao salvar', text: 'Uma mensagem vermelha explica o motivo. Em tarefas e atalhos o diálogo continua aberto com o que você digitou, para tentar de novo.' },
            { title: 'Dados não aparecem', text: 'Se a lista não carregar, o sistema avisa. Recarregue a página; o conteúdo não foi apagado.' },
          ],
        },
      ]}
    />
  );
}
