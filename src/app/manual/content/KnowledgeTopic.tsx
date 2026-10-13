import React from 'react';
import { ManualGuide } from '../components/ManualGuide';
import { ModuleApiToolSection } from '../components/ModuleApiToolSection';

export function KnowledgeTopic() {
  return (
    <ManualGuide
      topicId="knowledge"
      accentClass="bg-cyan-600"
      quoteTitle="Sobre a sua chave de IA"
      quote="Sua chave do Google Gemini fica guardada de forma cifrada no servidor da plataforma e é usada só nas suas perguntas ao Assistente. Você pode trocá-la ou apagá-la nas Configurações a qualquer momento."
      notes={[
        {
          title: 'Quem vê o quê',
          text: 'Os documentos da Base são compartilhados com todas as pessoas logadas. As suas conversas com o Assistente são privadas: só você as vê.',
        },
        {
          title: 'Limites',
          text: 'Arquivo importado: até 20 MB. Documento: até 2 milhões de caracteres. O Assistente lê as suas últimas 20 mensagens e no máximo uns 120 mil caracteres de documentos por pergunta.',
        },
      ]}
      sections={[
        {
          title: 'Wiki: criar e manter documentos',
          description: 'A Base de Conhecimento fica em Conhecimento > Base.',
          items: [
            { title: 'Criar e editar', text: 'O editor é visual (negrito, listas, títulos, código), não Markdown. Título é obrigatório e o documento tem categoria e tags. Qualquer pessoa logada cria documentos; para editar um que já existe, veja “Quem pode editar”.' },
            { title: 'Importar arquivos', text: 'No editor, importe .docx, .txt, .md ou .json. O texto entra no editor para você revisar antes de salvar. PDFs ainda não são aceitos pela tela.' },
            { title: 'Importar do TDN', text: 'Com o token do TDN configurado em Meu Espaço > Conectividade, busque páginas, importe e depois sincronize para atualizar o conteúdo.' },
            { title: 'Ler e baixar', text: 'O leitor mostra um sumário lateral. Você pode baixar em Markdown, HTML ou texto e marcar favoritos (os favoritos ficam só no seu navegador).' },
            { title: 'Quem pode editar', text: 'Todos leem. Editar, apagar e restaurar é do autor do documento, da liderança da squad do documento (Agile Master, People Lead, Product Owner, Tech Lead, Tribe Lead, Agile Coach, SME) e de administradores. Os botões só aparecem para quem pode; se tentar sem permissão, aparece “Só o autor ou a liderança editam este documento.”. Documentos antigos, de antes desta regra, são do autor e dos administradores.' },
            { title: 'Histórico de versões', text: 'Cada mudança de título, conteúdo ou tags guarda uma versão (até 50 por documento). Abra o documento e vá na aba Histórico para ver quem alterou e quando. Quem pode editar restaura uma versão antiga: ela vira uma nova versão e a anterior continua no histórico. O Assistente e a busca usam sempre a versão atual.' },
            { title: 'Lixeira', text: 'Documento apagado vai para a Lixeira e não aparece mais nas buscas. Quem pode editar o documento pode restaurá-lo. Hoje não existe exclusão definitiva automática: ele fica guardado até alguém restaurar.' },
          ],
        },
        {
          title: 'Assistente de IA',
          description: 'Perguntas respondidas com base nos documentos da Base.',
          items: [
            { title: 'Configurar a chave', text: 'Em Conhecimento > Configurações cole a sua chave do Google AI Studio (Gemini). Por enquanto só chaves do Google funcionam; OpenAI e Anthropic aparecem como “Em breve”.' },
            { title: 'Perguntar', text: 'O Assistente procura os documentos mais parecidos com a sua pergunta e responde citando as fontes. A resposta chega inteira, não aos poucos.' },
            { title: 'Sem chave', text: 'Sem chave configurada o sistema só busca nos documentos (e no TDN, se configurado) e mostra os resultados, sem gerar texto.' },
            { title: 'Consumo', text: 'Em Configurações você vê o total de tokens que as suas perguntas usaram. O valor é informado pelo seu navegador e serve de referência de custo, não de cobrança.' },
            { title: 'Cuidado com as respostas', text: 'O Assistente pode errar. Confira o documento citado antes de decidir algo importante.' },
            { title: 'Histórico', text: 'Cada consulta fica na barra lateral. Se o histórico não puder ser salvo, a tela avisa e a conversa vale só até recarregar.' },
          ],
        },
      ]}
    >
      <ModuleApiToolSection moduleId="knowledge" />
    </ManualGuide>
  );
}
