import React from 'react';
import { ManualGuide } from '../components/ManualGuide';

export function RetroTopic() {
  return (
    <ManualGuide
      topicId="retro"
      accentClass="bg-orange-600"
      quoteTitle="Segurança psicológica"
      quote="Todos assumem que os colegas agiram com as melhores intenções e com as informações disponíveis no momento. Sem caça às bruxas."
      notes={[
        {
          title: 'Sobre o anonimato',
          text: 'Enquanto os cards não são revelados, a tela esconde o texto e o autor dos cards dos outros. É uma proteção da tela, não criptografia: não use a retro para dados realmente sigilosos.',
        },
        {
          title: 'Quem facilita',
          text: 'Quem cria o quadro é o facilitador, e só existe um por vez. Qualquer participante pode assumir o controle quando o facilitador sai.',
        },
      ]}
      sections={[
        {
          title: 'Criar a retrospectiva',
          items: [
            { title: 'Modelo de colunas', text: 'Clássico, Start/Stop/Continue, Mad/Sad/Glad, Starfish, 4Ls, DAKI, Veleiro, Três Porquinhos, Carro de corrida ou Personalizado (2 a 6 colunas, com nomes seus). Em cada coluna personalizada você marca qual é o plano de ação.' },
            { title: 'Opções do facilitador', text: 'Todas começam desligadas: autores abertos, sincronizar a coluna em foco, check-in de humor, revelar cards sozinho quando o tempo acabar e ordenar por votos ao encerrar a votação.' },
            { title: 'Convidar', text: 'Quem recebe o link e está logado entra como participante.' },
          ],
        },
        {
          title: 'Durante a sessão',
          items: [
            { title: '1. Escrever', text: 'Cada pessoa escreve seus cards. Eles ficam ocultos para os outros até a revelação.' },
            { title: '2. Revelar', text: 'O facilitador clica em “Revelar cards”. Pode usar o timer; com a opção ligada, os cards se revelam quando o tempo zera.' },
            { title: '3. Votar', text: 'O facilitador inicia a votação (só depois de revelar). Cada pessoa vota até o limite por coluna; clicar de novo remove o voto. “Resetar votação” apaga todos os votos e pede confirmação.' },
            { title: '4. Agrupar', text: 'O facilitador funde ideias parecidas dentro da mesma coluna: o texto do card de origem vira histórico no destino e os votos se somam sem contar duas vezes a mesma pessoa.' },
            { title: '5. Plano de ação', text: 'Nos cards de ação defina responsável e prazo; qualquer participante pode marcar como feito.' },
            { title: '6. Fechar', text: 'Exporte em PDF, Markdown, texto para o TDN ou CSV. Participantes só exportam depois da revelação.' },
          ],
        },
        {
          title: 'Entre uma retro e outra',
          items: [
            { title: 'Importar ações pendentes', text: 'Traga para o novo quadro as ações não concluídas de retros anteriores da mesma squad; o card mostra quantas vezes ela já foi repetida.' },
            { title: 'Histórico da squad', text: 'Na visão de desempenho da squad você acompanha humor médio, ações feitas e ações recorrentes.' },
            { title: 'Chat e arrastar', text: 'O chat tem canal geral e mensagens diretas. Antes da revelação, cada pessoa move apenas os próprios cards; o facilitador move qualquer um.' },
          ],
        },
      ]}
    />
  );
}
