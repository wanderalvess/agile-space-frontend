# Biblioteca de IA (Prompt Hub)

## 1. Visão geral

Acervo da empresa para ativos de IA: prompts, skills, agentes, Gems, instruções,
workflows, configurações de MCP e recursos de referência. O objetivo é que uma
pessoa **encontre** o que já existe antes de escrever de novo.

Rota base: `/prompt-hub`.

## 2. Estrutura de arquivos

```
src/app/prompt-hub/
├── page.tsx                    # Landing (visitante) + porta de entrada do dashboard
├── types.ts                    # PromptItem, PromptCollection, PromptFilters
├── constants.tsx               # Fonte única de tipos, status, impacto, visibilidade
├── skillFrontmatter.ts         # Validação do formato SKILL.md (função pura)
├── findSimilar.ts              # Detecção de itens duplicados (função pura)
├── deletePrompt.ts             # Exclusão em cascata (item + comentários + favorito)
├── components/
│   ├── Dashboard.tsx           # Catálogo: busca, filtros, ordenação, destaques
│   ├── PromptCard.tsx          # Card do item
│   ├── PromptEditor.tsx        # Publicação e edição
│   ├── PromptView.tsx          # Detalhe: variáveis, conteúdo, metadados, discussão
│   └── CollectionEditor.tsx    # Montagem de trilhas
├── [id]/page.tsx               # Link compartilhável de um item
├── autor/[authorId]/page.tsx   # Perfil: itens de uma pessoa
├── colecoes/page.tsx           # Lista de coleções
├── colecoes/[id]/page.tsx      # Trilha ordenada
├── tutorial/page.tsx           # Guia de criação de skills (pt-BR)
└── seed/page.tsx               # Carga inicial — restrita a admin, manual
```

`src/components/prompt-hub/PromptGuide.tsx` é o painel lateral "Como usar a
biblioteca". `src/components/workspace/MyPrompts.tsx` reaproveita os componentes
do Hub dentro do workspace.

## 3. Modelo de dados

### 3.1 `prompt_hub/{id}`

Campos principais: `title`, `description`, `content`, `type`, `visibility`,
`tags[]`, `gemLink`, `architectureLink`, `status`, `impact`, `businessGoal`,
`targetAudience`, autoria denormalizada (`authorId`, `authorName`, `authorRole`,
`authorSquad`, `authorAvatar`) e contadores `useCount` / `forkCount`.

Subcoleção `comments/{id}`: discussão do item.

`isFavorited` **não** é persistido no documento — é derivado por usuário.

### 3.2 `users/{uid}/prompt_favorites/{promptId}`

Favoritos são por pessoa. Guardar a estrela no documento do prompt faria o
favorito de um aparecer para todos que enxergam o item.

### 3.3 `prompt_collections/{id}`

`name`, `description`, `itemIds[]` (ordenado), `visibility`, posse
(`ownerId`, `ownerName`, `ownerSquad`).

A coleção guarda apenas IDs: **não concede acesso**. Item privado dentro de uma
trilha pública continua invisível para quem não é o autor.

## 4. Segurança

Regras em `firestore.rules`, bloco `prompt_hub` e `prompt_collections`.

- **Leitura**: item público, ou o autor. Estar autenticado não dá acesso a itens
  privados de terceiros.
- **Criação**: apenas em nome próprio (`authorId == request.auth.uid`).
- **Edição/exclusão**: autor ou admin, sem transferir autoria.
- **Contadores**: qualquer pessoa autenticada pode somar exatamente 1 em
  `useCount` / `forkCount` de item público, e nada além disso.
- **Comentários**: herdam a visibilidade do item pai (custa um `get()` no pai).
  Exclusão permitida ao autor do comentário, ao dono do item e ao admin.

> Ao escrever regras que serão avaliadas em consultas (`list`), evite checagem de
> existência de campo (`'campo' in resource.data`). A análise estática do
> Firestore não consegue prová-la a partir das restrições do `where` e recusa a
> consulta inteira. Use comparação direta.

### Índices necessários

Declarados em `firestore.indexes.json`. Precisam ser publicados —
`firebase deploy --only firestore:indexes` — e levam minutos construindo:

| Coleção | Campos |
|---|---|
| `prompt_hub` | `visibility`, `updatedAt` |
| `prompt_hub` | `authorId`, `updatedAt` |
| `prompt_hub` | `authorId`, `visibility`, `updatedAt` |
| `prompt_collections` | `visibility`, `updatedAt` |
| `prompt_collections` | `ownerId`, `updatedAt` |

## 5. Funcionalidades

**Descoberta** — busca sobre título, descrição, conteúdo, tags e autor; filtro
por categoria com contagem; ordenação por recência, uso, clones ou alfabética;
tags clicáveis; favoritos; destaque de mais utilizados.

**Uso** — cópia direta do card (item com `{{variáveis}}` abre o detalhe para
preencher antes); duplicação para a biblioteca privada; link compartilhável.

**Publicação** — formulário progressivo: o essencial visível, detalhes de
iniciativa recolhidos. Campos de conteúdo mudam conforme o tipo. Skill tem o
formato SKILL.md conferido ao vivo, e erros de formato bloqueiam a publicação.
Itens parecidos são sinalizados antes de publicar, sem bloquear.

**Organização** — coleções ordenadas e perfil por autor.

**Tutorial** — guia em português para criação de skills, com uma seção reservada
para os padrões internos da empresa.

## 6. Limitações conhecidas

- Visibilidade por **squad** e por **cargo** existe no tipo, mas nenhuma consulta
  as carrega. As opções não aparecem no editor.
- Busca e filtros rodam **no cliente**: todo o acervo público é carregado. Não
  escala para centenas de itens sem paginação ou busca server-side.
- Itens com status `arquivado` continuam aparecendo no catálogo.
- Favoritos de terceiros apontando para item excluído ficam órfãos: limpá-los
  exige Cloud Function ou rotina administrativa.
- Não há testes automatizados das regras — o emulador do Firestore exige Java,
  ausente no ambiente atual.

## 7. Stack

Next.js (App Router), TypeScript, Tailwind com tokens semânticos (`bg-card`,
`text-muted-foreground`, `border-border`) para acompanhar tema claro/escuro e as
variantes visuais do app, Firebase Firestore e Auth, Radix UI, lucide-react,
sonner para toasts.
