import type { ManualBlock } from './types';

export const PROMPT_HUB_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'O Prompt Hub é o acervo da empresa para ativos de IA que valem ser reaproveitados: prompts, skills, agentes, Gems, workflows e iniciativas. Procure o que já existe antes de escrever de novo: um bom prompt economiza horas, e aqui a ideia de uma pessoa vira ativo para todo mundo.',
  },
  { kind: 'h2', text: 'O que dá para guardar' },
  {
    kind: 'li',
    text: '**Oito tipos:** Prompt, Skill, Agente, Gem, Instrução, Workflow, MCP e Recurso. O tipo muda os rótulos e o formato esperado do conteúdo.',
  },
  {
    kind: 'li',
    text: '**Skills:** precisam do formato SKILL.md, com nome e descrição no cabeçalho. Erros de formato bloqueiam a publicação; avisos não. Dá para importar uma pasta inteira de skills de uma vez.',
  },
  {
    kind: 'li',
    text: '**Detalhes de iniciativa:** seção opcional com status, impacto, objetivo de negócio, público-alvo e documentação, para acompanhar iniciativas de IA da empresa.',
  },
  {
    kind: 'li',
    text: '**Coleções:** trilhas ordenadas de itens, privadas ou públicas, para onboarding e temas.',
  },
  { kind: 'h2', text: 'Usar um item' },
  {
    kind: 'step',
    title: 'Preencha as variáveis',
    text: 'Marque campos com chaves duplas no texto. O detalhe do item mostra um campo para cada variável e o portal substitui tudo ao copiar.',
  },
  {
    kind: 'step',
    title: 'Copie',
    text: 'Itens sem variáveis são copiados direto do cartão. Quem está logado também soma 1 ao contador de uso do item.',
  },
  {
    kind: 'step',
    title: 'Duplique para adaptar',
    text: 'Cria uma cópia privada, “Cópia de …”, para você adaptar, e conta um clone no item original.',
  },
  {
    kind: 'step',
    title: 'Favorite e comente',
    text: 'Os favoritos ficam salvos no seu navegador. Os comentários ficam abertos a quem enxerga o item.',
  },
  {
    kind: 'step',
    title: 'Publique',
    text: 'O botão fica travado enquanto salva e, se você fechar com alterações, o portal pede confirmação. Itens parecidos geram um aviso, sem impedir a publicação.',
  },
  { kind: 'h2', text: 'Quem vê e quem edita' },
  {
    kind: 'li',
    text: '**Visibilidade:** todo item novo nasce privado. Só os itens públicos aparecem para os outros. Quem ainda não fez login pode explorar o Prompt Hub apenas lendo itens públicos.',
  },
  {
    kind: 'li',
    text: '**Seus itens:** editar, arquivar e excluir são do autor do item. Os seus itens também aparecem em Meu espaço, na aba Biblioteca, em Prompts.',
  },
  {
    kind: 'li',
    text: '**Links:** os links de ferramenta e de documentação só aceitam endereços http ou https.',
  },
  { kind: 'module-api', moduleId: 'prompt-hub' },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Meu prompt novo sumiu da lista dos outros.',
    a: 'Todo item novo nasce privado. Para os outros verem, mude a visibilidade para público ao publicar.',
  },
  {
    kind: 'faq',
    q: 'Como uso um prompt que tem variáveis?',
    a: 'Abra o item, preencha o campo de cada variável e copie. O texto já sai com os valores no lugar.',
  },
];
