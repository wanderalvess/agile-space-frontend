import type { ManualBlock } from './types';

export const KNOWLEDGE_CONTENT: ManualBlock[] = [
  {
    kind: 'idea',
    text: 'A Base de conhecimento é a wiki da empresa para guias e manuais, com busca, importação do TDN e um assistente de IA que responde com base nos documentos. Os documentos são compartilhados com todas as pessoas logadas.',
  },
  { kind: 'h2', text: 'Wiki: criar e manter documentos' },
  {
    kind: 'step',
    title: 'Criar e editar',
    text: 'O editor é visual (negrito, listas, títulos, código), não Markdown. O título é obrigatório e o documento tem categoria e tags. Qualquer pessoa logada cria documentos; para editar um que já existe, veja “Quem pode editar”.',
  },
  {
    kind: 'step',
    title: 'Importar arquivos',
    text: 'No editor, importe arquivos .docx, .txt, .md ou .json. O texto entra no editor para você revisar antes de salvar. PDFs ainda não são aceitos.',
  },
  {
    kind: 'step',
    title: 'Importar do TDN',
    text: 'Com o token do TDN configurado em Meu espaço, na aba Conta, em Conectividade, busque páginas, importe e depois sincronize para atualizar o conteúdo.',
  },
  {
    kind: 'step',
    title: 'Ler e baixar',
    text: 'O leitor mostra um sumário lateral. Você pode baixar em Markdown, HTML ou texto e marcar favoritos, que ficam só no seu navegador.',
  },
  {
    kind: 'step',
    title: 'Rascunho e arquivado',
    text: 'Um **Rascunho** só você vê e fica fora da lista, da busca e do assistente até ser publicado. Um artigo **Arquivado** também sai da lista, da busca e do assistente, mas o link continua abrindo e dá para restaurar.',
  },
  { kind: 'h2', text: 'Quem pode editar e o histórico' },
  {
    kind: 'li',
    text: '**Quem pode editar:** todos leem. Editar, apagar e restaurar é do autor do documento, da liderança da squad do documento (Agile Master, People Lead, Product Owner, Tech Lead, Tribe Lead, Agile Coach, SME) e de administradores. Os botões só aparecem para quem pode. Documentos antigos, de antes desta regra, são do autor e dos administradores.',
  },
  {
    kind: 'li',
    text: '**Histórico de versões:** cada mudança de título, conteúdo ou tags guarda uma versão, até 50 por documento. Na aba Histórico você vê quem alterou e quando. Quem pode editar restaura uma versão antiga: ela vira uma nova versão e a anterior continua no histórico.',
  },
  {
    kind: 'li',
    text: '**Lixeira:** um documento apagado vai para a Lixeira e deixa de aparecer nas buscas. Quem pode editar o documento pode restaurá-lo. Hoje não existe exclusão definitiva automática.',
  },
  { kind: 'h2', text: 'Assistente de IA' },
  {
    kind: 'step',
    title: 'Configurar a chave',
    text: 'Em Conhecimento, nas Configurações, cole a sua chave do Google AI Studio (Gemini). Por enquanto só chaves do Google funcionam. A chave fica guardada cifrada no servidor, é usada só nas suas perguntas e você pode trocá-la ou apagá-la quando quiser.',
  },
  {
    kind: 'step',
    title: 'Perguntar',
    text: 'O assistente procura os documentos mais parecidos com a sua pergunta e responde citando as fontes. A resposta chega inteira, não aos poucos.',
  },
  {
    kind: 'step',
    title: 'Sem chave',
    text: 'Sem chave configurada, o portal só busca nos documentos (e no TDN, se configurado) e mostra os resultados, sem gerar texto.',
  },
  {
    kind: 'li',
    text: '**Consumo:** em Configurações você vê o total de tokens que as suas perguntas usaram. É uma referência de custo, não uma cobrança.',
  },
  {
    kind: 'li',
    text: '**Histórico:** cada consulta fica na barra lateral. As suas conversas com o assistente são privadas. Se o histórico não puder ser salvo, a tela avisa e a conversa vale só até recarregar.',
  },
  {
    kind: 'warn',
    text: 'O assistente pode errar. Confira o documento citado antes de decidir algo importante. Limites: arquivo importado de até 20 MB, documento de até 2 milhões de caracteres, e o assistente lê as suas últimas 20 mensagens.',
  },
  { kind: 'module-api', moduleId: 'knowledge' },
  { kind: 'h2', text: 'Dúvidas comuns' },
  {
    kind: 'faq',
    q: 'Posso editar o artigo de outra squad?',
    a: 'Só se você for o autor, da liderança da squad do documento ou administrador. Quem não pode editar não vê os botões de editar, apagar e restaurar.',
  },
  {
    kind: 'faq',
    q: 'Apaguei um documento sem querer. Dá para recuperar?',
    a: 'Dá. Abra a Lixeira e restaure o documento, se você tiver permissão de edição nele. Se não tiver, peça a quem tem.',
  },
];
