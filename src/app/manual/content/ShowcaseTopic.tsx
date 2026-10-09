import React from 'react';
import { ManualGuide } from '../components/ManualGuide';

export function ShowcaseTopic() {
  return (
    <ManualGuide
      topicId="showcase"
      accentClass="bg-pink-600"
      quoteTitle="Review sem slides"
      quote="Quem prepara não precisa montar slide. A squad importa as entregas, cada pessoa completa a evidência dos próprios cards e, na cerimônia, o Modo Teatro mostra uma entrega por vez."
      notes={[
        {
          title: 'Quem pode abrir',
          text: 'Uma Review pertence a uma squad, mas qualquer pessoa logada que receba o link consegue abrir e editar. A lista do painel mostra só as Reviews da sua squad.',
        },
        {
          title: 'Quem decide',
          text: 'Aprovar, pedir ajuste ou rejeitar é com quem tem o papel Product Owner ou SME no perfil. Os demais participantes veem o botão desativado.',
        },
      ]}
      sections={[
        {
          title: 'Preparar a Review',
          items: [
            { title: 'Criar', text: 'No painel, “Nova Review” com título, squad e sprint (opcional). O nome da squad filtra a lista do painel: se escrever diferente do nome oficial, a Review some da lista, mas continua acessível pelo link.' },
            { title: 'Configurar', text: 'Nas configurações defina capa, fundo, tema, objetivos da sprint e ordem dos cards. Se tentar iniciar sem objetivos, o sistema avisa uma vez.' },
            { title: 'Importar do Jira', text: 'Traz título, tipo, problema, solução, critérios, dev/QA, horas, versões e links. Cards com a mesma chave não são duplicados. Também dá para criar cards manuais (padrão ou de métricas).' },
            { title: 'Completar os cards', text: 'Cada pessoa preenche problema, solução e evidências dos seus cards (links, imagem, vídeo, até 5 anexos PNG, JPEG ou PDF de 10 MB cada) e marca “Pronta”. Links de documento técnico e TDN são opcionais e só aceitam http(s).' },
            { title: 'Prontidão', text: 'O cabeçalho compara o que está preenchido com o que foi marcado como pronto e sinaliza divergências.' },
          ],
        },
        {
          title: 'Apresentar e encerrar',
          items: [
            { title: 'Modo Teatro', text: 'Tela cheia: capa e depois um card por vez, com navegação por setas e Esc para sair. A apresentação mostra todos os cards, na ordem escolhida, sem os filtros pessoais da lista.' },
            { title: 'Decisão do PO', text: 'Aprovar grava na hora. Ajuste e rejeição abrem um quadro de feedback (pode ficar vazio) antes de confirmar.' },
            { title: 'Finalizar', text: 'Botão no último card. Se houver cards sem decisão, o sistema pede confirmação antes de marcar a Review como finalizada.' },
            { title: 'Exportar', text: 'PDF (capa, indicadores e uma página por card), relatório em Markdown, tabela de aprovações e lista de links do Jira.' },
          ],
        },
      ]}
    />
  );
}
