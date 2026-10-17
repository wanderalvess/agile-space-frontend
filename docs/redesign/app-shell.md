# Base de telas: cabeçalho, rodapé, ícones e template de página

Tudo que uma página que **não é sala** precisa para parecer parte do mesmo portal. Salas ao vivo (Poker, Retro, Brainstorming, Health Check, Showcase, Plano de ação) continuam com o `RoomTopBar` do kit de sala (`src/components/room-kit`).

## O que existe

| Peça | Arquivo | Para quê |
|---|---|---|
| Registro de módulos | `src/lib/modules-registry.ts` | Nome, rota, ícone, grupo e apelidos de cada módulo. Fonte única. |
| Ícone de módulo | `src/components/brand/ModuleIcon.tsx` | `<ModuleIcon module="poker" />` e `moduleIcon('poker')`. |
| Cabeçalho | `src/components/layout/AppHeader.tsx` | Marca, navegação curta, squad ativa, busca, sino, tema e perfil. |
| Rodapé | `src/components/layout/AppFooter.tsx` | Versão, Feedback, Versões, Manual, Segurança e dados, Suporte. |
| Esqueleto | `src/components/page/PageShell.tsx` | AppHeader + miolo (máx. 1680 px) + AppFooter. |
| Cabeçalho da página | `src/components/page/PageHeader.tsx` | Migalha, título, subtítulo, etiquetas e ações. |
| Números do topo | `src/components/page/KpiRow.tsx` | `KpiRow` + `KpiCard`. |
| Barra de dados | `src/components/page/DataToolbar.tsx` | Busca, filtros, contador, ações. |
| Tabela | `src/components/page/DataTable.tsx` | Colunas, cabeçalho fixo, vira cartões em tela estreita, linha expansível. |
| Estados | `src/components/page/States.tsx` | `EmptyState`, `ErrorState`, `LoadingSkeleton`. |
| Coluna lateral | `src/components/page/SidePanelSection.tsx` | `SidePanelSection` e `PageColumns`. |

Tudo é importável de `@/components/page` (exceto o registro, o `ModuleIcon`, o `AppHeader` e o `AppFooter`, que também podem ser usados sem o esqueleto).

## Exemplo mínimo de página

```tsx
'use client';

import { Clock, Users } from 'lucide-react';
import { KpiCard, KpiRow, PageHeader, PageShell } from "@/components/page";
import { ModalButton } from "@/components/room-kit";

export default function MinhaPagina() {
  return (
    <PageShell documentTitle="Minha página">
      <PageHeader
        title="Minha página"
        module="roster" // ícone do módulo ao lado do título (opcional)
        breadcrumb={[{ label: 'Squad', href: '/squad' }, { label: 'Minha página' }]}
        actions={<ModalButton variant="primary">Ação principal</ModalButton>}
      />
      <KpiRow>
        <KpiCard label="Pessoas" value="8" hint="Ativas" icon={Users} />
        <KpiCard label="Horas por dia" value="38h" icon={Clock} />
      </KpiRow>
      {/* DataToolbar + DataTable / EmptyState / ErrorState / LoadingSkeleton ... */}
    </PageShell>
  );
}
```

O layout raiz (`src/app/layout.tsx`) já abre um `<main>`; por isso o `PageShell` usa `<div id="conteudo">` e não cria outro `main`. O layout raiz também esconde o `Header` antigo em quase todas as rotas (lista `isMinimalLayout` em `layout/Header.tsx`): a página que adota o `PageShell` não precisa mexer nisso.

## Props

### `PageShell`

| Prop | Tipo | Padrão | Nota |
|---|---|---|---|
| `documentTitle` | `string` | – | Vira `"{título} \| Portal Tech V&D"` na aba. |
| `feedbackName` | `string` | `documentTitle` | Nome da tela no feedback do rodapé. |
| `width` | `'default' \| 'narrow' \| 'wide'` | `default` | 1680 px (igual à Home), 1120 px, 1920 px. |
| `header` | `AppHeaderProps` | – | Repassado ao `AppHeader`. |
| `footer` | `ReactNode \| false` | `AppFooter` | Rodapé próprio ou nenhum. |
| `backdrop` | `ReactNode` | – | Elemento decorativo atrás do topo (a Home usa um halo). |
| `contentClassName` | `string` | – | Soma ao miolo (padrão: coluna com `gap-5`). |

### `AppHeader`

| Prop | Tipo | Nota |
|---|---|---|
| `squadControl` | `AppHeaderSquadControl \| null` | Padrão: lê a sessão e troca a squad ativa com `switchProject`. A Home passa o dela (com "Todas as squads"). `null` esconde squad e seletor (páginas sem contexto de squad). |
| `search` | `{ query, onQueryChange }` | Com ele a caixa só **filtra** a página (Home). Sem ele a busca **abre o módulo** escolhido (lista com setas, Enter e Esc). |
| `sticky` | `boolean` | Fixa o topo a partir de 1024 px. |

Comportamento:

- Navegação principal (a partir de 1024 px): Home, Squad, Meu espaço, Rituais ▾ (Scrum Poker, Retrospectiva, Review, Radar de clima, Brainstorming) e Admin (só admin). Abaixo de 1024 px vira o botão de menu (gaveta, alvos de 44 px). De 1024 a 1279 px o item Home some (a marca já leva à Home).
- Squad ativa: com **um** vínculo aparece só o nome (rótulo, sem menu, sem seta). Com **dois ou mais** vira seletor e a troca usa `switchProject`. Sem vínculo nenhum não aparece nada.
- Busca: a partir de 1360 px a caixa fica inteira; de 1024 a 1359 px vira botão de lupa que abre a mesma busca; abaixo de 1024 px fica na segunda linha.
- Sino, tema e perfil são os mesmos da Home (`NotificationCenter`, `ThemeToggle`, `ProfileMenu`).

### `AppFooter`

`toolName` (nome da tela no feedback) e `onOpenFeedback` (quem já monta o próprio `FeedbackWidget`, como a Home). Sem `onOpenFeedback`, o rodapé monta e abre o widget sozinho.

### `PageHeader`

`title`, `subtitle`, `breadcrumb: {label, href?}[]` (o último é a página atual), `module` (ícone do módulo), `badges` (etiquetas ao lado do título) e `actions` (botões à direita).

### `KpiRow` / `KpiCard`

`KpiRow columns={2|3|4}` (padrão 4; 1 coluna no celular, 2 em tablet). `KpiCard`: `label`, `value`, `hint`, `icon`, `tone`.

### `DataToolbar`

`search { value, onChange, placeholder, ariaLabel }`, `filters` (use `SelectField` do kit, altura 38), `count { shown, total, noun }`, `actions`.

### `DataTable<T>`

`columns: { id, header, cell(row), width?, align?, primary? }[]`, `rows`, `getRowId`, `ariaLabel`, `renderExpanded?`, `expandedId?`/`onExpandedChange?` (controlado) ou estado interno, `expandLabel?`, `stickyHeader` (cola abaixo do AppHeader a partir de 1024 px), `stackBelow: 'md' | 'lg' | 'xl'` (padrão `xl`: abaixo de 1280 px cada linha vira cartão e cada valor ganha seu rótulo), `empty`, `footer`.

`width` é uma faixa de grid (`"120px"`, `"minmax(0,1.6fr)"`). A coluna `primary` (nome, título) ocupa a linha inteira no modo cartão e vai sem rótulo.

### Estados

- `EmptyState { title, description?, icon?, actions?, embedded? }`
- `ErrorState { title?, description?, onRetry?, retryLabel?, embedded? }` (`role="alert"`)
- `LoadingSkeleton { variant: 'kpis' | 'table' | 'cards' | 'page', rows?, label? }` (`role="status"`, `motion-safe:animate-pulse`)

`embedded` tira a borda tracejada para usar dentro de um cartão/tabela.

## Registro de módulos e ícones

`MODULES` tem 23 módulos: `home`, `painel`, `squad`, `roster` (Time da squad), `workspace` (Meu espaço), `poker`, `retro`, `showcase` (Review), `health` (Radar de clima), `brainstorming`, `action-plan`, `jolt`, `devtools`, `qa`, `sprint-planner` (em breve), `knowledge` (Base de conhecimento), `prompt-hub`, `manual`, `support`, `changelog` (Versões), `governance` (Segurança e dados), `admin`, `settings`.

```ts
import { getModule, moduleIcon, moduleLabel, searchModules, moduleForPath } from '@/lib/modules-registry';
import { ModuleIcon } from '@/components/brand/ModuleIcon';

<ModuleIcon module="poker" className="h-5 w-5 text-primary" />   // ícone decorativo (aria-hidden)
const Icon = moduleIcon('poker');                                 // para IconTile / listas
moduleLabel('governance');                                        // "Segurança e dados"
```

Regras:

1. **Um ícone por módulo**, sempre o do registro (o teste `modules-registry.test.ts` falha se dois módulos usarem o mesmo ícone). Não importe `Rocket`, `Layers` etc. direto para representar um módulo.
2. **Um nome por módulo**: use `moduleLabel(key)` em títulos, menus, migalhas e textos de busca. Nome antigo vai em `aliases` (a busca acha "Biblioteca de IA", "governança", "5W2H").
3. Módulo novo entra no registro e aparece sozinho na busca, na paleta de comandos e (se tiver `home`) no cartão "Todos os módulos".
4. Ícone de linha de 1,5 (`strokeWidth={1.5}`), tokens de cor semânticos, sem logo de produto TOTVS, sem degradê.

Quem lê do registro hoje: Home (`components/home/modules.ts`, `RitualsSection`, `home-ui` `TOOL_ICON`), `lib/integration-catalog.ts`, `components/workspace/CommandPalette.tsx`, menu da conta (`ProfileMenu`), `AppHeader`, `AppFooter`, `ModuleSearch`.

## Regra do nome da squad

> O nome (ou o ID) da squad aparece **uma vez no cabeçalho** (seletor ou rótulo do `AppHeader`) e, no corpo, **só onde o conteúdo é daquela squad**, nunca repetido lado a lado.

Na prática:

- Título da página não leva o nome da squad ("Time da squad", não "Time da squad · DDWMISSI"). O mesmo vale para `document.title`.
- Não coloque selo/chip com o nome da squad ao lado do título.
- Em listas que misturam squads (Home com várias, sessões ao vivo), a etiqueta da squad em cada item é conteúdo daquela squad: pode.
- Em confirmações destrutivas ("Remover Ana da squad X?") o nome fica: ali é a prova do que será afetado.
- Páginas com `?squadId=` na URL precisam acompanhar a troca da squad ativa (veja o efeito em `app/squad/roster/page.tsx`): senão o cabeçalho mostra uma squad e o corpo outra.

### Ocorrências ainda a tratar (outras páginas)

- `/painel` virou a aba Resumo de `/squad` (hub em `PageShell`, título "Squad", sem selo da squad; `SummaryWelcome` só mostra a chave quando difere do nome). Resolvido.
- `layout/RoomHeader.tsx` e `layout/Header.tsx` ainda embutem o `GlobalProjectSelector` (um segundo seletor de squad). Sai quando a página migra para o `AppHeader`.

## Checklist para migrar uma página

1. Troque `<RoomHeader>` / `<Footer>` / `<main>` próprios por `<PageShell>`.
2. Título, migalha e ações em `<PageHeader>`; números em `<KpiRow>`.
3. Busca e filtros em `<DataToolbar>`; listas em `<DataTable>` quando couber.
4. Carregando, vazio e erro com `LoadingSkeleton`, `EmptyState`, `ErrorState` (nunca deixe a tela parecer vazia quando falhou).
5. Tire o nome da squad do título e dos selos (regra acima). Tire o segundo seletor de squad.
6. Ícones de módulo só do registro. Texto com no mínimo 12 px (`text-xs`).
7. Confira 1920, 1440, 1366, 1024 e 375 px; temas padrão, Midnight e TOTVS em claro e escuro; com 1 e com 3 vínculos.
