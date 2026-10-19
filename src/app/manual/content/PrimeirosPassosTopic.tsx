import React from 'react';
import { ManualGuide } from '../components/ManualGuide';

export function PrimeirosPassosTopic() {
  return (
    <ManualGuide
      topicId="primeiros-passos"
      accentClass="bg-primary"
      quoteTitle="Regra do produto"
      quote="Ninguém se torna liderança de uma squad por conta própria. O papel vem do vínculo com a squad: do Jira (Profields), de um convite ou de um pedido aprovado por quem lidera."
      notes={[
        {
          title: 'Ainda sem vínculo?',
          text: 'Você vê a tela de espera enquanto não tem squad. Se a sua squad não aparece na busca, peça um convite a quem lidera (Agile Master, Product Owner ou People Lead) ou envie um pedido de vínculo e acompanhe em “Meus pedidos”.',
        },
      ]}
      sections={[
        {
          title: 'Como você entra numa squad',
          items: [
            { title: 'Convite', text: 'Quem recebeu um link usa “Tenho um link de convite” na tela de entrada. O papel já vem definido no convite.' },
            { title: 'Importação do Jira', text: 'Agile Master e People Lead importam as suas squads do Jira (domínio e token digitados uma vez), conferem a prévia, ajustam pessoas e papéis e confirmam. Também dá para criar uma squad sem o Jira.' },
            { title: 'Pedido de vínculo', text: 'Busque a squad pela chave do projeto, pelo nome ou por uma pessoa e peça o vínculo. Quem lidera a squad (Agile Master, Product Owner ou People Lead) confere e aprova. Quem não aparece na lista escolhe o papel de contribuidor: constrói (Developer), testa (QA), desenha (Designer) ou acompanha (Stakeholder/Observador).' },
            { title: 'É você?', text: 'Se o seu nome bate com alguém da lista de uma squad (e essa pessoa não é liderança), o sistema pergunta num clique. Nada muda até você confirmar.' },
          ],
        },
        {
          title: 'Níveis de conta e liderança',
          items: [
            { title: 'Administrador e Membro', text: 'O nível da conta é um só entre dois: Administrador (cuida do portal, dos usuários e das aprovações) ou Membro. Ele não diz o seu cargo.' },
            { title: 'A liderança vem do vínculo', text: 'Ser Agile Master, Product Owner ou People Lead depende do vínculo com cada squad, não da conta. Você pode liderar uma squad e ser contribuidor em outra.' },
            { title: 'Papéis que você escolhe sozinho', text: 'Só os de contribuidor: Developer, QA, Designer e Stakeholder/Observador. Os papéis de liderança não podem ser escolhidos por conta própria.' },
          ],
        },
      ]}
    />
  );
}
