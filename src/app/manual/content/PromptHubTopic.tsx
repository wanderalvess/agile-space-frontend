import React from 'react';
import { ManualGuide } from '../components/ManualGuide';
import { ModuleApiToolSection } from '../components/ModuleApiToolSection';

export function PromptHubTopic() {
  return (
    <ManualGuide
      topicId="prompt-hub"
      accentClass="bg-violet-600"
      quoteTitle="Achar antes de escrever"
      quote="Um bom prompt economiza horas de código e refinamento. Na Biblioteca, a intuição de uma pessoa vira ativo reutilizável para toda a empresa."
      notes={[
        {
          title: 'Visibilidade',
          text: 'Todo item novo nasce privado. Só itens públicos aparecem para os outros. Quem ainda não fez login pode explorar a biblioteca apenas lendo itens públicos.',
        },
        {
          title: 'Links',
          text: 'Links de ferramenta e de documentação só aceitam endereços http:// ou https://.',
        },
      ]}
      sections={[
        {
          title: 'O que dá para guardar',
          items: [
            { title: 'Oito tipos', text: 'Prompt, Skill, Agente, Gem, Instrução, Workflow, MCP e Recurso. O tipo muda os rótulos e o formato esperado do conteúdo.' },
            { title: 'Skills', text: 'Skills precisam do formato SKILL.md (nome e descrição no cabeçalho). Erros de formato bloqueiam a publicação; avisos não. Dá para importar uma pasta inteira de skills de uma vez.' },
            { title: 'Detalhes de iniciativa', text: 'Seção opcional com status, impacto, objetivo de negócio, público-alvo e documentação, para acompanhar iniciativas de IA da empresa.' },
            { title: 'Coleções', text: 'Trilhas ordenadas de itens, privadas ou públicas, para onboarding e temas.' },
          ],
        },
        {
          title: 'Usar um item',
          items: [
            { title: 'Variáveis', text: 'Marque campos com chaves duplas no texto. O detalhe do item mostra um campo para cada variável e o sistema substitui tudo ao copiar.' },
            { title: 'Copiar', text: 'Itens sem variáveis são copiados direto do card. Quem está logado também soma 1 ao contador de uso.' },
            { title: 'Duplicar', text: 'Cria uma cópia privada, “Cópia de …”, para você adaptar, e conta um clone no item original.' },
            { title: 'Favoritar e comentar', text: 'Favoritos ficam salvos no seu navegador. Comentários são abertos a quem enxerga o item.' },
            { title: 'Publicar', text: 'O botão fica travado enquanto salva e, se você fechar com alterações, o sistema pede confirmação. Itens parecidos geram um aviso, sem impedir a publicação.' },
            { title: 'Seus itens', text: 'Editar, arquivar e excluir são do autor do item. Seus itens também aparecem em Meu Espaço > Prompts.' },
          ],
        },
      ]}
    >
      <ModuleApiToolSection moduleId="prompt-hub" />
    </ManualGuide>
  );
}
