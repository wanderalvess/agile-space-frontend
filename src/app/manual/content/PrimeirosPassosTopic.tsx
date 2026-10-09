import React from 'react';
import { ManualGuide } from '../components/ManualGuide';

export function PrimeirosPassosTopic() {
  return (
    <ManualGuide
      topicId="primeiros-passos"
      accentClass="bg-indigo-600"
      quoteTitle="Regra do produto"
      quote="Ninguém se torna Agile Master ou People Lead por conta própria. O papel vem do Jira (Profields) ou de convite e ajuste de um administrador."
      notes={[
        {
          title: 'Sem equipe ainda?',
          text: 'Se a sua equipe não aparece na busca, peça a um Agile Master ou People Lead para cadastrá-la, ou use um link de convite.',
        },
      ]}
      sections={[
        {
          title: 'Primeiro acesso',
          items: [
            { title: 'É você?', text: 'Se o seu nome bate com alguém da lista de uma equipe (e essa pessoa não é liderança), o sistema pergunta num clique. Nada muda até você confirmar.' },
            { title: 'Como você usa o Portal?', text: 'Escolha entre “Sou Agile Master ou People Lead” (importa equipes do Jira ou cria uma) e “Participo de uma equipe” (procura uma equipe já cadastrada).' },
            { title: 'Participar', text: 'Busque pela chave do projeto, nome da equipe ou de uma pessoa. Na lista da equipe, marque “Sou eu” na sua linha. Se não estiver nela, escolha um papel: constrói (Developer), desenha (Designer) ou acompanha (Stakeholder/Observador).' },
            { title: 'Link de convite', text: 'Quem recebeu um convite usa “Tenho um link de convite” no rodapé da tela. Quem só quer conhecer o Portal pode seguir em “Só quero dar uma olhada”.' },
          ],
        },
        {
          title: 'Quem cadastra equipes',
          items: [
            { title: 'Agile Master e People Lead', text: 'Importam várias equipes do Jira de uma vez (domínio e token digitados uma vez), conferem a prévia, ajustam pessoas e cargos e confirmam. Também podem criar uma equipe sem o Jira.' },
            { title: 'Administradores', text: 'Também cadastram equipes e ajustam o cargo de outras pessoas.' },
            { title: 'Os demais papéis', text: 'Product Owner, Tech Lead, Developer, QA, Designer, SME e Stakeholder participam, mas não cadastram equipes. Papéis de liderança não podem ser escolhidos por conta própria.' },
          ],
        },
      ]}
    />
  );
}
